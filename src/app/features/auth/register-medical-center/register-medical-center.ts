import { NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, map, switchMap, type Observable } from 'rxjs';

import {
  isMedicalOrganizationType,
  type MedicalOrganizationType,
} from '../../../core/data-access/directory/directory.types';
import { MAX_MEDICAL_FACILITY_BRANCHES } from '../../../core/data-access/iam/medical-facility.rules';
import { MedicalCenterRegistrationClient } from '../../../core/data-access/iam/medical-center-registration.client';
import { IamClient } from '../../../core/data-access/iam/iam.client';
import { LegalEntityTypesCatalog } from '../../../core/data-access/system-context/legal-entity-types.service';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import { uiLanguage } from '../../../core/i18n/ui-language';
import { OnboardingDraftService } from '../../../core/onboarding/onboarding-draft.service';
import type { OnboardingDraft } from '../../../core/onboarding/onboarding-draft.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Link } from '../../../shared/components/atoms/link/link';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DropzonePdf } from '../../../shared/components/molecules/dropzone-pdf/dropzone-pdf';
import type {
  PdfUploader,
  UploadedDocument,
} from '../../../shared/components/molecules/dropzone-pdf/dropzone-pdf.types';
import { OnboardingDraftBanner } from '../../../shared/components/molecules/onboarding-draft-banner/onboarding-draft-banner';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { CustomField } from '../../../shared/components/organisms/paginated-form/custom-field';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import {
  RegistrationHelp,
  type HelpCard,
} from '../../../shared/components/organisms/registration-help/registration-help';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import {
  BranchesEditor,
  sucursalesConIdsUnicos,
  type SucursalDeclarada,
} from '../shared-registration/branches-editor/branches-editor';
import { executivesIncomplete, executivesTouched, type ExecutivesRaw } from '../shared-registration/executives';
import { InlineNameFields } from '../shared-registration/inline-name-fields/inline-name-fields';
import {
  legalDocumentsFields,
  notarizedPowerField,
  RECORD_LEGAL_DOCUMENTS,
  KEY_NOTARIZED_POWER,
  type EnrollmentDocumentKey,
} from '../shared-registration/legal-documents';
import { addressFromPoint, pointLabel } from '../shared-registration/address-from-point';
import {
  MapLocationPicker,
  type Coordinates,
  type LocalityFromPoint,
  type TestIds,
} from '../shared-registration/map-location-picker/map-location-picker';
import { RegistrationBadge } from '../shared-registration/registration-badge';
import { medicalCenterBody } from './medical-center-body';
import {
  CLAVES_DE_PAPELES,
  MAX_ADDRESS,
  createMedicalCenterForm,
} from './medical-center-form';
import {
  DESTINO_TIPO_DE_ORGANIZACION,
  medicalOrganizationTypeOptions,
} from './medical-organization-types';
import { medicalCenterPages, TEST_ID } from './medical-center-pages';
import { AYUDA_ALTA_MEDICA } from './medical-center.help';
import {
  AVISO_CATALOGO,
  documentosOpcionales,
  entreLasOpciones,
  signupErrorMessage,
} from './medical-center-rules';

// Quien importaba estas desde la pantalla las sigue encontrando acá.
export { documentosOpcionales, entreLasOpciones, signupErrorMessage };
export { DOCUMENTOS_OPCIONALES_POR_TIPO } from './medical-center-rules';

/** Dónde se leen el país y la jurisdicción: los mismos catálogos públicos del alta de laboratorio. */
const DESTINO_PAIS = 'directory.tenants.country_concept_id';
const DESTINO_JURISDICCION = 'profiles.jurisdiction_authorizations.jurisdiction_concept_id';

/** Los códigos estables de esos conceptos. */
const COUNTRY_CODE = 'BO';
const JURISDICTION_CODE = 'JURISDICTION_NATIONAL';

/** El tipo de borrador de esta alta (autoguardado y telemetría del embudo). */
const FORM_TYPE = 'medical-center' as const;

/** Lo que se dice cuando las gerencias quedaron a medias. */
const AVISO_GERENCIAS =
  'Complete las tres gerencias (nombre, celular y correo de cada una) o deje las tres vacías: la plataforma las recibe como un solo bloque.';

/**
 * **Alta de una organización médica** (CM-11): un hospital, una clínica, un
 * consultorio, un centro de enfermería u otra institución de salud crea su
 * cuenta.
 *
 * ## Qué pide y por qué
 *
 * Lo mismo que el alta del centro de imagenología —empresa, papeles en PDF,
 * casa central en el mapa, sucursales, representante legal con su poder, las
 * tres gerencias y la clave—, menos lo específico de los estudios por
 * modalidad, y dos datos que son propios de un establecimiento de salud:
 *
 * - **El número de registro ante el SEDES** (`healthFacilityRegistrationNumber`):
 *   hasta ahora sólo se subía el PDF del certificado; sin el número la
 *   plataforma no puede verificarlo ni cruzarlo con el registro oficial.
 * - **El director médico** (`medicalDirector`, con su matrícula): la norma
 *   exige un responsable técnico por establecimiento. No es una cuenta: es un
 *   contacto de responsabilidad, como las gerencias.
 *
 * ## Qué manda y por qué así
 *
 * `POST /iam/auth/register-organization` con el `tenantType` que eligió quien
 * la registra (`HOSPITAL`, `CLINIC`, `MEDICAL_OFFICE`, `NURSING` o
 * `HEALTH_OTHER`). Las opciones salen del catálogo público `tenant-type`,
 * filtradas a esos cinco (ver `medicalOrganizationTypeOptions`). Los cinco son
 * territoriales, así que la API exige país y jurisdicción; se leen de los
 * catálogos públicos y se resuelven **por código**, igual que el alta del
 * laboratorio. Los papeles se suben al elegirlos (`app-dropzone-pdf`) y viaja
 * su `fileId`. El bloque `medicalFacility` lleva el NIT, el número de registro,
 * el director médico y las direcciones (ver `MedicalFacility`).
 *
 * El owner de la cuenta es el representante legal: su nombre en partes y su
 * correo no se piden dos veces. El código de la organización no se pide: sale
 * de la razón social.
 *
 * ## Qué pasa después
 *
 * La organización nace **pendiente de verificación**. Hasta que la plataforma
 * la verifique no puede abrir su práctica ni su primera sede
 * (`medical-center-setup`), y la pantalla de éxito se lo dice.
 */
@Component({
  selector: 'app-register-medical-center',
  imports: [
    Alert,
    AnnounceOnAppear,
    AppButton,
    AuthSplit,
    BranchesEditor,
    CustomField,
    DropzonePdf,
    InlineNameFields,
    Link,
    MapLocationPicker,
    NgTemplateOutlet,
    OnboardingDraftBanner,
    PaginatedForm,
    RegistrationBadge,
    RegistrationHelp,
    RouterLink,
  ],
  templateUrl: './register-medical-center.html',
  styleUrls: ['../shared-registration/registration.css', './register-medical-center.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterMedicalCenter {
  private readonly client = inject(MedicalCenterRegistrationClient);
  private readonly iam = inject(IamClient);
  private readonly context = inject(SystemContextClient);
  private readonly legalEntityTypes = inject(LegalEntityTypesCatalog);
  private readonly router = inject(Router);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly draftService = inject(OnboardingDraftService);

  protected readonly claim = 'Sume su organización médica a la red';
  protected readonly tagline =
    'Publique sus procedimientos y afilie a sus médicos para que los pacientes lo encuentren.';

  /**
   * Los tipos de institución que la API publica, de los cinco médicos.
   *
   * Arranca con la lista de respaldo —los cinco—: con un catálogo lento, un
   * desplegable obligatorio vacío pedía «Elija el tipo de institución.» sin
   * nada que elegir. Cuando el catálogo responde se queda con los que publica, y
   * `ofrecerTipos` vacía lo elegido si dejó de ofrecerse.
   */
  private readonly tiposDeOrganizacion = signal<readonly SelectOption<MedicalOrganizationType>[]>(
    medicalOrganizationTypeOptions(null),
  );

  readonly form = createMedicalCenterForm(
    entreLasOpciones(() => untracked(this.tiposDeOrganizacion)),
  );

  /** El tipo societario elegido: decide qué documentos son opcionales. */
  private readonly tipoSocietario = toSignal(this.form.controls.legalEntityType.valueChanges, {
    initialValue: this.form.controls.legalEntityType.value,
  });

  /**
   * Si ya hay algo escrito en las gerencias. Cambia sólo al pasar de vacías a
   * en uso (y al revés), no en cada tecla: de ahí dependen los asteriscos.
   */
  protected readonly gerenciasEnUso = toSignal(
    this.form.valueChanges.pipe(map(() => executivesTouched(this.form.getRawValue() as ExecutivesRaw))),
    { initialValue: false },
  );

  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly registered = signal(false);
  protected readonly verificationSent = signal(false);
  /** El correo de la cuenta, para decir adónde llegó el aviso de verificación. */
  protected readonly accountEmail = signal('');

  /** Los tipos societarios de Bolivia, del mismo catálogo que las demás altas. */
  private readonly tiposSocietarios = signal<readonly SelectOption<string>[]>([]);

  /**
   * Las páginas del alta. `computed` porque los catálogos llegan después de que
   * la pantalla se arma y el tipo societario cambia qué papeles son opcionales.
   */
  protected readonly paginas = computed<readonly PaginaDeFormulario[]>(() => {
    const opcionales = documentosOpcionales(this.tipoSocietario());
    const lang = uiLanguage();
    return medicalCenterPages({
      tiposDeOrganizacion: this.tiposDeOrganizacion(),
      tiposSocietarios: this.tiposSocietarios(),
      // Los que el tipo societario permite omitir salen «(opcional)» y sin mensaje de obligatorio.
      camposDeDocumentos: legalDocumentsFields(COUNTRY_CODE, lang).map((campo) => {
        if (!opcionales.some((clave) => clave === campo.key)) return campo;
        const { required: _required, mensajeDeError: _mensaje, ...resto } = campo;
        return { ...resto, label: `${campo.label} (opcional)` };
      }),
      gerenciasEnUso: this.gerenciasEnUso(),
      campoDePoder: notarizedPowerField(COUNTRY_CODE, lang, !opcionales.includes(KEY_NOTARIZED_POWER)),
    });
  });

  /* --- el avance guardado y la telemetría ---------------------------------- */

  protected readonly borradorDetectado = signal<OnboardingDraft | null>(null);
  protected readonly pasoGuardado = signal(0);
  private readonly claveVisible = signal('organizacion');

  protected readonly ayudaVisible = computed<readonly HelpCard[]>(
    () => AYUDA_ALTA_MEDICA[this.claveVisible()] ?? [],
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const detectado = this.draftService.detectDraft(FORM_TYPE);
      if (detectado && (detectado.stepIndex > 0 || Object.keys(detectado.data).length > 2)) {
        this.borradorDetectado.set(detectado);
      }
      this.draftService.trackEvent('start', FORM_TYPE, 0);
    }
    // Cambiar el tipo societario cambia qué documentos son obligatorios.
    this.form.controls.legalEntityType.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((tipo) => this.exigirDocumentos(tipo));
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.guardarBorrador());
    this.context.dynamicEnum(DESTINO_TIPO_DE_ORGANIZACION).subscribe({
      next: (catalogo) => this.ofrecerTipos(medicalOrganizationTypeOptions(catalogo)),
      error: () => this.ofrecerTipos(medicalOrganizationTypeOptions(null)),
    });
    this.legalEntityTypes.listar().subscribe({
      next: (opciones) =>
        this.tiposSocietarios.set(this.legalEntityTypes.opcionesPorPais(opciones, COUNTRY_CODE)),
      // Sin catálogo el servicio ofrece las figuras de su diccionario: un
      // desplegable vacío dejaba el alta sin poder terminarse.
      error: () => this.tiposSocietarios.set(this.legalEntityTypes.opcionesPorPais([], COUNTRY_CODE)),
    });
  }

  /**
   * Al bloquear «Siguiente» (o llevar a la primera página con algo mal), el
   * motor sólo marca al grupo del nombre, no a sus casillas: se marcan acá para
   * que cada una muestre su error, también el de las gerencias a medias.
   */
  protected alRechazarPagina(pagina: PaginaDeFormulario): void {
    for (const campo of pagina.campos) this.form.get(campo.key)?.markAllAsTouched();
  }

  protected recordarPaso(pagina: PaginaDeFormulario): void {
    this.claveVisible.set(pagina.clave ?? '');
    this.guardarBorrador();
  }

  /**
   * Guarda el avance en el navegador y en el servidor. **Sin los papeles**: lo
   * que se guarda de ellos es el `fileId` de una pre-carga que puede vencer, y
   * la pantalla no sabría mostrarlo; quien retoma los vuelve a elegir. **Sin la
   * contraseña**, nunca.
   */
  guardarBorrador(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const paginas = this.paginas();
      const clave = this.claveVisible();
      const indice = Math.max(0, paginas.findIndex((p) => p.clave === clave));
      const titulo = paginas[indice]?.titulo ?? clave;
      const datos: Record<string, unknown> = { ...this.form.getRawValue() };
      for (const papel of CLAVES_DE_PAPELES) delete datos[papel];
      delete datos['sucursales'];
      // Una contraseña no se guarda en ningún borrador: ni en el navegador ni
      // en el servidor. `OnboardingDraftService` también la quita, pero esta
      // pantalla no depende de que otro se acuerde.
      delete datos['password'];
      this.draftService.saveProgress(
        FORM_TYPE,
        indice,
        clave,
        titulo,
        datos,
        { gpsCentral: this.gpsCentral(), sucursales: this.sucursales() },
        paginas.length,
      );
      this.draftService.trackEvent('step_view', FORM_TYPE, indice, { stepKey: clave });
    } catch {
      // Un borrador que no se guarda no frena el alta.
    }
  }

  /** Restaura el avance previo del formulario si existe. */
  restaurarBorrador(draftParam?: OnboardingDraft): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const draft = draftParam ?? this.draftService.detectDraft(FORM_TYPE);
      if (!draft) return;
      if (draft.data) this.form.patchValue(draft.data);
      const extra = (draft.extraData ?? {}) as Record<string, unknown>;
      if (extra['gpsCentral'] !== undefined) {
        this.fijarGpsCentral(extra['gpsCentral'] as Coordinates | null);
      }
      if (Array.isArray(extra['sucursales'])) {
        this.fijarSucursales(extra['sucursales'] as readonly SucursalDeclarada[]);
      }
      if (typeof draft.stepIndex === 'number' && draft.stepIndex >= 0) {
        this.pasoGuardado.set(draft.stepIndex);
      }
      this.borradorDetectado.set(null);
    } catch {
      // Un borrador roto no frena el alta.
    }
  }

  /** Descarta el borrador y limpia el estado. */
  descartarBorrador(): void {
    this.limpiarBorrador();
    this.draftService.trackEvent('abandon', FORM_TYPE, 0);
  }

  private limpiarBorrador(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.draftService.clearDraft(FORM_TYPE);
      this.borradorDetectado.set(null);
    } catch {
      // Ignorar
    }
  }

  /* --- documentos legales (dropzone real, con `fileId`) ------------------ */

  /** Vuelve obligatorios los papeles salvo los que el tipo societario permite omitir. */
  private exigirDocumentos(tipoSocietario: string): void {
    const opcionales = documentosOpcionales(tipoSocietario);
    for (const clave of this.clavesDeDocumento) {
      const control = this.form.controls[clave];
      if (opcionales.includes(clave)) {
        control.removeValidators(Validators.required);
      } else {
        control.addValidators(Validators.required);
      }
      control.updateValueAndValidity({ emitEvent: false });
    }
  }

  protected esDocumentoObligatorio(clave: EnrollmentDocumentKey): boolean {
    return !documentosOpcionales(this.tipoSocietario()).includes(clave);
  }

  /** Cómo sube cada `app-dropzone-pdf`: la pre-carga pública de las demás altas. */
  protected readonly subirDocumento: PdfUploader = (file) =>
    this.iam.uploadRegistrationDocument(file);

  /** Los cinco papeles de la empresa, más el poder del representante. */
  protected readonly clavesDeDocumento: readonly EnrollmentDocumentKey[] = [
    ...RECORD_LEGAL_DOCUMENTS.map((documento) => documento.key),
    KEY_NOTARIZED_POWER,
  ];

  /** Lo ya subido por cada dropzone, para sobrevivir a que el asistente destruya y recree la página. */
  private readonly documentosSubidos = signal<Partial<Record<EnrollmentDocumentKey, UploadedDocument>>>({});

  registrarDocumento(clave: EnrollmentDocumentKey, fileId: string | null): void {
    const control = this.form.controls[clave];
    control.setValue(fileId ?? '');
    control.markAsTouched();
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

  protected esDocumentoInvalido(clave: EnrollmentDocumentKey): boolean {
    const control = this.form.controls[clave];
    return control.touched && control.invalid;
  }

  /** El rótulo ya resuelto del documento, para pasárselo a su dropzone. */
  protected etiquetaDeDocumento(clave: EnrollmentDocumentKey): string {
    const campo = this.paginas()
      .flatMap((pagina) => pagina.campos)
      .find((c) => c.key === clave);
    return campo?.label.replace(' (opcional)', '') ?? 'Documento';
  }

  /* --- la casa central ----------------------------------------------------- */

  /**
   * El punto de la casa central, ya confirmado sobre el mapa. La señal alimenta
   * el `[inicial]` del selector; el control homónimo es el que hace obligatorio
   * el punto. Los dos los escribe {@link fijarGpsCentral}.
   */
  readonly gpsCentral = signal<Coordinates | null>(null);

  protected readonly idsUbicacionCentral: TestIds = {
    mapa: `${TEST_ID}-central-map`,
    confirmada: `${TEST_ID}-central-location-confirmed`,
    avisoGeocodificacion: `${TEST_ID}-central-geocoding-notice`,
    quitar: `${TEST_ID}-central-location-remove`,
    confirmar: `${TEST_ID}-central-location-confirm`,
    usarUbicacion: `${TEST_ID}-central-location-use`,
    marcarEnMapa: `${TEST_ID}-central-location-pick`,
  };

  /** El punto confirmado (o `null`), en la señal y en el control obligatorio. */
  fijarGpsCentral(punto: Coordinates | null): void {
    this.gpsCentral.set(punto);
    const control = this.form.controls.gpsCentral;
    if (control.value !== punto) control.setValue(punto);
    // Con punto, la dirección nunca queda vacía: es un obligatorio que no se ve.
    const direccion = this.form.controls.addressLines;
    if (punto !== null && direccion.value.trim() === '') direccion.setValue(pointLabel(punto));
  }

  /** Lo deducido del punto llena la dirección, que ya no se escribe a mano. */
  escribirLocalidadCentral(localidad: LocalityFromPoint | null): void {
    if (localidad === null) return;
    this.form.controls.addressLines.setValue(addressFromPoint(localidad, null, MAX_ADDRESS));
  }

  /* --- sucursales ---------------------------------------------------------- */

  readonly sucursales = signal<readonly SucursalDeclarada[]>([]);

  /** El tope del editor y el del validador del control: el mismo número. */
  protected readonly maximoSucursales = MAX_MEDICAL_FACILITY_BRANCHES;

  /** La lista vive en la señal (la lee el editor) y en el control (que frena las incompletas). */
  fijarSucursales(entrante: readonly SucursalDeclarada[]): void {
    // También al restaurar un borrador viejo: los ids repetidos se renombran.
    const lista = sucursalesConIdsUnicos(entrante);
    this.sucursales.set(lista);
    const control = this.form.controls.sucursales;
    control.setValue(lista);
    control.markAsTouched();
  }

  protected sucursalesConFaltantes(): boolean {
    const control = this.form.controls.sucursales;
    return control.touched && control.invalid;
  }

  /* --- envío --------------------------------------------------------------- */

  submit(): void {
    if (this.isSubmitting()) return;
    const tipo = this.form.controls.tenantType.value;
    // Las gerencias viajan como bloque de a tres: a medias no se descartan en
    // silencio, se pide completarlas o vaciarlas. Los controles ya lo dicen
    // junto a cada campo y el motor lleva a la primera página afectada; esto es
    // la red de seguridad por si este método se llama sin pasar por él.
    if (executivesIncomplete(this.form.getRawValue())) {
      this.form.markAllAsTouched();
      this.errorMessage.set(AVISO_GERENCIAS);
      return;
    }
    if (this.form.invalid || !isMedicalOrganizationType(tipo)) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.catalogos()
      .pipe(
        switchMap((ids) =>
          this.client.register(
            medicalCenterBody(tipo, this.form.getRawValue(), this.gpsCentral(), ids),
          ),
        ),
      )
      .subscribe({
        next: (resultado) => {
          this.isSubmitting.set(false);
          this.accountEmail.set(this.form.controls.legalRepEmail.value.trim());
          this.verificationSent.set(resultado.emailVerificationSent);
          this.registered.set(true);
          this.limpiarBorrador();
          this.draftService.trackEvent('complete', FORM_TYPE, this.paginas().length);
        },
        error: (error: unknown) => {
          this.isSubmitting.set(false);
          this.errorMessage.set(signupErrorMessage(error));
        },
      });
  }

  /**
   * Publica las opciones del tipo y revalida lo elegido contra ellas.
   *
   * Un valor que dejó de ofrecerse se vacía: la persona vuelve a ver el
   * desplegable sin elegir —y, si ya lo había tocado, con «Elija el tipo de institución.»—
   * en vez de un valor invisible que la API rechazaría.
   */
  private ofrecerTipos(opciones: readonly SelectOption<MedicalOrganizationType>[]): void {
    this.tiposDeOrganizacion.set(opciones);
    const tipo = this.form.controls.tenantType;
    if (tipo.value !== '' && !opciones.some((opcion) => opcion.value === tipo.value)) {
      tipo.setValue('');
    }
    tipo.updateValueAndValidity();
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  /** Lee los dos catálogos y resuelve los ids por código. Un fallo corta con el aviso. */
  private catalogos(): Observable<{ pais: string; jurisdiccion: string }> {
    const byCode = (destino: string, codigo: string) =>
      this.context.dynamicEnum(destino).pipe(
        map((enumeracion) => {
          const id = enumeracion.options.find((opcion) => opcion.code === codigo)?.conceptId;
          if (id === undefined) throw new Error(AVISO_CATALOGO);
          return id;
        }),
      );
    return forkJoin({
      pais: byCode(DESTINO_PAIS, COUNTRY_CODE),
      jurisdiccion: byCode(DESTINO_JURISDICCION, JURISDICTION_CODE),
    });
  }
}
