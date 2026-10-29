import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal, PLATFORM_ID } from '@angular/core';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { map, switchMap } from 'rxjs';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import type {
  PharmacyBranchRegistration,
  PharmacyOrganizationRegistration,
} from '../../../core/data-access/iam/iam.types';
import { registrationErrorToViewState } from '../shared-registration/registration-errors';
import { uiLanguage } from '../../../core/i18n/ui-language';
import { loading, ready, validation } from '../../../core/view-state/view-state';
import {
  DIAGNOSIS_CATALOG_NOTICE,
  DiagnosisCenterEnrollment,
  DIAGNOSIS_CODES,
  IncompleteCatalog,
  type DiagnosisCatalogs,
} from '../shared-registration/diagnostic-center-enrollment';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { OnboardingDraftBanner } from '../../../shared/components/molecules/onboarding-draft-banner/onboarding-draft-banner';
import { OnboardingDraftService } from '../../../core/onboarding/onboarding-draft.service';
import type { OnboardingDraft } from '../../../core/onboarding/onboarding-draft.types';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DropzonePdf } from '../../../shared/components/molecules/dropzone-pdf/dropzone-pdf';
import type {
  PdfUploader,
  UploadedDocument,
} from '../../../shared/components/molecules/dropzone-pdf/dropzone-pdf.types';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { BranchBulkImport } from '../../../shared/components/organisms/branch-bulk-import/branch-bulk-import';
import {
  coordinatesFromMapUrl,
  type BranchDraft,
} from '../../../shared/utils/branch-import/branch-import';
import { CustomField } from '../../../shared/components/organisms/paginated-form/custom-field';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import {
  RegistrationHelp,
  type HelpCard,
} from '../../../shared/components/organisms/registration-help/registration-help';
import { AYUDA } from './register-pharmacy.help';
import { paginateFields } from '../../../shared/forms/paginated/paginate-fields';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import {
  notarizedPowerField,
  legalDocumentsFields,
  RECORD_LEGAL_DOCUMENTS,
  type EnrollmentDocumentKey,
} from '../shared-registration/legal-documents';
import { InlineNameFields } from '../shared-registration/inline-name-fields/inline-name-fields';
import {
  nameGroup,
  completeName,
} from '../shared-registration/name-fields/person-name';
import {
  MESSAGE_SHORT_PASSWORD,
  passwordValidators,
} from '../shared-registration/password-policy';
import {
  MapLocationPicker,
  type Coordinates,
  type LocalityFromPoint,
  type TestIds,
} from '../shared-registration/map-location-picker/map-location-picker';
import { RegistrationBadge } from '../shared-registration/registration-badge';
import { addressFromPoint, pointLabel } from '../shared-registration/address-from-point';

/* ============================================================================
    Alta de farmacia — Módulo Farmacia §1 del registro de procesos
    («REGISTRO DE PROCESOS POR MODULO.md», líneas 254-277).

    A diferencia del molde (`RegisterLaboratory`), acá SÍ sale a la red:
    `POST /iam/auth/register-organization` con `tenantType: 'PHARMACY'`
    (decisión D1 del carril de farmacia, 2026-09-29). La estructura de
    páginas y el trato de las sucursales copian la forma del laboratorio; el
    envío copia el mecanismo de `RegisterOrganization` (la aseguradora), que
    es la otra alta que ya usa este mismo endpoint de verdad.
    ========================================================================== */

/**
 * Los ocho tipos societarios que el punto 1.1.1 del registro de procesos
 * pide elegir de una lista cerrada, restringidos a los ocho de Bolivia del
 * diccionario `VS_LEGAL_ENTITY_TYPE` (`core/mock/fixtures/concepts.ts`) —
 * el registro de procesos de farmacia no contempla otro país. Se duplican
 * acá y no se importan de `RegisterLaboratory`: el carril de farmacia no
 * toca el laboratorio más allá de lo que ya vive en `shared-registration/`
 * (ver `README.md` del carril, §5).
 */
const TIPOS_DE_SOCIEDAD: readonly SelectOption<string>[] = [
  { value: 'UNIPERSONAL', label: 'Unipersonal' },
  { value: 'SRL', label: 'S.R.L.' },
  { value: 'LTDA', label: 'Ltda.' },
  { value: 'SA', label: 'S.A.' },
  { value: 'SOCIEDAD_COLECTIVA', label: 'Sociedad colectiva' },
  { value: 'COMANDITA_SIMPLE', label: 'Sociedad en comandita simple' },
  { value: 'COMANDITA_ACCIONES', label: 'Sociedad en comandita por acciones' },
  { value: 'SUCURSAL_EXTRANJERA', label: 'Sucursal de sociedad extranjera' },
];

/** Bolivia es el único país que contempla el registro de procesos de farmacia. */
const PAIS = 'BO';

/** Una sucursal declarada en el alta (punto 1.18). */
export interface SucursalDeFarmacia {
  readonly id: string;
  readonly nombre: string;
  readonly direccion: string;
  readonly descripcion: string;
  /** El enlace de mapa que pegó la persona o que trajo la carga en lote. */
  readonly urlUbicacion: string;
  readonly gps: Coordinates | null;
}

const MAX_NOMBRE = 300;
const MAX_DIRECCION = 300;
const MAX_NIT = 100;
const MAX_CORREO = 320;

/** Dígitos, con o sin guiones: el NIT boliviano es numérico. */
const NIT_VALIDO = /^[0-9][0-9-]{3,19}$/;

/**
 * Las tres gerencias de contacto (1.9-1.17) van como **nueve controles
 * planos**, no como tres `FormGroup` anidados.
 *
 * `app-paginated-form` resuelve cada `campo.key` con `formControlName`, que
 * busca un control **directo** del `FormGroup` raíz — no acepta una ruta con
 * punto (`'generalManager.name'`) como sí haría `FormGroup.get()`. Con
 * subgrupos, cada campo de gerencia lanzaba en el navegador
 * `NG0304: Cannot find control with name: 'generalManager.name'` y la página
 * quedaba con sus tres campos rotos (verificado con Playwright: consola +
 * `<app-paginated-form>` sin los inputs). Mismo motivo por el que
 * `RegisterLaboratory` —el molde— también usa controles planos para sus tres
 * gerencias.
 */

/**
 * **Registro público de una farmacia** (Módulo Farmacia §1 del registro de
 * procesos) — carril A, 2026-09-29.
 *
 * ## Qué es obligatorio, y por qué (decisión D2 del carril)
 *
 * Frena el alta sólo lo más básico para nacer: **razón social, tipo de
 * sociedad, NIT, el punto de la central en el mapa —del que sale su dirección
 * legal—, nombre y correo del representante legal, correo de acceso y
 * contraseña**. El resto —los seis papeles en PDF, las sucursales y las tres
 * gerencias— se completa después desde la Ficha de la farmacia.
 *
 * El punto es obligatorio por pedido del cliente (26/10/2026): la persona sólo
 * marca el punto, y la calle, el municipio y la zona se deducen de él, sin
 * editarse.
 *
 * Es la regla explícita del propietario para este alta: «lo obligatorio es
 * lo más básico», a diferencia del alta de laboratorio (el molde de
 * estructura) y de aseguradora, donde el registro de procesos exige más
 * papeles desde el día uno.
 *
 * ## Con qué correo se entra
 *
 * El registro de procesos no pide un correo de acceso *distinto* del
 * representante legal (no hay un punto «correo de acceso» separado en la
 * fuente): el correo del representante (1.8.2) es el mismo con el que se
 * inicia sesión, igual que decide el molde de laboratorio en su página
 * «Representante legal» («Con este correo se entra»). Por eso «Tu acceso»
 * sólo pide la contraseña.
 */
@Component({
  selector: 'app-register-pharmacy',
  imports: [RegistrationBadge, 
    BranchBulkImport,
    NgTemplateOutlet,
    RouterLink,
    Link,
    AppButton,
    AppInput,
    NavIcon,
    Tooltip,
    FormField,
    AuthSplit,
    AnnounceOnAppear,
    Alert,
    PaginatedForm,
    CustomField,
    RegistrationHelp,
    MapLocationPicker,
    DropzonePdf,
    InlineNameFields,
    OnboardingDraftBanner,
  ],
  templateUrl: './register-pharmacy.html',
  styleUrls: ['../shared-registration/registration.css', './register-pharmacy.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPharmacy {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly draftService = inject(OnboardingDraftService);
  private readonly iam = inject(IamClient);
  /** Resuelve del catálogo los conceptos de país y jurisdicción que la API exige. */
  private readonly alta = inject(DiagnosisCenterEnrollment);
  private readonly router = inject(Router);

  readonly borradorDetectado = signal<OnboardingDraft | null>(null);
  readonly pasoGuardado = signal<number>(0);

  readonly form = new FormGroup({
    // --- 1.1 · la empresa ---------------------------------------------------
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    companyType: new FormControl<string | null>(null, { validators: [Validators.required] }),
    // --- 1.2 · el NIT --------------------------------------------------------
    taxId: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(MAX_NIT),
        Validators.pattern(NIT_VALIDO),
      ],
    }),
    // --- 1.1.2, 1.2.1, 1.3, 1.4, 1.5, 1.8.1 · los seis papeles, todos opcionales
    constitutionFileId: new FormControl('', { nonNullable: true }),
    taxIdentifierFileId: new FormControl('', { nonNullable: true }),
    commerceRegistryFileId: new FormControl('', { nonNullable: true }),
    operatingLicenseFileId: new FormControl('', { nonNullable: true }),
    healthAuthorityCertificateFileId: new FormControl('', { nonNullable: true }),
    powerOfAttorneyFileId: new FormControl('', { nonNullable: true }),
    // --- 1.6 · dirección legal de la central ---------------------------------
    // No se escribe (pedido del cliente del 26/10/2026): la deduce el punto de
    // la central, ver `escribirLocalidadCentral`. Sigue obligatoria porque la
    // API la exige, y nunca queda vacía con un punto puesto.
    addressLines: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_DIRECCION)],
    }),
    // **El punto de la central es obligatorio** (mismo pedido). Vive en el
    // formulario porque el motor valida de a una página y sólo frena lo que
    // está en el `FormGroup`. Lo escribe `fijarGpsCentral` con el punto
    // CONFIRMADO, y vuelve a `null` si se quita o se mueve el pin.
    gpsCentral: new FormControl<Coordinates | null>(null, {
      validators: [Validators.required],
    }),
    // --- 1.8, 1.8.2 · representante legal -------------------------------------
    // Un grupo con las partes del nombre (primer nombre y apellido paterno obligatorios).
    legalRepName: nameGroup(true),
    // La API exige el documento del representante legal (4 a 50 caracteres).
    legalRepIdNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4), Validators.maxLength(50)],
    }),
    legalRepEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(MAX_CORREO)],
    }),
    // --- 1.9 a 1.17 · las tres gerencias, todas opcionales (nueve controles
    // planos: ver el JSDoc sobre `controlesDeGerencia` más arriba en el archivo) ---
    generalManagerName: nameGroup(false),
    generalManagerPhone: new FormControl('', { nonNullable: true, validators: [telefonoCompleto] }),
    generalManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(MAX_CORREO)],
    }),
    commercialManagerName: nameGroup(false),
    commercialManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    commercialManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(MAX_CORREO)],
    }),
    marketingManagerName: nameGroup(false),
    marketingManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    marketingManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(MAX_CORREO)],
    }),
    // --- la cuenta -------------------------------------------------------------
    password: new FormControl('', { nonNullable: true, validators: [...passwordValidators] }),
  });

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');
  readonly registered = signal(false);
  readonly verificationSent = signal(false);

  readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') return state.issues[0]?.message ?? null;
    if (state.status === 'offline')
      return 'No pudimos conectarnos. Revise su conexión y reintente.';
    if (state.status === 'error')
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    return null;
  });

  /** Los cinco papeles de la empresa, en el orden del registro de procesos. */
  private readonly camposDeDocumentos = legalDocumentsFields(PAIS, uiLanguage(), false);

  /**
   * El poder del representante (1.8.1) no va con los papeles de la empresa:
   * se pide en la misma página que el representante, junto a quien lo firma.
   */
  private readonly campoDelPoder = computed(() =>
    notarizedPowerField(PAIS, uiLanguage(), this.poderObligatorio()),
  );

  readonly paginas = computed<readonly PaginaDeFormulario[]>(() =>
    paginateFields([
      {
        titulo: 'La empresa',
        clave: 'empresa',
        icon: 'building' as const,
        hint: 'Los datos con los que su farmacia está inscrita.',
        campos: [
          {
            key: 'legalName',
            label: 'Nombre o razón social',
            control: 'text' as const,
            required: true,
            icono: 'building' as const,
            placeholder: 'Farmacia San Martín S.R.L.',
            testId: 'registro-farmacia-razon-social',
            mensajeDeError: 'Escriba el nombre o la razón social de la farmacia.',
          },
          {
            key: 'companyType',
            label: 'Tipo de sociedad',
            hint: 'El que figura en su matrícula de comercio.',
            control: 'select' as const,
            options: TIPOS_DE_SOCIEDAD,
            required: true,
            icono: 'labels' as const,
            placeholder: 'Elija el tipo de sociedad',
            testId: 'registro-farmacia-tipo-sociedad',
            mensajeDeError: 'Elija el tipo de sociedad.',
          },
          {
            key: 'taxId',
            label: 'Número de NIT',
            hint: 'Sólo números. Es el que va a salir en las facturas.',
            control: 'text' as const,
            required: true,
            icono: 'billing' as const,
            placeholder: '1023456789',
            testId: 'registro-farmacia-nit',
            mensajeDeError: 'Escriba el NIT: sólo números, al menos cuatro dígitos.',
          },
        ],
      },
      {
        titulo: 'Los papeles de la farmacia',
        clave: 'documentos',
        icon: 'folder' as const,
        hint: 'Opcionales: puede completarlos después desde la Ficha de su farmacia. PDF, hasta 10 MB por archivo.',
        sinPartir: true,
        campos: this.camposDeDocumentos,
      },
      {
        titulo: 'Dónde está la central',
        clave: 'ubicacion',
        icon: 'pin' as const,
        // Sólo el punto: la calle, el departamento, el municipio y la zona
        // salen de él y el selector los muestra sin dejarlos editar.
        campos: [
          {
            key: 'gpsCentral',
            label: 'Ubicación de la central en el mapa',
            hint: 'Marque el punto exacto de la central. De ahí sacamos la calle, el municipio y la zona.',
            control: 'custom' as const,
            required: true,
            mensajeDeError: 'Marque el lugar en el mapa y pulse «Confirmar dirección actual».',
          },
        ],
      },
      {
        titulo: 'Sus sucursales',
        clave: 'sucursales',
        icon: 'hospital' as const,
        hint: 'Si sólo atiende en la central, siga de largo.',
        campos: [{ key: 'sucursales', label: 'Sucursales (opcional)', control: 'custom' as const }],
      },
      {
        titulo: 'Representante legal',
        clave: 'representante',
        icon: 'shield' as const,
        campos: [
          {
            // Sin rótulo ni error propios: `app-inline-name-fields` pinta cada casilla
            // con el suyo, y un `<label for>` externo apuntaría a un control que no existe.
            key: 'legalRepName',
            label: '',
            control: 'custom' as const,
            mensajeDeError: '',
          },
          {
            key: 'legalRepIdNumber',
            label: 'Documento de identidad del representante',
            hint: 'Cédula de identidad o documento equivalente.',
            control: 'text' as const,
            required: true,
            icono: 'people' as const,
            testId: 'registro-farmacia-representante-documento',
            mensajeDeError: 'Escriba el documento del representante (al menos cuatro caracteres).',
          },
          {
            key: 'legalRepEmail',
            label: 'Correo del representante legal',
            hint: 'Con este correo va a entrar a la plataforma.',
            control: 'email' as const,
            required: true,
            icono: 'mail' as const,
            autocomplete: 'username',
            testId: 'registro-farmacia-representante-correo',
            mensajeDeError: 'Escriba un correo válido: es el usuario de la cuenta.',
          },
          this.campoDelPoder(),
        ],
      },
      ...this.paginasDeGerencia(),
      {
        titulo: 'Su acceso',
        clave: 'acceso',
        icon: 'lock' as const,
        hint: 'Entra con el correo del representante legal y esta contraseña.',
        campos: [
          {
            key: 'password',
            label: 'Contraseña',
            hint: 'Al menos 8 caracteres.',
            control: 'password' as const,
            required: true,
            icono: 'lock' as const,
            autocomplete: 'new-password',
            testId: 'registro-farmacia-password',
            mensajeDeError: MESSAGE_SHORT_PASSWORD,
          },
        ],
      },
    ]),
  );

  /** Las tres gerencias, como tres páginas propias — mismo patrón que el molde de laboratorio. */
  private paginasDeGerencia(): readonly {
    readonly titulo: string;
    readonly clave: string;
    readonly icon: 'briefcase' | 'chart' | 'megaphone';
    readonly hint: string;
    readonly campos: readonly {
      readonly key: string;
      readonly label: string;
      readonly control: 'custom' | 'tel' | 'email';
      readonly icono?: 'people' | 'mail';
      readonly testId: string;
      readonly mensajeDeError?: string;
    }[];
  }[] {
    const gerencias: readonly {
      readonly key: 'generalManager' | 'commercialManager' | 'marketingManager';
      readonly titulo: string;
      readonly clave: string;
      readonly icon: 'briefcase' | 'chart' | 'megaphone';
      readonly hint: string;
      readonly prefijoTestId: string;
    }[] = [
      {
        key: 'generalManager',
        titulo: 'Gerencia general',
        clave: 'gerencia-general',
        icon: 'briefcase',
        hint: 'Todo este paso es opcional: puede completarlo después.',
        prefijoTestId: 'registro-farmacia-gerente-general',
      },
      {
        key: 'commercialManager',
        titulo: 'Gerencia comercial',
        clave: 'gerencia-comercial',
        icon: 'chart',
        hint: 'Opcional. Es a quien le llega el resumen de ventas.',
        prefijoTestId: 'registro-farmacia-gerente-comercial',
      },
      {
        key: 'marketingManager',
        titulo: 'Gerencia de marketing',
        clave: 'gerencia-marketing',
        icon: 'megaphone',
        hint: 'Opcional. Es con quien se coordinan las promociones.',
        prefijoTestId: 'registro-farmacia-gerente-marketing',
      },
    ];

    return gerencias.map((gerencia) => ({
      titulo: gerencia.titulo,
      clave: gerencia.clave,
      icon: gerencia.icon,
      hint: gerencia.hint,
      campos: [
        {
          // Controles planos (`${key}Name`, no `${key}.name`): ver el JSDoc
          // sobre `controlesDeGerencia`, más arriba en el archivo.
          key: `${gerencia.key}Name`,
          label: '',
          control: 'custom' as const,
          mensajeDeError: '',
          testId: gerencia.prefijoTestId,
        },
        {
          key: `${gerencia.key}Phone`,
          label: 'Celular',
          control: 'tel' as const,
          testId: `${gerencia.prefijoTestId}-celular`,
          mensajeDeError: 'El número está incompleto.',
        },
        {
          key: `${gerencia.key}Email`,
          label: 'Correo',
          control: 'email' as const,
          icono: 'mail' as const,
          testId: `${gerencia.prefijoTestId}-correo`,
          mensajeDeError: 'Escriba un correo válido o déjelo vacío.',
        },
      ],
    }));
  }

  /* --- documentos legales (dropzone real, con `fileId`) -------------------- */

  /** Cómo sube cada `app-dropzone-pdf`: mismo endpoint de pre-carga pública que usa la aseguradora. */
  protected readonly subirDocumento: PdfUploader = (file) =>
    this.iam.uploadRegistrationDocument(file);

  /** Lo ya subido por cada dropzone, para sobrevivir a que el asistente destruya y recree la página. */
  protected readonly documentosSubidos = signal<
    Partial<Record<EnrollmentDocumentKey, UploadedDocument>>
  >({});

  protected registrarDocumento(clave: EnrollmentDocumentKey, fileId: string | null): void {
    this.form.controls[clave].setValue(fileId ?? '');
    if (fileId === null) {
      this.documentosSubidos.update((actual) => {
        const { [clave]: _omitido, ...resto } = actual;
        return resto;
      });
    }
  }

  protected recordarDocumento(clave: EnrollmentDocumentKey, documento: UploadedDocument): void {
    this.documentosSubidos.update((actual) => ({ ...actual, [clave]: documento }));
  }

  protected documentoInicialDe(clave: EnrollmentDocumentKey): UploadedDocument | null {
    return this.documentosSubidos()[clave] ?? null;
  }

  /** El rótulo ya resuelto del documento (sin el sufijo «(opcional)», acá es siempre opcional). */
  protected etiquetaDeDocumento(clave: EnrollmentDocumentKey): string {
    const campo = [...this.camposDeDocumentos, this.campoDelPoder()].find((c) => c.key === clave);
    return campo?.label.replace(' (opcional)', '') ?? 'Documento';
  }

  protected readonly clavesDeDocumento: readonly EnrollmentDocumentKey[] = [
    ...RECORD_LEGAL_DOCUMENTS.map((d) => d.key),
    'powerOfAttorneyFileId',
  ];

  /* --- la ubicación de la central -------------------------------------------- */

  /**
   * El punto confirmado de la central. Alimenta el `[inicial]` del selector;
   * el control homónimo del formulario es el que lo hace obligatorio. Los dos
   * los escribe {@link fijarGpsCentral}.
   */
  readonly gpsCentral = signal<Coordinates | null>(null);
  /** El tipo societario elegido: decide si el poder del representante es obligatorio. */
  private readonly tipoSocietario = toSignal(this.form.controls.companyType.valueChanges, {
    initialValue: this.form.controls.companyType.value,
  });

  /**
   * La API exige el poder notariado del representante salvo a una empresa
   * unipersonal (BR-09, 422 «sólo una empresa unipersonal puede omitirlo»).
   * Mismo criterio que imagenología: sin tipo elegido todavía, no se exige.
   */
  private poderObligatorio(): boolean {
    const tipo = this.tipoSocietario();
    return tipo !== null && tipo !== 'UNIPERSONAL';
  }

  /** Guarda el borrador del avance del formulario en caché y backend. */
  guardarBorrador(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const paginas = this.paginas();
      const clave = this.claveVisible();
      const indice = Math.max(0, paginas.findIndex((p) => p.clave === clave));
      const titulo = paginas[indice]?.titulo ?? clave;
      const raw = this.form.getRawValue();
      const extraData = {
        gpsCentral: this.gpsCentral(),
        sucursales: this.sucursales(),
        documentosSubidos: this.documentosSubidos(),
      };
      this.draftService.saveProgress(
        'pharmacy',
        indice,
        clave,
        titulo,
        raw,
        extraData,
        paginas.length,
      );
      this.draftService.trackEvent('step_view', 'pharmacy', indice, {
        stepKey: clave,
      });
    } catch {
      // Ignorar
    }
  }

  /** Restaura el avance previo del formulario desde caché si existe. */
  restaurarBorrador(draftParam?: OnboardingDraft): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const draft = draftParam ?? this.draftService.detectDraft('pharmacy');
      if (!draft) return;
      if (draft.data) {
        this.form.patchValue(draft.data);
      }
      const extra = (draft.extraData ?? {}) as Record<string, unknown>;
      if (extra['gpsCentral'] !== undefined) {
        this.fijarGpsCentral(extra['gpsCentral'] as Coordinates | null);
      }
      if (Array.isArray(extra['sucursales'])) {
        this.sucursales.set(extra['sucursales'] as readonly SucursalDeFarmacia[]);
      }
      if (extra['documentosSubidos'] && typeof extra['documentosSubidos'] === 'object') {
        this.documentosSubidos.set(
          extra['documentosSubidos'] as Partial<Record<EnrollmentDocumentKey, UploadedDocument>>,
        );
      }
      if (typeof draft.stepIndex === 'number' && draft.stepIndex >= 0) {
        this.pasoGuardado.set(draft.stepIndex);
      }
      this.borradorDetectado.set(null);
    } catch {
      // Ignorar
    }
  }

  /** Descarta el borrador y limpia el estado. */
  descartarBorrador(): void {
    this.limpiarBorrador();
    this.draftService.trackEvent('abandon', 'pharmacy', 0);
  }

  /** Elimina el borrador en caché al completar exitosamente el registro. */
  limpiarBorrador(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.draftService.clearDraft('pharmacy');
      this.borradorDetectado.set(null);
    } catch {
      // Ignorar
    }
  }

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const detectado = this.draftService.detectDraft('pharmacy');
      if (detectado && (detectado.stepIndex > 0 || Object.keys(detectado.data).length > 2)) {
        this.borradorDetectado.set(detectado);
      }
      this.draftService.trackEvent('start', 'pharmacy', 0);
    }

    this.form.controls.companyType.valueChanges.pipe(takeUntilDestroyed()).subscribe((tipo) => {
      const poder = this.form.controls.powerOfAttorneyFileId;
      if (tipo === null || tipo === 'UNIPERSONAL') {
        poder.removeValidators(Validators.required);
      } else {
        poder.addValidators(Validators.required);
      }
      poder.updateValueAndValidity();
    });

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.guardarBorrador();
    });
  }

  /** El punto confirmado de la central (o `null`), en la señal y en el control obligatorio. */
  fijarGpsCentral(punto: Coordinates | null): void {
    this.gpsCentral.set(punto);
    const control = this.form.controls.gpsCentral;
    if (control.value !== punto) control.setValue(punto);
    // Con punto, la dirección nunca queda vacía: es un obligatorio que no se
    // ve, y un borrador viejo podría traer el punto sin ella.
    const direccion = this.form.controls.addressLines;
    if (punto !== null && direccion.value.trim() === '') direccion.setValue(pointLabel(punto));
  }

  /**
   * Lo deducido del punto de la central llena la dirección legal, que ya no
   * se escribe a mano. Sin punto no se toca: el punto obligatorio, que sí se
   * ve, es el que frena.
   */
  escribirLocalidadCentral(localidad: LocalityFromPoint | null): void {
    if (localidad === null) return;
    this.form.controls.addressLines.setValue(addressFromPoint(localidad, null, MAX_DIRECCION));
  }

  /** La dirección de una sucursal sale de su punto, como la de la central. */
  escribirLocalidadDeSucursal(id: string, localidad: LocalityFromPoint | null): void {
    if (localidad === null) return;
    this.actualizarSucursal(id, { direccion: addressFromPoint(localidad, null, MAX_DIRECCION) });
  }

  protected readonly idsUbicacionCentral: TestIds = {
    mapa: 'registro-farmacia-central-map',
    confirmada: 'registro-farmacia-central-location-confirmed',
    avisoGeocodificacion: 'registro-farmacia-central-geocoding-notice',
    quitar: 'registro-farmacia-central-location-remove',
    confirmar: 'registro-farmacia-central-location-confirm',
    usarUbicacion: 'registro-farmacia-central-location-use',
    marcarEnMapa: 'registro-farmacia-central-location-pick',
  };

  /* --- sucursales -------------------------------------------------------- */

  readonly sucursales = signal<readonly SucursalDeFarmacia[]>([]);
  private proximaSucursal = 1;

  agregarSucursal(): void {
    const id = `sucursal-${this.proximaSucursal}`;
    this.proximaSucursal += 1;
    this.sucursales.update((lista) => [
      ...lista,
      { id, nombre: '', direccion: '', descripcion: '', urlUbicacion: '', gps: null },
    ]);
  }

  quitarSucursal(id: string): void {
    this.sucursales.update((lista) => lista.filter((sucursal) => sucursal.id !== id));
  }

  escribirNombreDeSucursal(id: string, nombre: string | number | null): void {
    this.actualizarSucursal(id, { nombre: nombre === null ? '' : String(nombre) });
  }

  escribirDescripcionDeSucursal(id: string, descripcion: string | number | null): void {
    this.actualizarSucursal(id, { descripcion: descripcion === null ? '' : String(descripcion) });
  }

  escribirUrlDeSucursal(id: string, url: string | number | null): void {
    const enlace = url === null ? '' : String(url).trim();
    // Pegar el enlace es una de las dos maneras de ubicar la sucursal: si trae el
    // punto escrito, es el punto (y el pin lo muestra); si ya había uno marcado
    // a mano, ése se respeta.
    const punto = enlace === '' ? null : coordinatesFromMapUrl(enlace);
    const yaUbicada = (this.sucursales().find((sucursal) => sucursal.id === id)?.gps ?? null) !== null;
    this.actualizarSucursal(id, {
      urlUbicacion: enlace,
      ...(punto === null || yaUbicada ? {} : { gps: { lat: punto.latitude, lng: punto.longitude } }),
    });
  }

  /* --- carga en lote ------------------------------------------------------ */

  /** Si está abierto el diálogo «Subir sucursales en lote». */
  readonly cargaEnLoteAbierta = signal(false);

  /** Los nombres ya escritos: el archivo no puede repetirlos. */
  readonly nombresDeSucursales = computed(() =>
    this.sucursales()
      .map((sucursal) => sucursal.nombre)
      .filter((nombre) => nombre.trim() !== ''),
  );

  /**
   * Suma al final las sucursales del archivo. Cada una nace con su pin si el
   * enlace traía el punto escrito; si no, se marca a mano como cualquier otra.
   */
  agregarSucursalesEnLote(lote: readonly BranchDraft[]): void {
    const nuevas = lote.map((borrador): SucursalDeFarmacia => {
      const id = `sucursal-${this.proximaSucursal}`;
      this.proximaSucursal += 1;
      return {
        id,
        nombre: borrador.name,
        direccion: borrador.address,
        descripcion: borrador.description,
        urlUbicacion: borrador.locationUrl,
        gps:
          borrador.coordinates === null
            ? null
            : { lat: borrador.coordinates.latitude, lng: borrador.coordinates.longitude },
      };
    });
    this.sucursales.update((lista) => [...lista, ...nuevas]);
  }

  /**
   * Las sucursales que no se podrían registrar: sin punto en el mapa o sin
   * nombre. La API exige las dos cosas, y antes se descartaban EN SILENCIO al
   * enviar —una sucursal del CSV sin punto desaparecía del alta sin avisar—.
   * Ahora se dicen por su nombre y el envío espera a que se completen o se quiten.
   */
  readonly sucursalesIncompletas = computed(() =>
    this.sucursales().flatMap((sucursal, indice) => {
      const faltaNombre = sucursal.nombre.trim() === '';
      const faltaPunto = sucursal.gps === null;
      return faltaNombre || faltaPunto
        ? [
            {
              id: sucursal.id,
              rotulo: faltaNombre ? `Sucursal ${indice + 1} (sin nombre)` : sucursal.nombre.trim(),
              faltaNombre,
              faltaPunto,
            },
          ]
        : [];
    }),
  );

  /** El aviso para el banner y para el envío: cuáles y qué les falta. */
  readonly avisoDeSucursalesIncompletas = computed<string | null>(() => {
    const lista = this.sucursalesIncompletas();
    if (lista.length === 0) return null;
    const nombres = lista.map((s) => `«${s.rotulo}»`).join(', ');
    return lista.length === 1
      ? `Una sucursal no se puede registrar todavía: ${nombres}. Márquela en el mapa, pegue el enlace de su ubicación (o complete el nombre), o quítela.`
      : `${lista.length} sucursales no se pueden registrar todavía: ${nombres}. Márquelas en el mapa, pegue el enlace de su ubicación (o complete el nombre), o quítelas.`;
  });

  fijarGpsDeSucursal(id: string, gps: Coordinates | null): void {
    this.actualizarSucursal(id, { gps });
  }

  private actualizarSucursal(id: string, cambio: Partial<SucursalDeFarmacia>): void {
    this.sucursales.update((lista) =>
      lista.map((sucursal) => (sucursal.id === id ? { ...sucursal, ...cambio } : sucursal)),
    );
  }

  idsDeSucursal(id: string): TestIds {
    return {
      mapa: `registro-farmacia-${id}-map`,
      confirmada: `registro-farmacia-${id}-location-confirmed`,
      avisoGeocodificacion: `registro-farmacia-${id}-geocoding-notice`,
      quitar: `registro-farmacia-${id}-location-remove`,
      confirmar: `registro-farmacia-${id}-location-confirm`,
      usarUbicacion: `registro-farmacia-${id}-location-use`,
      marcarEnMapa: `registro-farmacia-${id}-location-pick`,
    };
  }

  /* --- la columna de ayuda ------------------------------------------------- */

  private readonly claveVisible = signal('empresa');
  readonly ayudaVisible = computed<readonly HelpCard[]>(
    () => AYUDA[this.claveVisible()] ?? [],
  );

  /**
   * Al bloquear «Siguiente», el motor sólo marca al grupo del nombre, no a sus
   * casillas: se marcan acá para que cada una muestre su error.
   */
  alRechazarPagina(pagina: PaginaDeFormulario): void {
    for (const campo of pagina.campos) this.form.get(campo.key)?.markAllAsTouched();
  }

  protected recordarPaso(pagina: PaginaDeFormulario): void {
    this.claveVisible.set(pagina.clave ?? '');
    this.guardarBorrador();
  }

  /* --- envío ---------------------------------------------------------------- */

  submit(): void {
    if (this.isSubmitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const aviso = this.avisoDeSucursalesIncompletas();
    if (aviso !== null) {
      this.state.set(validation([{ field: 'sucursales', message: aviso }]));
      return;
    }

    this.state.set(loading());

    // País y jurisdicción (y, en el laboratorio, su tipo de unidad) son
    // conceptos: se resuelven del catálogo antes de enviar. Sin ellos la API
    // responde 422 «exige país y jurisdicción».
    this.alta
      .catalogs()
      .pipe(
        map((catalogos) => this.datos(catalogos)),
        switchMap((datos) => this.iam.registerPharmacyOrganization(datos)),
      )
      .subscribe({
        next: (resultado) => {
          this.limpiarBorrador();
          this.draftService.trackEvent('complete', 'pharmacy', this.paginas().length);
          this.state.set(ready(null));
          this.verificationSent.set(resultado.emailVerificationSent);
          this.registered.set(true);
        },
        error: (error: unknown) => this.state.set(this.fallaDelEnvio(error)),
      });
  }

  /** Un catálogo incompleto se explica; el resto, como cualquier error de la API. */
  private fallaDelEnvio(error: unknown): ViewState<null> {
    if (error instanceof IncompleteCatalog) {
      return validation([{ field: 'catalogos', message: DIAGNOSIS_CATALOG_NOTICE }]);
    }
    if (error instanceof Error && !(error instanceof HttpErrorResponse)) {
      return validation([{ field: 'alta', message: error.message }]);
    }
    return registrationErrorToViewState(error, 'organization');
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  /** El código único de tenant: derivado del NIT, que es el dato estable que el alta ya exige. */
  private codigoDesdeNit(nit: string): string {
    const limpio = nit.trim().replace(/[^A-Za-z0-9]/g, '');
    return `FARM-${limpio}`;
  }

  /** Una gerencia sólo viaja si las tres partes están completas (nombre, celular y correo). */
  private gerenciaCompleta(g: { name: string; phone: string; email: string }): boolean {
    return g.name !== '' && g.phone.trim() !== '' && g.email.trim() !== '';
  }

  private datos(catalogos: DiagnosisCatalogs): PharmacyOrganizationRegistration {
    const concepto = DiagnosisCenterEnrollment.concept;
    const raw = this.form.getRawValue();
    const central = this.gpsCentral();
    const nombreDelRepresentante = completeName(raw.legalRepName);

    const sucursales: readonly PharmacyBranchRegistration[] = this.sucursales()
      .filter((s) => s.nombre.trim() !== '' && s.gps !== null)
      .map((s) => ({
        name: s.nombre.trim(),
        latitude: s.gps!.lat,
        longitude: s.gps!.lng,
        ...(s.descripcion.trim() === '' ? {} : { description: s.descripcion.trim() }),
        ...(s.urlUbicacion === '' ? {} : { locationUrl: s.urlUbicacion }),
      }));

    const gerencias = {
      generalManager: {
        name: completeName(raw.generalManagerName),
        phone: raw.generalManagerPhone,
        email: raw.generalManagerEmail,
      },
      commercialManager: {
        name: completeName(raw.commercialManagerName),
        phone: raw.commercialManagerPhone,
        email: raw.commercialManagerEmail,
      },
      marketingManager: {
        name: completeName(raw.marketingManagerName),
        phone: raw.marketingManagerPhone,
        email: raw.marketingManagerEmail,
      },
    };
    const todasCompletas = Object.values(gerencias).every((g) => this.gerenciaCompleta(g));

    const documentos = {
      constitutionFileId: raw.constitutionFileId,
      taxIdentifierFileId: raw.taxIdentifierFileId,
      commerceRegistryFileId: raw.commerceRegistryFileId,
      operatingLicenseFileId: raw.operatingLicenseFileId,
      healthAuthorityCertificateFileId: raw.healthAuthorityCertificateFileId,
    };
    const documentosCompletos = Object.values(documentos).every((v) => v !== '');

    return {
      code: this.codigoDesdeNit(raw.taxId),
      legalName: raw.legalName.trim(),
      legalEntityType: raw.companyType ?? '',
      countryConceptId: concepto(catalogos.pais, DIAGNOSIS_CODES.pais),
      jurisdictionConceptId: concepto(
        catalogos.jurisdiccion,
        DIAGNOSIS_CODES.jurisdiccionNacional,
      ),
      taxIdentifier: raw.taxId.trim(),
      legalAddress: raw.addressLines.trim(),
      ...(central === null
        ? {}
        : { headquarters: { latitude: central.lat, longitude: central.lng } }),
      ...(sucursales.length === 0 ? {} : { branches: sucursales }),
      owner: {
        email: raw.legalRepEmail.trim(),
        password: raw.password,
        displayName: nombreDelRepresentante,
      },
      legalRepresentative: {
        fullName: nombreDelRepresentante,
        idNumber: raw.legalRepIdNumber.trim(),
        email: raw.legalRepEmail.trim(),
        ...(raw.powerOfAttorneyFileId === ''
          ? {}
          : { powerOfAttorneyFileId: raw.powerOfAttorneyFileId }),
      },
      ...(documentosCompletos ? { legalDocuments: documentos } : {}),
      ...(todasCompletas
        ? {
            executives: {
              generalManager: {
                fullName: gerencias.generalManager.name,
                phone: gerencias.generalManager.phone.trim(),
                email: gerencias.generalManager.email.trim(),
              },
              commercialManager: {
                fullName: gerencias.commercialManager.name,
                phone: gerencias.commercialManager.phone.trim(),
                email: gerencias.commercialManager.email.trim(),
              },
              marketingManager: {
                fullName: gerencias.marketingManager.name,
                phone: gerencias.marketingManager.phone.trim(),
                email: gerencias.marketingManager.email.trim(),
              },
            },
          }
        : {}),
    };
  }
}
