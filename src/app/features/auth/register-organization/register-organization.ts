import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgTemplateOutlet } from '@angular/common';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import type { OrganizationRegistration } from '../../../core/data-access/iam/iam.types';
import { LegalEntityTypesCatalog } from '../../../core/data-access/system-context/legal-entity-types.service';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { uiLanguage } from '../../../core/i18n/ui-language';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type { DynamicEnumOption } from '../../../core/data-access/system-context/system-context.types';
import { Link } from '../../../shared/components/atoms/link/link';
import { Input } from '../../../shared/components/atoms/input/input';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Accordion, AccordionPanel, FormField } from '../../../shared/components/molecules';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DropzonePdf } from '../../../shared/components/molecules/dropzone-pdf/dropzone-pdf';
import type {
  PdfUploader,
  UploadedDocument,
} from '../../../shared/components/molecules/dropzone-pdf/dropzone-pdf.types';
import {
  PhoneInput,
  telefonoCompleto,
} from '../../../shared/components/molecules/phone-input/phone-input';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { mensajeDeError } from '../../../shared/forms/paginated/mensaje-de-error';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import {
  camposDeDocumentosLegales,
  campoDelPoderNotariado,
  DOCUMENTOS_LEGALES_DEL_REGISTRO,
  type ClaveDeDocumentoDelAlta,
} from '../registro-compartido/documentos-legales';
import {
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../registro-compartido/ubicacion-picker/ubicacion-picker';
import { unirNombres } from '../../../core/profesion/nombres-adicionales';

/** Mínimos que exigen los DTO del backend. */
const MIN_PASSWORD = 8;

/** Largos que declara el bloque `organization` de `RegisterOrganizationDto`. */
const MAX_CODIGO = 100;
const MAX_NOMBRE = 300;
const MAX_ZONA_HORARIA = 100;

/** Largos del bloque `payer`, iguales a los del alta administrativa. */
const MAX_CARRIER_CODE = 60;
const MAX_NIT = 100;
const MAX_SIGLA = 20;
const MAX_DIRECCION = 300;

/** Tope del `fullName` compuesto (subtarea 1.4), igual al del DTO del backend. */
const MAX_NOMBRE_CONTACTO = 200;
const MIN_CI_REPRESENTANTE = 4;
const MAX_CI_REPRESENTANTE = 50;
const MAX_CORREO = 320;

/**
 * Topes por parte del nombre (representante, gerencias y owner): sólo los ve
 * el cliente — el backend recibe siempre el compuesto, nunca las partes.
 */
const MIN_PARTE_NOMBRE = 2;
const MAX_PARTE_NOMBRE = 100;

/** Mismo patrón que el DTO del backend para el código único del tenant. */
const CODIGO_VALIDO = /^[A-Za-z0-9._-]+$/;

/** Los cinco controles con los que se declara el nombre de una persona en este alta. */
interface ControlesDeNombre {
  name: FormControl<string>;
  middleName: FormControl<string>;
  thirdName: FormControl<string>;
  lastName: FormControl<string>;
  motherLastName: FormControl<string>;
}

/**
 * Los cinco controles de nombre, en blanco: primer nombre y apellido paterno
 * obligatorios, los otros tres opcionales — mismo desglose que paciente y
 * médico (`register-patient.ts`/`register-practitioner.ts`).
 */
function controlesDeNombre(): ControlesDeNombre {
  return {
    name: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(MIN_PARTE_NOMBRE),
        Validators.maxLength(MAX_PARTE_NOMBRE),
      ],
    }),
    middleName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PARTE_NOMBRE)],
    }),
    thirdName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PARTE_NOMBRE)],
    }),
    lastName: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(MIN_PARTE_NOMBRE),
        Validators.maxLength(MAX_PARTE_NOMBRE),
      ],
    }),
    motherLastName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PARTE_NOMBRE)],
    }),
  };
}

/**
 * Compone el nombre completo tal como lo espera `fullName` en el backend
 * (`RegisterOrganizationLegalRepresentativeDto`/`RegisterOrganizationExecutiveContactDto`):
 * las partes no vacías, recortadas y separadas por un espacio. Reusa
 * `unirNombres`, la misma función que ya concilia esto entre el alta de
 * médico y su editor de perfil — ver su JSDoc.
 */
function componerNombreCompleto(p: {
  name: string;
  middleName: string;
  thirdName: string;
  lastName: string;
  motherLastName: string;
}): string {
  return unirNombres([p.name, p.middleName, p.thirdName, p.lastName, p.motherLastName]);
}

/**
 * El nombre compuesto no puede pasar el `@MaxLength(200)` de `fullName` en el
 * backend. Vive a nivel de GRUPO (no de un control) porque depende de las
 * cinco partes juntas.
 *
 * El mínimo de 3 caracteres del mismo decorador queda garantizado por
 * `name`/`lastName` (2 + 2 + el espacio que los separa): no hace falta
 * repetirlo acá.
 */
const nombreCompletoCabe: ValidatorFn = (grupo: AbstractControl): ValidationErrors | null => {
  const valor = grupo.value as Partial<{
    name: string;
    middleName: string;
    thirdName: string;
    lastName: string;
    motherLastName: string;
  }>;
  const compuesto = componerNombreCompleto({
    name: valor.name ?? '',
    middleName: valor.middleName ?? '',
    thirdName: valor.thirdName ?? '',
    lastName: valor.lastName ?? '',
    motherLastName: valor.motherLastName ?? '',
  });
  return compuesto.length > MAX_NOMBRE_CONTACTO
    ? { nombreCompletoLargo: { max: MAX_NOMBRE_CONTACTO, actual: compuesto.length } }
    : null;
};

/** El nombre del representante legal: sus cinco partes, como un único grupo. */
function grupoDeNombre(): FormGroup<ControlesDeNombre> {
  return new FormGroup(controlesDeNombre(), { validators: [nombreCompletoCabe] });
}

/** Los siete campos de una gerencia de contacto (subtarea 1.4): nombre en cinco partes, celular, correo. */
function grupoDeGerente(): FormGroup<
  ControlesDeNombre & { phone: FormControl<string>; email: FormControl<string> }
> {
  return new FormGroup(
    {
      ...controlesDeNombre(),
      phone: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, telefonoCompleto],
      }),
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email, Validators.maxLength(MAX_CORREO)],
      }),
    },
    { validators: [nombreCompletoCabe] },
  );
}

/**
 * Registro público de una organización aseguradora
 * (`POST /iam/auth/register-organization`).
 *
 * ## Por qué es una pantalla propia y no un tercer tipo del alta de `RegisterPatient`
 *
 * Ahí los dos formularios comparten un mismo endpoint de auto-registro de
 * *personas*. Acá el sujeto que se crea es una **organización** —con su
 * propio usuario owner adentro—, y el endpoint es otro
 * (`register-organization`, no `register-patient` ni `register-practitioner`).
 * Mezclarlo como una tercera pestaña habría forzado a los dos formularios de
 * persona a convivir con un bloque de datos de empresa que no les concierne.
 *
 * ## El tipo de tenant es fijo
 *
 * A diferencia del alta administrativa (`OrganizationNew`), que ofrece los
 * diez tipos de `TENANT_TYPE_CODES`, acá no hay nada que elegir: esta
 * pantalla sólo da de alta aseguradoras, así que el cliente manda
 * `tenantType: 'PAYER'` fijo y el bloque `payer` **siempre** viaja completo.
 *
 * ## NIT reusa `regulatorIdentifier`
 *
 * No es una columna nueva del backend: es el mismo campo que ya exige el
 * alta administrativa de aseguradoras, sólo que acá se etiqueta «NIT» porque
 * es como lo conoce quien se registra.
 *
 * ## Tipo societario y país de constitución (subtarea 1.1)
 *
 * El registro de procesos pide que el tipo societario se **elija de una
 * lista cerrada**, «para tener DATA de cuántos proveedores tenemos con SRL,
 * UNIPERSONAL y S.A.». `incorporationCountry` es un campo **sólo de la
 * interfaz**: filtra qué figuras ofrece el selector de tipo societario, pero
 * no viaja al backend — un `PAYER` no es territorial (no exige
 * `countryConceptId`, ver `TERRITORIAL_TENANT_TYPES`), y el backend deriva el
 * país de constitución del propio `legalEntityType` elegido
 * (`countryConceptForLegalEntityType`). Cambiar de país recalcula las
 * opciones del tipo societario y limpia la elección si dejó de pertenecer a
 * la lista nueva — mismo patrón que el título profesional y sus
 * especialidades en `RegisterPractitioner`.
 */
@Component({
  selector: 'app-register-organization',
  imports: [
    RouterLink,
    Link,
    Alert,
    AuthSplit,
    AnnounceOnAppear,
    PaginatedForm,
    CampoPersonalizado,
    NgTemplateOutlet,
    DropzonePdf,
    UbicacionPicker,
    // Representante legal y gerencias (subtarea 1.4): el acordeón se declara
    // fuera del `[formGroup]` del motor (como los demás `ng-template` de
    // `appCampoPersonalizado`), así que sus controles se enchufan con
    // `[formControl]` y no con `formControlName` — de ahí `ReactiveFormsModule`.
    ReactiveFormsModule,
    Accordion,
    AccordionPanel,
    FormField,
    Input,
    PhoneInput,
  ],
  templateUrl: './register-organization.html',
  styleUrl: './register-organization.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterOrganization {
  private readonly iam = inject(IamClient);
  private readonly router = inject(Router);
  private readonly legalEntityTypes = inject(LegalEntityTypesCatalog);

  protected readonly claim = 'Gestioná tu aseguradora en un solo lugar';
  protected readonly tagline =
    'Sumate a la red de salud y conectá con miles de pacientes y prestadores.';

  readonly form = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(MAX_CODIGO),
        Validators.pattern(CODIGO_VALIDO),
      ],
    }),
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    tradeName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_NOMBRE)],
    }),
    // País de constitución y tipo societario (subtarea 1.1). El país nunca
    // viaja al backend: sólo filtra qué figuras ofrece el segundo campo. Ver
    // el JSDoc de la clase.
    incorporationCountry: new FormControl('BO', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    legalEntityType: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    sigla: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_SIGLA)],
    }),
    regulatorIdentifier: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NIT)],
    }),
    address: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_DIRECCION)],
    }),
    carrierCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_CARRIER_CODE)],
    }),
    timeZone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_ZONA_HORARIA)],
    }),
    // Documentos legales de afiliación (subtarea 1.2): guardan el `fileId`
    // que devuelve la pre-carga, no el archivo. Obligatorio en el
    // formulario, opcional en el contrato — mismo criterio que
    // `legalEntityType` (ver el JSDoc de la clase).
    constitutionFileId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    taxIdentifierFileId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    commerceRegistryFileId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    operatingLicenseFileId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    healthAuthorityCertificateFileId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    // Representante legal (subtarea 1.4 + desglose de nombre): sus cinco
    // partes como un único grupo (`grupoDeNombre`), igual que el resto del
    // alta. El teléfono es el único dato de contacto opcional: el registro
    // de procesos no lo pide, y `telefonoCompleto` deja pasar la cadena
    // vacía (ver su JSDoc).
    legalRepresentative: grupoDeNombre(),
    legalRepresentativeIdNumber: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(MIN_CI_REPRESENTANTE),
        Validators.maxLength(MAX_CI_REPRESENTANTE),
      ],
    }),
    legalRepresentativeEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(MAX_CORREO)],
    }),
    legalRepresentativePhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    powerOfAttorneyFileId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    // Las tres gerencias de contacto (subtarea 1.4), como un único grupo
    // anidado: es lo que le permite al motor bloquear «Siguiente» y saltar a
    // esta página cuando algo falta (`form.get('executives')` existe y es
    // inválido), cosa que 9 controles sueltos con un campo `custom` sin
    // `FormControl` homónimo no lograrían — ver `paginaEsValida` del motor.
    executives: new FormGroup({
      generalManager: grupoDeGerente(),
      commercialManager: grupoDeGerente(),
      marketingManager: grupoDeGerente(),
    }),
    // Datos del owner. El nombre va en sus cinco partes, igual que el
    // resto de las personas de este alta: el backend sigue sin columna de
    // tercer nombre, así que `thirdName` se pliega en `middleName` al
    // enviar — ver `datos()` y `unirNombres`.
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    middleName: new FormControl('', { nonNullable: true }),
    thirdName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_PARTE_NOMBRE)],
    }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    motherLastName: new FormControl('', { nonNullable: true }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
  });

  /** Las opciones crudas del catálogo, sin filtrar por país. */
  private readonly opcionesTipoSocietarioCrudas = signal<readonly DynamicEnumOption[]>([]);
  protected readonly catalogoTipoSocietarioCaido = signal(false);

  /** Los cinco países que ofrece el diccionario, Bolivia primero. */
  protected readonly opcionesPaisSocietario: readonly SelectOption<string>[] =
    this.legalEntityTypes.paises();

  /** Las formas societarias del país elegido, ya traducidas. */
  protected readonly opcionesTipoSocietario = computed<readonly SelectOption<string>[]>(() =>
    this.legalEntityTypes.opcionesPorPais(
      this.opcionesTipoSocietarioCrudas(),
      this.incorporationCountryElegido(),
    ),
  );

  /**
   * El país elegido, **como señal**.
   *
   * Duplica el valor del `FormControl` a propósito: `opcionesTipoSocietario`
   * es un `computed`, y un `computed` sólo se recalcula cuando cambia una
   * SEÑAL que leyó — el valor de un `FormControl` no lo despierta. Mismo
   * patrón que `tituloProfesionalElegido` en `RegisterPractitioner`.
   */
  private readonly incorporationCountryElegido = signal('BO');

  /**
   * El alta, servida de a una página.
   *
   * Catorce campos en una pantalla es lo que hace abandonar un registro a la
   * mitad, y este es el alta pública de una aseguradora: quien la abre no tiene
   * ninguna obligación de terminarla. Las tres secciones son las que ya
   * separaban visualmente el formulario —la empresa, su identificación ante la
   * plataforma, y la cuenta de quien la administra—; el motor las parte en
   * páginas de cuatro conservando el nombre.
   *
   * `computed`, y no una constante: las opciones del tipo societario cambian
   * con el país elegido (subtarea 1.1).
   */
  protected readonly paginas = computed(() =>
    paginarCampos([
      {
        titulo: 'La empresa',
        hint: 'Cómo se llama y qué figura jurídica tiene.',
        campos: [
          {
            key: 'legalName',
            label: 'Nombre de la empresa',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-nombre',
            mensajeDeError: 'Escribí el nombre de la empresa.',
          },
          {
            key: 'incorporationCountry',
            label: 'País de constitución',
            hint: 'Determina qué figuras societarias se pueden elegir.',
            control: 'select' as const,
            options: this.opcionesPaisSocietario,
            required: true,
            testId: 'registro-organizacion-pais',
            mensajeDeError: 'Elegí el país de constitución.',
          },
          {
            key: 'legalEntityType',
            label: 'Tipo societario',
            hint: 'La figura jurídica con la que está constituida la empresa.',
            control: 'select' as const,
            options: this.opcionesTipoSocietario(),
            required: true,
            testId: 'registro-organizacion-tipo-societario',
            mensajeDeError: 'Elegí el tipo societario.',
          },
          {
            key: 'tradeName',
            label: 'Nombre comercial (opcional)',
            hint: 'Con el que la conocen los afiliados. Es el que se ve en el directorio.',
            control: 'text' as const,
            testId: 'registro-organizacion-comercial',
          },
        ],
      },
      {
        titulo: 'Cómo se la identifica',
        hint: 'El código y la sigla con los que aparece en la plataforma.',
        campos: [
          {
            key: 'code',
            label: 'Código',
            hint: 'Identificador único en toda la plataforma.',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-codigo',
            mensajeDeError: 'Escribí un código: letras, números, punto, guion o guion bajo.',
          },
          {
            key: 'sigla',
            label: 'Sigla',
            hint: 'Las pocas letras con las que se la nombra en tablas y comprobantes.',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-sigla',
            mensajeDeError: 'Escribí la sigla (hasta 20 caracteres).',
          },
          {
            key: 'carrierCode',
            label: 'Código de aseguradora',
            hint: 'El código interno con el que la plataforma la identifica.',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-carrier',
            mensajeDeError: 'Escribí el código de aseguradora (hasta 60 caracteres).',
          },
          {
            key: 'timeZone',
            label: 'Zona horaria (opcional)',
            hint: 'Formato IANA, por ejemplo America/La_Paz.',
            control: 'text' as const,
            testId: 'registro-organizacion-zona',
            mensajeDeError: 'La zona horaria no puede superar los 100 caracteres.',
          },
        ],
      },
      {
        titulo: 'Datos de la aseguradora',
        hint: 'Lo que la plataforma necesita para facturarle y ubicarla.',
        campos: [
          {
            key: 'regulatorIdentifier',
            label: 'NIT',
            hint: 'El número de identificación tributaria, para la facturación.',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-nit',
            mensajeDeError: 'Escribí el NIT de la empresa.',
          },
          {
            key: 'address',
            label: 'Dirección',
            hint: 'La de la casa matriz. Las de cada sucursal se cargan después.',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-direccion',
            mensajeDeError: 'Escribí la dirección (hasta 300 caracteres).',
          },
          {
            key: 'gpsCasaMatriz',
            label: 'Ubicación de la casa matriz en el mapa (opcional)',
            hint: 'Usá tu GPS o tocá el plano. Sin el punto, la aseguradora no aparece cuando alguien busca la más cercana.',
            control: 'custom' as const,
            ancho: 'completo' as const,
          },
        ],
      },
      {
        titulo: 'Documentación legal obligatoria (PDF)',
        clave: 'documentos-legales',
        icon: 'folder' as const,
        hint: 'Solo PDF, hasta 10 MB por archivo. Se suben al instante y quedan pendientes de verificación.',
        campos: camposDeDocumentosLegales(this.incorporationCountryElegido(), uiLanguage()),
      },
      {
        titulo: 'Representante legal',
        clave: 'legal-representative',
        hint: 'Quien está facultado para firmar en nombre de la aseguradora.',
        campos: [
          {
            // Sin rótulo, mismo motivo que `executives` más abajo: el
            // `app-form-field` externo de un campo `custom` pintaría un
            // `<label for>` hacia un control que no existe, y el título de
            // la página ya dice de qué se trata.
            key: 'legalRepresentative',
            label: '',
            control: 'custom' as const,
            ancho: 'completo' as const,
            mensajeDeError:
              'Completá el nombre y el apellido paterno del representante legal.',
          },
          {
            key: 'legalRepresentativeIdNumber',
            label: 'Cédula de identidad',
            hint: 'Como figura en el carnet, con su extensión. Ej. 4872190 SC',
            control: 'text' as const,
            required: true,
            testId: 'registro-organizacion-representante-ci',
            mensajeDeError: 'Escribí el número de cédula.',
          },
          {
            key: 'legalRepresentativeEmail',
            label: 'Correo oficial de notificaciones',
            control: 'email' as const,
            required: true,
            testId: 'registro-organizacion-representante-correo',
            mensajeDeError: 'Ingresá un correo válido.',
          },
          {
            key: 'legalRepresentativePhone',
            label: 'Teléfono de contacto (opcional)',
            control: 'tel' as const,
            testId: 'registro-organizacion-representante-telefono',
            mensajeDeError: 'Completá el número.',
          },
          campoDelPoderNotariado(this.incorporationCountryElegido(), uiLanguage()),
        ],
      },
      {
        titulo: 'Directorio ejecutivo',
        clave: 'executives',
        hint: 'Contactos para convenios, conciliaciones y soporte de siniestros.',
        campos: [
          {
            // Sin rótulo a propósito: el `app-form-field` externo de un
            // campo `custom` pintaría un `<label for>` hacia un control que
            // no existe (nadie reclama `FORM_CONTROL_CONTEXT` acá), y el
            // título de la página más el encabezado de cada gerencia ya
            // dicen de qué se trata cada cosa.
            key: 'executives',
            label: '',
            control: 'custom' as const,
            ancho: 'completo' as const,
            mensajeDeError: 'Completá nombre, celular y correo de las tres gerencias.',
          },
        ],
      },
      {
        titulo: 'Tu cuenta',
        hint: 'Quien administra la aseguradora en la plataforma.',
        campos: [
        {
          key: 'name',
          label: 'Nombre',
          control: 'text' as const,
          required: true,
          autocomplete: 'given-name',
          testId: 'registro-organizacion-owner-nombre',
          mensajeDeError: 'Ingresá tu nombre.',
        },
        {
          key: 'middleName',
          label: 'Segundo nombre (opcional)',
          control: 'text' as const,
          autocomplete: 'additional-name',
          testId: 'registro-organizacion-owner-segundo-nombre',
        },
        {
          key: 'thirdName',
          label: 'Tercer nombre u otros (opcional)',
          control: 'text' as const,
          testId: 'registro-organizacion-owner-tercer-nombre',
        },
        {
          key: 'lastName',
          label: 'Apellido paterno',
          control: 'text' as const,
          required: true,
          autocomplete: 'family-name',
          testId: 'registro-organizacion-owner-apellido-paterno',
          mensajeDeError: 'Ingresá tu apellido paterno.',
        },
        {
          key: 'motherLastName',
          label: 'Apellido materno (opcional)',
          control: 'text' as const,
          autocomplete: 'family-name',
          testId: 'registro-organizacion-owner-apellido-materno',
        },
        {
          key: 'email',
          label: 'Correo',
          hint: 'Con este correo vas a iniciar sesión.',
          control: 'email' as const,
          required: true,
          autocomplete: 'username',
          testId: 'registro-organizacion-owner-correo',
          mensajeDeError: 'Ingresá un correo válido.',
        },
        {
          key: 'password',
          label: 'Contraseña',
          hint: 'Al menos 8 caracteres.',
          control: 'password' as const,
          required: true,
          autocomplete: 'new-password',
          testId: 'registro-organizacion-owner-password',
          mensajeDeError: 'La contraseña necesita al menos 8 caracteres.',
        },
      ],
    },
    ]),
  );

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');

  readonly registered = signal(false);
  readonly verificationSent = signal(false);

  readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues[0]?.message ?? null;
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  constructor() {
    this.cargarTipoSocietario();
    this.acomodarPaisYTipoSocietario();
  }

  /**
   * Trae el catálogo de tipos societarios (subtarea 1.1).
   *
   * Un fallo no bloquea el registro visualmente —el campo sigue siendo
   * obligatorio, pero no hay nada que romper si el catálogo tarda—: se avisa
   * con `catalogoTipoSocietarioCaido` para que la pantalla pueda ofrecer
   * reintentar, mismo criterio que el resto de los catálogos del registro.
   */
  protected cargarTipoSocietario(): void {
    this.legalEntityTypes.listar().subscribe({
      next: (opciones) => {
        this.catalogoTipoSocietarioCaido.set(false);
        this.opcionesTipoSocietarioCrudas.set(opciones);
      },
      error: () => {
        this.opcionesTipoSocietarioCrudas.set([]);
        this.catalogoTipoSocietarioCaido.set(true);
      },
    });
  }

  /** Reintenta la lectura del catálogo. Ver `reintentarDepartamentos` en `RegisterPractitioner`. */
  protected reintentarTipoSocietario(): void {
    this.legalEntityTypes.olvidar();
    this.cargarTipoSocietario();
  }

  /**
   * Cambiar el país recalcula las opciones del tipo societario y limpia la
   * elección si dejó de pertenecer a la lista nueva — un desplegable con un
   * valor que no está entre sus opciones muestra un vacío que miente. Se
   * llama desde el constructor: `takeUntilDestroyed` pide contexto de
   * inyección.
   */
  private acomodarPaisYTipoSocietario(): void {
    const pais = this.form.controls.incorporationCountry;
    const tipoSocietario = this.form.controls.legalEntityType;
    pais.valueChanges.pipe(takeUntilDestroyed()).subscribe((valor) => {
      this.incorporationCountryElegido.set(valor);

      const validos = new Set(this.opcionesTipoSocietario().map((o) => o.value));
      if (tipoSocietario.value !== '' && !validos.has(tipoSocietario.value)) {
        tipoSocietario.setValue('');
      }
    });
  }

  /**
   * La ubicación de la casa matriz, si la persona la confirmó (subtarea 1.3).
   *
   * Una señal y no un `FormControl`: el campo es `custom` (lo pinta
   * `app-ubicacion-picker`, no un control de texto), y `app-paginated-form`
   * tolera un campo `custom` sin control homónimo en el `FormGroup`. Pasarla
   * como `[inicial]` al picker es lo que le permite sobrevivir a que el
   * asistente destruya y recree esta página al navegar (misma lección que
   * `documentosSubidos`, arriba).
   */
  readonly gpsCasaMatriz = signal<Coordenadas | null>(null);

  protected readonly idsUbicacionCasaMatriz: IdsDePrueba = {
    mapa: 'registro-organizacion-casa-matriz-map',
    confirmada: 'registro-organizacion-casa-matriz-location-confirmed',
    avisoGeocodificacion: 'registro-organizacion-casa-matriz-geocoding-notice',
    quitar: 'registro-organizacion-casa-matriz-location-remove',
    sinConfirmar: 'registro-organizacion-casa-matriz-location-unconfirmed',
    confirmar: 'registro-organizacion-casa-matriz-location-confirm',
    usarUbicacion: 'registro-organizacion-casa-matriz-location-use',
    marcarEnMapa: 'registro-organizacion-casa-matriz-location-pick',
  };

  /** Los cinco documentos legales, en el orden del registro de procesos (subtarea 1.2). */
  protected readonly documentosLegales = DOCUMENTOS_LEGALES_DEL_REGISTRO;

  /** Cómo sube cada `app-dropzone-pdf`: delega en el mismo endpoint de pre-carga pública. */
  protected readonly subirDocumento: PdfUploader = (file) =>
    this.iam.uploadRegistrationDocument(file);

  /**
   * Lo que cada dropzone ya subió, para sobrevivir a que `app-paginated-form`
   * la destruya y recree al navegar entre páginas del asistente.
   * Ver el JSDoc de `documentoInicial` en `DropzonePdf`.
   */
  protected readonly documentosSubidos = signal<
    Partial<Record<ClaveDeDocumentoDelAlta, UploadedDocument>>
  >({});

  /** Guarda el `fileId` que la dropzone recordó, en el control que le corresponde. */
  protected registrarDocumento(clave: ClaveDeDocumentoDelAlta, fileId: string | null): void {
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

  /** Recuerda el documento recién subido para poder restaurarlo tras ir y volver. */
  protected recordarDocumento(clave: ClaveDeDocumentoDelAlta, documento: UploadedDocument): void {
    this.documentosSubidos.update((actual) => ({ ...actual, [clave]: documento }));
  }

  /**
   * Lo ya subido para ese documento, si lo hay.
   *
   * Un método y no `documentosSubidos()[clave]` directo en la plantilla: el
   * `let-clave` de `ngTemplateOutletContext` no tiene tipo (no hay guard de
   * contexto para un `ng-template` sin directiva propia), y TypeScript no
   * deja indexar un `Record` con una clave `any` bajo `noImplicitAny`.
   */
  protected documentoInicialDe(clave: ClaveDeDocumentoDelAlta): UploadedDocument | null {
    return this.documentosSubidos()[clave] ?? null;
  }

  /** Si ese documento está tocado y vacío/incompleto — mismo criterio que el resto de los campos. */
  protected esDocumentoInvalido(clave: ClaveDeDocumentoDelAlta): boolean {
    const control = this.form.controls[clave];
    return control.touched && control.invalid;
  }

  /** El rótulo ya traducido del documento, para pasárselo a su dropzone. */
  protected etiquetaDeDocumento(clave: ClaveDeDocumentoDelAlta): string {
    const campo = this.paginas()
      .flatMap((pagina) => pagina.campos)
      .find((c) => c.key === clave);
    return campo?.label ?? '';
  }

  /** Las tres gerencias del acordeón (subtarea 1.4), en el orden del registro de procesos. */
  protected readonly gerencias: readonly {
    readonly key: 'generalManager' | 'commercialManager' | 'marketingManager';
    readonly heading: string;
    readonly testId: string;
    readonly expanded: ReturnType<typeof signal<boolean>>;
  }[] = [
    {
      key: 'generalManager',
      heading: '1. Gerente General',
      testId: 'general-manager',
      // Abierta por defecto: es la primera que se completa, y un acordeón que
      // arranca con las tres plegadas obligaría a un clic antes de escribir
      // nada.
      expanded: signal(true),
    },
    {
      key: 'commercialManager',
      heading: '2. Gerente Comercial',
      testId: 'commercial-manager',
      expanded: signal(false),
    },
    {
      key: 'marketingManager',
      heading: '3. Gerente de Marketing',
      testId: 'marketing-manager',
      expanded: signal(false),
    },
  ];

  /**
   * Los cinco campos de nombre, iguales para el representante legal y las
   * tres gerencias — mismo desglose que paciente, médico y el owner de este
   * alta. `ancho` decide cuánto ocupa cada uno en `register-org__nombres`.
   */
  protected readonly camposDeNombre: readonly {
    readonly key: 'name' | 'middleName' | 'thirdName' | 'lastName' | 'motherLastName';
    readonly label: string;
    readonly autocomplete?: string;
    readonly testId: string;
    readonly ancho: 'tercio' | 'mitad';
    readonly required?: boolean;
  }[] = [
    {
      key: 'name',
      label: 'Primer nombre',
      autocomplete: 'given-name',
      testId: 'nombre',
      ancho: 'tercio',
      required: true,
    },
    {
      key: 'middleName',
      label: 'Segundo nombre (opcional)',
      autocomplete: 'additional-name',
      testId: 'segundo-nombre',
      ancho: 'tercio',
    },
    {
      key: 'thirdName',
      label: 'Tercer nombre u otros (opcional)',
      testId: 'tercer-nombre',
      ancho: 'tercio',
    },
    {
      key: 'lastName',
      label: 'Apellido paterno',
      autocomplete: 'family-name',
      testId: 'apellido-paterno',
      ancho: 'mitad',
      required: true,
    },
    {
      key: 'motherLastName',
      label: 'Apellido materno (opcional)',
      autocomplete: 'family-name',
      testId: 'apellido-materno',
      ancho: 'mitad',
    },
  ];

  /** Celular y correo de una gerencia (subtarea 1.4): lo único que no es nombre. */
  protected readonly camposDeContactoDeGerencia: readonly {
    readonly key: 'phone' | 'email';
    readonly label: string;
    readonly hint?: string;
    readonly control: 'tel' | 'email';
    readonly autocomplete?: string;
  }[] = [
    {
      key: 'phone',
      label: 'Celular',
      hint: 'Con WhatsApp activo.',
      control: 'tel',
      autocomplete: 'tel',
    },
    { key: 'email', label: 'Correo corporativo', control: 'email', autocomplete: 'email' },
  ];

  /**
   * El `FormControl` de un campo de una gerencia, dentro del grupo `executives`.
   *
   * Tipado como `FormControl` y no como `AbstractControl`: `[formControl]`
   * (`FormControlDirective`) exige el tipo concreto, y el grupo anidado sólo
   * contiene `FormControl`s (nunca otro `FormGroup`).
   */
  protected controlDeGerencia(
    gerenciaKey: 'generalManager' | 'commercialManager' | 'marketingManager',
    campoKey:
      | 'name'
      | 'middleName'
      | 'thirdName'
      | 'lastName'
      | 'motherLastName'
      | 'phone'
      | 'email',
  ): FormControl<string> {
    return this.form.controls.executives.controls[gerenciaKey].controls[campoKey];
  }

  /** El `FormControl` de un campo de nombre del representante legal. */
  protected controlDelRepresentante(
    campoKey: 'name' | 'middleName' | 'thirdName' | 'lastName' | 'motherLastName',
  ): FormControl<string> {
    return this.form.controls.legalRepresentative.controls[campoKey];
  }

  /**
   * El error de un nombre compuesto (>200 caracteres en total), a nivel de
   * `FormGroup` — nunca del `FormControl` de una parte: el validador vive
   * en el grupo porque depende de las cinco partes juntas. Se muestra bajo
   * el apellido paterno, que es donde ya se lee cuando el resto del nombre
   * está completo.
   */
  private errorDeNombreLargo(grupo: AbstractControl): string {
    return grupo.touched && grupo.hasError('nombreCompletoLargo')
      ? 'El nombre completo no puede pasar de 200 caracteres.'
      : '';
  }

  /** Reusa los mismos textos de error que el resto del alta. */
  protected errorDeGerencia(
    gerenciaKey: 'generalManager' | 'commercialManager' | 'marketingManager',
    campo: {
      readonly key:
        | 'name'
        | 'middleName'
        | 'thirdName'
        | 'lastName'
        | 'motherLastName'
        | 'phone'
        | 'email';
      readonly label: string;
    },
  ): string {
    const mensajePropio = mensajeDeError(this.controlDeGerencia(gerenciaKey, campo.key), {
      label: campo.label,
      mensajeDeError: campo.key === 'phone' ? 'Completá el número.' : undefined,
    });
    if (mensajePropio !== '' || campo.key !== 'lastName') return mensajePropio;
    return this.errorDeNombreLargo(this.form.controls.executives.controls[gerenciaKey]);
  }

  /** Mismo criterio que {@link errorDeGerencia}, para el representante legal. */
  protected errorDelRepresentante(campo: {
    readonly key: 'name' | 'middleName' | 'thirdName' | 'lastName' | 'motherLastName';
    readonly label: string;
  }): string {
    const mensajePropio = mensajeDeError(this.controlDelRepresentante(campo.key), {
      label: campo.label,
    });
    if (mensajePropio !== '' || campo.key !== 'lastName') return mensajePropio;
    return this.errorDeNombreLargo(this.form.controls.legalRepresentative);
  }

  /**
   * Marca y despliega el acordeón cuando el motor bloquea «Siguiente» en la
   * página `executives` (salida `rechazada` del motor, subtarea 1.4).
   *
   * Hace falta porque el motor sólo marca **al grupo** (`markAsTouched`), no
   * a sus hijos, y el `blur` del primer campo ya dejó tocado al grupo, así
   * que un segundo `markAsTouched` del motor no dispara nada nuevo — de ahí
   * que esto viva acá y no escuchando el propio `FormGroup`.
   */
  protected alRechazarPagina(pagina: PaginaDeFormulario): void {
    if (pagina.clave === 'legal-representative') {
      // Mismo motivo que para `executives`: el motor sólo marca el GRUPO
      // (`markAsTouched`), no a sus cinco hijos.
      this.form.controls.legalRepresentative.markAllAsTouched();
      return;
    }
    if (pagina.clave !== 'executives') return;

    const grupo = this.form.controls.executives;
    grupo.markAllAsTouched();
    for (const gerencia of this.gerencias) {
      if (grupo.controls[gerencia.key].invalid) {
        gerencia.expanded.set(true);
      }
    }
  }

  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.iam.registerOrganization(this.datos()).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.verificationSent.set(resultado.emailVerificationSent);
        this.registered.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  /**
   * Lleva al login en vez de iniciar sesión sola.
   *
   * El endpoint devuelve los identificadores del tenant y del owner, no
   * tokens: entrar automáticamente exigiría un segundo viaje con las
   * credenciales recién escritas.
   */
  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  private datos(): OrganizationRegistration {
    const raw = this.form.getRawValue();
    const tradeName = raw.tradeName.trim();
    const timeZone = raw.timeZone.trim();
    // El backend no tiene columna de tercer nombre: se pliega en
    // `middleName`, igual que en el alta de paciente y de médico.
    const segundoNombre = unirNombres([raw.middleName, raw.thirdName]);
    const apellidoMaterno = raw.motherLastName.trim();
    const casaMatriz = this.gpsCasaMatriz();
    const telefonoRepresentante = raw.legalRepresentativePhone.trim();
    const gerente = (g: {
      name: string;
      middleName: string;
      thirdName: string;
      lastName: string;
      motherLastName: string;
      phone: string;
      email: string;
    }) => ({
      fullName: componerNombreCompleto(g),
      phone: g.phone.trim(),
      email: g.email.trim(),
    });

    return {
      code: raw.code.trim(),
      legalName: raw.legalName.trim(),
      legalEntityType: raw.legalEntityType,
      ...(tradeName === '' ? {} : { tradeName }),
      ...(timeZone === '' ? {} : { timeZone }),
      payer: {
        carrierCode: raw.carrierCode.trim(),
        regulatorIdentifier: raw.regulatorIdentifier.trim(),
        sigla: raw.sigla.trim(),
        address: raw.address.trim(),
        ...(casaMatriz === null
          ? {}
          : { latitude: casaMatriz.lat, longitude: casaMatriz.lng }),
      },
      owner: {
        email: raw.email.trim(),
        password: raw.password,
        name: raw.name.trim(),
        lastName: raw.lastName.trim(),
        ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
        ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      },
      legalDocuments: {
        constitutionFileId: raw.constitutionFileId,
        taxIdentifierFileId: raw.taxIdentifierFileId,
        commerceRegistryFileId: raw.commerceRegistryFileId,
        operatingLicenseFileId: raw.operatingLicenseFileId,
        healthAuthorityCertificateFileId: raw.healthAuthorityCertificateFileId,
      },
      // Representante legal y gerencias (subtarea 1.4): al nivel de
      // `organization`, nunca dentro de `payer` — ver el JSDoc de la clase.
      legalRepresentative: {
        fullName: componerNombreCompleto(raw.legalRepresentative),
        idNumber: raw.legalRepresentativeIdNumber.trim(),
        email: raw.legalRepresentativeEmail.trim(),
        ...(telefonoRepresentante === '' ? {} : { phone: telefonoRepresentante }),
        powerOfAttorneyFileId: raw.powerOfAttorneyFileId,
      },
      executives: {
        generalManager: gerente(raw.executives.generalManager),
        commercialManager: gerente(raw.executives.commercialManager),
        marketingManager: gerente(raw.executives.marketingManager),
      },
    };
  }
}
