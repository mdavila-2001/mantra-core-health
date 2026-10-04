import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { map, switchMap } from 'rxjs';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import type {
  PharmacyBranchRegistration,
  PharmacyOrganizationRegistration,
} from '../../../core/data-access/iam/iam.types';
import { registrationErrorToViewState } from '../registro-compartido/registration-errors';
import { uiLanguage } from '../../../core/i18n/ui-language';
import { loading, ready, validation } from '../../../core/view-state/view-state';
import {
  AVISO_CATALOGO_DE_DIAGNOSTICO,
  AltaDeCentroDiagnostico,
  CODIGOS_DE_DIAGNOSTICO,
  CatalogoIncompleto,
  type CatalogosDeDiagnostico,
} from '../registro-compartido/alta-de-centro-diagnostico';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
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
import type { BranchDraft } from '../../../shared/utils/branch-import/branch-import';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import {
  RegistroAyuda,
  type TarjetaDeAyuda,
} from '../../../shared/components/organisms/registro-ayuda/registro-ayuda';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import {
  campoDelPoderNotariado,
  camposDeDocumentosLegales,
  DOCUMENTOS_LEGALES_DEL_REGISTRO,
  type ClaveDeDocumentoDelAlta,
} from '../registro-compartido/documentos-legales';
import { CamposDeNombre } from '../registro-compartido/campos-de-nombre/campos-de-nombre';
import {
  grupoDeNombre,
  nombreCompleto,
} from '../registro-compartido/campos-de-nombre/nombre-de-persona';
import {
  MENSAJE_CONTRASENA_CORTA,
  validadoresDeContrasena,
} from '../registro-compartido/politica-de-contrasena';
import {
  AVISO_REESCRIBIR_DIRECCION,
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../registro-compartido/ubicacion-picker/ubicacion-picker';

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
 * diccionario `VS_LEGAL_ENTITY_TYPE` (`core/mock/fixtures/conceptos.ts`) —
 * el registro de procesos de farmacia no contempla otro país. Se duplican
 * acá y no se importan de `RegisterLaboratory`: el carril de farmacia no
 * toca el laboratorio más allá de lo que ya vive en `registro-compartido/`
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
  readonly gps: Coordenadas | null;
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

/** Por qué se pide cada cosa, por sección — mismo mecanismo que el molde, texto propio de farmacia. */
const AYUDA: Readonly<Record<string, readonly TarjetaDeAyuda[]>> = {
  empresa: [
    {
      icono: 'building',
      titulo: 'La empresa, no el local',
      texto:
        'Acá va la razón social con la que tu farmacia está inscrita. Los locales donde atendés se cargan más adelante, cada uno con su punto en el mapa.',
    },
    {
      icono: 'labels',
      titulo: 'El tipo se elige de la lista',
      texto:
        'La plataforma necesita poder contar cuántas farmacias tiene de cada tipo societario, y eso sólo funciona si todas eligen de la misma lista.',
    },
  ],
  documentos: [
    {
      icono: 'folder',
      titulo: 'Ningún papel frena tu alta',
      texto:
        'Podés adjuntarlos ahora o más adelante desde la Ficha de tu farmacia. Sí van a hacer falta para que tu farmacia quede habilitada a operar.',
    },
    {
      icono: 'shield',
      titulo: 'Quién los ve',
      texto:
        'Los mira el equipo que aprueba el alta. No se publican en tu ficha ni los ve un paciente.',
    },
  ],
  ubicacion: [
    {
      icono: 'pin',
      titulo: 'El punto es lo que te hace aparecer',
      texto:
        'Cuando un paciente busca dónde comprar su receta, la app ordena por cercanía. Sin el punto en el mapa tu farmacia queda fuera de esa lista, aunque la dirección esté escrita.',
    },
  ],
  sucursales: [
    {
      icono: 'hospital',
      titulo: 'Una fila por local',
      texto:
        'Cada sucursal se ubica sola en el mapa: un paciente del sur no tiene por qué cruzar la ciudad porque la central esté en el norte.',
    },
  ],
  representante: [
    {
      icono: 'mail',
      titulo: 'Con este correo se entra',
      texto:
        'El correo del representante legal es el usuario de la cuenta. Después se suman los usuarios que hagan falta, cada uno con el suyo.',
    },
    {
      icono: 'folder',
      titulo: 'El poder va con quien lo firma',
      texto:
        'Adjuntalo acá, junto a los datos del representante. Es opcional: si el dueño se representa a sí mismo, no hace falta.',
    },
  ],
  'gerencia-general': [
    {
      icono: 'briefcase',
      titulo: 'Los cargos son opcionales',
      texto:
        'Ninguno de los tres frena el alta. Se piden para saber a quién escribirle según el asunto, y no todo al mismo correo.',
    },
  ],
  'gerencia-comercial': [
    {
      icono: 'chart',
      titulo: 'A quién le llega el resumen de ventas',
      texto:
        'Si lo dejás vacío, el resumen de pedidos y ventas va al correo del representante legal.',
    },
  ],
  'gerencia-marketing': [
    {
      icono: 'megaphone',
      titulo: 'Promociones y campañas',
      texto:
        'Las promociones de tu farmacia se coordinan con esta persona. Se puede cargar después.',
    },
  ],
  acceso: [
    {
      icono: 'lock',
      titulo: 'Una clave nueva, no la del correo',
      texto: 'Al menos ocho caracteres. Se puede cambiar después desde el perfil.',
    },
  ],
};

/**
 * **Registro público de una farmacia** (Módulo Farmacia §1 del registro de
 * procesos) — carril A, 2026-09-29.
 *
 * ## Qué es obligatorio, y por qué (decisión D2 del carril)
 *
 * Frena el alta sólo lo más básico para nacer: **razón social, tipo de
 * sociedad, NIT, dirección legal de la central, nombre y correo del
 * representante legal, correo de acceso y contraseña**. El resto —los seis
 * papeles en PDF, el punto de la central en el mapa, las sucursales y las
 * tres gerencias— se completa después desde la Ficha de la farmacia, y va a
 * exigirse para operar cuando exista esa vía en el backend (`PENDIENTES-BACKEND.md`, P49).
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
  imports: [
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
    CampoPersonalizado,
    RegistroAyuda,
    UbicacionPicker,
    DropzonePdf,
    CamposDeNombre,
  ],
  templateUrl: './register-pharmacy.html',
  styleUrls: ['../registro-compartido/registro.css', './register-pharmacy.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPharmacy {
  private readonly iam = inject(IamClient);
  /** Resuelve del catálogo los conceptos de país y jurisdicción que la API exige. */
  private readonly alta = inject(AltaDeCentroDiagnostico);
  private readonly router = inject(Router);

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
    addressLines: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_DIRECCION)],
    }),
    // --- 1.8, 1.8.2 · representante legal -------------------------------------
    // Un grupo con las partes del nombre (primer nombre y apellido paterno obligatorios).
    legalRepName: grupoDeNombre(true),
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
    generalManagerName: grupoDeNombre(false),
    generalManagerPhone: new FormControl('', { nonNullable: true, validators: [telefonoCompleto] }),
    generalManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(MAX_CORREO)],
    }),
    commercialManagerName: grupoDeNombre(false),
    commercialManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    commercialManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(MAX_CORREO)],
    }),
    marketingManagerName: grupoDeNombre(false),
    marketingManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    marketingManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email, Validators.maxLength(MAX_CORREO)],
    }),
    // --- la cuenta -------------------------------------------------------------
    password: new FormControl('', { nonNullable: true, validators: [...validadoresDeContrasena] }),
  });

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');
  readonly registered = signal(false);
  readonly verificationSent = signal(false);

  readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') return state.issues[0]?.message ?? null;
    if (state.status === 'offline')
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    if (state.status === 'error')
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    return null;
  });

  /** Los cinco papeles de la empresa, en el orden del registro de procesos. */
  private readonly camposDeDocumentos = camposDeDocumentosLegales(PAIS, uiLanguage(), false);

  /**
   * El poder del representante (1.8.1) no va con los papeles de la empresa:
   * se pide en la misma página que el representante, junto a quien lo firma.
   */
  private readonly campoDelPoder = computed(() =>
    campoDelPoderNotariado(PAIS, uiLanguage(), this.poderObligatorio()),
  );

  readonly paginas = computed<readonly PaginaDeFormulario[]>(() =>
    paginarCampos([
      {
        titulo: 'La empresa',
        clave: 'empresa',
        icon: 'building' as const,
        hint: 'Los datos con los que tu farmacia está inscrita.',
        campos: [
          {
            key: 'legalName',
            label: 'Nombre o razón social',
            control: 'text' as const,
            required: true,
            icono: 'building' as const,
            placeholder: 'Farmacia San Martín S.R.L.',
            testId: 'registro-farmacia-razon-social',
            mensajeDeError: 'Escribí el nombre o la razón social de la farmacia.',
          },
          {
            key: 'companyType',
            label: 'Tipo de sociedad',
            hint: 'El que figura en tu matrícula de comercio.',
            control: 'select' as const,
            options: TIPOS_DE_SOCIEDAD,
            required: true,
            icono: 'labels' as const,
            placeholder: 'Elegí el tipo de sociedad',
            testId: 'registro-farmacia-tipo-sociedad',
            mensajeDeError: 'Elegí el tipo de sociedad.',
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
            mensajeDeError: 'Escribí el NIT: sólo números, al menos cuatro dígitos.',
          },
        ],
      },
      {
        titulo: 'Los papeles de la farmacia',
        clave: 'documentos',
        icon: 'folder' as const,
        hint: 'Opcionales: podés completarlos después desde la Ficha de tu farmacia. PDF, hasta 10 MB por archivo.',
        campos: this.camposDeDocumentos,
      },
      {
        titulo: 'Dónde está la central',
        clave: 'ubicacion',
        icon: 'pin' as const,
        campos: [
          {
            key: 'addressLines',
            label: 'Dirección legal de la central',
            hint: 'Calle, número y zona. Es la que figura en tus papeles.',
            control: 'text' as const,
            required: true,
            icono: 'pin' as const,
            placeholder: 'Av. Cañoto esq. Ballivián 234, Zona Central',
            testId: 'registro-farmacia-direccion',
            mensajeDeError: 'Escribí la dirección legal de la central.',
          },
          {
            key: 'gpsCentral',
            label: 'Ubicación en el mapa (opcional)',
            hint: 'Sin el punto, tu farmacia no aparece cuando alguien busca la más cercana.',
            control: 'custom' as const,
          },
        ],
      },
      {
        titulo: 'Tus sucursales',
        clave: 'sucursales',
        icon: 'hospital' as const,
        hint: 'Si sólo atendés en la central, seguí de largo.',
        campos: [{ key: 'sucursales', label: 'Sucursales (opcional)', control: 'custom' as const }],
      },
      {
        titulo: 'Representante legal',
        clave: 'representante',
        icon: 'shield' as const,
        campos: [
          {
            // Sin rótulo ni error propios: `app-campos-de-nombre` pinta cada casilla
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
            mensajeDeError: 'Escribí el documento del representante (al menos cuatro caracteres).',
          },
          {
            key: 'legalRepEmail',
            label: 'Correo del representante legal',
            hint: 'Con este correo vas a entrar a la plataforma.',
            control: 'email' as const,
            required: true,
            icono: 'mail' as const,
            autocomplete: 'username',
            testId: 'registro-farmacia-representante-correo',
            mensajeDeError: 'Escribí un correo válido: es el usuario de la cuenta.',
          },
          this.campoDelPoder(),
        ],
      },
      ...this.paginasDeGerencia(),
      {
        titulo: 'Tu acceso',
        clave: 'acceso',
        icon: 'lock' as const,
        hint: 'Entrás con el correo del representante legal y esta contraseña.',
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
            mensajeDeError: MENSAJE_CONTRASENA_CORTA,
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
        hint: 'Todo este paso es opcional: podés completarlo después.',
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
          mensajeDeError: 'Escribí un correo válido o dejalo vacío.',
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
    Partial<Record<ClaveDeDocumentoDelAlta, UploadedDocument>>
  >({});

  protected registrarDocumento(clave: ClaveDeDocumentoDelAlta, fileId: string | null): void {
    this.form.controls[clave].setValue(fileId ?? '');
    if (fileId === null) {
      this.documentosSubidos.update((actual) => {
        const { [clave]: _omitido, ...resto } = actual;
        return resto;
      });
    }
  }

  protected recordarDocumento(clave: ClaveDeDocumentoDelAlta, documento: UploadedDocument): void {
    this.documentosSubidos.update((actual) => ({ ...actual, [clave]: documento }));
  }

  protected documentoInicialDe(clave: ClaveDeDocumentoDelAlta): UploadedDocument | null {
    return this.documentosSubidos()[clave] ?? null;
  }

  /** El rótulo ya resuelto del documento (sin el sufijo «(opcional)», acá es siempre opcional). */
  protected etiquetaDeDocumento(clave: ClaveDeDocumentoDelAlta): string {
    const campo = [...this.camposDeDocumentos, this.campoDelPoder()].find((c) => c.key === clave);
    return campo?.label.replace(' (opcional)', '') ?? 'Documento';
  }

  protected readonly clavesDeDocumento: readonly ClaveDeDocumentoDelAlta[] = [
    ...DOCUMENTOS_LEGALES_DEL_REGISTRO.map((d) => d.key),
    'powerOfAttorneyFileId',
  ];

  /* --- la ubicación de la central -------------------------------------------- */

  readonly gpsCentral = signal<Coordenadas | null>(null);

  private readonly direccionVaciadaPorElMapa = signal(false);
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

  constructor() {
    this.form.controls.companyType.valueChanges.subscribe((tipo) => {
      const poder = this.form.controls.powerOfAttorneyFileId;
      if (tipo === null || tipo === 'UNIPERSONAL') {
        poder.removeValidators(Validators.required);
      } else {
        poder.addValidators(Validators.required);
      }
      poder.updateValueAndValidity();
    });
  }

  private readonly direccionEscrita = toSignal(this.form.controls.addressLines.valueChanges, {
    initialValue: '',
  });
  readonly direccionPorReescribir = computed(
    () => this.direccionVaciadaPorElMapa() && this.direccionEscrita().trim() === '',
  );
  private readonly sucursalesVaciadasPorElMapa = signal<ReadonlySet<string>>(new Set());
  protected readonly avisoReescribir = AVISO_REESCRIBIR_DIRECCION;

  vaciarDireccionPorElMapa(): void {
    const direccion = this.form.controls.addressLines;
    direccion.setValue('');
    direccion.markAsUntouched();
    this.direccionVaciadaPorElMapa.set(true);
  }

  vaciarDireccionDeSucursalPorElMapa(id: string): void {
    this.actualizarSucursal(id, { direccion: '' });
    this.sucursalesVaciadasPorElMapa.update((ids) => new Set([...ids, id]));
  }

  sucursalPorReescribir(sucursal: SucursalDeFarmacia): boolean {
    return this.sucursalesVaciadasPorElMapa().has(sucursal.id) && sucursal.direccion.trim() === '';
  }

  protected readonly idsUbicacionCentral: IdsDePrueba = {
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

  escribirDireccionDeSucursal(id: string, direccion: string | number | null): void {
    this.actualizarSucursal(id, { direccion: direccion === null ? '' : String(direccion) });
  }

  escribirDescripcionDeSucursal(id: string, descripcion: string | number | null): void {
    this.actualizarSucursal(id, { descripcion: descripcion === null ? '' : String(descripcion) });
  }

  escribirUrlDeSucursal(id: string, url: string | number | null): void {
    this.actualizarSucursal(id, { urlUbicacion: url === null ? '' : String(url).trim() });
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

  fijarGpsDeSucursal(id: string, gps: Coordenadas | null): void {
    this.actualizarSucursal(id, { gps });
  }

  private actualizarSucursal(id: string, cambio: Partial<SucursalDeFarmacia>): void {
    this.sucursales.update((lista) =>
      lista.map((sucursal) => (sucursal.id === id ? { ...sucursal, ...cambio } : sucursal)),
    );
  }

  idsDeSucursal(id: string): IdsDePrueba {
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
  readonly ayudaVisible = computed<readonly TarjetaDeAyuda[]>(
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
  }

  /* --- envío ---------------------------------------------------------------- */

  submit(): void {
    if (this.isSubmitting()) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    // País y jurisdicción (y, en el laboratorio, su tipo de unidad) son
    // conceptos: se resuelven del catálogo antes de enviar. Sin ellos la API
    // responde 422 «exige país y jurisdicción».
    this.alta
      .catalogos()
      .pipe(
        map((catalogos) => this.datos(catalogos)),
        switchMap((datos) => this.iam.registerPharmacyOrganization(datos)),
      )
      .subscribe({
        next: (resultado) => {
          this.state.set(ready(null));
          this.verificationSent.set(resultado.emailVerificationSent);
          this.registered.set(true);
        },
        error: (error: unknown) => this.state.set(this.fallaDelEnvio(error)),
      });
  }

  /** Un catálogo incompleto se explica; el resto, como cualquier error de la API. */
  private fallaDelEnvio(error: unknown): ViewState<null> {
    if (error instanceof CatalogoIncompleto) {
      return validation([{ field: 'catalogos', message: AVISO_CATALOGO_DE_DIAGNOSTICO }]);
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

  private datos(catalogos: CatalogosDeDiagnostico): PharmacyOrganizationRegistration {
    const concepto = AltaDeCentroDiagnostico.concepto;
    const raw = this.form.getRawValue();
    const central = this.gpsCentral();
    const nombreDelRepresentante = nombreCompleto(raw.legalRepName);

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
        name: nombreCompleto(raw.generalManagerName),
        phone: raw.generalManagerPhone,
        email: raw.generalManagerEmail,
      },
      commercialManager: {
        name: nombreCompleto(raw.commercialManagerName),
        phone: raw.commercialManagerPhone,
        email: raw.commercialManagerEmail,
      },
      marketingManager: {
        name: nombreCompleto(raw.marketingManagerName),
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
      countryConceptId: concepto(catalogos.pais, CODIGOS_DE_DIAGNOSTICO.pais),
      jurisdictionConceptId: concepto(
        catalogos.jurisdiccion,
        CODIGOS_DE_DIAGNOSTICO.jurisdiccionNacional,
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
