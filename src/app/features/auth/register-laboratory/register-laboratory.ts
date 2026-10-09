import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { map, switchMap } from 'rxjs';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { IamClient } from '../../../core/data-access/iam/iam.client';
import type {
  DiagnosticUnitBranchRegistration,
  LaboratoryOrganizationRegistration,
} from '../../../core/data-access/iam/iam.types';
import { registrationErrorToViewState } from '../shared-registration/registration-errors';
import { uiLanguage } from '../../../core/i18n/ui-language';
import { loading, ready, validation } from '../../../core/view-state/view-state';
import {
  AVISO_CATALOGO_DE_DIAGNOSTICO,
  AltaDeCentroDiagnostico,
  CODIGOS_DE_DIAGNOSTICO,
  CatalogoIncompleto,
  type CatalogosDeDiagnostico,
} from '../shared-registration/diagnostic-center-enrollment';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
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
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/custom-field';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import {
  RegistroAyuda,
  type TarjetaDeAyuda,
} from '../../../shared/components/organisms/registration-help/registration-help';
import {
  campoDelPoderNotariado,
  camposDeDocumentosLegales,
  DOCUMENTOS_LEGALES_DEL_REGISTRO,
  type ClaveDeDocumentoDelAlta,
} from '../shared-registration/legal-documents';
import {
  MENSAJE_CONTRASENA_CORTA,
  validadoresDeContrasena,
} from '../shared-registration/password-policy';
import { paginarCampos } from '../../../shared/forms/paginated/paginate-fields';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import {
  AVISO_REESCRIBIR_DIRECCION,
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../shared-registration/map-location-picker/map-location-picker';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { CamposDeNombre } from '../shared-registration/name-fields/name-fields';
import {
  grupoDeNombre,
  nombreCompleto,
} from '../shared-registration/name-fields/person-name';

/* ============================================================================
    Alta del laboratorio de sangre — proceso 4.1 del registro del stakeholder.

    Lo que se pregunta acá, y en este orden, es la lista de dieciocho puntos de
    «MODULO LABORATORIO DE SANGRE · Registro en la App Datos Legales de la
    empresa», transcripta en `SALUD/📋 Registro de procesos por módulo.md`. No
    se agregó ninguna pregunta que la fuente no haga —salvo la contraseña, ver
    el JSDoc de la clase— ni se sacó ninguna que sí haga.

    Sale a la red igual que el alta de farmacia (carril A de la cuenta de
    laboratorio, 30/09/2026): `POST /iam/auth/register-organization` con
    `tenantType: 'DIAGNOSTIC_CENTER'` y el bloque `diagnosticUnit`. Ver
    `submit()` y `PENDIENTES-BACKEND.md`, P51.
    ========================================================================== */

/**
 * Los ocho tipos societarios del punto 4.1.1.1, tal como los enumera la fuente.
 *
 * **Se elige, no se escribe.** El proceso lo pide con todas las letras —«SOLO
 * SELECCIONAR AL REGISTRAR»— y dice para qué: poder contar cuántos proveedores
 * hay de cada tipo. Un campo libre haría imposible ese conteo el primer día que
 * alguien escriba «S.R.L.», «SRL» y «Srl.».
 *
 * **`SRL` y `LTDA` son, en Bolivia, la misma figura** (Sociedad de
 * Responsabilidad Limitada, que se abrevia «Ltda.»). Van las dos porque la
 * fuente las enumera por separado y acá la fuente manda; la contradicción se
 * anota para escalarla, no se resuelve en silencio fusionándolas — si la
 * plataforma decide que son una sola, esa decisión cambia el conteo que el
 * propio punto 4.1.1.1 pide, y no es de esta pantalla.
 */
export const TIPOS_DE_SOCIEDAD: readonly SelectOption<string>[] = [
  { value: 'UNIPERSONAL', label: 'Unipersonal' },
  { value: 'SRL', label: 'S.R.L.' },
  { value: 'LTDA', label: 'Ltda.' },
  { value: 'SA', label: 'S.A.' },
  { value: 'SOCIEDAD_COLECTIVA', label: 'Sociedad colectiva' },
  { value: 'COMANDITA_SIMPLE', label: 'Sociedad en comandita simple' },
  // `COMANDITA_ACCIONES` (subtarea 1.1): el código real del diccionario
  // compartido (`legal-entity-types.dictionary.ts`). Viaja tal cual en
  // `legalEntityType`, y el simulador lo contrasta con `TIPO_SOCIETARIO` (B6).
  { value: 'COMANDITA_ACCIONES', label: 'Sociedad en comandita por acciones' },
  { value: 'SUCURSAL_EXTRANJERA', label: 'Sucursal de sociedad extranjera' },
];

/** Bolivia es el único país que contempla el registro de procesos del laboratorio. */
const PAIS = 'BO';

/** Una sucursal declarada en el alta (punto 4.1.18). */
export interface SucursalDeclarada {
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

/** El nombre de la sede primaria de la unidad: la central que declara 4.1.6. */
const NOMBRE_DE_LA_CENTRAL = 'Casa central';

/** Dígitos, con o sin guiones: el NIT boliviano es numérico. */
const NIT_VALIDO = /^[0-9][0-9-]{3,19}$/;

/**
 * Por qué se pide cada cosa, por sección.
 *
 * Mismo mecanismo que el alta de profesional: la columna cambia con el paso,
 * porque «¿por qué me piden ESTO?» es una pregunta distinta en cada página.
 */
const AYUDA: Readonly<Record<string, readonly TarjetaDeAyuda[]>> = {
  empresa: [
    {
      icono: 'building',
      titulo: 'La empresa, no el local',
      texto:
        'Acá va la razón social tal como figura en su matrícula de comercio. Los locales donde atiende se cargan más adelante, cada uno con su punto en el mapa.',
    },
    {
      icono: 'labels',
      titulo: 'El tipo se elige de la lista',
      texto:
        'No es un capricho del formulario: la plataforma necesita poder contar cuántos proveedores tiene de cada tipo, y eso sólo funciona si todos eligen de la misma lista.',
    },
  ],
  documentos: [
    {
      icono: 'folder',
      titulo: 'Ningún papel frena su alta',
      texto:
        'Puede adjuntarlos ahora o más adelante. Sí van a hacer falta para que su laboratorio quede habilitado a atender: el SEPREC, la licencia y el certificado del SEDES prueban que está registrado y habilitado para operar.',
    },
    {
      icono: 'shield',
      titulo: 'Quién los ve',
      texto:
        'Los mira el equipo que aprueba el alta. No se publican en su ficha ni los ve un paciente.',
    },
  ],
  ubicacion: [
    {
      icono: 'pin',
      titulo: 'El punto es lo que le hace aparecer',
      texto:
        'Cuando un paciente busca dónde hacerse un estudio, la app ordena por cercanía. Sin el punto en el mapa su laboratorio queda fuera de esa lista, aunque la dirección esté escrita.',
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
        'Adjúntelo acá, junto a los datos del representante. Es opcional: si el dueño se representa a sí mismo, no hace falta.',
    },
  ],
  'gerencia-general': [
    {
      icono: 'briefcase',
      titulo: 'Los cargos son opcionales',
      texto:
        'Ninguno de los tres frena el alta. Se piden para saber a quién escribirle: el detalle semanal de comisiones y las campañas van a quien corresponda, y no todo al mismo correo.',
    },
  ],
  'gerencia-comercial': [
    {
      icono: 'chart',
      titulo: 'A quién le llega la liquidación',
      texto:
        'El resumen semanal de ventas y comisiones se manda a este correo cuando está cargado. Si lo deja vacío, va al del representante legal.',
    },
  ],
  'gerencia-marketing': [
    {
      icono: 'megaphone',
      titulo: 'Campañas y promociones',
      texto:
        'Las campañas de estudios dirigidas se coordinan con esta persona. Se puede cargar más adelante desde el perfil.',
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
 * **Registro del laboratorio de sangre** — los datos legales de la empresa
 * (proceso 4.1).
 *
 * ## A dónde va
 *
 * A `POST /iam/auth/register-organization` con `tenantType: 'DIAGNOSTIC_CENTER'`
 * —el código que la API emite para un laboratorio— y el bloque
 * `diagnosticUnit` que su DTO ya declara para ese tipo: la central como sede
 * primaria, con su dirección y, si se confirmó, su punto en el mapa. Mismo
 * mecanismo que el alta de farmacia (`RegisterPharmacy`): `IamClient`,
 * `ViewState` y los PDF subidos antes por la pre-carga pública. Lo que la API
 * real todavía no acepta de este cuerpo está en `PENDIENTES-BACKEND.md`, P51.
 *
 * ## De dónde sale cada pregunta
 *
 * De los dieciocho puntos de 4.1, en su orden. La única que la fuente **no**
 * hace es la **contraseña**: sin ella no hay cuenta con la que volver a entrar,
 * y las otras altas de la plataforma la piden igual. El usuario es el correo
 * del representante legal, que sí está en la fuente (4.1.8.2), así que no se
 * inventó ninguna identidad nueva.
 *
 * Lo que la fuente **no** pide y por eso no está, anotado para que no pase por
 * olvido: 4.1 no menciona departamento ni municipio. El directorio los va a
 * necesitar para ordenar por cercanía, pero eso es una pregunta al propietario,
 * no algo que esta pantalla deba inventar.
 *
 * ## Qué es obligatorio, y por qué (misma regla que la farmacia, D2)
 *
 * Frena el alta sólo lo más básico para nacer: **razón social, tipo de
 * sociedad (de la lista cerrada), NIT, dirección legal de la central, nombre y
 * correo del representante legal —que es el correo de acceso— y contraseña**.
 *
 * El resto —los seis papeles en PDF, el punto de la central, las sucursales y
 * los tres cargos— se puede completar después. Los papeles siguen siendo lo
 * que habilita a un laboratorio a **atender** (sin certificado del SEDES no
 * puede), pero esa regla es de habilitación, no de alta, y hoy no la hace
 * cumplir ninguna capa (P51).
 */
@Component({
  selector: 'app-register-laboratory',
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
  templateUrl: './register-laboratory.html',
  styleUrls: ['../shared-registration/registration.css', './register-laboratory.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterLaboratory {
  private readonly iam = inject(IamClient);
  /** Resuelve del catálogo los conceptos de país y jurisdicción que la API exige. */
  private readonly alta = inject(AltaDeCentroDiagnostico);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    // --- 4.1.1 · la empresa ------------------------------------------------
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    companyType: new FormControl<string | null>(null, {
      validators: [Validators.required],
    }),
    // --- 4.1.2 · el NIT ----------------------------------------------------
    taxId: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(MAX_NIT),
        Validators.pattern(NIT_VALIDO),
      ],
    }),
    // --- 4.1.1.2, 4.1.2.1, 4.1.3, 4.1.4, 4.1.5, 4.1.8.1 · los seis papeles,
    // todos opcionales: cada control guarda el `fileId` de la pre-carga ------
    constitutionFileId: new FormControl('', { nonNullable: true }),
    taxIdentifierFileId: new FormControl('', { nonNullable: true }),
    commerceRegistryFileId: new FormControl('', { nonNullable: true }),
    operatingLicenseFileId: new FormControl('', { nonNullable: true }),
    healthAuthorityCertificateFileId: new FormControl('', { nonNullable: true }),
    powerOfAttorneyFileId: new FormControl('', { nonNullable: true }),
    // --- 4.1.6 · dirección legal de la central -----------------------------
    addressLines: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_DIRECCION)],
    }),
    // --- 4.1.8 · representante legal ---------------------------------------
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
    // --- 4.1.9 a 4.1.17 · los tres cargos, todos opcionales ----------------
    generalManagerName: grupoDeNombre(false),
    generalManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    generalManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    salesManagerName: grupoDeNombre(false),
    salesManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    salesManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    marketingManagerName: grupoDeNombre(false),
    marketingManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    marketingManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    // --- la cuenta ---------------------------------------------------------
    password: new FormControl('', {
      nonNullable: true,
      validators: [...validadoresDeContrasena],
    }),
  });

  /**
   * Las nueve secciones del alta, en el orden del proceso.
   *
   * Pasan por `paginarCampos` como todo lo que monta el motor. Ninguna supera
   * los cuatro campos, así que cada sección es una página y conserva su rótulo.
   */
  readonly paginas = computed(() =>
    paginarCampos([
      {
        titulo: 'La empresa',
        clave: 'empresa',
        icon: 'building' as const,
        hint: 'Los datos con los que figura en su matrícula de comercio.',
        campos: [
          {
            key: 'legalName',
            label: 'Nombre o razón social',
            control: 'text' as const,
            required: true,
            icono: 'building' as const,
            placeholder: 'Laboratorio Clínico del Sur S.R.L.',
            testId: 'registro-lab-razon-social',
            mensajeDeError: 'Escriba el nombre o la razón social de la empresa.',
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
            testId: 'registro-lab-tipo-sociedad',
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
            testId: 'registro-lab-nit',
            mensajeDeError: 'Escriba el NIT: sólo números, al menos cuatro dígitos.',
          },
        ],
      },
      {
        titulo: 'Los papeles de la empresa',
        clave: 'documentos',
        icon: 'folder' as const,
        hint: 'Opcionales: puede adjuntarlos ahora o más adelante. PDF, hasta 10 MB por archivo.',
        // Los seis, en el orden del registro de procesos: el motor parte la
        // página sola en «(1 de 2)» y «(2 de 2)».
        campos: camposDeDocumentosLegales(PAIS, uiLanguage(), false),
      },
      {
        titulo: 'Dónde está la central',
        clave: 'ubicacion',
        icon: 'pin' as const,
        campos: [
          {
            key: 'addressLines',
            label: 'Dirección legal de la central',
            hint: 'Calle, número y zona. Es la que figura en sus papeles.',
            control: 'text' as const,
            required: true,
            icono: 'pin' as const,
            placeholder: 'Av. Cañoto esq. Ballivián 234, Zona Central',
            testId: 'registro-lab-direccion',
            mensajeDeError: 'Escriba la dirección legal de la central.',
          },
          {
            key: 'gpsCentral',
            label: 'Ubicación en el mapa (opcional)',
            hint: 'Sin el punto, su laboratorio no aparece cuando alguien busca el más cercano.',
            control: 'custom' as const,
          },
        ],
      },
      {
        titulo: 'Sus sucursales',
        clave: 'sucursales',
        icon: 'hospital' as const,
        hint: 'Si sólo atiende en la central, siga de largo.',
        campos: [
          {
            key: 'sucursales',
            label: 'Sucursales (opcional)',
            control: 'custom' as const,
          },
        ],
      },
      {
        titulo: 'Representante legal',
        clave: 'representante',
        icon: 'shield' as const,
        campos: [
          {
            // Sin rótulo ni error propios: `app-name-fields` pinta cada casilla
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
            testId: 'registro-lab-representante-documento',
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
            testId: 'registro-lab-representante-correo',
            mensajeDeError: 'Escriba un correo válido: es el usuario de la cuenta.',
          },
          // El poder (4.1.8.1) se pide junto a quien lo firma, no con los papeles de la empresa.
          campoDelPoderNotariado(PAIS, uiLanguage(), this.poderObligatorio()),
        ],
      },
      {
        titulo: 'Gerencia general',
        clave: 'gerencia-general',
        icon: 'briefcase' as const,
        hint: 'Todo este paso es opcional: puede completarlo después.',
        campos: [
          {
            key: 'generalManagerName',
            label: '',
            control: 'custom' as const,
            mensajeDeError: '',
            testId: 'registro-lab-gerente-general',
          },
          {
            key: 'generalManagerPhone',
            label: 'Celular',
            control: 'tel' as const,
            testId: 'registro-lab-gerente-general-celular',
            mensajeDeError: 'El número está incompleto.',
          },
          {
            key: 'generalManagerEmail',
            label: 'Correo',
            control: 'email' as const,
            icono: 'mail' as const,
            testId: 'registro-lab-gerente-general-correo',
            mensajeDeError: 'Escriba un correo válido o déjelo vacío.',
          },
        ],
      },
      {
        titulo: 'Gerencia comercial',
        clave: 'gerencia-comercial',
        icon: 'chart' as const,
        hint: 'Opcional. Es a quien le llega el detalle semanal de ventas y comisiones.',
        campos: [
          {
            key: 'salesManagerName',
            label: '',
            control: 'custom' as const,
            mensajeDeError: '',
            testId: 'registro-lab-gerente-comercial',
          },
          {
            key: 'salesManagerPhone',
            label: 'Celular',
            control: 'tel' as const,
            testId: 'registro-lab-gerente-comercial-celular',
            mensajeDeError: 'El número está incompleto.',
          },
          {
            key: 'salesManagerEmail',
            label: 'Correo',
            control: 'email' as const,
            icono: 'mail' as const,
            testId: 'registro-lab-gerente-comercial-correo',
            mensajeDeError: 'Escriba un correo válido o déjelo vacío.',
          },
        ],
      },
      {
        titulo: 'Gerencia de marketing',
        clave: 'gerencia-marketing',
        icon: 'megaphone' as const,
        hint: 'Opcional. Es con quien se coordinan las campañas.',
        campos: [
          {
            key: 'marketingManagerName',
            label: '',
            control: 'custom' as const,
            mensajeDeError: '',
            testId: 'registro-lab-gerente-marketing',
          },
          {
            key: 'marketingManagerPhone',
            label: 'Celular',
            control: 'tel' as const,
            testId: 'registro-lab-gerente-marketing-celular',
            mensajeDeError: 'El número está incompleto.',
          },
          {
            key: 'marketingManagerEmail',
            label: 'Correo',
            control: 'email' as const,
            icono: 'mail' as const,
            testId: 'registro-lab-gerente-marketing-correo',
            mensajeDeError: 'Escriba un correo válido o déjelo vacío.',
          },
        ],
      },
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
            testId: 'registro-lab-password',
            mensajeDeError: MENSAJE_CONTRASENA_CORTA,
          },
        ],
      },
    ]),
  );

  /* --- documentos legales (dropzone real, con `fileId`) ------------------ */

  /** Cómo sube cada `app-dropzone-pdf`: la misma pre-carga pública que la farmacia y la aseguradora. */
  protected readonly subirDocumento: PdfUploader = (file) =>
    this.iam.uploadRegistrationDocument(file);

  /** Lo ya subido por cada dropzone, para sobrevivir a que el asistente destruya y recree la página. */
  protected readonly documentosSubidos = signal<
    Partial<Record<ClaveDeDocumentoDelAlta, UploadedDocument>>
  >({});

  protected readonly clavesDeDocumento: readonly ClaveDeDocumentoDelAlta[] = [
    ...DOCUMENTOS_LEGALES_DEL_REGISTRO.map((d) => d.key),
    'powerOfAttorneyFileId',
  ];

  registrarDocumento(clave: ClaveDeDocumentoDelAlta, fileId: string | null): void {
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

  /** El rótulo ya resuelto del documento, sin el sufijo «(opcional)» que lleva el campo. */
  protected etiquetaDeDocumento(clave: ClaveDeDocumentoDelAlta): string {
    const campo = this.paginas()
      .flatMap((pagina) => pagina.campos)
      .find((c) => c.key === clave);
    return campo?.label.replace(' (opcional)', '') ?? 'Documento';
  }

  /* --- la ubicación de la central ---------------------------------------- */

  /**
   * El punto de la central, ya confirmado sobre el mapa.
   *
   * Fuera del formulario, como en el alta de profesional: `app-map-location-picker`
   * emite **sólo lo confirmado** y se guarda para sí el estado intermedio.
   */
  readonly gpsCentral = signal<Coordenadas | null>(null);

  /**
   * Si el mapa vació la dirección escrita y todavía nadie la reescribió (D-06).
   *
   * Tocar el mapa deja «Dirección» en blanco —el punto nuevo ya no es esa
   * calle— y lo dice al lado. El aviso acompaña al campo vacío: en cuanto se
   * vuelve a escribir, se va solo. Las sucursales llevan el suyo, por id.
   */
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

  /** Tocaron el mapa de la central: la dirección escrita ya no vale (D-06). */
  vaciarDireccionPorElMapa(): void {
    const direccion = this.form.controls.addressLines;
    direccion.setValue('');
    // El vaciado lo hizo el sistema, no la persona: el campo vuelve a «sin
    // tocar» y el error de obligatorio espera a que lo toque o intente avanzar.
    direccion.markAsUntouched();
    this.direccionVaciadaPorElMapa.set(true);
  }

  /** Lo mismo, para el mapa de una sucursal. */
  vaciarDireccionDeSucursalPorElMapa(id: string): void {
    this.actualizarSucursal(id, { direccion: '' });
    this.sucursalesVaciadasPorElMapa.update((ids) => new Set([...ids, id]));
  }

  /** Si esa sucursal tiene la dirección en blanco porque tocaron su mapa. */
  sucursalPorReescribir(sucursal: SucursalDeclarada): boolean {
    return this.sucursalesVaciadasPorElMapa().has(sucursal.id) && sucursal.direccion.trim() === '';
  }

  protected readonly idsUbicacionCentral: IdsDePrueba = {
    mapa: 'registro-lab-central-map',
    confirmada: 'registro-lab-central-location-confirmed',
    avisoGeocodificacion: 'registro-lab-central-geocoding-notice',
    quitar: 'registro-lab-central-location-remove',
    confirmar: 'registro-lab-central-location-confirm',
    usarUbicacion: 'registro-lab-central-location-use',
    marcarEnMapa: 'registro-lab-central-location-pick',
  };

  /* --- sucursales -------------------------------------------------------- */

  /**
   * Las sucursales que se fueron agregando (4.1.18).
   *
   * Una lista que crece, y no un puñado de casillas fijas, por lo mismo que los
   * nombres del alta de profesional: un techo arbitrario deja afuera a quien
   * tiene más, y las casillas de más son ruido para quien tiene una sola.
   */
  readonly sucursales = signal<readonly SucursalDeclarada[]>([]);

  /** Contador propio: `crypto.randomUUID` no está en todos los entornos de render. */
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

  /**
   * Escribe el nombre de una sucursal desde el campo proyectado.
   *
   * `app-input` emite `string | number | null` —es el tipo de su `value`, no
   * una laxitud de esta pantalla—, así que se normaliza acá igual que en el
   * alta de profesional: el `null` de un campo vaciado es la cadena vacía, no
   * un agujero en la lista.
   */
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
    const nuevas = lote.map((borrador): SucursalDeclarada => {
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

  private actualizarSucursal(id: string, cambio: Partial<SucursalDeclarada>): void {
    this.sucursales.update((lista) =>
      lista.map((sucursal) => (sucursal.id === id ? { ...sucursal, ...cambio } : sucursal)),
    );
  }

  /** Los identificadores de prueba del mapa de una sucursal. */
  idsDeSucursal(id: string): IdsDePrueba {
    return {
      mapa: `registro-lab-${id}-map`,
      confirmada: `registro-lab-${id}-location-confirmed`,
      avisoGeocodificacion: `registro-lab-${id}-geocoding-notice`,
      quitar: `registro-lab-${id}-location-remove`,
      confirmar: `registro-lab-${id}-location-confirm`,
      usarUbicacion: `registro-lab-${id}-location-use`,
      marcarEnMapa: `registro-lab-${id}-location-pick`,
    };
  }

  /* --- la columna de ayuda ----------------------------------------------- */

  private readonly claveVisible = signal('empresa');

  readonly ayudaVisible = computed<readonly TarjetaDeAyuda[]>(
    () => AYUDA[this.claveVisible()] ?? [],
  );

  protected recordarPaso(pagina: PaginaDeFormulario): void {
    this.claveVisible.set(pagina.clave ?? '');
  }

  /* --- envío ------------------------------------------------------------- */

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');
  /** Si la API ya creó la cuenta (201). */
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
        switchMap((datos) => this.iam.registerLaboratoryOrganization(datos)),
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
    return `LAB-${nit.trim().replace(/[^A-Za-z0-9]/g, '')}`;
  }

  /** Un cargo sólo viaja si las tres partes están completas (nombre, celular y correo). */
  private cargoCompleto(cargo: { name: string; phone: string; email: string }): boolean {
    return cargo.name.trim() !== '' && cargo.phone.trim() !== '' && cargo.email.trim() !== '';
  }

  private datos(catalogos: CatalogosDeDiagnostico): LaboratoryOrganizationRegistration {
    const concepto = AltaDeCentroDiagnostico.concepto;
    const raw = this.form.getRawValue();
    const central = this.gpsCentral();

    // Una sucursal sin nombre no es una sucursal todavía: no viaja.
    const sucursales: readonly DiagnosticUnitBranchRegistration[] = this.sucursales()
      .filter((s) => s.nombre.trim() !== '')
      .map((s) => ({
        name: s.nombre.trim(),
        addressLines: s.direccion.trim() === '' ? [] : [s.direccion.trim()],
        ...(s.gps === null ? {} : { location: { latitude: s.gps.lat, longitude: s.gps.lng } }),
        ...(s.descripcion.trim() === '' ? {} : { description: s.descripcion.trim() }),
        ...(s.urlUbicacion === '' ? {} : { locationUrl: s.urlUbicacion }),
      }));

    const cargos = {
      generalManager: {
        name: nombreCompleto(raw.generalManagerName),
        phone: raw.generalManagerPhone,
        email: raw.generalManagerEmail,
      },
      commercialManager: {
        name: nombreCompleto(raw.salesManagerName),
        phone: raw.salesManagerPhone,
        email: raw.salesManagerEmail,
      },
      marketingManager: {
        name: nombreCompleto(raw.marketingManagerName),
        phone: raw.marketingManagerPhone,
        email: raw.marketingManagerEmail,
      },
    };
    const contacto = (cargo: { name: string; phone: string; email: string }) => ({
      fullName: cargo.name.trim(),
      phone: cargo.phone.trim(),
      email: cargo.email.trim(),
    });
    // Todo o nada, como el DTO: las tres gerencias o ninguna.
    const cargosCompletos = Object.values(cargos).every((cargo) => this.cargoCompleto(cargo));

    const documentos = {
      constitutionFileId: raw.constitutionFileId,
      taxIdentifierFileId: raw.taxIdentifierFileId,
      commerceRegistryFileId: raw.commerceRegistryFileId,
      operatingLicenseFileId: raw.operatingLicenseFileId,
      healthAuthorityCertificateFileId: raw.healthAuthorityCertificateFileId,
    };
    // Todo o nada, como el DTO: los cinco papeles de la empresa o ninguno.
    const documentosCompletos = Object.values(documentos).every((v) => v !== '');

    const razonSocial = raw.legalName.trim();
    const nombreDelRepresentante = nombreCompleto(raw.legalRepName);
    return {
      code: this.codigoDesdeNit(raw.taxId),
      legalName: razonSocial,
      legalEntityType: raw.companyType ?? '',
      countryConceptId: concepto(catalogos.pais, CODIGOS_DE_DIAGNOSTICO.pais),
      jurisdictionConceptId: concepto(
        catalogos.jurisdiccion,
        CODIGOS_DE_DIAGNOSTICO.jurisdiccionNacional,
      ),
      diagnosticUnit: {
        name: razonSocial,
        diagnosticUnitTypeConceptId: concepto(
          catalogos.tipoDeUnidad,
          CODIGOS_DE_DIAGNOSTICO.laboratorio,
        ),
        modalityConceptIds: [
          concepto(catalogos.modalidad, CODIGOS_DE_DIAGNOSTICO.modalidades.laboratorio),
        ],
        primarySite: {
          name: NOMBRE_DE_LA_CENTRAL,
          address: {
            lines: [raw.addressLines.trim()],
            ...(central === null ? {} : { latitude: central.lat, longitude: central.lng }),
          },
        },
        ...(sucursales.length === 0 ? {} : { branches: sucursales }),
      },
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
      ...(cargosCompletos
        ? {
            executives: {
              generalManager: contacto(cargos.generalManager),
              commercialManager: contacto(cargos.commercialManager),
              marketingManager: contacto(cargos.marketingManager),
            },
          }
        : {}),
    };
  }
}
