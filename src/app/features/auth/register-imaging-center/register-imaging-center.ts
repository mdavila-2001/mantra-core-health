import { FileInput } from '../../../shared/components/molecules/file-input/file-input';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import { Link } from '../../../shared/components/atoms/link/link';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import {
  RegistroAyuda,
  type TarjetaDeAyuda,
} from '../../../shared/components/organisms/registro-ayuda/registro-ayuda';
import { MAX_ATTACHMENT_BYTES } from '../registro-compartido/credenciales-del-medico';
import {
  MENSAJE_CONTRASENA_CORTA,
  validadoresDeContrasena,
} from '../registro-compartido/politica-de-contrasena';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import type { PaginaDeFormulario } from '../../../shared/forms/paginated/paginated-form.types';
import {
  AVISO_REESCRIBIR_DIRECCION,
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../registro-compartido/ubicacion-picker/ubicacion-picker';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { generarCodigoLegible } from '../../../core/codigo-legible/codigo-legible';
import { IamClient } from '../../../core/data-access/iam/iam.client';
import type {
  DiagnosticCenterRegistration,
  OrganizationContactPerson,
  OrganizationExecutives,
} from '../../../core/data-access/iam/iam.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready, validation } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { codigoDesdeSigla } from '../register-organization/codigo-desde-sigla';
import {
  AVISO_CATALOGO_DE_DIAGNOSTICO,
  AltaDeCentroDiagnostico,
  CODIGOS_DE_DIAGNOSTICO,
  CatalogoIncompleto,
  type CatalogosDeDiagnostico,
} from '../registro-compartido/alta-de-centro-diagnostico';

/* ============================================================================
    Alta del centro de imagenología — «MODULO ANALISIS MEDICOS (RAYOS X,
    RESONANCIA, ETC.)», punto 1 del registro del stakeholder.

    Los dieciocho puntos de datos legales que pide este módulo son, palabra por
    palabra, los mismos dieciocho del módulo de laboratorio de sangre: la fuente
    los repite completos en las dos secciones. Así que esta pantalla es el alta
    del laboratorio con dos diferencias, y las dos están anotadas donde ocurren:
    la lista de modalidades (qué estudios hace el centro) y la autorización de
    radioprotección.

    Es la MAQUETA: nada sale a la red. Ver `submit()`.
    ========================================================================== */

/**
 * Los ocho tipos societarios del punto 1.1.1 del módulo.
 *
 * **Se elige, no se escribe**, por el mismo motivo que en el alta del
 * laboratorio: la fuente lo pide con todas las letras —«SOLO SELECCIONAR AL
 * REGISTRAR»— y dice para qué, poder contar cuántos proveedores hay de cada
 * tipo. Un campo libre haría imposible ese conteo el primer día que alguien
 * escriba «S.R.L.», «SRL» y «Srl.».
 *
 * La lista se repite acá en vez de importarse de `register-laboratory`: son dos
 * altas de dos módulos distintos del registro de procesos, y atar una a la otra
 * haría que tocar la lista de un módulo cambiara en silencio el formulario del
 * otro. Si algún día la plataforma decide que la lista de tipos societarios es
 * **una sola de la empresa** y no de cada alta, el lugar donde vivirá es un
 * catálogo compartido, no el alta de laboratorio.
 */
export const TIPOS_DE_SOCIEDAD: readonly SelectOption<string>[] = [
  { value: 'UNIPERSONAL', label: 'Unipersonal' },
  { value: 'SRL', label: 'S.R.L.' },
  { value: 'LTDA', label: 'Ltda.' },
  { value: 'SA', label: 'S.A.' },
  { value: 'SOCIEDAD_COLECTIVA', label: 'Sociedad colectiva' },
  { value: 'COMANDITA_SIMPLE', label: 'Sociedad en comandita simple' },
  // Corregido a `COMANDITA_ACCIONES` (subtarea 1.1): es el código real del
  // diccionario compartido (`legal-entity-types.dictionary.ts`); esta pantalla
  // es una maqueta que no sale a la red, pero el código debe coincidir para
  // el día que se conecte.
  { value: 'COMANDITA_ACCIONES', label: 'Sociedad en comandita por acciones' },
  { value: 'SUCURSAL_EXTRANJERA', label: 'Sucursal de sociedad extranjera' },
];

/**
 * Cada modalidad de la lista → el código de su concepto en el catálogo
 * `diagnostic-modality` (BR-09). El valor del formulario sigue siendo la
 * etiqueta que ve la persona; el concepto se resuelve por código al enviar.
 */
const CODIGO_DE_MODALIDAD: Readonly<Record<string, string>> = {
  'Rayos X': CODIGOS_DE_DIAGNOSTICO.modalidades.rayosX,
  Ecografía: CODIGOS_DE_DIAGNOSTICO.modalidades.ecografia,
  'Tomografía computarizada': CODIGOS_DE_DIAGNOSTICO.modalidades.tomografia,
  'Resonancia magnética': CODIGOS_DE_DIAGNOSTICO.modalidades.resonancia,
  Mamografía: CODIGOS_DE_DIAGNOSTICO.modalidades.mamografia,
  'Densitometría ósea': CODIGOS_DE_DIAGNOSTICO.modalidades.densitometria,
};

/**
 * Los estudios que puede hacer el centro.
 *
 * **Actualización (BR-09):** las seis modalidades tienen concepto en la API
 * (`DU_MODALITY_*`) y el alta las manda como conceptos, resueltos por código
 * desde el catálogo público `diagnostic-modality`. Lo que sigue documenta el
 * estado anterior a la conexión.
 *
 * ## Por qué existe esta pregunta, si los dieciocho puntos no la hacen
 *
 * La hace el punto 2.1.5 del **mismo** módulo: «la APP le mostrara las opciones
 * de todas las empresas de análisis clínicos **que pueden realizar los
 * estudios**». Sin saber qué hace cada centro no hay forma de mostrar esa
 * lista: quedarían todos ofrecidos para todo, y un paciente con una orden de
 * resonancia terminaría en un centro que sólo tiene ecógrafo. Es también lo
 * único que distingue este alta de la del laboratorio de sangre.
 *
 * ## Qué está en el catálogo y qué no — hallazgo para `dev`
 *
 * De esta lista, **el catálogo de terminología sólo tiene dos**:
 * `diagnostic_units:MODALITY_XRAY` y `diagnostic_units:MODALITY_ULTRASOUND`
 * (las siembra `salud-db/gen_seeds.py`; la tercera, `MODALITY_LABORATORY`, es
 * la del otro módulo). **La resonancia magnética, la tomografía, la mamografía
 * y la densitometría no existen todavía como concepto**, y el módulo se llama,
 * justamente, «RAYOS X, **RESONANCIA**, ETC.».
 *
 * Se ofrecen igual las seis porque esto es la maqueta y lo que hay que poder
 * mirar y corregir es la pantalla que el propietario pidió. El día que esto se
 * conecte, las cuatro que faltan hay que sembrarlas en el modelo —dirección de
 * cambio: `gen_seeds.py`, no la base a mano— o el alta va a poder declarar algo
 * que la base no sabe guardar. Está anotado en el `.md` de traspaso.
 *
 * El valor guardado es la etiqueta y no un código: es lo que se lee en la
 * solicitud, y mientras cuatro de los seis no tengan concepto, un código sería
 * inventarlo. `otro: true` deja escribir la modalidad que la lista no previó.
 */
export const MODALIDADES: readonly SelectOption<string>[] = [
  { value: 'Rayos X', label: 'Rayos X' },
  { value: 'Ecografía', label: 'Ecografía' },
  { value: 'Tomografía computarizada', label: 'Tomografía computarizada' },
  { value: 'Resonancia magnética', label: 'Resonancia magnética' },
  { value: 'Mamografía', label: 'Mamografía' },
  { value: 'Densitometría ósea', label: 'Densitometría ósea' },
];

/** Un papel adjunto: con qué nombre llegó y cuánto pesa. */
export interface AdjuntoDeclarado {
  readonly archivo: string;
  readonly pesoBytes: number;
}

/** Una sucursal declarada en el alta (punto 1.18). */
export interface SucursalDeclarada {
  readonly id: string;
  readonly nombre: string;
  readonly direccion: string;
  readonly gps: Coordenadas | null;
}

/**
 * Los papeles del alta, por la clave del control que los guarda.
 *
 * Seis son los del proceso —constitución, NIT, SEPREC, licencia, SEDES y
 * poder—. El séptimo, `radioproteccionFile`, **no lo pide la fuente**: ver
 * dónde se declara el campo.
 *
 * Que vivan en el formulario es lo que hace que los tres obligatorios los haga
 * cumplir el motor —una página con un control inválido no avanza, y eso ya está
 * escrito y probado— en vez de una comprobación aparte que hay que acordarse de
 * llamar.
 */
export type ClaveDeAdjunto =
  | 'constitucionFile'
  | 'nitFile'
  | 'seprecFile'
  | 'licenciaFile'
  | 'sedesFile'
  | 'poderFile';

/** Cómo conoce la API cada papel del alta: por el nombre de su `fileId`. */
type ClaveDeDocumentoDelAlta =
  | 'taxIdentifierFileId'
  | 'commerceRegistryFileId'
  | 'operatingLicenseFileId'
  | 'healthAuthorityCertificateFileId'
  | 'constitutionFileId'
  | 'powerOfAttorneyFileId';

/**
 * Formatos que se aceptan: **sólo PDF**. La pre-carga del alta
 * (`POST /iam/auth/upload-registration-document`) rechaza cualquier otro tipo, y
 * ofrecer una foto que la API va a devolver es hacer perder el papel al final.
 */
const FORMATOS_DE_RESPALDO = 'application/pdf';

/** Cinco megas, el mismo tope que las otras altas: la misma constante. */
const MAX_BYTES_ADJUNTO = MAX_ATTACHMENT_BYTES;

const MAX_NOMBRE = 300;
const MAX_DIRECCION = 300;
const MAX_NIT = 100;

/** Dígitos, con o sin guiones: el NIT boliviano es numérico. */
const NIT_VALIDO = /^[0-9][0-9-]{3,19}$/;

/**
 * Por qué se pide cada cosa, por sección.
 *
 * Mismo mecanismo que las otras altas largas: la columna cambia con el paso,
 * porque «¿por qué me piden ESTO?» es una pregunta distinta en cada página.
 */
const AYUDA: Readonly<Record<string, readonly TarjetaDeAyuda[]>> = {
  empresa: [
    {
      icono: 'building',
      titulo: 'La empresa, no el local',
      texto:
        'Acá va la razón social tal como figura en tu matrícula de comercio. Los locales donde atendés se cargan más adelante, cada uno con su punto en el mapa.',
    },
    {
      icono: 'labels',
      titulo: 'El tipo se elige de la lista',
      texto:
        'No es un capricho del formulario: la plataforma necesita poder contar cuántos proveedores tiene de cada tipo, y eso sólo funciona si todos eligen de la misma lista.',
    },
  ],
  estudios: [
    {
      icono: 'scan',
      titulo: 'Es lo que te hace aparecer en la orden correcta',
      texto:
        'Cuando llega una orden médica, la app ofrece sólo los centros que pueden hacer ese estudio. Si no marcás ninguno, tu centro no entra en ninguna búsqueda.',
    },
    {
      icono: 'sliders',
      titulo: 'Marcá lo que hacés hoy',
      texto:
        'No hace falta que esté todo: el detalle por estudio, con sus precios y sus equipos, se carga después desde tu panel. Acá alcanza con las áreas grandes.',
    },
  ],
  documentos: [
    {
      icono: 'folder',
      titulo: 'Tres papeles frenan, tres no',
      texto:
        'Sin SEPREC, licencia de funcionamiento y certificado del SEDES no podemos publicar un centro: son los que prueban que está registrado y habilitado para operar. Los otros tres los podés traer después.',
    },
    {
      icono: 'shield',
      titulo: 'Quién los ve',
      texto:
        'Los mira el equipo que aprueba el alta. No se publican en tu ficha ni los ve un paciente.',
    },
  ],
  radioproteccion: [
    {
      icono: 'shield',
      titulo: 'Sólo si usás radiación ionizante',
      texto:
        'Rayos X, tomografía y mamografía la usan; la ecografía y la resonancia, no. Si tenés la autorización, adjuntala: es lo que el equipo de verificación va a pedir primero.',
    },
  ],
  ubicacion: [
    {
      icono: 'pin',
      titulo: 'El punto es lo que te hace aparecer',
      texto:
        'Cuando un paciente busca dónde hacerse un estudio, la app ordena por cercanía. Sin el punto en el mapa tu centro queda fuera de esa lista, aunque la dirección esté escrita.',
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
        'El resumen semanal de ventas y comisiones se manda a este correo cuando está cargado. Si lo dejás vacío, va al del representante legal.',
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
 * **Registro del centro de imagenología** — los datos legales de la empresa del
 * módulo «ANÁLISIS MÉDICOS (RAYOS X, RESONANCIA, ETC.)».
 *
 * ## Qué es y qué no es
 *
 * Es la maqueta visual del alta: **no hay endpoint detrás y no se llama a
 * ninguno**. La API tiene tres altas públicas —paciente, profesional y
 * aseguradora— y el centro de diagnóstico no es una de ellas, igual que no lo
 * es el laboratorio de sangre. Así que el envío se resuelve acá y la pantalla
 * lo dice: queda una solicitud, no una cuenta. Ver `submit()`.
 *
 * ## Por qué la pantalla dice «imagenología» y la fuente dice «análisis médicos»
 *
 * Porque en Bolivia «análisis» es lo que se pide en el laboratorio de sangre, y
 * ése es **el otro módulo**: dos altas que se llamaran parecido serían la
 * manera más rápida de que un centro de rayos se registre en la equivocada. Y
 * porque el nombre no es una invención de esta pantalla: el catálogo ya publica
 * la categoría `DU_TYPE_IMAGING` como «Imagenología», y así la ve hoy el
 * paciente en el directorio de laboratorios. El título del módulo, tal como lo
 * escribió el propietario, se conserva acá arriba y en el `.md` de traspaso.
 *
 * ## De dónde sale cada pregunta
 *
 * De los dieciocho puntos de datos legales del módulo, en su orden — que son
 * los mismos dieciocho del laboratorio de sangre; la fuente los repite enteros.
 * Las preguntas que la fuente **no** hace en esa lista, y por qué están:
 *
 * - **La contraseña**: sin ella no hay cuenta con la que volver a entrar, y las
 *   otras altas de la plataforma la piden igual. El usuario es el correo del
 *   representante legal, que sí está en la fuente, así que no se inventó
 *   ninguna identidad nueva.
 * - **Los estudios que hace el centro**: los pide el punto 2.1.5 del mismo
 *   módulo. Ver {@link MODALIDADES}.
 * - **La autorización de radioprotección**: ver el campo `radioproteccionFile`.
 *   Es el único agregado que no sale de ninguna línea de la fuente, y por eso
 *   es opcional y va marcado para que el propietario decida.
 *
 * Lo que la fuente **no** pide y por eso no está, anotado para que no pase por
 * olvido: no menciona departamento ni municipio. El directorio los va a
 * necesitar para ordenar por cercanía, pero eso es una pregunta al propietario,
 * no algo que esta pantalla deba inventar.
 *
 * ## Qué es obligatorio, y por qué
 *
 * La regla es la misma del alta de laboratorio: frena el alta lo que sin ello
 * no hay centro publicable.
 *
 * - **Razón social, tipo de sociedad y NIT**: la identidad tributaria de quien
 *   va a facturar. El tipo, además, es el conteo que pide 1.1.1.
 * - **Al menos un estudio**: sin eso el centro no puede aparecer en ninguna
 *   orden, que es todo lo que el módulo hace.
 * - **SEPREC, licencia de funcionamiento y certificado del SEDES**: los tres
 *   que prueban que la empresa está registrada y **habilitada para operar**.
 * - **Dirección legal de la central**: sin dirección no hay a dónde ir.
 * - **Representante legal y su correo**: es quien firma, y el correo es el
 *   usuario de la cuenta.
 *
 * No frena, y cada uno por su motivo:
 *
 * - **Los tres cargos** (general, comercial y marketing): el propietario los
 *   pidió opcionales, y son nueve campos de contacto que no cambian nada de lo
 *   que la plataforma puede hacer hoy. Opcional no es «cualquier cosa»: un
 *   correo escrito a medias sigue frenando, porque un correo inválido cargado
 *   es peor que el campo vacío —parece que hay a quién escribirle—.
 * - **Constitución de la empresa y poder del representante**: una
 *   **unipersonal** no tiene ninguno de los dos —no constituye sociedad y el
 *   titular se representa a sí mismo—. Exigirlos dejaría afuera a un tipo
 *   societario que la propia lista ofrece.
 * - **NIT en PDF**: el número ya se pide escrito; el papel es respaldo.
 * - **Autorización de radioprotección**: no la necesita un centro que sólo
 *   hace ecografía o resonancia, que no usan radiación ionizante.
 * - **Punto en el mapa y sucursales**: el GPS depende de un permiso del
 *   navegador que se puede negar, y hay centros de un solo local. Se explica lo
 *   que se pierde sin ellos en vez de frenar el alta.
 */
@Component({
  selector: 'app-register-imaging-center',
  imports: [
    FileInput,
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
  ],
  templateUrl: './register-imaging-center.html',
  styleUrls: ['../registro-compartido/registro.css', './register-imaging-center.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterImagingCenter {
  private readonly router = inject(Router);
  private readonly iam = inject(IamClient);
  private readonly alta = inject(AltaDeCentroDiagnostico);

  /**
   * El código de organización se deriva del nombre y lleva un sufijo propio de
   * esta pantalla (único en la plataforma; fijo por instancia, así un reintento
   * manda el mismo).
   */
  private readonly sufijoDeCodigo = generarCodigoLegible(5);

  constructor() {
    // La constitución de la empresa (y el poder de su representante) se exigen
    // salvo a una unipersonal.
    this.form.controls.companyType.valueChanges.subscribe((tipo) => {
      const constitucion = this.form.controls.constitucionFile;
      const poder = this.form.controls.poderFile;
      if (tipo === 'UNIPERSONAL' || tipo === null) {
        constitucion.removeValidators(Validators.required);
        poder.removeValidators(Validators.required);
      } else {
        constitucion.addValidators(Validators.required);
        poder.addValidators(Validators.required);
      }
      constitucion.updateValueAndValidity();
      poder.updateValueAndValidity();
    });
  }

  protected readonly formatosDeRespaldo = FORMATOS_DE_RESPALDO;

  readonly form = new FormGroup({
    // --- 1.1 · la empresa --------------------------------------------------
    legalName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    companyType: new FormControl<string | null>(null, {
      validators: [Validators.required],
    }),
    // --- 1.2 · el NIT ------------------------------------------------------
    taxId: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.maxLength(MAX_NIT),
        Validators.pattern(NIT_VALIDO),
      ],
    }),
    // --- 2.1.5 · qué estudios hace el centro -------------------------------
    // Vacío y no `''`: el motor evalúa `valor.includes(opcion)` para marcar las
    // casillas, y sobre una cadena eso marcaría opciones que nadie marcó.
    modalidades: new FormControl<readonly string[]>([], {
      nonNullable: true,
      validators: [Validators.required],
    }),
    // --- 1.1.2, 1.2.1, 1.3, 1.4, 1.5 · los papeles -------------------------
    // La constitución es obligatoria salvo para una unipersonal (ver el constructor).
    constitucionFile: new FormControl<AdjuntoDeclarado | null>(null),
    // El NIT en PDF es obligatorio: la API pide los cuatro papeles de la empresa
    // juntos (`legalDocuments` es todo o nada).
    nitFile: new FormControl<AdjuntoDeclarado | null>(null, {
      validators: [Validators.required],
    }),
    seprecFile: new FormControl<AdjuntoDeclarado | null>(null, {
      validators: [Validators.required],
    }),
    licenciaFile: new FormControl<AdjuntoDeclarado | null>(null, {
      validators: [Validators.required],
    }),
    sedesFile: new FormControl<AdjuntoDeclarado | null>(null, {
      validators: [Validators.required],
    }),
    // La autorización de radioprotección no viaja en el alta: la API no tiene
    // dónde guardarla (`legalDocuments` no la declara) y ofrecer un papel que se
    // tira es peor que no pedirlo. Se pide después, desde el panel (D-BR09-1).
    // --- 1.6 · dirección legal de la central -------------------------------
    addressLines: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_DIRECCION)],
    }),
    // --- 1.8 · representante legal -----------------------------------------
    legalRepName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(MAX_NOMBRE)],
    }),
    legalRepEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    // La API exige el documento del representante legal (4 a 50 caracteres).
    legalRepIdNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(4), Validators.maxLength(50)],
    }),
    poderFile: new FormControl<AdjuntoDeclarado | null>(null),
    // --- 1.9 a 1.17 · los tres cargos, todos opcionales --------------------
    generalManagerName: new FormControl('', { nonNullable: true }),
    generalManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    generalManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    salesManagerName: new FormControl('', { nonNullable: true }),
    salesManagerPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    salesManagerEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    marketingManagerName: new FormControl('', { nonNullable: true }),
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
   * Las once secciones del alta, en el orden del proceso.
   *
   * Pasan por `paginarCampos` como todo lo que monta el motor. Ninguna supera
   * los cuatro campos, así que cada sección es una página y conserva su rótulo.
   *
   * **Los estudios van segundos**, antes que los papeles: es la pregunta que
   * define qué es este centro, se contesta de memoria y sin buscar nada, y abrir
   * un alta con cuatro cajas de «adjuntá un archivo» es la forma más rápida de
   * que alguien la deje para después y no vuelva.
   */
  readonly paginas = paginarCampos([
    {
      titulo: 'La empresa',
      clave: 'empresa',
      icon: 'building' as const,
      hint: 'Los datos con los que figura en tu matrícula de comercio.',
      campos: [
        {
          key: 'legalName',
          label: 'Nombre o razón social',
          control: 'text' as const,
          required: true,
          icono: 'building' as const,
          placeholder: 'Centro de Imagenología del Oriente S.R.L.',
          testId: 'registro-imagen-razon-social',
          mensajeDeError: 'Escribí el nombre o la razón social de la empresa.',
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
          testId: 'registro-imagen-tipo-sociedad',
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
          testId: 'registro-imagen-nit',
          mensajeDeError: 'Escribí el NIT: sólo números, al menos cuatro dígitos.',
        },
      ],
    },
    {
      titulo: 'Qué estudios hacés',
      clave: 'estudios',
      icon: 'scan' as const,
      hint: 'Marcá todos los que tu centro pueda realizar hoy.',
      campos: [
        {
          key: 'modalidades',
          label: 'Estudios que realiza el centro',
          hint: 'Marcá los estudios de la lista. Uno que no esté hoy no se puede registrar en el alta.',
          control: 'checkboxes' as const,
          options: MODALIDADES,
          required: true,
          testId: 'registro-imagen-modalidades',
          mensajeDeError: 'Marcá al menos un estudio: es lo que hace que tu centro aparezca.',
        },
      ],
    },
    {
      titulo: 'Los papeles de la empresa',
      clave: 'documentos',
      icon: 'folder' as const,
      hint: 'Sólo PDF. Hasta 5 MB por archivo.',
      campos: [
        {
          key: 'seprecFile',
          ancho: 'mitad' as const,
          label: 'SEPREC',
          hint: 'La matrícula de comercio vigente.',
          control: 'custom' as const,
          required: true,
          mensajeDeError: 'Adjuntá el SEPREC: sin la matrícula no podemos publicar el centro.',
        },
        {
          key: 'licenciaFile',
          ancho: 'mitad' as const,
          label: 'Licencia de funcionamiento',
          hint: 'La que emite tu municipio.',
          control: 'custom' as const,
          required: true,
          mensajeDeError: 'Adjuntá la licencia de funcionamiento.',
        },
        {
          key: 'sedesFile',
          ancho: 'mitad' as const,
          label: 'Certificado del SEDES',
          hint: 'El que habilita al centro a operar.',
          control: 'custom' as const,
          required: true,
          mensajeDeError:
            'Adjuntá el certificado del SEDES: es lo que habilita a un centro a atender.',
        },
        {
          key: 'nitFile',
          ancho: 'mitad' as const,
          label: 'NIT en PDF',
          hint: 'El respaldo del número que escribiste antes.',
          control: 'custom' as const,
          required: true,
          mensajeDeError: 'Adjuntá el NIT en PDF: viaja junto con los demás papeles.',
        },
      ],
    },
    {
      titulo: 'Constitución y poder',
      clave: 'radioproteccion',
      icon: 'shield' as const,
      hint: 'Una empresa unipersonal no tiene ninguno de los dos; el resto de las sociedades sí. La autorización de radioprotección se pide después, desde tu panel.',
      campos: [
        {
          key: 'constitucionFile',
          ancho: 'mitad' as const,
          label: 'Constitución de la empresa',
          hint: 'La escritura con la que se constituyó la sociedad. Una unipersonal no la tiene.',
          control: 'custom' as const,
        },
        {
          key: 'poderFile',
          ancho: 'mitad' as const,
          label: 'Poder del representante legal',
          hint: 'No hace falta si el titular se representa a sí mismo (unipersonal).',
          control: 'custom' as const,
        },
      ],
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
          testId: 'registro-imagen-direccion',
          mensajeDeError: 'Escribí la dirección legal de la central.',
        },
        {
          key: 'gpsCentral',
          label: 'Ubicación en el mapa (opcional)',
          hint: 'Sin el punto, tu centro no aparece cuando alguien busca el más cercano.',
          control: 'custom' as const,
        },
      ],
    },
    {
      titulo: 'Tus sucursales',
      clave: 'sucursales',
      icon: 'hospital' as const,
      hint: 'Se cargan desde tu panel cuando la cuenta esté verificada: hoy no viajan con el alta.',
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
          key: 'legalRepName',
          label: 'Nombre del representante legal',
          control: 'text' as const,
          required: true,
          icono: 'people' as const,
          autocomplete: 'name',
          testId: 'registro-imagen-representante',
          mensajeDeError: 'Escribí el nombre del representante legal.',
        },
        {
          key: 'legalRepIdNumber',
          label: 'Documento de identidad del representante',
          hint: 'Cédula de identidad o documento equivalente.',
          control: 'text' as const,
          required: true,
          icono: 'people' as const,
          testId: 'registro-imagen-representante-documento',
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
          testId: 'registro-imagen-representante-correo',
          mensajeDeError: 'Escribí un correo válido: es el usuario de la cuenta.',
        },
      ],
    },
    {
      titulo: 'Gerencia general',
      clave: 'gerencia-general',
      icon: 'briefcase' as const,
      hint: 'Todo este paso es opcional: podés completarlo después.',
      campos: [
        {
          key: 'generalManagerName',
          label: 'Nombre del gerente general',
          control: 'text' as const,
          icono: 'people' as const,
          testId: 'registro-imagen-gerente-general',
        },
        {
          key: 'generalManagerPhone',
          label: 'Celular',
          control: 'tel' as const,
          testId: 'registro-imagen-gerente-general-celular',
          mensajeDeError: 'El número está incompleto.',
        },
        {
          key: 'generalManagerEmail',
          label: 'Correo',
          control: 'email' as const,
          icono: 'mail' as const,
          testId: 'registro-imagen-gerente-general-correo',
          mensajeDeError: 'Escribí un correo válido o dejalo vacío.',
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
          label: 'Nombre del gerente comercial',
          control: 'text' as const,
          icono: 'people' as const,
          testId: 'registro-imagen-gerente-comercial',
        },
        {
          key: 'salesManagerPhone',
          label: 'Celular',
          control: 'tel' as const,
          testId: 'registro-imagen-gerente-comercial-celular',
          mensajeDeError: 'El número está incompleto.',
        },
        {
          key: 'salesManagerEmail',
          label: 'Correo',
          control: 'email' as const,
          icono: 'mail' as const,
          testId: 'registro-imagen-gerente-comercial-correo',
          mensajeDeError: 'Escribí un correo válido o dejalo vacío.',
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
          label: 'Nombre del gerente de marketing',
          control: 'text' as const,
          icono: 'people' as const,
          testId: 'registro-imagen-gerente-marketing',
        },
        {
          key: 'marketingManagerPhone',
          label: 'Celular',
          control: 'tel' as const,
          testId: 'registro-imagen-gerente-marketing-celular',
          mensajeDeError: 'El número está incompleto.',
        },
        {
          key: 'marketingManagerEmail',
          label: 'Correo',
          control: 'email' as const,
          icono: 'mail' as const,
          testId: 'registro-imagen-gerente-marketing-correo',
          mensajeDeError: 'Escribí un correo válido o dejalo vacío.',
        },
      ],
    },
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
          testId: 'registro-imagen-password',
          mensajeDeError: MENSAJE_CONTRASENA_CORTA,
        },
      ],
    },
  ]);

  readonly attachmentFiles = signal<Partial<Record<ClaveDeAdjunto, readonly File[]>>>({});
  protected readonly maxAttachmentBytes = MAX_BYTES_ADJUNTO;

  attachmentLabel(key: ClaveDeAdjunto): string {
    return this.paginas.flatMap(page => page.campos).find(field => field.key === key)?.label ?? 'Documento';
  }

  isAttachmentRequired(key: ClaveDeAdjunto): boolean {
    return this.form.controls[key].hasValidator(Validators.required);
  }

  isAttachmentInvalid(key: ClaveDeAdjunto): boolean {
    const control = this.form.controls[key];
    return control.touched && control.invalid;
  }

  filesForAttachment(key: ClaveDeAdjunto): readonly File[] {
    return this.attachmentFiles()[key] ?? [];
  }

  updateAttachment(key: ClaveDeAdjunto, files: readonly File[]): void {
    this.attachmentFiles.update(current => ({ ...current, [key]: files }));
    const file = files[0];
    const control = this.form.controls[key];
    control.setValue(file ? { archivo: file.name, pesoBytes: file.size } : null);
    control.markAsTouched();
    this.errorAdjunto.set(null);
  }

  /* --- adjuntos ---------------------------------------------------------- */

  /** El motivo del último archivo rechazado, si hubo. */
  readonly errorAdjunto = signal<string | null>(null);

  /** El adjunto guardado en un control, para que la plantilla lo muestre. */
  adjuntoDe(clave: ClaveDeAdjunto): AdjuntoDeclarado | null {
    return this.form.controls[clave].value;
  }

  /* --- la ubicación de la central ---------------------------------------- */

  /**
   * El punto de la central, ya confirmado sobre el mapa.
   *
   * Fuera del formulario, como en las otras altas: `app-ubicacion-picker` emite
   * **sólo lo confirmado** y se guarda para sí el estado intermedio.
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
    mapa: 'registro-imagen-central-map',
    confirmada: 'registro-imagen-central-location-confirmed',
    avisoGeocodificacion: 'registro-imagen-central-geocoding-notice',
    quitar: 'registro-imagen-central-location-remove',
    confirmar: 'registro-imagen-central-location-confirm',
    usarUbicacion: 'registro-imagen-central-location-use',
    marcarEnMapa: 'registro-imagen-central-location-pick',
  };

  /* --- sucursales -------------------------------------------------------- */

  /**
   * Las sucursales que se fueron agregando (1.18).
   *
   * Una lista que crece, y no un puñado de casillas fijas: un techo arbitrario
   * deja afuera a quien tiene más, y las casillas de más son ruido para quien
   * tiene una sola.
   */
  readonly sucursales = signal<readonly SucursalDeclarada[]>([]);

  /** Contador propio: `crypto.randomUUID` no está en todos los entornos de render. */
  private proximaSucursal = 1;

  agregarSucursal(): void {
    const id = `sucursal-${this.proximaSucursal}`;
    this.proximaSucursal += 1;
    this.sucursales.update((lista) => [...lista, { id, nombre: '', direccion: '', gps: null }]);
  }

  quitarSucursal(id: string): void {
    this.sucursales.update((lista) => lista.filter((sucursal) => sucursal.id !== id));
  }

  /**
   * Escribe el nombre de una sucursal desde el campo proyectado.
   *
   * `app-input` emite `string | number | null` —es el tipo de su `value`, no
   * una laxitud de esta pantalla—, así que se normaliza acá: el `null` de un
   * campo vaciado es la cadena vacía, no un agujero en la lista.
   */
  escribirNombreDeSucursal(id: string, nombre: string | number | null): void {
    this.actualizarSucursal(id, { nombre: nombre === null ? '' : String(nombre) });
  }

  escribirDireccionDeSucursal(id: string, direccion: string | number | null): void {
    this.actualizarSucursal(id, { direccion: direccion === null ? '' : String(direccion) });
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
      mapa: `registro-imagen-${id}-map`,
      confirmada: `registro-imagen-${id}-location-confirmed`,
      avisoGeocodificacion: `registro-imagen-${id}-geocoding-notice`,
      quitar: `registro-imagen-${id}-location-remove`,
      confirmar: `registro-imagen-${id}-location-confirm`,
      usarUbicacion: `registro-imagen-${id}-location-use`,
      marcarEnMapa: `registro-imagen-${id}-location-pick`,
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

  /** Si el alta ya se envió y la API la aceptó. */
  readonly enviada = signal(false);

  /** El estado del envío: en curso, con su error o en reposo. */
  readonly estado = signal<ViewState<null>>(ready(null));
  readonly enviando = computed(() => this.estado().status === 'loading');

  /** El aviso de un envío fallido, con la referencia que soporte necesita. */
  readonly mensajeDeError = computed<string | null>(() => {
    const estado = this.estado();
    if (estado.status === 'validation') {
      return estado.issues[0]?.message ?? null;
    }
    if (estado.status === 'offline') {
      return 'No pudimos conectarnos. Revisá tu conexión y reintentá.';
    }
    if (estado.status === 'error') {
      return `${estado.message || 'Ocurrió un error inesperado.'} (${estado.requestId})`;
    }
    return null;
  });

  /**
   * Da de alta el centro: lee el catálogo, sube los PDF (en serie y antes
   * del alta) y llama a `POST /iam/auth/register-organization` con
   * `tenantType: 'DIAGNOSTIC_CENTER'`. La cuenta queda pendiente de
   * verificación; recién con la respuesta se dice que quedó registrada.
   *
   * Si una subida falla, el alta no se envía y las que ya salieron se conservan
   * para el reintento (`AltaDeCentroDiagnostico`).
   */
  submit(): void {
    if (this.enviando()) {
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.estado.set(loading());
    this.alta
      .catalogos()
      .pipe(
        // Los conceptos se resuelven antes de subir nada: si el catálogo no trae
        // uno, no quedan PDF subidos a una alta que no va a salir.
        map((catalogos) => this.conceptos(catalogos)),
        switchMap((conceptos) =>
          this.alta
            .subirDocumentos(this.archivosDelAlta())
            .pipe(switchMap((ids) => this.iam.registerOrganization(this.datos(conceptos, ids)))),
        ),
      )
      .subscribe({
        next: () => {
          this.estado.set(ready(null));
          this.enviada.set(true);
        },
        error: (error: unknown) => this.estado.set(this.fallaDelEnvio(error)),
      });
  }

  /** Los PDF elegidos, por el nombre con el que el alta los conoce. */
  private archivosDelAlta() {
    const uno = (clave: ClaveDeAdjunto): File | undefined => this.attachmentFiles()[clave]?.[0];
    return {
      taxIdentifierFileId: uno('nitFile'),
      commerceRegistryFileId: uno('seprecFile'),
      operatingLicenseFileId: uno('licenciaFile'),
      healthAuthorityCertificateFileId: uno('sedesFile'),
      constitutionFileId: uno('constitucionFile'),
      powerOfAttorneyFileId: uno('poderFile'),
    };
  }

  /** Los ids de concepto que el alta necesita, por su código. Falla si el catálogo no trae alguno. */
  private conceptos(catalogos: CatalogosDeDiagnostico) {
    const concepto = AltaDeCentroDiagnostico.concepto;
    return {
      pais: concepto(catalogos.pais, CODIGOS_DE_DIAGNOSTICO.pais),
      jurisdiccion: concepto(catalogos.jurisdiccion, CODIGOS_DE_DIAGNOSTICO.jurisdiccionNacional),
      tipoDeUnidad: concepto(catalogos.tipoDeUnidad, CODIGOS_DE_DIAGNOSTICO.imagenes),
      modalidades: this.form.controls.modalidades.value.map((etiqueta) =>
        concepto(catalogos.modalidad, CODIGO_DE_MODALIDAD[etiqueta] ?? etiqueta),
      ),
    };
  }

  /** El cuerpo del alta, con los ids del catálogo y de los PDF ya resueltos. */
  private datos(
    conceptos: ReturnType<RegisterImagingCenter['conceptos']>,
    ids: Partial<Record<ClaveDeDocumentoDelAlta, string>>,
  ): DiagnosticCenterRegistration {
    const raw = this.form.getRawValue();
    const gps = this.gpsCentral();
    const gerencias = this.gerencias();
    const nombre = raw.legalName.trim();
    const { taxIdentifierFileId, commerceRegistryFileId } = ids;
    const { operatingLicenseFileId, healthAuthorityCertificateFileId } = ids;
    // Los cuatro papeles no opcionales los exige el formulario; si alguno faltara
    // acá es que la subida no lo devolvió, y eso frena el envío en vez de mandar
    // un bloque incompleto que la API rechazaría entero.
    if (
      taxIdentifierFileId === undefined ||
      commerceRegistryFileId === undefined ||
      operatingLicenseFileId === undefined ||
      healthAuthorityCertificateFileId === undefined
    ) {
      throw new Error('Faltan papeles por adjuntar.');
    }
    return {
      tenantType: 'DIAGNOSTIC_CENTER',
      code: `${codigoDesdeSigla(nombre).slice(0, 60)}_${this.sufijoDeCodigo}`,
      legalName: nombre,
      legalEntityType: raw.companyType ?? '',
      timeZone: 'America/La_Paz',
      countryConceptId: conceptos.pais,
      jurisdictionConceptId: conceptos.jurisdiccion,
      diagnosticUnit: {
        diagnosticUnitTypeConceptId: conceptos.tipoDeUnidad,
        modalityConceptIds: conceptos.modalidades,
        primarySite: {
          name: 'Central',
          timeZone: 'America/La_Paz',
          address: {
            lines: [raw.addressLines.trim()],
            // El punto viaja sólo si se confirmó sobre el mapa.
            ...(gps === null ? {} : { latitude: gps.lat, longitude: gps.lng }),
          },
        },
      },
      owner: {
        email: raw.legalRepEmail.trim(),
        password: raw.password,
        displayName: raw.legalRepName.trim(),
      },
      legalDocuments: {
        ...(ids.constitutionFileId === undefined
          ? {}
          : { constitutionFileId: ids.constitutionFileId }),
        taxIdentifierFileId,
        commerceRegistryFileId,
        operatingLicenseFileId,
        healthAuthorityCertificateFileId,
      },
      legalRepresentative: {
        fullName: raw.legalRepName.trim(),
        idNumber: raw.legalRepIdNumber.trim(),
        email: raw.legalRepEmail.trim(),
        ...(ids.powerOfAttorneyFileId === undefined
          ? {}
          : { powerOfAttorneyFileId: ids.powerOfAttorneyFileId }),
      },
      // Las gerencias son un bloque de a tres: con menos, la API lo rechaza
      // entero. Viajan sólo si están las tres completas.
      ...(gerencias === null ? {} : { executives: gerencias }),
    };
  }

  /** Las tres gerencias, o `null` si alguna no está completa (nombre, celular y correo). */
  private gerencias(): OrganizationExecutives | null {
    const raw = this.form.getRawValue();
    const contacto = (
      fullName: string,
      phone: string,
      email: string,
    ): OrganizationContactPerson | null =>
      fullName.trim() === '' || phone.trim() === '' || email.trim() === ''
        ? null
        : { fullName: fullName.trim(), phone: phone.trim(), email: email.trim() };
    const general = contacto(raw.generalManagerName, raw.generalManagerPhone, raw.generalManagerEmail);
    const comercial = contacto(raw.salesManagerName, raw.salesManagerPhone, raw.salesManagerEmail);
    const marketing = contacto(
      raw.marketingManagerName,
      raw.marketingManagerPhone,
      raw.marketingManagerEmail,
    );
    return general === null || comercial === null || marketing === null
      ? null
      : { generalManager: general, commercialManager: comercial, marketingManager: marketing };
  }

  /** Traduce lo que falló a un estado que la pantalla sabe decir. */
  private fallaDelEnvio(error: unknown): ViewState<null> {
    if (error instanceof CatalogoIncompleto) {
      return validation([{ field: 'catalogos', message: AVISO_CATALOGO_DE_DIAGNOSTICO }]);
    }
    if (error instanceof Error && !(error instanceof HttpErrorResponse)) {
      return validation([{ field: 'alta', message: error.message }]);
    }
    return errorToViewState<null>(error);
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }
}
