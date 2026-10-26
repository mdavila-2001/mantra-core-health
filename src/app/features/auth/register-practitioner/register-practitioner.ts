import { environment } from '../../../../environments/environment';
import { FileDropTarget } from '../../../shared/forms/file-drop-target';
import { FileInput } from '../../../shared/components/molecules/file-input/file-input';
import { SignatureOrSeal } from '../../../shared/components/molecules/signature-or-seal/signature-or-seal';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
  type WritableSignal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { OnboardingDraftBanner } from '../../../shared/components/molecules/onboarding-draft-banner/onboarding-draft-banner';
import { OnboardingDraftService } from '../../../core/onboarding/onboarding-draft.service';
import type { OnboardingDraft } from '../../../core/onboarding/onboarding-draft.types';
import { HttpResponse } from '@angular/common/http';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  concat,
  concatMap,
  filter,
  from,
  map,
  of,
  throwIfEmpty,
  toArray,
  type Observable,
} from 'rxjs';

import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { IamClient } from '../../../core/data-access/iam/iam.client';
import type {
  BirthSexCode,
  NewRegistrationCredential,
  PractitionerRegistration,
  UploadedRegistrationDocument,
} from '../../../core/data-access/iam/iam.types';
import { registrationErrorToViewState } from '../shared-registration/registration-errors';
import { loading, ready, validation } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { Avatar } from '../../../shared/components/atoms/avatar/avatar';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import { Select } from '../../../shared/components/atoms/select/select';
import { Link } from '../../../shared/components/atoms/link/link';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { CustomField } from '../../../shared/components/organisms/paginated-form/custom-field';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import {
  RegistrationHelp,
  type HelpCard,
} from '../../../shared/components/organisms/registration-help/registration-help';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { componerDireccion } from '../shared-registration/address-line';
import type { NewOwnSite } from '../../../core/data-access/practice-sites/practice-sites.types';
import {
  MapLocationPicker,
  type Coordinates,
  type LocalityFromPoint,
  type TestIds,
} from '../shared-registration/map-location-picker/map-location-picker';
import { confirmedLocality } from '../shared-registration/point-locality';
import { joinNames } from '../../../core/profession/additional-names';
import {
  PROFESSION_COLLEGE,
  titleCollege,
  isCollege,
} from '../../../core/profession/regulatory-authorities';
import {
  PROFESSIONAL_TITLE_OPTIONS,
  titleHealthFilter,
} from '../../../core/profession/professional-degrees';
import { CATALOG_OUTSIDE_INSTITUTION } from '../../../core/profession/educational-institutions';
import {
  CATALOG_OUTSIDE_COUNTRY,
  UniversitiesRegistry,
  cityToChooseUniversity,
  choiceFromText,
  type HealthFilter,
} from '../../../core/profession/university-registry';
import { SystemContextClient } from '../../../core/data-access/system-context/system-context.client';
import { MAX_ATTACHMENT_BYTES } from '../shared-registration/doctor-credentials';
import { passwordValidators } from '../shared-registration/password-policy';
import { identityDocumentValidators } from '../shared-registration/national-id';
import {
  EMPTY_STUDY,
  isStudyMissingNumber,
  withCountry as studyWithCountry,
  withStudyField,
  withUniversity as studyWithUniversity,
  type EditableStudyField,
  type SpecialtyStudy,
} from '../shared-registration/specialty-study';
import {
  practitionerFields,
  validatePractitionerPersonalEmail,
  validatePractitionerPhone,
} from '../shared-registration/practitioner-fields';
import type {
  CampoDeFormulario,
  PaginaDeFormulario,
} from '../../../shared/forms/paginated/paginated-form.types';
import { BoProfessionsCatalog } from '../../../core/data-access/terminology/bo-professions.service';

/**
 * `Date` → ISO `YYYY-MM-DD`, tal como lo esperan los DTO del backend.
 *
 * Copiada del alta de paciente en vez de compartida: son siete líneas sin
 * estado, y el repo ya la tiene repetida en `profiles.client.ts` y en
 * `practitioner-profile-edit`. Un módulo de utilidades para esto costaría más
 * de leer que la función.
 */
function fechaIso(entrada: Date | string): string {
  // Un borrador restaurado trae la fecha como texto ISO (pasó por JSON): se
  // vuelve a `Date` antes de leerla, en vez de reventar en `getFullYear`.
  const fecha = entrada instanceof Date ? entrada : new Date(entrada);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Los campos de fecha del alta: el selector sólo entiende `Date`. */
const CAMPOS_DE_FECHA = ['birthDate', 'licenseIssueDate'] as const;

/**
 * El borrador pasa por JSON y las fechas vuelven como texto. El selector de
 * fecha las ignora (no son `Date`) pero el «obligatorio» las da por buenas, así
 * que el alta llegaba al envío con un texto donde esperaba una fecha. Se
 * convierten de vuelta, y una que no se pueda leer queda vacía.
 */
function revivirFechas(
  datos: Record<string, unknown>,
  claves: readonly string[],
): Record<string, unknown> {
  const copia = { ...datos };
  for (const clave of claves) {
    const valor = copia[clave];
    if (typeof valor === 'string') {
      const fecha = new Date(valor);
      copia[clave] = Number.isNaN(fecha.getTime()) ? null : fecha;
    }
  }
  return copia;
}

/**
 * El registro del cliente permite cuatro especialidades (L0174): eran la
 * principal y tres más. Desde D-01 (23/09/2026) no se elige una principal, así
 * que el techo es de la lista entera.
 */
const MAXIMO_DE_ESPECIALIDADES = 4;

/**
 * El código del tipo de credencial «título de especialidad» en el catálogo
 * `professional-credential-type`. Va aparte de `codigoDeConceptoPorTipo` porque
 * ese mapa es de los cuatro tipos de la página «Sus títulos»; el de especialidad
 * se declara en «Sus especialidades».
 */
const SPECIALTY_CREDENTIAL_CODE = 'CREDENTIAL_TYPE_SPECIALTY';

/**
 * Códigos odontológicos mantenidos para comprobar la cobertura del catálogo.
 * L0174 deja disponible la lista completa para cualquier profesión; este
 * conjunto no restringe las opciones del alta.
 */
export const ESPECIALIDADES_ODONTOLOGICAS: ReadonlySet<string> = new Set([
  'ODONTOLOGIA',
  'ENDODONCIA',
  'ORTODONCIA',
  'PERIODONCIA',
  'ESTETICA_DENTAL',
  'REHABILITACION_ORAL',
  'CIRUGIA_ORAL_MAXILOFACIAL',
  'CIRUGIA_BUCOMAXILOFACIAL',
  'ODONTOPEDIATRIA',
  'IMPLANTOLOGIA_ORAL',
  'ARMONIZACION_OROFACIAL',
]);

/**
 * Cómo se llama un consultorio al que nadie le puso nombre.
 *
 * `NewOwnSite.name` es obligatorio del lado del backend, y el alta no lo exige:
 * quien deja el rótulo vacío igual tiene un consultorio. Se renombra desde el
 * perfil cuando quiera.
 */
const NOMBRE_CONSULTORIO_POR_OMISION = 'Mi consultorio';

/**
 * Quién emite la matrícula que habilita a ejercer, como lista cerrada.
 *
 * Era texto libre, con la lista escrita en la pista del campo: «Ministerio de
 * Salud y Deportes, o Colegio de Odontólogos si tu especialidad es
 * odontología». Eso es un catálogo pidiendo permiso para existir — y mientras
 * no existió, la misma autoridad entró como «Ministerio de Salud», «MSD» y
 * «ministerio de salud y deportes», que son tres organismos distintos para
 * cualquier consulta.
 *
 * Va como lista fija y no por terminología porque el backend guarda un
 * **texto** (`regulatoryAuthority`, `@MaxLength(200)`), no un concepto: leer un
 * conjunto de valores para acabar mandando su etiqueta agregaría una petición y
 * un estado de fallo a una pantalla pública sin cambiar el dato que se
 * persiste. El día que la columna pase a `*_concept_id`, esto se cambia por una
 * lectura de catálogo como las demás.
 *
 * ## Por qué sigue acá, aunque AC-05-3 pida que desaparezca
 *
 * **Está bloqueado, y no por falta de trabajo de front.** AC-05-3 pide que esto
 * sea un `*_concept_id` de un value set servido por `terminology`. Faltan las
 * dos mitades, y ninguna se puede hacer desde este carril:
 *
 * 1. **No existe el value set.** No hay catálogo de autoridad reguladora en
 *    `mantra-core-health-api/src/common/seed/` —ninguno de los seis `*.catalog.ts`
 *    lo declara— ni entrada en `dynamic-enum-catalog.ts`. Sin conjunto sembrado,
 *    `GET /terminology/value-sets?code=…` devuelve `count: 0` y el desplegable
 *    queda permanentemente en «no pudimos traer el catálogo»: exactamente el
 *    fallo que `bo-departments.service.ts` documenta haber sufrido en agosto.
 * 2. **No existe la columna.** El dato aterriza en
 *    `profiles/entities/jurisdiction_authorizations.entity.ts:34-41`, columna
 *    `regulatory_authority`, **varchar nullable**. Guardar un `conceptId` ahí
 *    sería meter un uuid en una columna de texto libre sin FK ni integridad —el
 *    problema que AC-05-3 viene a resolver, con otra forma—. La columna nueva va
 *    por el pipeline `.puml → gen_ddl.py → SQL/ → BD → entidades` dentro de
 *    `mantra-core-health-model`, que **no está clonado en este workspace**, y
 *    acá no hay migraciones (ADR-0021).
 *
 * Lo que sí se puede afirmar es cómo se hará el día que las dos existan: el
 * patrón de validación está escrito y probado en
 * `profiles/services/medical-specialty-catalog.service.ts` —`assertIsMedicalSpecialty`,
 * que lanza el `PreconditionFailedException` del dominio (**422**, no 412) con
 * `{ conceptId, valueSet }`, y distingue «este concepto no pertenece» de «el
 * catálogo no está disponible»—. Es el mismo que ya usa el alta de profesional
 * para `specialtyConceptIds`, y es copiable tal cual.
 */
// La lista vive en `core/profession/regulatory-authorities.ts` desde el 13/09/2026:
// son tres —Ministerio de Salud, SEDES y el colegio de la profesión— y el editor
// del perfil ofrece las mismas. Lo de arriba sigue valiendo para ella.

/**
 * El título profesional, como lista cerrada.
 *
 * Mismo caso que la autoridad reguladora, y con la misma razón para no ser
 * terminología: `professionalTitle` es un texto de hasta cien caracteres en el
 * backend. Lo que cambia es para qué sirve el dato: **es lo que ve el paciente
 * en la ficha**, así que en texto libre la misma profesión aparecía como
 * «Medico», «Dr.», «medico general» y «MÉDICO GENERAL» en cuatro fichas
 * seguidas — un directorio que se lee como cuatro productos distintos.
 *
 * Las dos formas —masculina y femenina— van en la misma entrada («Médico /
 * Médica») porque lo que se guarda es el título, no el género de quien lo
 * ostenta, y separarlas duplicaría la lista para que cada quien elija la mitad
 * que le toca.
 *
 * ## Por qué sigue acá, aunque AC-05-4 pida que desaparezca
 *
 * Mismo bloqueo que {@link OPCIONES_AUTORIDAD_REGULADORA}, con su propia
 * columna: `professionalTitle` aterriza en
 * `profiles/entities/health_practitioner_profiles.entity.ts:31-35`, columna
 * `professional_title`, **varchar nullable**, y no hay value set de títulos
 * profesionales en `src/common/seed/` ni en `dynamic-enum-catalog.ts`. Ver ahí
 * el detalle y el patrón de validación que corresponde el día que existan.
 */

/**
 * Sexo, con sus dos categorías (AC-05-7).
 *
 * Las mismas dos que el alta de paciente y por la misma razón: **es lo que el
 * documento de identidad boliviano registra** y lo que la ficha clínica
 * contrasta contra él. P-05-8 de la ficha pregunta justamente si aplica igual
 * acá; se asume que sí —es el mismo documento y el mismo país— y queda escrito
 * para poder revertirlo si el propietario dice otra cosa.
 *
 * Va como lista fija y no como lectura de terminología porque la API lo recibe
 * **por código legible** (`sexAtBirth: 'FEMALE'`), no por uuid de concepto:
 * pedir el catálogo sólo para pintar dos etiquetas agregaría una petición y un
 * estado de fallo a una pantalla pública, sin ganar nada. El mapeo a concepto
 * lo hace el backend.
 *
 * No se comparte con el alta de paciente a propósito: son dos constantes de dos
 * pantallas que hoy coinciden, y compartirlas ataría el día que una de las dos
 * necesite otra lista —que es exactamente lo que pasó con el resto de esta
 * pantalla cuando vivía dentro de la otra—.
 */
/**
 * Los cuatro tipos de título que el registro de procesos pide para el médico
 * (MODULO MEDICO, ítems 15, 17, 18 y 19), cada uno con «espacio para poder
 * subir varios».
 *
 * El código es el que va a viajar al backend el día que esto se conecte; la
 * etiqueta y el singular son lo que ve el profesional —el singular porque
 * «Quitar Otra profesión» y «+ Agregar otra profesión» no se escriben igual, y
 * derivarlos de la etiqueta con `toLowerCase()` daba lo primero—.
 *
 * `UNIVERSITARIO` dejó de rotularse «Título profesional universitario»: es el
 * lugar de la **segunda profesión**. El propietario lo pidió con todas las
 * letras —«hay doctores que aparte de ser doctores han estudiado otra
 * profesión»—, y llamarlo por su tipo de diploma escondía para qué está: la
 * profesión con la que ejerce ya se eligió, obligatoria, en el paso del título.
 */
const TIPOS_DE_TITULO = [
  {
    codigo: 'UNIVERSITARIO',
    etiqueta: 'Otra profesión',
    singular: 'otra profesión',
    ayuda:
      'Si además de su profesión de salud estudió otra carrera, cárguela acá. Puede cargar las que tenga, y ninguna es obligatoria.',
    placeholderNombre: 'Qué carrera: Derecho, Ingeniería de Sistemas…',
  },
  {
    codigo: 'DIPLOMADO',
    etiqueta: 'Diplomado',
    singular: 'diplomado',
    ayuda: 'Cuantos tengas.',
    placeholderNombre: 'Cómo se llama el diplomado',
  },
  {
    codigo: 'MAESTRIA',
    etiqueta: 'Maestría',
    singular: 'maestría',
    ayuda: 'Cuantas tengas.',
    placeholderNombre: 'Cómo se llama la maestría',
  },
  {
    codigo: 'DOCTORADO',
    etiqueta: 'Doctorado',
    singular: 'doctorado',
    ayuda: 'Cuantos tengas.',
    placeholderNombre: 'Cómo se llama el doctorado',
  },
] as const;

/** El código de uno de los cuatro tipos de título. */
type CodigoDeTitulo = (typeof TIPOS_DE_TITULO)[number]['codigo'];

/**
 * Un título declarado en el alta, con su respaldo adjunto y fileId cuando ya
 * se subió. El id sobrevive a un fallo posterior para que el reintento no
 * vuelva a cargar el mismo archivo.
 */
interface TituloDeclarado {
  /** Identificador local, sólo para el `track` de la lista. */
  readonly id: string;
  readonly tipo: CodigoDeTitulo;
  /** Cómo se llama el título: «Medicina», «Salud Pública»… */
  readonly nombre: string;
  /**
   * La profesión de la COB-2023 que acredita, sólo en «Otra profesión»: ahí el
   * nombre ya no se escribe, se elige de `VS_BO_PROFESSION` (propietario,
   * 04/10/2026) y `nombre` guarda su etiqueta para mostrarla.
   */
  readonly profesionConceptId?: string | null;
  /**
   * El número del diploma. **Es el único dato obligatorio de la fila**: la
   * columna que lo recibe (`professional_credentials.number`) es NOT NULL, así
   * que una fila sin número no se puede guardar y el alta no la manda.
   */
  readonly numero: string;
  /**
   * Dónde lo cursó: «Universidad Mayor de San Andrés». Es lo que viaja en
   * `issuingInstitutionText`, elegido del padrón o escrito a mano.
   */
  readonly universidad: string;
  /** El país donde lo cursó, por nombre. Ver {@link CampoDeEstudio}. */
  readonly pais: string;
  /** La ciudad donde lo cursó. */
  readonly ciudad: string;
  /**
   * Qué opción del desplegable de país está marcada: el nombre, el centinela
   * {@link CATALOG_OUTSIDE_COUNTRY} —que destapa la casilla escrita— o nada.
   * Va aparte de `pais` porque con «Otro país…» elegido y nada escrito todavía,
   * `pais` es vacío y el desplegable tiene que seguir en «Otro».
   */
  readonly paisElegido: string | null;
  /** Lo mismo para la universidad, con {@link CATALOG_OUTSIDE_INSTITUTION}. */
  readonly universidadElegida: string | null;
  /** El nombre del archivo elegido, o `null` si todavía no adjuntó ninguno. */
  readonly archivo: string | null;
  readonly pesoBytes: number | null;
  readonly fileId: string | null;
}

/**
 * Los tres datos de dónde se estudió un título, y de dónde sale cada uno.
 *
 * Es la pregunta que más veces vuelve, así que va escrita una sola vez acá:
 *
 * - **País.** Desplegable, poblado por {@link UniversitiesRegistry}: Bolivia
 *   primero y 199 países más, con «Otro país…» que destapa una casilla escrita.
 *   Lo pidió el propietario el 02/10/2026 («deben ser select, poblados con
 *   datos, como árbol para filtrar por país»). Se guarda el **nombre**: la
 *   columna del modelo (`issuing_country_concept_id`) es un concepto, pero
 *   `VS_COUNTRY` sigue sin miembros y el alta no lo recibe, así que hoy no
 *   viaja. Cuando lo reciba, es un mapeo nombre → concepto, no otra pantalla.
 * - **Universidad.** Desplegable **acotado al país elegido** —es el árbol—, con
 *   «Otra institución…» para la que falte. Bolivia usa la lista curada de
 *   `educational-institutions.ts`; el resto, el padrón importado. Viaja como
 *   `issuingInstitutionText`, que sigue siendo texto: el valor de cada opción
 *   es el nombre, así que al backend le llega lo mismo que antes.
 * - **Ciudad.** Texto, **propuesto por la universidad**: al elegir una del
 *   padrón con sede única se completa con su ciudad («UMSS» → Cochabamba), y
 *   sigue a la universidad mientras nadie la escriba a mano (ver
 *   `ciudadAlCambiarDeUniversidad`). Lo pidió el propietario el 03/10/2026
 *   («debe mostrar la ciudad por defecto»). Las de varias sedes y las del
 *   padrón importado no proponen nada, y ahí se escribe.
 *   Viaja en el título como `issuingCityText`.
 */
type CampoDeEstudio = 'universidad' | 'pais' | 'ciudad';

/** Uno de los campos de una fila de título que se escriben a mano. */
type CampoEditableDeTitulo = 'nombre' | 'numero' | CampoDeEstudio;

/** Los tres controles de dónde se estudió el título con el que ejerce. */
type ClaveDeEstudioDelTitulo =
  | 'professionalTitleNumber'
  | 'professionalTitleUniversity'
  | 'professionalTitleCountry'
  | 'professionalTitleCity';

/** Un respaldo suelto: el de la matrícula y el del registro del SEDES. */
interface RespaldoDeclarado {
  readonly archivo: string;
  readonly pesoBytes: number;
}

/** Cuál respaldo suelto se está tocando: el del título, la matrícula o el SEDES. */
type ClaveDeRespaldo = 'professional-title' | 'license' | 'sedes';

/** Tope de peso por adjunto. El mismo que la foto de perfil. */
const MAX_BYTES_ADJUNTO = MAX_ATTACHMENT_BYTES;

/**
 * Formatos que se aceptan como respaldo de la matrícula y del SEDES: sólo PDF.
 *
 * Desde P29 estos archivos se suben a `POST /iam/auth/upload-registration-document`,
 * que sólo admite PDF (422 `PRECONDITION_FAILED` con `detectedMimeType`). Con el
 * selector abierto a JPG y PNG (`SUPPORT_FILE_FORMATS`), una foto de la matrícula
 * pasaba todo el alta y la cuenta fallaba en el último paso con «problema de
 * configuración de nuestra parte». Se ve en la evidencia visual de P29 (26/10/2026).
 */
const FORMATOS_DE_RESPALDO = 'application/pdf';

/**
 * Por qué se pide lo que se pide, paso por paso.
 *
 * ## Por qué esto existe
 *
 * Un alta de salud pregunta cosas que ningún otro formulario pregunta: qué
 * departamento emitió tu cédula, con qué matrícula ejercés, de qué colegio.
 * Cada una tiene un motivo bueno y ninguno cabe en la pista del campo —la pista
 * dice qué escribir, no por qué se guarda—, así que sin esto el motivo no
 * estaba en ningún lado y la pregunta quedaba sonando a intromisión. Eso es de
 * lo que más hace abandonar un registro.
 *
 * Va **al costado** y no dentro del formulario: no alarga la página, no compite
 * con los campos y se lee sólo si hace falta. Ver `app-registration-help`.
 *
 * ## Por qué es un mapa por clave y no una lista
 *
 * Porque la respuesta cambia con la pregunta, y las páginas se reordenan. Con
 * un arreglo paralelo, mover una sección de sitio dejaría la explicación de la
 * matrícula al lado de la contraseña, y nadie se enteraría hasta verlo. La
 * clave la declara la propia página (`PaginaDeFormulario.clave`), así que las
 * dos mitades no se pueden separar de un descuido.
 */
const AYUDA_PROFESIONAL: Readonly<Record<string, readonly HelpCard[]>> = {
  name: [
    {
      icono: 'people',
      titulo: 'Así le van a ver sus pacientes',
      texto:
        'El nombre de su ficha pública sale de acá, y se escribe como figura en su documento: es lo que un paciente contrasta antes de elegirle.',
    },
    {
      icono: 'patients',
      titulo: 'Su cédula queda como documento oficial',
      texto:
        'No es con lo que entra —eso es su correo—, pero es lo que identifica a la persona detrás de la matrícula.',
    },
    {
      icono: 'pin',
      titulo: 'La expedición va con el número',
      texto: 'El «SC», «LP»… es parte del mismo carnet: por eso los dos se piden juntos.',
    },
  ],
  access: [
    {
      icono: 'mail',
      titulo: 'Con su correo personal va a entrar',
      texto:
        'Use uno que siga teniendo si cambia de trabajo: es su identidad de acceso y por donde se recupera la cuenta si pierde la clave.',
    },
    {
      icono: 'lock',
      titulo: 'Su contraseña, sólo suya',
      texto:
        'Ocho caracteres o más. Se guarda cifrada: ni el equipo de AloVida puede verla, y nunca se la vamos a pedir por teléfono ni por correo.',
    },
    {
      icono: 'stethoscope',
      titulo: 'Por qué le pedimos los dos',
      texto:
        'Sexo y fecha de nacimiento son dato clínico: mandan en dosis, valores de referencia y tamizajes. Los dos se guardan en su perfil. Qué clase de profesional es se pregunta más adelante, con su título.',
    },
  ],
  residence: [
    {
      icono: 'pin',
      titulo: 'Para ubicarle en el directorio',
      texto:
        'Un paciente busca por ciudad antes que por nombre. Con el punto de su casa sabemos su localidad, y aparece en la búsqueda de quien le tiene cerca.',
    },
  ],
  'workplace-location': [
    {
      icono: 'phone',
      titulo: 'Todo esto es del consultorio',
      texto:
        'Son los datos por los que le ubican en el trabajo, no los de su acceso. Puede dejarlos vacíos y cargarlos después desde su perfil.',
    },
  ],
  practice: [
    {
      icono: 'stethoscope',
      titulo: 'Es su carta de presentación',
      texto:
        'El título es lo primero que ve un paciente antes de pedirle un turno. Puede cambiarlo cuando quiera.',
    },
    {
      icono: 'directory',
      titulo: 'Y decide qué sigue',
      texto:
        'De él dependen el colegio que se le ofrece en la habilitación y las especialidades que va a poder elegir: un odontólogo no elige entre las 36 del catálogo, elige entre las suyas. Por eso se pregunta antes que las dos cosas.',
    },
  ],
  credentials: [
    {
      icono: 'shield',
      titulo: 'Es lo que le habilita a atender',
      texto:
        'Comprobamos matrícula y colegio antes de que aparezca en el directorio. Es lo que le da certeza a quien le elige sin conocerle.',
    },
    {
      icono: 'history',
      titulo: 'Lo opcional puede dejarlo para después',
      texto:
        'La fecha de inscripción y los respaldos no frenan su alta: se cargan cuando los tenga a mano, desde su perfil.',
    },
    {
      icono: 'folder',
      titulo: 'Los verifica una persona, no un robot',
      texto:
        'Puede registrarse sin subirlos y cargarlos después desde su perfil. Mientras no estén, su matrícula figura como declarada y no como verificada.',
    },
  ],
  specialties: [
    {
      icono: 'directory',
      titulo: 'Es por donde le encuentran',
      texto:
        'Un paciente busca por especialidad. Las que elija son las búsquedas en las que va a aparecer.',
    },
    {
      icono: 'teach',
      titulo: 'Cuantos tengas, no sólo uno',
      texto:
        'Hay médicos con dos carreras, y con varios diplomados o maestrías. Cada título lleva su propio archivo, así se verifica de a uno.',
    },
  ],
  'signature-seal': [
    {
      icono: 'shield',
      titulo: 'Son imágenes, no una firma electrónica',
      texto:
        'Suba la foto o el escaneo de su firma de puño y letra y de su sello. Se imprimen al pie de sus documentos junto a su nombre y matrícula. Puede saltear este paso y cargarlos después.',
    },
  ],
};

/**
 * Alta pública de un profesional de la salud.
 *
 * ## Por qué es su propio componente
 *
 * Vivía dentro de `register-patient` como la otra rama de un `@if`: una sola
 * clase de 2 400 líneas con dos `FormGroup`, dos listas de páginas y un
 * `tipo()` que salía del dato de la ruta. Son **dos altas distintas**, no una
 * con campos extra —el paciente entra con su documento y el correo le es
 * opcional; el profesional entra con su correo y sin habilitación comprobable
 * no hay alta—, así que la única cosa que compartían de verdad era el cascarón:
 * la tarjeta, el membrete, el pie y la columna de ayuda. Eso es CSS
 * (`../shared-registration/registration.css`) y un organismo
 * (`app-registration-help`), no una clase en común.
 *
 * ## Por qué va por el motor
 *
 * Porque antes era una sola columna de doce a quince campos que no entraba en
 * ninguna pantalla. `app-paginated-form` lleva la barra de avance, el índice,
 * el «Atrás», la validación de a una página y el foco que la sigue; lo que
 * queda acá es lo que el motor no puede saber —qué se pregunta, en qué orden y
 * contra qué endpoint va—.
 *
 * Cada ubicación es un campo `custom` —el mapa con su punto, que esta pantalla
 * proyecta y el motor no conoce—, y el departamento emisor pasa a serlo sólo
 * si su catálogo no cargó, para poder mostrar ahí el «Reintentar». El motor les
 * reserva el sitio con su rótulo y su error, y no aprende nada de terminología
 * ni de mapas.
 */
/**
 * Las sedes de una universidad como opciones del desplegable de ciudad.
 *
 * Se arman una vez por lista: el padrón devuelve siempre la misma referencia
 * para la misma universidad, y una lista nueva en cada detección de cambios
 * repintaría el desplegable.
 */
const opcionesDeCiudadArmadas = new WeakMap<readonly string[], readonly SelectOption<string>[]>();
function opcionesDeCiudad(sedes: readonly string[]): readonly SelectOption<string>[] {
  let opciones = opcionesDeCiudadArmadas.get(sedes);
  if (opciones === undefined) {
    opciones = sedes.map((sede) => ({ value: sede, label: sede }));
    opcionesDeCiudadArmadas.set(sedes, opciones);
  }
  return opciones;
}

/** Texto comparable para un buscador: sin mayúsculas ni tildes. */
function sinTildes(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

@Component({
  selector: 'app-register-practitioner',
  imports: [
    FileDropTarget,
    FileInput,
    SignatureOrSeal,
    RouterLink,
    AppButton,
    NavIcon,
    Tooltip,
    MapLocationPicker,
    Link,
    Alert,
    AuthSplit,
    AnnounceOnAppear,
    PaginatedForm,
    CustomField,
    ReferenceCombobox,
    RegistrationHelp,
    FormField,
    AppInput,
    Select,
    Avatar,
    OnboardingDraftBanner,
  ],
  templateUrl: './register-practitioner.html',
  styleUrls: ['../shared-registration/registration.css', './register-practitioner.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPractitioner {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly iam = inject(IamClient);
  private readonly router = inject(Router);
  private readonly systemContext = inject(SystemContextClient);
  private readonly draftService = inject(OnboardingDraftService);

  readonly borradorDetectado = signal<OnboardingDraft | null>(null);
  readonly pasoGuardado = signal<number>(0);

  /* ---- «Otra profesión»: lista normalizada (COB-2023) --------------------

     El nombre de la segunda carrera se elige de `VS_BO_PROFESSION` y no se
     escribe (propietario, 04/10/2026): «no es cualquier profesión que se deja
     ingresar». El filtro es local —son 241— y sin tildes, porque casi nadie
     escribe «ingeniería» con acento. */
  private readonly catalogoDeProfesiones = inject(BoProfessionsCatalog);
  protected readonly profesiones = signal<readonly ReferenceOption[]>([]);
  protected readonly catalogoProfesionesCaido = signal(false);
  /** Lo escrito en el buscador de profesión de cada fila, por id de fila. */
  private readonly busquedaDeProfesion = signal<Readonly<Record<string, string>>>({});

  private cargarProfesiones(): void {
    this.catalogoProfesionesCaido.set(false);
    this.catalogoDeProfesiones.list().subscribe({
      next: (opciones) =>
        this.profesiones.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        ),
      error: () => this.catalogoProfesionesCaido.set(true),
    });
  }

  /** Vuelve a pedir el catálogo de profesiones después de un fallo. */
  reintentarProfesiones(): void {
    this.catalogoDeProfesiones.forget();
    this.cargarProfesiones();
  }

  /** Guarda lo escrito en el buscador de profesión de una fila. */
  buscarProfesionEnFila(id: string, texto: string): void {
    this.busquedaDeProfesion.update((busquedas) => ({ ...busquedas, [id]: texto }));
  }

  /** Las profesiones que coinciden con lo escrito en esa fila. */
  profesionesDeFila(id: string): readonly ReferenceOption[] {
    const busqueda = sinTildes(this.busquedaDeProfesion()[id] ?? '');
    const todas = this.profesiones();
    return busqueda === '' ? todas : todas.filter((o) => sinTildes(o.label).includes(busqueda));
  }

  /** La profesión elegida en una fila, como opción del combobox. */
  profesionElegidaDeFila(titulo: TituloDeclarado): ReferenceOption | null {
    if (!titulo.profesionConceptId) return null;
    return (
      this.profesiones().find((opcion) => opcion.value === titulo.profesionConceptId) ?? {
        value: titulo.profesionConceptId,
        label: titulo.nombre,
      }
    );
  }

  /**
   * De qué campo cuelga el catálogo de tipos de título.
   *
   * Se pide por **campo destino** y no por código de conjunto porque esta
   * columna sí declara su amarre (`professional-credential-type`), a diferencia
   * de la de especialidades. La ruta es pública, que es lo que la habilita en un
   * alta sin sesión.
   */
  private readonly campoDeTipoDeTitulo =
    'profiles.professional_credentials.credential_type_concept_id';

  /**
   * Qué concepto del catálogo corresponde a cada tipo de la pantalla.
   *
   * El mapeo es **por código**, nunca por rótulo: el código es la identidad
   * estable del concepto y el rótulo del catálogo viene en inglés técnico.
   */
  private readonly codigoDeConceptoPorTipo: Readonly<Record<CodigoDeTitulo, string>> = {
    UNIVERSITARIO: 'CREDENTIAL_TYPE_DEGREE',
    DIPLOMADO: 'CREDENTIAL_TYPE_DIPLOMA',
    MAESTRIA: 'CREDENTIAL_TYPE_MASTER',
    DOCTORADO: 'CREDENTIAL_TYPE_DOCTORATE',
  };

  /** Código de concepto → uuid, tal como lo devolvió el catálogo. */
  private readonly conceptoPorCodigo = signal<ReadonlyMap<string, string>>(new Map());

  /** Si hay una lectura del catálogo de tipos en vuelo. */
  private readonly pidiendoTiposDeTitulo = signal(false);

  /**
   * Si el catálogo de tipos no sirve y ya no se está pidiendo: lo que enciende
   * el aviso con su botón «Reintentar» en el paso.
   *
   * Se deriva del MISMO mapa que frena el envío (`hayTitulosSinTipo`), y no de
   * una bandera aparte encendida en el `error` del observable. Con la bandera,
   * un 200 que no trajera los tipos —o un `next` que reventara al mapearlos—
   * dejaba el mapa vacío y la bandera apagada: el alert decía «pulsá
   * Reintentar» y el botón no existía. Así, si hay una fila que no puede
   * resolver su tipo, el botón está, porque los dos leen lo mismo.
   */
  readonly catalogoTiposDeTituloCaido = computed(() => {
    if (this.pidiendoTiposDeTitulo()) {
      return false;
    }
    const conceptos = this.conceptoPorCodigo();
    return Object.values(this.codigoDeConceptoPorTipo).some((codigo) => !conceptos.has(codigo));
  });

  /**
   * El aviso de que el catálogo no cargó, en un solo sitio.
   *
   * Está acá y no escrito dos veces porque el éxito del reintento tiene que
   * poder reconocer ESTE aviso para retirarlo: el otro aviso del paso —el del
   * número que falta— viaja por el mismo canal y no debe borrarse de rebote.
   */
  private readonly avisoCatalogoDeTipos =
    'No pudimos cargar los tipos de título. En el paso «Sus títulos», el botón «Reintentar» vuelve a pedirlos.';

  /**
   * Una fila que todavía no dice nada: se agregó y quedó en blanco.
   *
   * No frena el envío ni viaja, igual que una casilla de especialidad agregada
   * y vacía. Lo que sí frena es una fila **con datos** y sin número.
   */
  private filaVacia(titulo: TituloDeclarado): boolean {
    return (
      titulo.numero.trim() === '' &&
      titulo.nombre.trim() === '' &&
      titulo.universidad.trim() === '' &&
      titulo.pais.trim() === '' &&
      titulo.ciudad.trim() === '' &&
      titulo.archivo === null
    );
  }

  /**
   * Si esta fila declara algo pero le falta el número que la hace guardable.
   *
   * Público porque lo usan la plantilla —para marcar el campo— y las pruebas,
   * que comprueban que la fila señalada es la que está mal.
   */
  tituloSinNumero(titulo: TituloDeclarado): boolean {
    return !this.filaVacia(titulo) && titulo.numero.trim() === '';
  }

  /**
   * Qué falta en «Tus títulos», nombrando las secciones tal como se ven
   * («Otra profesión», «Maestría»…). `null` si no falta nada.
   */
  protected readonly avisoDeTitulosIncompletos = computed<string | null>(() => {
    const secciones = TIPOS_DE_TITULO.filter((tipo) =>
      this.titulos().some((titulo) => titulo.tipo === tipo.codigo && this.tituloSinNumero(titulo)),
    ).map((tipo) => `«${tipo.etiqueta}»`);
    if (secciones.length === 0) return null;
    const donde =
      secciones.length === 1
        ? secciones[0]
        : `${secciones.slice(0, -1).join(', ')} y ${secciones.at(-1)}`;
    return `Falta el número del diploma en ${donde}. Complételo o quite la fila para seguir.`;
  });

  /** Lo mismo que {@link hayTitulosSinNumero}, público para las pruebas. */
  tituloSinNumeroEnAlgunaFila(): boolean {
    return this.hayTitulosSinNumero();
  }

  /** Si alguna fila declara algo sin número. Ver `tituloSinNumero`. */
  protected hayTitulosSinNumero(): boolean {
    return this.titulos().some((titulo) => this.tituloSinNumero(titulo));
  }

  /**
   * Si hay filas listas para mandar cuyo tipo el catálogo no resolvió.
   *
   * Pasa si la lectura del catálogo falló. Mandar la fila sin tipo no es
   * opción —el contrato lo exige— y descartarla en silencio es justamente lo
   * que esta subtarea vino a corregir, así que el envío se frena y lo dice.
   */
  protected hayTitulosSinTipo(): boolean {
    return (
      this.titulosParaRegistro().some(
        (titulo) =>
          titulo.numero.trim() !== '' &&
          this.conceptoPorCodigo().get(this.codigoDeConceptoPorTipo[titulo.tipo]) === undefined,
      ) ||
      (this.specialtyStudies().some((study) => study.number.trim() !== '') &&
        this.conceptoPorCodigo().get(SPECIALTY_CREDENTIAL_CODE) === undefined)
    );
  }

  /** La universidad escrita en el bloque del título con el que ejerce. */
  protected universidadPrincipal(): string {
    return this.formProfesional.controls.professionalTitleUniversity.value.trim();
  }

  /** El diploma principal usa el mismo contrato de credenciales universitarias. */
  private tituloPrincipalDeclarado(): TituloDeclarado | null {
    const numero = this.formProfesional.controls.professionalTitleNumber.value.trim();
    if (!numero) return null;
    return {
      id: 'professional-title',
      tipo: 'UNIVERSITARIO',
      nombre: this.formProfesional.controls.professionalTitle.value.trim(),
      numero,
      universidad: this.universidadPrincipal(),
      pais: this.formProfesional.controls.professionalTitleCountry.value.trim(),
      ciudad: this.formProfesional.controls.professionalTitleCity.value.trim(),
      paisElegido: this.paisDelTituloElegido(),
      universidadElegida: this.universidadDelTituloElegida(),
      archivo: this.respaldoTituloProfesional()?.archivo ?? null,
      pesoBytes: this.respaldoTituloProfesional()?.pesoBytes ?? null,
      fileId: this.fileIdTituloPrincipal(),
    };
  }

  /** El mismo número universitario identifica una única credencial, aunque se use una sigla. */
  private titulosParaRegistro(): readonly TituloDeclarado[] {
    const principal = this.tituloPrincipalDeclarado();
    const titulos = this.titulos();
    return principal &&
      !titulos.some((t) => t.tipo === 'UNIVERSITARIO' && t.numero.trim() === principal.numero)
      ? [principal, ...titulos]
      : titulos;
  }

  /** Con número explícito se vincula por diploma; sin él se conserva la coincidencia de universidad. */
  private filaDeLaUniversidadPrincipal(): TituloDeclarado | null {
    const numero = this.formProfesional.controls.professionalTitleNumber.value.trim();
    const universidad = this.universidadPrincipal().toLowerCase();
    return (
      this.titulosParaRegistro().find(
        (titulo) =>
          titulo.tipo === 'UNIVERSITARIO' &&
          titulo.numero.trim() !== '' &&
          (numero
            ? titulo.numero.trim() === numero
            : titulo.universidad.trim() === '' ||
              titulo.universidad.trim().toLowerCase() === universidad),
      ) ?? null
    );
  }

  /** Un PDF o una universidad necesitan un diploma numerado; nunca se inventa el número. */
  protected hayUniversidadPrincipalSinTitulo(): boolean {
    return (
      (this.universidadPrincipal() !== '' ||
        !!this.attachmentFiles()['professional-title']?.length) &&
      this.filaDeLaUniversidadPrincipal() === null
    );
  }

  private usaPdfPrincipal(titulo: TituloDeclarado): boolean {
    return (
      titulo.id === this.filaDeLaUniversidadPrincipal()?.id &&
      (titulo.id === 'professional-title' || !this.attachmentFiles()[titulo.id]?.length) &&
      !!this.attachmentFiles()['professional-title']?.length
    );
  }

  private fileIdDeTitulo(titulo: TituloDeclarado): string | null {
    return this.usaPdfPrincipal(titulo) ? this.fileIdTituloPrincipal() : titulo.fileId;
  }

  /**
   * Los títulos que viajan en el alta. El PDF va como fileId, asociado a la
   * misma fila que su tipo, número e institución.
   */
  private credencialesDeclaradas(): readonly NewRegistrationCredential[] {
    const conceptos = this.conceptoPorCodigo();
    return [...this.titleCredentials(conceptos), ...this.specialtyCredentials(conceptos)];
  }

  /**
   * El estudio de cada especialidad, como credencial `CREDENTIAL_TYPE_SPECIALTY`.
   * El nombre de la especialidad viaja como `titleText`: es lo que distingue una
   * fila de la otra en el perfil. Sin número no hay fila (la columna es NOT NULL),
   * y eso ya frenó el envío antes de llegar acá.
   */
  private specialtyCredentials(
    conceptos: ReadonlyMap<string, string>,
  ): readonly NewRegistrationCredential[] {
    const conceptId = conceptos.get(SPECIALTY_CREDENTIAL_CODE);
    if (conceptId === undefined) return [];
    const labels = new Map(
      this.allSpecialtyOptions().map((option) => [option.value, option.label]),
    );
    return this.specialtyStudies().flatMap((study, index) => {
      const number = study.number.trim();
      if (number === '') return [];
      const university = study.university.trim();
      const city = study.city.trim();
      const country = study.country.trim();
      const specialty = labels.get(this.especialidadesExtra()[index] ?? '') ?? '';
      return [
        {
          credentialTypeConceptId: conceptId,
          number,
          ...(university === '' ? {} : { issuingInstitutionText: university }),
          ...(city === '' ? {} : { issuingCityText: city }),
          ...(country === '' ? {} : { issuingCountryText: country }),
          ...(specialty === '' ? {} : { titleText: specialty }),
          ...(study.fileId === null ? {} : { fileId: study.fileId }),
        },
      ];
    });
  }

  private titleCredentials(
    conceptos: ReadonlyMap<string, string>,
  ): readonly NewRegistrationCredential[] {
    const filaPrincipal = this.filaDeLaUniversidadPrincipal();
    return this.titulosParaRegistro().flatMap((titulo) => {
      const numero = titulo.numero.trim();
      const conceptId = conceptos.get(this.codigoDeConceptoPorTipo[titulo.tipo]);
      if (numero === '' || conceptId === undefined) {
        return [];
      }
      const universidad =
        titulo.universidad.trim() === '' && titulo.id === filaPrincipal?.id
          ? this.universidadPrincipal()
          : titulo.universidad.trim();
      const ciudad = titulo.ciudad.trim();
      const pais = titulo.pais.trim();
      return [
        {
          credentialTypeConceptId: conceptId,
          number: numero,
          ...(universidad === '' ? {} : { issuingInstitutionText: universidad }),
          ...(ciudad === '' ? {} : { issuingCityText: ciudad }),
          ...(pais === '' ? {} : { issuingCountryText: pais }),
          ...(titulo.profesionConceptId ? { professionConceptId: titulo.profesionConceptId } : {}),
          // El nombre escrito viaja en los títulos sin catálogo (diplomado,
          // maestría, doctorado). «Otra profesión» lo dice con su concepto.
          ...(titulo.tipo !== 'UNIVERSITARIO' && titulo.nombre.trim() !== ''
            ? { titleText: titulo.nombre.trim() }
            : {}),
          ...(this.fileIdDeTitulo(titulo) === null ? {} : { fileId: this.fileIdDeTitulo(titulo)! }),
        },
      ];
    });
  }

  /**
   * Los tipos de título del catálogo. Un fallo no bloquea el alta: lo que
   * bloquea es intentar mandar una fila cuyo tipo no se pudo resolver.
   */
  protected cargarTiposDeCredencial(): void {
    this.pidiendoTiposDeTitulo.set(true);
    this.systemContext.dynamicEnum(this.campoDeTipoDeTitulo).subscribe({
      next: (enumeracion) => {
        // Primero se apaga «pidiendo», y recién después se toca el mapa: si
        // mapear la respuesta reventara, el mapa quedaría vacío con el aviso
        // encendido, que es lo correcto, y no vacío con el aviso apagado.
        this.pidiendoTiposDeTitulo.set(false);
        this.conceptoPorCodigo.set(
          new Map(enumeracion.options.map((opcion) => [opcion.code, opcion.conceptId])),
        );
        // Si el envío se había frenado por esto, el aviso se retira solo: el
        // catálogo ya está y volver a pulsar «Crear cuenta» va a funcionar.
        this.retirarAvisoDeCatalogo();
      },
      error: () => {
        this.pidiendoTiposDeTitulo.set(false);
        this.conceptoPorCodigo.set(new Map());
      },
    });
  }

  /**
   * Vuelve a pedir el catálogo de tipos de título.
   *
   * Público porque lo usan la plantilla —el botón «Reintentar» del paso— y las
   * pruebas. Olvida lo memoizado antes de pedir, igual que
   * `reintentarDepartamentos`: el cliente ya descarta la entrada al fallar,
   * pero pedirlo explícitamente es lo que hace que este método signifique
   * «volvé a la red» y no «devolveme lo que tengas guardado».
   *
   * Lo escrito en las filas no se toca: vive en `titulos`, que esto no mira.
   */
  reintentarTiposDeCredencial(): void {
    this.systemContext.forget(this.campoDeTipoDeTitulo);
    this.cargarTiposDeCredencial();
  }

  /**
   * Retira el aviso del catálogo, y sólo ése.
   *
   * Se compara el mensaje porque las dos advertencias del paso —catálogo caído
   * y número que falta— son `validation` sobre el mismo campo: borrar la otra
   * de rebote dejaría el envío frenado sin nada en pantalla, que es el defecto
   * que esta subtarea ya corrigió una vez.
   */
  private retirarAvisoDeCatalogo(): void {
    const state = this.state();
    if (state.status === 'validation' && state.issues[0]?.message === this.avisoCatalogoDeTipos) {
      this.state.set(ready(null));
    }
  }

  readonly formProfesional = new FormGroup({
    // Mismas cuatro partes que el paciente: la persona se registra igual sea
    // cual sea el perfil, y el backend compone con ellas el nombre que muestra.
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    middleName: new FormControl('', { nonNullable: true }),
    thirdName: new FormControl('', { nonNullable: true }),
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    motherLastName: new FormControl('', { nonNullable: true }),
    // El correo de TRABAJO. Dejó de ser la identidad de acceso —eso ahora es
    // `personalEmail`— y con eso dejó de ser obligatorio: un médico puede no
    // tener correo institucional, y el del consultorio lo pone la organización.
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [...passwordValidators],
    }),
    // Documento de identidad boliviano. Obligatorio en el alta de profesional:
    // la matrícula habilita a ejercer, pero es la cédula la que ata esa matrícula
    // a una persona verificable. Además del formato válido, ahora tiene que estar.
    nationalId: new FormControl('', {
      nonNullable: true,
      validators: [...identityDocumentValidators],
    }),
    licenseNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    sedesLicenseNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    // Quién emitió la matrícula y con qué título ejerce: los dos salen de una
    // lista cerrada — ver `OPCIONES_AUTORIDAD_REGULADORA` y
    // `OPCIONES_TITULO_PROFESIONAL`. Siguen siendo controles de texto porque lo
    // que el desplegable escribe es la etiqueta, que es lo que el backend
    // guarda.
    regulatoryAuthority: new FormControl('', { nonNullable: true }),
    // Obligatorio: es la profesión con la que ejerce, y de ella dependen la
    // lista de especialidades y el colegio que se ofrece en la habilitación.
    // Preguntarla como opcional dejaba las dos cosas eligiéndose a ciegas.
    professionalTitle: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    // Dónde estudió la profesión con la que ejerce. Los tres son opcionales:
    // el alta se completa sin ninguno, y quien no se acuerde del año o del
    // nombre exacto de su casa de estudios los carga después desde el perfil.
    // Por qué son texto y no listas cerradas: ver `CampoDeEstudio`.
    professionalTitleNumber: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    professionalTitleUniversity: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(200)],
    }),
    professionalTitleCountry: new FormControl('', { nonNullable: true }),
    professionalTitleCity: new FormControl('', { nonNullable: true }),
    // Respaldo de la página «Tus títulos» para el motor de pasos, que sólo
    // frena una página si alguno de sus controles es inválido. Vale `true`
    // mientras ninguna fila tenga datos sin número (lo sincroniza un `effect`
    // del constructor) y NO viaja: `datosProfesional()` arma el cuerpo campo
    // a campo. Así «Siguiente» se frena en el paso donde está el error y no
    // recién en el último (propietario, 04/10/2026).
    academicTitles: new FormControl(true, {
      nonNullable: true,
      validators: [(control) => (control.value === true ? null : { tituloSinNumero: true })],
    }),
    // Lo mismo para la página «Sus especialidades»: vale `true` mientras
    // ninguna especialidad tenga datos de estudio sin número de diploma. Lleva
    // la clave del campo de la página para que el motor la frene ahí, y NO viaja.
    especialidadesExtra: new FormControl(true, {
      nonNullable: true,
      validators: [(control) => (control.value === true ? null : { estudioSinNumero: true })],
    }),
    // El control guarda lo que `app-phone-input` compone —el prefijo del país
    // elegido y su número—, así que el validador comprueba justamente eso, y
    // viene del propio campo: es él quien sabe qué largo tiene cada país.
    phone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    // Los cuatro contactos que el registro pide separados del de acceso. Cada
    // uno viaja a su propia fila de puntos de contacto, distinguida por el par
    // sistema × uso; mezclarlos en un solo campo era lo que hacía que el número
    // privado y el del consultorio fueran el mismo dato.
    mobilePhone: new FormControl('', {
      nonNullable: true,
      validators: [validatePractitionerPhone],
    }),
    workMobilePhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    workLandline: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    // El correo PERSONAL, y desde ahora la identidad de acceso: es el que el
    // profesional conserva aunque cambie de hospital, así que es el único que
    // sirve para entrar y para recuperar la cuenta. Viaja en el `email` del
    // DTO, que es el campo de login de la API (ver `cuerpoDelRegistro`).
    personalEmail: new FormControl('', {
      nonNullable: true,
      validators: [validatePractitionerPersonalEmail],
    }),
    // Obligatoria por la misma razón que `sexAtBirth`, y con más motivo: la
    // edad manda en dosis, valores de referencia y tamizajes. Un profesional
    // sin fecha de nacimiento es una ficha que después hay que perseguir.
    birthDate: new FormControl<Date | null>(null, {
      validators: [Validators.required],
    }),
    // AC-05-7: el DTO lo aceptaba desde siempre; lo que faltaba era
    // preguntarlo. Igual que en el alta de paciente, es dato clínico —dosis,
    // valores de referencia, tamizajes— y no una cortesía: obligatorio, aunque
    // el resto de esta sección sí sea opcional.
    sexAtBirth: new FormControl<BirthSexCode | null>(null, {
      validators: [Validators.required],
    }),
    licenseIssueDate: new FormControl<Date | null>(null),
    // El departamento de expedición es parte del mismo carnet que el número:
    // si uno es obligatorio, el otro también, o el documento queda a medias.
    issuerAdministrativeAreaConceptId: new FormControl<string | null>(null, {
      validators: [Validators.required],
    }),
    // **El punto del domicilio es obligatorio** (pedido del cliente del
    // 26/10/2026) y es lo único que se marca. Vive en el formulario para que
    // el motor frene la página sin él; no se escribe: lo llena
    // `confirmarGpsDomicilio` con el punto CONFIRMADO, y vuelve a `null` si se
    // quita o se mueve el pin.
    gpsDomicilio: new FormControl<Coordinates | null>(null, {
      validators: [Validators.required],
    }),
    // Lo que sale del punto, en sólo lectura: la calle, el distrito o zona (que
    // viaja dentro de la línea de dirección, ver `componerDireccion`) y el
    // municipio. Ya no son campos de ninguna página —los muestra el selector
    // del mapa— y sin validadores, para que nada invisible frene el alta. Los
    // escriben `aplicarLocalidad*`.
    homeAddressLines: new FormControl('', { nonNullable: true }),
    homeDistrict: new FormControl('', { nonNullable: true }),
    municipio: new FormControl<string | null>(null),
    municipioConsultorio: new FormControl<string | null>(null),
    // Dirección habitual de trabajo, distinta de la casa y del consultorio
    // que declara como propio. También sale de su punto.
    workAddressLines: new FormControl('', { nonNullable: true }),
    // El consultorio propio: su nombre y su calle. Ver la página
    // «Tu consultorio propio» y el JSDoc de `datosProfesional`.
    officeName: new FormControl('', { nonNullable: true }),
    officeContactPhone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    // La calle y la zona del consultorio: salen de su punto, como las de la casa.
    officeAddressLines: new FormControl('', { nonNullable: true }),
    officeDistrict: new FormControl('', { nonNullable: true }),
    profilePhotoBase64: new FormControl<string | null>(null),
    // La firma y el sello: **imágenes**, no una firma electrónica. Opcionales.
    signatureImageBase64: new FormControl<string | null>(null),
    sealImageBase64: new FormControl<string | null>(null),
  });

  /** Los cuatro tipos de título, para que la plantilla los recorra. */
  protected readonly tiposDeTitulo = TIPOS_DE_TITULO;

  /**
   * El tope de la universidad escrita a mano, en la fila y en el título
   * principal: `issuingInstitutionText` lo acota a 200 y se acota acá igual,
   * para que el exceso no llegue a ser un 400 en inglés técnico. País y ciudad
   * no viajan todavía, así que no tienen tope.
   */
  protected readonly topeDeUniversidad = 200;

  protected readonly paisFueraDeCatalogo = CATALOG_OUTSIDE_COUNTRY;
  protected readonly institucionFueraDeCatalogo = CATALOG_OUTSIDE_INSTITUTION;

  protected readonly formatosDeRespaldo = FORMATOS_DE_RESPALDO;
  /** Los títulos académicos usan la pre-carga existente, que acepta sólo PDF. */
  protected readonly formatosDeTitulo = '.pdf';

  /**
   * Los títulos que la persona fue agregando, de los cuatro tipos.
   *
   * Una sola lista y no cuatro: el tipo va adentro de cada fila. Así agregar un
   * quinto tipo el día de mañana es una entrada más en `TIPOS_DE_TITULO`, y no
   * un signal nuevo con su método nuevo.
   */
  readonly titulos = signal<readonly TituloDeclarado[]>([]);

  /** Los títulos de un tipo, en el orden en que se agregaron. */
  titulosDe(tipo: CodigoDeTitulo): readonly TituloDeclarado[] {
    return this.titulos().filter((titulo) => titulo.tipo === tipo);
  }

  /**
   * Los respaldos sueltos: el del título profesional, el de la matrícula y el
   * del registro del SEDES.
   *
   * El del título va en el paso del título y no con los otros dos a propósito:
   * el título profesional es obligatorio y su archivo no, así que la pantalla
   * tiene que dejar clarísimo cuál de las dos cosas frena el avance.
   */
  readonly respaldoTituloProfesional = signal<RespaldoDeclarado | null>(null);
  private readonly fileIdTituloPrincipal = signal<string | null>(null);
  readonly respaldoMatricula = signal<RespaldoDeclarado | null>(null);
  readonly respaldoSedes = signal<RespaldoDeclarado | null>(null);
  /**
   * El fileId de cada respaldo de habilitación ya subido (P29). Se recuerda
   * para que un reintento del alta no vuelva a subir —ni intente reclamar dos
   * veces— el mismo PDF, y se olvida cuando la persona cambia el archivo.
   */
  private readonly fileIdDeHabilitacion = signal<Partial<Record<'license' | 'sedes', string>>>({});

  /** El error del último adjunto rechazado, si hubo. */
  readonly errorAdjunto = signal<string | null>(null);

  /**
   * Los dos respaldos de la habilitación, con el número que respalda cada uno.
   *
   * Trae el valor del formulario para que la pantalla muestre «MP-12345» al
   * lado de su archivo: un adjunto sin el número al lado obliga a abrirlo para
   * saber de cuál es.
   */
  readonly respaldosDeHabilitacion = computed(() => {
    const raw = this.formProfesional.getRawValue();
    return [
      {
        clave: 'license' as ClaveDeRespaldo,
        etiqueta: 'Matrícula profesional',
        valor: raw.licenseNumber.trim(),
        adjunto: this.respaldoMatricula,
      },
      {
        clave: 'sedes' as ClaveDeRespaldo,
        etiqueta: 'Registro del SEDES',
        valor: raw.sedesLicenseNumber.trim(),
        adjunto: this.respaldoSedes,
      },
    ];
  });

  /** Agrega una fila vacía del tipo pedido, lista para escribir y adjuntar. */
  agregarTitulo(tipo: CodigoDeTitulo): void {
    this.actualizarTitulos((titulos) => [
      ...titulos,
      {
        // `crypto.randomUUID` existe en el navegador y en el Node del SSR.
        id: crypto.randomUUID(),
        tipo,
        nombre: '',
        numero: '',
        universidad: '',
        pais: '',
        ciudad: '',
        paisElegido: null,
        universidadElegida: null,
        archivo: null,
        pesoBytes: null,
        fileId: null,
      },
    ]);
  }

  /** Quita una fila entera, con su adjunto. */
  quitarTitulo(id: string): void {
    this.attachmentFiles.update((files) =>
      Object.fromEntries(Object.entries(files).filter(([key]) => key !== id)),
    );
    this.actualizarTitulos((titulos) => titulos.filter((titulo) => titulo.id !== id));
    this.limpiarAvisoDeTitulos();
  }

  /**
   * Borra el aviso en cuanto se corrige lo que lo provocó.
   *
   * Hace falta aparte de `limpiarElErrorAlCorregir()` porque las filas de
   * títulos no viven en el `FormGroup` —viven en un signal—, así que escribir
   * el número no dispara `valueChanges` y el aviso se quedaría contradiciendo
   * a la pantalla.
   */
  /**
   * Cambia las filas de títulos y, en el mismo paso, el control que respalda
   * la página «Tus títulos» ante el motor. Síncrono a propósito: con un
   * `effect` el control quedaba viejo hasta la próxima detección de cambios, y
   * un «Siguiente» o un envío inmediato leían la fila de antes.
   */
  private actualizarTitulos(
    cambio: (titulos: readonly TituloDeclarado[]) => readonly TituloDeclarado[],
  ): void {
    this.titulos.update(cambio);
    this.formProfesional.controls.academicTitles.setValue(!this.hayTitulosSinNumero());
  }

  private limpiarAvisoDeTitulos(): void {
    if (this.state().status === 'validation') {
      this.state.set(ready(null));
    }
  }

  /**
   * Escribe uno de los cuatro datos escritos a mano de un título.
   *
   * Uno solo y no cuatro métodos casi iguales: la única diferencia entre
   * escribir el nombre y escribir la ciudad es en qué clave cae el valor, y
   * `CampoEditableDeTitulo` la acota a las cuatro que existen —una clave
   * inventada no compila—. Sigue sin ser una bandera que cambia el
   * comportamiento: el comportamiento es el mismo para las cuatro.
   */
  escribirDatoDeTitulo(id: string, campo: CampoEditableDeTitulo, valor: string): void {
    this.actualizarTitulos((titulos) =>
      titulos.map((titulo) =>
        titulo.id === id ? this.conDatoEscrito(titulo, campo, valor) : titulo,
      ),
    );
    this.limpiarAvisoDeTitulos();
  }

  /**
   * Una fila con un dato escrito, y su desplegable puesto a tono.
   *
   * Escribir el país o la universidad **como texto** —lo hacen las pruebas y
   * lo haría una restauración— tiene que dejar el desplegable en la opción que
   * corresponde: el nombre si está en el padrón, «Otro…» si no. La excepción es
   * cuando ya está en «Otro…» y lo que se escribe es la casilla a mano: ahí el
   * desplegable se queda quieto aunque lo tecleado coincida con un nombre del
   * padrón, para que la casilla no desaparezca debajo del cursor.
   */
  private conDatoEscrito(
    titulo: TituloDeclarado,
    campo: CampoEditableDeTitulo,
    valor: string,
  ): TituloDeclarado {
    const escrito = { ...titulo, [campo]: valor };
    if (campo === 'pais' && titulo.paisElegido !== CATALOG_OUTSIDE_COUNTRY) {
      return {
        ...escrito,
        paisElegido: choiceFromText(
          valor,
          (pais) => this.padron.isCatalogCountry(pais),
          CATALOG_OUTSIDE_COUNTRY,
        ),
      };
    }
    if (campo === 'universidad' && titulo.universidadElegida !== CATALOG_OUTSIDE_INSTITUTION) {
      return {
        ...escrito,
        universidadElegida: choiceFromText(
          valor,
          (universidad) => this.padron.isUniversityOf(titulo.pais, universidad),
          CATALOG_OUTSIDE_INSTITUTION,
        ),
      };
    }
    return escrito;
  }

  /**
   * Elige en el desplegable de país o de universidad de una fila.
   *
   * Un nombre del padrón se guarda tal cual como texto —es lo que viaja—;
   * «Otro…» vacía el texto y destapa la casilla a mano; nada vacía ambos.
   * Cambiar de país **reinicia la universidad**: la lista es la del país, y
   * dejar «Universidad de Buenos Aires» marcada bajo Chile sería mentir.
   * La ciudad acompaña a la universidad en los dos casos (ver
   * {@link conUniversidadElegida}).
   */
  elegirEnFila(id: string, campo: 'pais' | 'universidad', eleccion: string | null): void {
    this.actualizarTitulos((titulos) =>
      titulos.map((titulo) => {
        if (titulo.id !== id) return titulo;
        if (campo === 'universidad') {
          return this.conUniversidadElegida(titulo, eleccion);
        }
        const pais = this.paisElegido(eleccion);
        const cambiaDePais = pais.pais !== titulo.pais;
        return {
          ...(cambiaDePais ? this.conUniversidadElegida(titulo, null) : titulo),
          ...pais,
        };
      }),
    );
    this.limpiarAvisoDeTitulos();
  }

  /**
   * Una fila con otra universidad marcada, y su ciudad puesta a tono: la de la
   * universidad nueva, salvo que la persona ya hubiera escrito la suya.
   */
  private conUniversidadElegida(titulo: TituloDeclarado, eleccion: string | null): TituloDeclarado {
    const universidad = this.universidadElegida(eleccion);
    return {
      ...titulo,
      ...universidad,
      ciudad: cityToChooseUniversity(
        titulo.ciudad,
        this.padron.citiesOf(titulo.pais, universidad.universidad),
      ),
    };
  }

  /**
   * Las universidades que se ofrecen en una fila según su tipo: «Otra
   * profesión» puede ser cualquier carrera; diplomados, maestrías y doctorados
   * se cargan en un alta de salud y se acotan a las casas que dictan salud.
   */
  private filtroDeFila(titulo: TituloDeclarado): HealthFilter {
    return titulo.tipo === 'UNIVERSITARIO' ? null : 'salud';
  }

  /** Las ciudades que puede tener una fila: las sedes de su universidad. */
  ciudadesDeFila(titulo: TituloDeclarado): readonly SelectOption<string>[] {
    return opcionesDeCiudad(this.padron.citiesOf(titulo.pais, titulo.universidad));
  }

  /** Elige la ciudad de una fila, que sólo puede ser una de las sedes. */
  elegirCiudadEnFila(id: string, ciudad: string | null): void {
    this.actualizarTitulos((titulos) =>
      titulos.map((titulo) => (titulo.id === id ? { ...titulo, ciudad: ciudad ?? '' } : titulo)),
    );
    this.limpiarAvisoDeTitulos();
  }

  /** Elige la profesión COB-2023 de una fila de «Otra profesión». */
  elegirProfesionEnFila(id: string, opcion: ReferenceOption | null): void {
    this.actualizarTitulos((titulos) =>
      titulos.map((titulo) =>
        titulo.id === id
          ? { ...titulo, profesionConceptId: opcion?.value ?? null, nombre: opcion?.label ?? '' }
          : titulo,
      ),
    );
    this.limpiarAvisoDeTitulos();
  }

  /** El par texto + opción marcada que deja una elección en el país. */
  private paisElegido(eleccion: string | null): Pick<TituloDeclarado, 'pais' | 'paisElegido'> {
    return {
      paisElegido: eleccion,
      pais: eleccion === null || eleccion === CATALOG_OUTSIDE_COUNTRY ? '' : eleccion,
    };
  }

  /** El par texto + opción marcada que deja una elección en la universidad. */
  private universidadElegida(
    eleccion: string | null,
  ): Pick<TituloDeclarado, 'universidad' | 'universidadElegida'> {
    return {
      universidadElegida: eleccion,
      universidad: eleccion === null || eleccion === CATALOG_OUTSIDE_INSTITUTION ? '' : eleccion,
    };
  }

  /** Las opciones de universidad de una fila: las del país que eligió. */
  opcionesDeUniversidadDeFila(titulo: TituloDeclarado): readonly SelectOption<string>[] {
    return this.padron.universityOptions(titulo.pais, this.filtroDeFila(titulo));
  }

  /**
   * Escribe el nombre de un título.
   *
   * Se conserva porque es el que llaman las pruebas y el que existía antes de
   * que la fila tuviera cuatro campos; delega para que haya una sola forma de
   * escribir en la lista.
   */
  escribirNombreDeTitulo(id: string, nombre: string): void {
    this.escribirDatoDeTitulo(id, 'nombre', nombre);
  }

  readonly attachmentFiles = signal<Partial<Record<string, readonly File[]>>>({});
  protected readonly maxAttachmentBytes = MAX_BYTES_ADJUNTO;

  updateSupportFiles(key: ClaveDeRespaldo, files: readonly File[]): void {
    this.attachmentFiles.update((current) => ({ ...current, [key]: files }));
    const file = files[0];
    if (key === 'professional-title') this.fileIdTituloPrincipal.set(null);
    else this.fileIdDeHabilitacion.update((actual) => ({ ...actual, [key]: undefined }));
    this.destinoDelRespaldo(key).set(file ? { archivo: file.name, pesoBytes: file.size } : null);
    this.errorAdjunto.set(null);
  }

  updateTitleFiles(id: string, files: readonly File[]): void {
    this.attachmentFiles.update((current) => ({ ...current, [id]: files }));
    const file = files[0];
    this.actualizarTitulos((titles) =>
      titles.map((title) =>
        title.id === id
          ? { ...title, archivo: file?.name ?? null, pesoBytes: file?.size ?? null, fileId: null }
          : title,
      ),
    );
    this.errorAdjunto.set(null);
  }

  /** El signal donde vive cada respaldo suelto. */
  private destinoDelRespaldo(cual: ClaveDeRespaldo) {
    if (cual === 'professional-title') return this.respaldoTituloProfesional;
    return cual === 'license' ? this.respaldoMatricula : this.respaldoSedes;
  }

  /**
   * Foto de perfil en base64 para previsualizar y enviar en el alta.
   */
  readonly fotoBase64 = signal<string | null>(null);
  readonly errorFoto = signal<string | null>(null);
  readonly nombreCompleto = computed(() => {
    const raw = this.formProfesional.getRawValue();
    return [raw.name, raw.lastName].filter((p) => p.trim() !== '').join(' ') || 'Profesional';
  });

  /**
   * Procesa la foto elegida por el usuario, valida tamaño y formato, y la convierte a Data URL.
   */
  alSeleccionarFoto(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    this.errorFoto.set(null);
    if (!archivo) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      this.errorFoto.set('El formato de la imagen debe ser JPG, PNG o WebP.');
      entrada.value = '';
      return;
    }

    const maxBytes = 5 * 1024 * 1024;
    if (archivo.size > maxBytes) {
      this.errorFoto.set('La imagen supera el límite de 5 MB.');
      entrada.value = '';
      return;
    }

    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result as string;
      this.fotoBase64.set(resultado);
      this.formProfesional.controls.profilePhotoBase64.setValue(resultado);
      entrada.value = '';
    };
    lector.onerror = () => {
      this.errorFoto.set('No se pudo leer la imagen seleccionada.');
      entrada.value = '';
    };
    lector.readAsDataURL(archivo);
  }

  /**
   * La firma y el sello médicos del alta, como imágenes para previsualizar y
   * enviar. Opcionales: se saltan y se cargan después desde el perfil.
   */
  private readonly imagenesSubidas: Partial<
    Record<'signatureImageBase64' | 'sealImageBase64', { dataUrl: string; fileId: string }>
  > = {};
  readonly firmaBase64 = signal<string | null>(null);
  readonly selloBase64 = signal<string | null>(null);
  readonly errorFirma = signal<string | null>(null);
  readonly errorSello = signal<string | null>(null);

  alSeleccionarFirma(evento: Event): void {
    this.leerImagenDeFirma(evento, 'signatureImageBase64', this.firmaBase64, this.errorFirma);
  }

  alSeleccionarSello(evento: Event): void {
    this.leerImagenDeFirma(evento, 'sealImageBase64', this.selloBase64, this.errorSello);
  }

  quitarFirma(entrada?: HTMLInputElement): void {
    this.quitarImagenDeFirma('signatureImageBase64', this.firmaBase64, this.errorFirma, entrada);
  }

  quitarSello(entrada?: HTMLInputElement): void {
    this.quitarImagenDeFirma('sealImageBase64', this.selloBase64, this.errorSello, entrada);
  }

  /** Valida formato y peso (2 MB) y deja la imagen como Data URL en el formulario. */
  private leerImagenDeFirma(
    evento: Event,
    control: 'signatureImageBase64' | 'sealImageBase64',
    vista: WritableSignal<string | null>,
    error: WritableSignal<string | null>,
  ): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    error.set(null);
    if (!archivo) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(archivo.type)) {
      error.set('El formato de la imagen debe ser JPG, PNG o WebP.');
      entrada.value = '';
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      error.set('La imagen supera el límite de 2 MB.');
      entrada.value = '';
      return;
    }
    const lector = new FileReader();
    lector.onload = () => {
      const resultado = lector.result as string;
      vista.set(resultado);
      this.formProfesional.controls[control].setValue(resultado);
      entrada.value = '';
    };
    lector.onerror = () => {
      error.set('No se pudo leer la imagen seleccionada.');
      entrada.value = '';
    };
    lector.readAsDataURL(archivo);
  }

  private quitarImagenDeFirma(
    control: 'signatureImageBase64' | 'sealImageBase64',
    vista: WritableSignal<string | null>,
    error: WritableSignal<string | null>,
    entrada?: HTMLInputElement,
  ): void {
    vista.set(null);
    this.formProfesional.controls[control].setValue(null);
    error.set(null);
    if (entrada) entrada.value = '';
  }

  /** Quita la foto seleccionada y restablece el control. */
  quitarFoto(inputElement?: HTMLInputElement): void {
    this.fotoBase64.set(null);
    this.formProfesional.controls.profilePhotoBase64.setValue(null);
    this.errorFoto.set(null);
    if (inputElement) {
      inputElement.value = '';
    }
  }

  /**
   * El municipio de residencia, deducido del punto del domicilio.
   *
   * Ya no se elige (26/10/2026): lo encuentra `app-map-location-picker` por el
   * contorno donde cae el punto, y llega con lo demás en
   * {@link aplicarLocalidadDomicilio}.
   */
  readonly municipioProfesional = signal<string | null>(null);

  /** Guarda la localidad del domicilio en la señal **y** en el control espejo. */
  private elegirMunicipioProfesional(conceptId: string | null): void {
    this.municipioProfesional.set(conceptId);
    this.escribirSiCambia('municipio', conceptId);
  }

  /**
   * El punto del domicilio, ya confirmado sobre el mapa.
   *
   * Lo emite `app-map-location-picker` y llega **sólo confirmado**: el componente
   * se guarda para sí el estado intermedio —capturado y sin confirmar— y avisa
   * en pantalla que ese no se guarda. Acá no hace falta volver a preguntarlo.
   */
  readonly gpsDomicilio = signal<Coordinates | null>(null);

  /** Ubicación laboral, confirmada por separado del domicilio y de sus sedes. */
  readonly gpsTrabajo = signal<Coordinates | null>(null);

  /**
   * La localidad del consultorio propio, deducida de su punto.
   *
   * Separada de la del domicilio a propósito: son dos lugares distintos, y hay
   * quien vive en una ciudad y atiende en otra.
   */
  readonly municipioConsultorio = signal<string | null>(null);

  /** Lo mismo, para el consultorio. */
  private elegirMunicipioConsultorio(conceptId: string | null): void {
    this.municipioConsultorio.set(conceptId);
    this.escribirSiCambia('municipioConsultorio', conceptId);
  }

  /**
   * Escribe un control de lo deducido sólo si el valor cambia.
   *
   * El selector avisa lo deducido cada vez que se monta su paso, aunque sea lo
   * mismo de antes. Reescribir igual dispararía `valueChanges`, y eso borra el
   * aviso de un envío fallido (`limpiarElErrorAlCorregir`) sin que la persona
   * haya corregido nada.
   */
  private escribirSiCambia(
    clave:
      | 'homeAddressLines'
      | 'homeDistrict'
      | 'municipio'
      | 'municipioConsultorio'
      | 'workAddressLines'
      | 'officeAddressLines'
      | 'officeDistrict',
    valor: string | null,
  ): void {
    const control = this.formProfesional.get(clave);
    if (control !== null && control.value !== valor) control.setValue(valor);
  }

  /** El punto del consultorio, ya confirmado sobre el mapa. */
  readonly gpsConsultorio = signal<Coordinates | null>(null);

  /**
   * Lo último que cada selector dedujo de su punto, confirmado o no.
   *
   * Se guarda aparte porque la calle suele llegar **antes** de que la persona
   * confirme: al confirmar se vuelca lo que ya estaba (ver `confirmedLocality`).
   */
  private readonly localidadDomicilio = signal<LocalityFromPoint | null>(null);
  private readonly localidadTrabajo = signal<LocalityFromPoint | null>(null);
  private readonly localidadConsultorio = signal<LocalityFromPoint | null>(null);

  /**
   * El punto confirmado (o `null`) del domicilio: la señal, el control
   * obligatorio y lo que sale de él, en el acto. Un `effect` esperaría a la
   * próxima detección de cambios y un «Siguiente» inmediato vería el control
   * atrasado.
   */
  confirmarGpsDomicilio(punto: Coordinates | null): void {
    this.gpsDomicilio.set(punto);
    const control = this.formProfesional.controls.gpsDomicilio;
    if (control.value !== punto) control.setValue(punto);
    this.volcarDomicilio();
  }

  confirmarGpsTrabajo(punto: Coordinates | null): void {
    this.gpsTrabajo.set(punto);
    this.volcarTrabajo();
  }

  confirmarGpsConsultorio(punto: Coordinates | null): void {
    this.gpsConsultorio.set(punto);
    this.volcarConsultorio();
  }

  /** Lo que el selector del domicilio dedujo de su punto. */
  aplicarLocalidadDomicilio(localidad: LocalityFromPoint | null): void {
    this.localidadDomicilio.set(localidad);
    this.volcarDomicilio();
  }

  aplicarLocalidadTrabajo(localidad: LocalityFromPoint | null): void {
    this.localidadTrabajo.set(localidad);
    this.volcarTrabajo();
  }

  aplicarLocalidadConsultorio(localidad: LocalityFromPoint | null): void {
    this.localidadConsultorio.set(localidad);
    this.volcarConsultorio();
  }

  /**
   * Calle (sólo calle y número), zona y municipio del domicilio, del punto
   * confirmado. Sin punto confirmado quedan vacíos: lo escrito antes describía
   * otro lugar. Si el mapa no tiene calle ahí, la calle queda vacía —es
   * opcional— y nunca se inventa.
   */
  private volcarDomicilio(): void {
    const localidad = confirmedLocality(this.localidadDomicilio(), this.gpsDomicilio());
    this.escribirSiCambia('homeAddressLines', localidad?.calleSola ?? '');
    this.escribirSiCambia('homeDistrict', localidad?.zona ?? '');
    this.elegirMunicipioProfesional(localidad?.municipioConceptId ?? null);
  }

  /** El trabajo no guarda zona aparte: va la línea entera (calle y barrio). */
  private volcarTrabajo(): void {
    const localidad = confirmedLocality(this.localidadTrabajo(), this.gpsTrabajo());
    this.escribirSiCambia('workAddressLines', localidad?.calle ?? localidad?.zona ?? '');
  }

  private volcarConsultorio(): void {
    const localidad = confirmedLocality(this.localidadConsultorio(), this.gpsConsultorio());
    this.escribirSiCambia('officeAddressLines', localidad?.calleSola ?? '');
    this.escribirSiCambia('officeDistrict', localidad?.zona ?? '');
    this.elegirMunicipioConsultorio(localidad?.municipioConceptId ?? null);
  }

  /** Los identificadores de prueba del bloque de ubicación del consultorio. */
  protected readonly idsUbicacionConsultorio: TestIds = {
    mapa: 'registration-practitioner-office-map',
    confirmada: 'registration-practitioner-office-location-confirmed',
    avisoGeocodificacion: 'registration-practitioner-office-geocoding-notice',
    quitar: 'registration-practitioner-office-location-remove',
    confirmar: 'registration-practitioner-office-location-confirm',
    usarUbicacion: 'registration-practitioner-office-location-use',
    marcarEnMapa: 'registration-practitioner-office-location-pick',
  };

  /** Los identificadores de prueba del bloque de ubicación del domicilio. */
  protected readonly idsUbicacionDomicilio: TestIds = {
    mapa: 'registration-practitioner-home-map',
    confirmada: 'registration-practitioner-home-location-confirmed',
    avisoGeocodificacion: 'registration-practitioner-home-geocoding-notice',
    quitar: 'registration-practitioner-home-location-remove',
    confirmar: 'registration-practitioner-home-location-confirm',
    usarUbicacion: 'registration-practitioner-home-location-use',
    marcarEnMapa: 'registration-practitioner-home-location-pick',
  };

  /** Identificadores de prueba del mapa para la dirección laboral. */
  protected readonly idsUbicacionTrabajo: TestIds = {
    mapa: 'registration-practitioner-work-map',
    confirmada: 'registration-practitioner-work-location-confirmed',
    avisoGeocodificacion: 'registration-practitioner-work-geocoding-notice',
    quitar: 'registration-practitioner-work-location-remove',
    confirmar: 'registration-practitioner-work-location-confirm',
    usarUbicacion: 'registration-practitioner-work-location-use',
    marcarEnMapa: 'registration-practitioner-work-location-pick',
  };

  /**
   * Casillas de nombres adicionales (cuarto, quinto, …) agregadas por el usuario.
   */
  readonly nombresExtra = signal<readonly string[]>([]);

  /**
   * Las especialidades del alta, todas iguales.
   *
   * Hasta el 23/09/2026 había además un desplegable «Especialidad principal»;
   * el médico pidió que ninguna se distinguiera (D-01) y se retiró. Ahora son
   * sólo estas casillas, hasta cuatro ({@link MAXIMO_DE_ESPECIALIDADES}). La
   * cadena vacía es «esta casilla todavía no eligió nada».
   */
  readonly especialidadesExtra = signal<readonly string[]>([]);

  /** Para que la plantilla deje de ofrecer «Agregar» al llegar al techo. */
  protected readonly maximoDeEspecialidades = MAXIMO_DE_ESPECIALIDADES;

  /**
   * Dónde estudió cada especialidad, **en el mismo orden** que
   * {@link especialidadesExtra}: la fila `i` es el estudio de la casilla `i`.
   * Es un arreglo aparte y no un objeto por casilla porque `especialidadesExtra`
   * es lo que ya leen las pruebas y el envío (`specialtyConceptIds`); una fila
   * que falte se lee como vacía (ver {@link specialtyStudyAt}).
   */
  readonly specialtyStudies = signal<readonly SpecialtyStudy[]>([]);

  /** El estudio de la casilla `index`; en blanco si todavía no se tocó. */
  specialtyStudyAt(index: number): SpecialtyStudy {
    return this.specialtyStudies()[index] ?? EMPTY_STUDY;
  }

  /** La clave del PDF de una especialidad en {@link attachmentFiles}. */
  protected specialtyFileKey(index: number): string {
    return `especialidad-${index}`;
  }

  /**
   * Cambia el estudio de una casilla y, en el mismo paso, el control que respalda
   * la página ante el motor. Síncrono por lo mismo que {@link actualizarTitulos}.
   */
  private updateSpecialtyStudy(
    index: number,
    change: (study: SpecialtyStudy) => SpecialtyStudy,
  ): void {
    this.specialtyStudies.update((studies) => {
      const next = [...studies];
      while (next.length <= index) next.push(EMPTY_STUDY);
      next[index] = change(next[index]);
      return next;
    });
    this.syncSpecialtyStudiesControl();
    this.limpiarAvisoDeTitulos();
  }

  private syncSpecialtyStudiesControl(): void {
    this.formProfesional.controls.especialidadesExtra.setValue(!this.hasStudiesMissingNumber());
  }

  /** Si alguna especialidad declara estudio sin el número que la hace guardable. */
  protected hasStudiesMissingNumber(): boolean {
    return this.specialtyStudies().some((study) => isStudyMissingNumber(study));
  }

  /** Si esta casilla declara estudio pero le falta el número. Público para la plantilla. */
  specialtyStudyMissingNumber(index: number): boolean {
    return isStudyMissingNumber(this.specialtyStudyAt(index));
  }

  /** Qué falta en «Sus especialidades», nombrando las casillas tal como se ven. */
  protected readonly incompleteStudiesNotice = computed<string | null>(() => {
    const missing = this.specialtyStudies()
      .map((study, index) => (isStudyMissingNumber(study) ? `Especialidad ${index + 1}` : null))
      .filter((name): name is string => name !== null);
    if (missing.length === 0) return null;
    const where =
      missing.length === 1
        ? `«${missing[0]}»`
        : `${missing
            .slice(0, -1)
            .map((name) => `«${name}»`)
            .join(', ')} y «${missing.at(-1)}»`;
    return `Falta el número del diploma en ${where}. Complételo o quite la especialidad para seguir.`;
  });

  /** Escribe el número, el país, la universidad o la ciudad de una especialidad. */
  writeSpecialtyStudy(
    index: number,
    field: EditableStudyField,
    value: string | number | null,
  ): void {
    const text = value === null ? '' : String(value);
    this.updateSpecialtyStudy(index, (study) => withStudyField(study, field, text, this.padron));
  }

  /** Elige el país de una especialidad; reinicia su universidad si cambia. */
  chooseSpecialtyCountry(index: number, choice: string | null): void {
    this.updateSpecialtyStudy(index, (study) => studyWithCountry(study, choice, this.padron));
  }

  /** Elige la universidad de una especialidad; su ciudad la acompaña. */
  chooseSpecialtyUniversity(index: number, choice: string | null): void {
    this.updateSpecialtyStudy(index, (study) => studyWithUniversity(study, choice, this.padron));
  }

  /** Elige la ciudad de una especialidad, que sólo puede ser una sede de su universidad. */
  chooseSpecialtyCity(index: number, city: string | null): void {
    this.updateSpecialtyStudy(index, (study) => ({ ...study, city: city ?? '' }));
  }

  /** Las universidades de una especialidad: las de salud del país elegido. */
  specialtyUniversityOptions(index: number): readonly SelectOption<string>[] {
    return this.padron.universityOptions(this.specialtyStudyAt(index).country, 'salud');
  }

  /** Las sedes de la universidad elegida para una especialidad. */
  specialtyCityOptions(index: number): readonly SelectOption<string>[] {
    const study = this.specialtyStudyAt(index);
    return opcionesDeCiudad(this.padron.citiesOf(study.country, study.university));
  }

  /** Adjunta (o quita) el diploma de una especialidad. */
  updateSpecialtyFiles(index: number, files: readonly File[]): void {
    this.attachmentFiles.update((current) => ({
      ...current,
      [this.specialtyFileKey(index)]: files,
    }));
    const file = files[0];
    this.updateSpecialtyStudy(index, (study) => ({
      ...study,
      fileName: file?.name ?? null,
      fileBytes: file?.size ?? null,
      fileId: null,
    }));
    this.errorAdjunto.set(null);
  }

  /** Suma una casilla vacía de especialidad. */
  agregarEspecialidad(): void {
    if (this.especialidadesExtra().length >= MAXIMO_DE_ESPECIALIDADES) return;
    this.especialidadesExtra.update((actuales) => [...actuales, '']);
  }

  /**
   * Quita una de las casillas agregadas.
   *
   * @param indice - Cuál de las casillas extra, empezando por 0.
   */
  quitarEspecialidad(indice: number): void {
    this.especialidadesExtra.update((actuales) => actuales.filter((_, i) => i !== indice));
    this.specialtyStudies.update((studies) => studies.filter((_, i) => i !== indice));
    // Los PDF van por posición: al quitar una casilla, las de después suben un
    // lugar y su archivo con ellas; el de la quitada se descarta.
    this.attachmentFiles.update((current) => {
      const next: Partial<Record<string, readonly File[]>> = {};
      for (const [key, files] of Object.entries(current)) {
        const position = /^especialidad-(\d+)$/.exec(key);
        if (position === null || Number(position[1]) < indice) {
          next[key] = files;
        } else if (Number(position[1]) > indice) {
          next[this.specialtyFileKey(Number(position[1]) - 1)] = files;
        }
      }
      return next;
    });
    this.syncSpecialtyStudiesControl();
  }

  /**
   * Elige la especialidad de una de las casillas agregadas.
   *
   * @param indice - Cuál de las casillas extra, empezando por 0.
   * @param valor - El uuid elegido, o `null` si se volvió al vacío.
   */
  elegirEspecialidadExtra(indice: number, valor: string | null): void {
    const elegida = valor ?? '';
    this.especialidadesExtra.update((actuales) =>
      actuales.map((especialidad, i) => (i === indice ? elegida : especialidad)),
    );
  }

  /** Suma una casilla vacía de nombre. */
  agregarNombre(): void {
    this.nombresExtra.update((actuales) => [...actuales, '']);
  }

  /**
   * Quita una de las casillas agregadas.
   *
   * @param indice - Cuál de las casillas extra, empezando por 0.
   */
  quitarNombre(indice: number): void {
    this.nombresExtra.update((actuales) => actuales.filter((_, i) => i !== indice));
  }

  /**
   * Escribe en una de las casillas agregadas.
   *
   * @param indice - Cuál de las casillas extra, empezando por 0.
   * @param valor - Lo que se escribió.
   */
  escribirNombreExtra(indice: number, valor: string | number | null): void {
    const texto = valor === null ? '' : String(valor);
    this.nombresExtra.update((actuales) =>
      actuales.map((nombre, i) => (i === indice ? texto : nombre)),
    );
  }

  /**
   * El valor de un control de nombre, para el campo proyectado.
   *
   * @param key - Cuál de los tres controles de nombre.
   */
  valorDeNombre(key: 'name' | 'middleName' | 'thirdName'): string {
    return this.formProfesional.controls[key].value;
  }

  /**
   * Escribe en un control de nombre desde el campo proyectado.
   *
   * @param key - Cuál de los tres controles de nombre.
   * @param valor - Lo que se escribió.
   */
  escribirNombre(key: 'name' | 'middleName' | 'thirdName', valor: string | number | null): void {
    this.formProfesional.controls[key].setValue(valor === null ? '' : String(valor));
  }

  /**
   * El padrón país → universidades. Bolivia está siempre; el resto se pide en el
   * constructor y llega por su propio trozo. Ver {@link UniversitiesRegistry}.
   */
  private readonly padron = inject(UniversitiesRegistry);

  /** Las opciones del desplegable de país, iguales en el título y en las filas. */
  protected readonly opcionesDePais = this.padron.countryOptions;

  /** Si el padrón importado todavía viene, para decirlo debajo del campo. */
  protected readonly padronCargando = computed(() => this.padron.status() === 'cargando');

  /**
   * Qué opción del desplegable de país del título principal está marcada.
   *
   * Va en un signal aparte del `FormControl` por lo mismo que `paisElegido` en
   * la fila: con «Otro país…» elegido y nada escrito, el control está vacío y
   * el desplegable tiene que seguir diciendo «Otro».
   */
  protected readonly paisDelTituloElegido = signal<string | null>(null);
  protected readonly universidadDelTituloElegida = signal<string | null>(null);

  protected readonly paisDelTituloEsOtro = computed(
    () => this.paisDelTituloElegido() === CATALOG_OUTSIDE_COUNTRY,
  );
  protected readonly universidadDelTituloEsOtra = computed(
    () => this.universidadDelTituloElegida() === CATALOG_OUTSIDE_INSTITUTION,
  );

  /** El país del título principal como texto, espejado desde el control. */
  private readonly paisDelTituloTexto = signal('');

  /**
   * Las universidades que se ofrecen para el título principal: las del país
   * elegido. Es el árbol que pidió el propietario: primero el país, después la
   * universidad acotada a él.
   */
  protected readonly opcionesDeUniversidadDelTitulo = computed(() =>
    this.padron.universityOptions(
      this.paisDelTituloTexto(),
      titleHealthFilter(this.tituloProfesionalTexto() ?? ''),
    ),
  );

  /** El título con el que ejerce, como signal: acota las universidades de arriba. */
  private readonly tituloProfesionalTexto = toSignal(
    this.formProfesional.controls.professionalTitle.valueChanges,
    { initialValue: this.formProfesional.controls.professionalTitle.value },
  );

  /** La ciudad del título principal elegida, como signal para el desplegable. */
  private readonly ciudadDelTituloTexto = toSignal(
    this.formProfesional.controls.professionalTitleCity.valueChanges,
    { initialValue: this.formProfesional.controls.professionalTitleCity.value },
  );

  /** Las ciudades del título principal: las sedes de la universidad elegida. */
  protected readonly ciudadesDelTitulo = computed(() =>
    opcionesDeCiudad(
      this.padron.citiesOf(this.paisDelTituloTexto(), this.universidadDelTituloTexto()),
    ),
  );

  /** La universidad del título principal como texto, espejada desde el control. */
  private readonly universidadDelTituloTexto = signal('');

  /** Lo que muestra el desplegable de ciudad del título principal. */
  protected readonly ciudadDelTitulo = computed(() => this.ciudadDelTituloTexto() || null);

  /** Elige la ciudad del título principal, entre las sedes de su universidad. */
  elegirCiudadDelTitulo(ciudad: string | null): void {
    this.formProfesional.controls.professionalTitleCity.setValue(ciudad ?? '');
  }

  /** Lo guardado en uno de los tres campos de estudio del título principal. */
  valorDeEstudio(key: ClaveDeEstudioDelTitulo): string {
    return this.formProfesional.controls[key].value;
  }

  /**
   * Escribe uno de los tres campos de estudio del título principal como texto.
   *
   * Es la casilla escrita a mano de «Otro…» y, para las pruebas, la forma de
   * poner un valor: el desplegable se pone a tono con la misma regla que
   * {@link conDatoEscrito} en la fila.
   */
  escribirEstudio(key: ClaveDeEstudioDelTitulo, valor: string | number | null): void {
    const texto = valor === null ? '' : String(valor);
    this.formProfesional.controls[key].setValue(texto);
    if (key === 'professionalTitleUniversity') {
      this.universidadDelTituloTexto.set(texto);
    }
    if (key === 'professionalTitleCountry') {
      this.paisDelTituloTexto.set(texto);
      if (this.paisDelTituloElegido() !== CATALOG_OUTSIDE_COUNTRY) {
        this.paisDelTituloElegido.set(
          choiceFromText(
            texto,
            (pais) => this.padron.isCatalogCountry(pais),
            CATALOG_OUTSIDE_COUNTRY,
          ),
        );
      }
    }
    if (
      key === 'professionalTitleUniversity' &&
      this.universidadDelTituloElegida() !== CATALOG_OUTSIDE_INSTITUTION
    ) {
      this.universidadDelTituloElegida.set(
        choiceFromText(
          texto,
          (universidad) => this.padron.isUniversityOf(this.paisDelTituloTexto(), universidad),
          CATALOG_OUTSIDE_INSTITUTION,
        ),
      );
    }
  }

  /**
   * Elige el país del título principal en el desplegable. Cambiar de país
   * reinicia la universidad, por lo mismo que en {@link elegirEnFila}.
   */
  elegirPaisDelTitulo(eleccion: string | null): void {
    const pais = eleccion === null || eleccion === CATALOG_OUTSIDE_COUNTRY ? '' : eleccion;
    const cambiaDePais = pais !== this.paisDelTituloTexto();
    // Antes de mover el país: la ciudad propuesta se reconoce por la
    // universidad que estaba elegida **en el país anterior**.
    if (cambiaDePais) {
      this.elegirUniversidadDelTitulo(null);
    }
    this.paisDelTituloElegido.set(eleccion);
    this.paisDelTituloTexto.set(pais);
    this.formProfesional.controls.professionalTitleCountry.setValue(pais);
  }

  /**
   * Elige la universidad del título principal en el desplegable.
   *
   * La ciudad de estudio la acompaña: se completa con la de la universidad
   * elegida, salvo que la persona ya hubiera escrito la suya. Es la misma regla
   * que en la fila ({@link conUniversidadElegida}).
   */
  elegirUniversidadDelTitulo(eleccion: string | null): void {
    const { professionalTitleUniversity, professionalTitleCity } = this.formProfesional.controls;
    const pais = this.paisDelTituloTexto();
    const universidad =
      eleccion === null || eleccion === CATALOG_OUTSIDE_INSTITUTION ? '' : eleccion;
    professionalTitleCity.setValue(
      cityToChooseUniversity(professionalTitleCity.value, this.padron.citiesOf(pais, universidad)),
    );
    this.universidadDelTituloElegida.set(eleccion);
    this.universidadDelTituloTexto.set(universidad);
    professionalTitleUniversity.setValue(universidad);
  }

  /** Si hay que pintar en rojo el primer nombre. */
  readonly primerNombreEnRojo = computed(() => {
    const control = this.formProfesional.controls.name;
    return control.touched && control.invalid;
  });

  /**
   * Los nombres que no son el primero, en una sola cadena.
   *
   * La codificación —todo lo que no es el primer nombre va junto en
   * `middle_name`, separado por espacios— salió a `nombres-adicionales` cuando
   * el editor del perfil tuvo que ofrecer las mismas casillas: el alta las
   * escribía y el editor las leía con otro criterio, así que corregir el
   * apellido desde el perfil borraba el tercer nombre declarado acá.
   */
  private nombresAdicionales(): string {
    const raw = this.formProfesional.getRawValue();
    return joinNames([raw.middleName, raw.thirdName, ...this.nombresExtra()]);
  }

  /** Departamento que emitió el documento (VS_BO_DEPARTMENT), y su catálogo. */
  private readonly departamentos = inject(BoDepartmentsCatalog);
  readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);
  readonly catalogoDepartamentosCaido = signal(false);

  /**
   * Las especialidades (VS_MEDICAL_SPECIALTY) y su catálogo.
   *
   * Se guardan CON su código además del par value/label: el código es lo que
   * identifica cada entrada del catálogo y permite comprobar su cobertura.
   */
  private readonly especialidades = inject(MedicalSpecialtiesCatalog);
  readonly opcionesEspecialidad = signal<readonly { value: string; label: string; code: string }[]>(
    [],
  );
  readonly catalogoEspecialidadesCaido = signal(false);

  /**
   * El título profesional elegido, **como señal**.
   *
   * Duplica el valor del `FormControl` a propósito. Las etiquetas del colegio
   * profesional dependen de esta selección; el catálogo de especialidades
   * permanece completo para cualquier profesión, como indica L0174.
   */
  private readonly tituloProfesionalElegido = signal('');

  /**
   * Lo escrito en la lupa del título. **Nunca reemplaza al valor del control**:
   * el `FormControl` sigue siendo el que manda y de él cuelga el colegio
   * automático. El catálogo de especialidades no depende de ese valor.
   */
  readonly busquedaTituloProfesional = signal('');

  /** Las doce opciones locales, acotadas por lo que se escribió. */
  readonly titulosProfesionalesFiltrados = computed<readonly ReferenceOption[]>(() => {
    const busqueda = this.busquedaTituloProfesional().trim().toLowerCase();
    // Sin peticiones: la lista es cerrada y ya está en memoria. Una lupa que
    // consulta al servidor para filtrar doce opciones agrega latencia y un
    // estado de error donde no hacía falta ninguno.
    return busqueda === ''
      ? PROFESSIONAL_TITLE_OPTIONS
      : PROFESSIONAL_TITLE_OPTIONS.filter((opcion) =>
          opcion.label.toLowerCase().includes(busqueda),
        );
  });

  /** La opción elegida, para que el rótulo vuelva al regresar a este paso. */
  readonly tituloProfesionalSeleccionado = computed<ReferenceOption | null>(() => {
    const valor = this.tituloProfesionalElegido();
    return PROFESSIONAL_TITLE_OPTIONS.find((opcion) => opcion.value === valor) ?? null;
  });

  /**
   * Escribe la elección en el mismo control de siempre.
   *
   * Es la línea que conserva la cadena `professionalTitle` →
   * `regulatoryAuthority`. Escribir el título en un estado propio de la lupa
   * habría cortado esa actualización en silencio.
   */
  elegirTituloProfesional(opcion: ReferenceOption | null): void {
    this.formProfesional.controls.professionalTitle.setValue(opcion?.value ?? '');
  }

  /**
   * Las páginas del alta, en el orden que pide AC-05-1.
   *
   * ## El orden
   *
   * Nombres y apellidos → CI + expedición → sexo → fecha de nacimiento →
   * celular → correo → residencia → matrículas → título → especialidades. Es la
   * lista del propietario (TAREA 05 §1.2) con los bloques que **tienen dónde
   * guardarse**; los que no, más abajo.
   *
   * ## Por qué la contraseña viaja con el correo y no al final
   *
   * Porque acá el correo **es** el identificador de acceso —a diferencia del
   * alta de paciente, que entra con el documento—, y las dos mitades de una
   * misma credencial se contestan juntas. El orden del propietario no la nombra
   * en ningún sitio; ponerla en su propia página al final sería un paso más
   * para un dato que ya está en la página que dice «con esto entrás».
   *
   * ## Lo que el orden pide y esta pantalla NO pregunta
   *
   * No es un olvido: **no tiene dónde guardarse**, y un formulario que pide un
   * dato y lo tira es peor que uno que no lo pide. Acá no hay migraciones
   * (ADR-0021) y el repositorio del modelo no está en este workspace, así que
   * ninguna de estas columnas se puede promover desde este carril.
   *
   * (**AC-05-6 ya no está en esta lista**: el celular y el correo personales,
   * el celular y el fijo del trabajo y el correo de acceso son cinco campos
   * distintos desde que la API los recibe por separado y los guarda como cinco
   * filas de puntos de contacto, cada una con su par sistema × uso.)
   * - **La zona** de residencia (AC-05-8). `common.addresses` no tiene columna
   *   de zona para ninguno de los dos registros, así que sigue sin preguntarse.
   *   La **línea de dirección y el GPS** salieron de esta lista el 08/09/2026:
   *   la pantalla ya los pregunta, con el mismo bloque que el alta de paciente.
   *   Lo que falta para que lleguen a destino es del lado de la API — ver el
   *   aviso de `datosProfesional`.
   * - **La organización y su ubicación** (AC-05-9, -10, -11). El padrón existe
   *   (`VS_BO_HEALTH_FACILITY`, 642 establecimientos de Santa Cruz) y el vínculo
   *   también (`profiles.practitioner_affiliations`, con su estado
   *   «declarado»), pero el DTO del alta no tiene por dónde recibirlos y
   *   `CreateAffiliationDto` ni siquiera expone `healthFacilityConceptId`.
   *   Además, el buscador que autocompletaría la dirección
   *   (`linkable-organizations`) exige sesión, y la expansión pública del value
   *   set devuelve nombre y código —no la dirección ni el municipio del
   *   establecimiento—, así que el autocompletado de AC-05-9 no es alcanzable
   *   desde una pantalla sin sesión aunque el campo existiera.
   * - **Las tres matrículas por separado** (AC-05-5). Siguen siendo **dos**
   *   números —`licenseNumber` (Ministerio, jurisdicción nacional) y
   *   `sedesLicenseNumber` (SEDES, jurisdicción departamental)— y **una**
   *   autoridad. El tercero, el registro del colegio profesional, todavía no
   *   tiene dónde ir: sería una tercera fila de `common.identifiers`, y eso es
   *   esquema. Lo que sí se corrigió es que el segundo dejara de archivarse
   *   como título de grado: es una habilitación y vive con la matrícula.
   * - **Lugar de estudio** (AC-05-13). La universidad se guarda por credencial
   *   y se elige de un padrón acotado al país; el país y la ciudad se siguen
   *   preguntando, pero no viajan porque el alta no define esos campos. Los PDFs de credenciales ahora se precargan y se
   *   asocian a su fila en el alta.
   *
   * ## El tope de cuatro campos por página no se relaja (AC-05-2)
   *
   * Todas pasan por `paginateFields`, que es la función que hace cumplir el tope,
   * salvo **nombre y cédula**: son cinco campos en una sola página, como en el
   * alta de paciente (propietario, 22/10/2026), y es la única excepción.
   */
  readonly paginasProfesional = computed<readonly PaginaDeFormulario[]>(() =>
    practitionerFields({
      professionalTitle: this.tituloProfesionalElegido(),
      departmentIssuerField: (testId) => this.campoDepartamentoEmisor(testId),
    }),
  );

  /**
   * El campo del departamento que emitió el documento.
   *
   * Es un `select` del motor mientras su catálogo esté; si la lectura falló,
   * el mismo campo pasa a `custom` y la pantalla proyecta ahí el aviso con su
   * «Reintentar». Un `select` vacío no tiene dónde decir que no cargó: se ve
   * como un desplegable sin opciones, que es indistinguible de un catálogo que
   * de verdad no tiene ninguna.
   *
   * La clave es la misma en los dos casos —la del control—, así que lo que se
   * haya elegido antes de un fallo no se pierde.
   */
  private campoDepartamentoEmisor(testId: string): CampoDeFormulario {
    const base = {
      key: 'issuerAdministrativeAreaConceptId',
      label: 'Departamento de emisión',
      required: true,
      hint: 'El «SC», «LP»... de su cédula.',
      mensajeDeError: 'Elija el departamento que expidió su cédula.',
    } as const;

    return this.catalogoDepartamentosCaido()
      ? // Sin catálogo el campo deja de ser un desplegable y pasa a ser un aviso
        // con su botón de reintento: eso no cabe en medio renglón, así que
        // recupera la fila entera. La pareja con el número sólo tiene sentido
        // mientras los dos sean casillas del mismo tamaño.
        { ...base, control: 'custom', ancho: 'completo' }
      : {
          ...base,
          control: 'select',
          options: this.opcionesDepartamento(),
          placeholder: 'Elija el departamento',
          testId,
          // La otra mitad del renglón del documento. Ver la página que lo usa.
          ancho: 'mitad',
        };
  }

  /* ---- Estado de la pantalla --------------------------------------------- */

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');

  readonly registered = signal(false);

  /**
   * Con qué va a iniciar sesión, para decírselo en la confirmación.
   *
   * Fijo, y ésa es la mitad del sentido de esta pantalla: el profesional entra
   * con su correo. El alta de paciente dice «tu documento», y mientras las dos
   * vivían en el mismo componente esto era un `computed` sobre el tipo de
   * cuenta.
   */
  readonly accessHint = 'su correo';

  /**
   * La clave de la página que se está contestando, tal como la avisa el motor.
   *
   * Empieza vacía y no en la primera clave: el motor emite la página apenas
   * monta, así que el valor de verdad llega solo. Adivinarlo acá sería tener
   * dos fuentes para el mismo dato, y la de adivinar es la que se olvida de
   * actualizarse cuando alguien reordene las páginas.
   */
  readonly claveVisible = signal('');

  /** Las tarjetas del costado: por qué te pedimos lo de ESTE paso. */
  readonly ayudaVisible = computed<readonly HelpCard[]>(
    () => AYUDA_PROFESIONAL[this.claveVisible()] ?? [],
  );

  /** Guarda el borrador del avance del formulario en caché y backend. */
  guardarBorrador(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const paginas = this.paginasProfesional();
      const clave = this.claveVisible();
      const indice = Math.max(
        0,
        paginas.findIndex((p) => p.clave === clave),
      );
      const titulo = paginas[indice]?.titulo ?? clave;
      const raw = this.formProfesional.getRawValue();
      const extraData = {
        nombresExtra: this.nombresExtra(),
        especialidadesExtra: this.especialidadesExtra(),
        gpsDomicilio: this.gpsDomicilio(),
        gpsTrabajo: this.gpsTrabajo(),
        gpsConsultorio: this.gpsConsultorio(),
      };
      this.draftService.saveProgress(
        'practitioner',
        indice,
        clave,
        titulo,
        raw,
        extraData,
        paginas.length,
      );
      this.draftService.trackEvent('step_view', 'practitioner', indice, {
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
      const draft = draftParam ?? this.draftService.detectDraft('practitioner');
      if (!draft) return;
      if (draft.data) {
        this.formProfesional.patchValue(revivirFechas(draft.data, CAMPOS_DE_FECHA));
        // Los municipios deducidos viajan desde sus señales: vuelven con el control.
        const raw = this.formProfesional.getRawValue();
        this.municipioProfesional.set(raw.municipio);
        this.municipioConsultorio.set(raw.municipioConsultorio);
      }
      const extra = (draft.extraData ?? {}) as Record<string, unknown>;
      if (Array.isArray(extra['nombresExtra'])) {
        this.nombresExtra.set(extra['nombresExtra'] as readonly string[]);
      }
      if (Array.isArray(extra['especialidadesExtra'])) {
        this.especialidadesExtra.set(extra['especialidadesExtra'] as readonly string[]);
      }
      if (extra['gpsDomicilio'] !== undefined) {
        // La señal y el control obligatorio, juntos. Sin volcar lo deducido: la
        // calle y la localidad ya volvieron con `data`, y el selector las vuelve
        // a deducir del mismo punto al mostrarse.
        const punto = extra['gpsDomicilio'] as Coordinates | null;
        this.gpsDomicilio.set(punto);
        this.formProfesional.controls.gpsDomicilio.setValue(punto);
      }
      if (extra['gpsTrabajo'] !== undefined) {
        this.gpsTrabajo.set(extra['gpsTrabajo'] as Coordinates | null);
      }
      if (extra['gpsConsultorio'] !== undefined) {
        this.gpsConsultorio.set(extra['gpsConsultorio'] as Coordinates | null);
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
    this.draftService.trackEvent('abandon', 'practitioner', 0);
  }

  /** Elimina el borrador en caché al completar exitosamente el registro. */
  limpiarBorrador(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      this.draftService.clearDraft('practitioner');
      this.borradorDetectado.set(null);
    } catch {
      // Ignorar
    }
  }

  /** Lo que el motor avisa al cambiar de página. */
  protected recordarPaso(pagina: PaginaDeFormulario): void {
    this.claveVisible.set(pagina.clave ?? '');
    this.guardarBorrador();
  }

  readonly errorMessage = computed<string | null>(() => {
    const state = this.state();
    if (state.status === 'validation') {
      return state.issues[0]?.message ?? null;
    }
    if (state.status === 'offline') {
      return 'No pudimos conectarnos. Revise su conexión y reintente.';
    }
    if (state.status === 'error') {
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    }
    return null;
  });

  constructor() {
    const detectado = this.draftService.detectDraft('practitioner');
    if (detectado && (detectado.stepIndex > 0 || Object.keys(detectado.data).length > 2)) {
      this.borradorDetectado.set(detectado);
    }
    this.draftService.trackEvent('start', 'practitioner', 0);

    this.cargarDepartamentos();
    this.cargarEspecialidades();
    this.cargarTiposDeCredencial();
    this.cargarProfesiones();
    // El padrón de universidades llega por su propio trozo; un fallo no frena
    // nada: Bolivia y «Otro…» están siempre.
    void this.padron.cargar();
    this.syncCollegeWithProfession();

    this.formProfesional.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.guardarBorrador();
    });

    // El aviso de un envío fallido se va en cuanto se corrige algo.
    this.limpiarElErrorAlCorregir();
  }

  /**
   * El registro del cliente, §1.4.4: al elegir la profesión, el colegio cambia
   * SOLO. Elegir «Odontólogo» pone Colegio de Odontólogos; una profesión médica
   * pone Colegio Médico — pero únicamente si la autoridad estaba vacía o era el
   * otro colegio del par: una elección explícita distinta (SEDES, Enfermería…)
   * no se pisa, porque el automatismo es una ayuda, no una regla.
   *
   * Se llama desde el constructor: `takeUntilDestroyed` pide contexto de
   * inyección. Sin eso el espejo del título no se instala y el rótulo del
   * colegio deja de actualizarse — ver {@link tituloProfesionalElegido}.
   */
  private syncCollegeWithProfession(): void {
    const titulo = this.formProfesional.controls.professionalTitle;
    const autoridad = this.formProfesional.controls.regulatoryAuthority;
    titulo.valueChanges.pipe(takeUntilDestroyed()).subscribe((valor) => {
      // Primero el espejo: de acá leen las etiquetas del colegio en el grafo
      // de señales.
      this.tituloProfesionalElegido.set(valor);

      // El colegio sigue a la profesión: la opción «Colegio de la profesión»
      // lleva el nombre del colegio de ese título. Vacía, se llena sólo si el
      // título tiene colegio conocido; un colegio ya elegido se cambia por el
      // del título nuevo. Ministerio o SEDES, elegidos a mano, no se tocan.
      const colegio = titleCollege(valor);
      const actual = autoridad.value;
      const cambiar =
        actual === '' ? colegio !== PROFESSION_COLLEGE : isCollege(actual) && actual !== colegio;
      if (cambiar) {
        autoridad.setValue(colegio);
      }
    });
  }

  /** El catálogo completo está disponible cualquiera sea la profesión elegida. */
  protected allSpecialtyOptions(): readonly SelectOption<string>[] {
    return this.opcionesEspecialidad().map(({ value, label }) => ({ value, label }));
  }

  /**
   * El consultorio propio tal como viaja en el alta, o `null` si no declaró
   * ninguno.
   *
   * ## Qué cuenta como «declaró uno»
   *
   * **Cualquiera de las cuatro piezas.** La página entera es opcional, así que
   * lo que decide no es un campo obligatorio sino que haya algo que guardar: un
   * nombre, una localidad, una calle o un punto. Exigir el nombre habría hecho
   * que quien completa la dirección y se olvida del rótulo pierda lo escrito
   * sin que nadie se lo diga, que es la clase de silencio que este alta ya
   * corrigió en otros dos sitios.
   *
   * Sin nombre se manda el genérico: el backend lo exige (`NewOwnSite.name`) y
   * un consultorio sin rótulo se sigue pudiendo renombrar desde el perfil.
   *
   * ## La forma es la de `NewOwnSite`, no una nueva
   *
   * Es exactamente el cuerpo que ya recibe `POST /practitioners/me/sites`
   * (ALV-005/006) y que arma «Mi perfil → dónde trabajo». No se inventa un
   * contrato: el alta pública no puede llamar a esa ruta —no hay sesión
   * todavía, el registro termina en el login— así que el dato viaja adentro del
   * alta y el backend reutiliza el mismo servicio.
   */
  private consultorioPropio(): NewOwnSite | null {
    const raw = this.formProfesional.getRawValue();
    const nombre = raw.officeName.trim();
    const calle = componerDireccion(raw.officeAddressLines, raw.officeDistrict);
    const telefono = raw.officeContactPhone.trim();
    const municipio = this.municipioConsultorio();
    const punto = this.gpsConsultorio();

    if (nombre === '' && calle === '' && telefono === '' && municipio === null && punto === null) {
      return null;
    }

    // La dirección sólo viaja si tiene algo adentro: una dirección vacía no es
    // «sin dirección», es una fila vacía en `common.addresses`. Es la misma
    // regla que ya aplica `work-history.ts` al registrar una sede.
    const conDireccion = calle !== '' || municipio !== null || punto !== null;

    return {
      name: nombre === '' ? NOMBRE_CONSULTORIO_POR_OMISION : nombre,
      ...(telefono === '' ? {} : { contactPhone: telefono }),
      ...(conDireccion
        ? {
            address: {
              lines: calle === '' ? [] : [calle],
              ...(municipio === null ? {} : { municipalityConceptId: municipio }),
              ...(punto === null ? {} : { latitude: punto.lat, longitude: punto.lng }),
            },
          }
        : {}),
    };
  }

  /** Ver el constructor. Se llama desde ahí: `takeUntilDestroyed` pide contexto de inyección. */
  private limpiarElErrorAlCorregir(): void {
    this.formProfesional.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.errorMessage() !== null) {
        this.state.set(ready(null));
      }
    });
  }

  /* ---- Catálogos --------------------------------------------------------- */

  /**
   * Trae el catálogo de departamentos bolivianos, para «departamento que
   * emitió tu documento».
   *
   * Un fallo no bloquea el registro: el campo es opcional, así que sin
   * catálogo la persona sigue pudiendo crear su cuenta y completar el dato
   * después desde su perfil.
   */
  protected cargarDepartamentos(): void {
    this.departamentos.listar().subscribe({
      next: (opciones) => {
        this.catalogoDepartamentosCaido.set(false);
        this.opcionesDepartamento.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        );
      },
      error: () => {
        this.opcionesDepartamento.set([]);
        this.catalogoDepartamentosCaido.set(true);
      },
    });
  }

  /** Las especialidades, para elegirlas EN el alta. Un fallo no bloquea: son opcionales. */
  protected cargarEspecialidades(): void {
    this.especialidades.listar().subscribe({
      next: (opciones) => {
        this.catalogoEspecialidadesCaido.set(false);
        this.opcionesEspecialidad.set(
          opciones.map((opcion) => ({
            value: opcion.conceptId,
            label: opcion.display,
            code: opcion.code,
          })),
        );
      },
      error: () => {
        this.opcionesEspecialidad.set([]);
        this.catalogoEspecialidadesCaido.set(true);
      },
    });
  }

  /**
   * Reintenta la lectura del catálogo.
   *
   * Olvida lo cacheado antes de pedir: `BoDepartmentsCatalog` comparte la
   * lectura con `shareReplay`, que guarda también el error, así que sin esto
   * «Reintentar» repetía el mismo fallo sin llegar a tocar la red. Mismo
   * criterio que `practitioner-profile-edit`.
   */
  protected reintentarDepartamentos(): void {
    this.departamentos.olvidar();
    this.cargarDepartamentos();
  }

  /* ---- Envío ------------------------------------------------------------- */

  /**
   * El envío, que el motor dispara en la última página y sólo con todo válido.
   *
   * La comprobación se repite acá igual: `submit()` es público —lo llaman las
   * pruebas y podría llamarlo otra pantalla— y un alta a medias que llegue a la
   * API es un 400 que la persona lee como un fallo del producto.
   */
  submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    // El aviso de títulos va ANTES del corte por formulario inválido: desde
    // que «Tus títulos» tiene su control de respaldo, una fila sin número
    // también deja el formulario inválido, y cortar primero escondería el
    // mensaje que dice qué sección corregir.
    if (
      this.formProfesional.invalid &&
      !this.hayTitulosSinNumero() &&
      !this.hasStudiesMissingNumber()
    ) {
      this.formProfesional.markAllAsTouched();
      return;
    }

    // Una fila de título sin número no se puede guardar —la columna es NOT
    // NULL—, así que el alta se frena acá y lo dice, en vez de mandarla y que
    // la API la rechace entera. Quitar la fila es la otra salida.
    //
    // El aviso va por el MISMO canal que el error de envío (`state` →
    // `errorMessage()` → `app-alert` con `appAnuncio`), que ya se anuncia a
    // lectores de pantalla y vive fuera del motor, así que se ve desde
    // cualquier paso. Nombra el paso al que hay que volver porque el índice de
    // pasos es navegable (`interactiveSteps`): el motor **no** expone una vía
    // para saltar de página desde afuera, y abrirla sería tocar un organismo
    // que usan las otras altas.
    if (this.hayTitulosSinNumero()) {
      this.state.set(
        validation([
          {
            field: 'academicTitles',
            message:
              `Vuelva al paso «Sus títulos». ${this.avisoDeTitulosIncompletos() ?? ''}`.trim(),
          },
        ]),
      );
      return;
    }
    // Lo mismo para el estudio de una especialidad: sin número de diploma no se
    // puede guardar, y se dice en qué casilla y en qué paso.
    if (this.hasStudiesMissingNumber()) {
      this.state.set(
        validation([
          {
            field: 'especialidadesExtra',
            message:
              `Vuelva al paso «Sus especialidades». ${this.incompleteStudiesNotice() ?? ''}`.trim(),
          },
        ]),
      );
      return;
    }
    // La universidad sola conserva su carácter opcional. Un PDF declarado sí
    // necesita un diploma numerado para que no se pierda al crear la cuenta.
    if (
      this.attachmentFiles()['professional-title']?.length &&
      this.hayUniversidadPrincipalSinTitulo()
    ) {
      this.state.set(
        validation([
          {
            field: 'professionalTitleUniversity',
            message:
              'Complete el número del diploma en «Su título profesional y foto». La universidad y el PDF que ya cargó se guardarán con ese título. También puede indicar su número en una fila «Universitario» de «Sus títulos».',
          },
        ]),
      );
      return;
    }
    // Y tampoco se manda si el catálogo de tipos no cargó: la fila viajaría sin
    // tipo, que el contrato exige, o se perdería en silencio.
    //
    // El aviso nombra el botón que de verdad reintenta. Antes decía «volvé al
    // paso y reintentá en unos segundos», y volver de paso no pedía nada: el
    // catálogo se leía una sola vez en el constructor, así que quien caía acá
    // no tenía salida sin recargar la página.
    if (this.hayTitulosSinTipo()) {
      this.state.set(validation([{ field: 'academicTitles', message: this.avisoCatalogoDeTipos }]));
      return;
    }

    this.state.set(loading());

    this.subirPdfDeTitulosPendientes()
      .pipe(concatMap(() => this.subirFirmaYSelloPendientes()))
      .subscribe({
        next: () => {
          this.iam.registerPractitioner(this.datosProfesional()).subscribe({
            next: () => {
              this.state.set(ready(null));
              this.registered.set(true);
              this.limpiarBorrador();
              this.draftService.trackEvent('complete', 'practitioner', 4);
            },
            error: (error: unknown) =>
              this.state.set(registrationErrorToViewState(error, 'practitioner')),
          });
        },
        error: (error: unknown) =>
          this.state.set(registrationErrorToViewState(error, 'practitioner')),
      });
  }

  /**
   * Sube en orden los PDFs que todavía no tienen fileId. Al guardar cada
   * respuesta en su fila antes de continuar, un fallo posterior deja el
   * progreso disponible para reintentar sin reclamar dos veces el mismo PDF.
   */
  private subirPdfDeTitulosPendientes(): Observable<void> {
    return concat(
      this.uploadTitlePdfs(),
      this.uploadSpecialtyPdfs(),
      this.uploadLicensePdfs(),
    ).pipe(
      toArray(),
      map(() => undefined),
    );
  }

  /**
   * Sube el PDF de la matrícula y el del SEDES (P29), y recuerda cada fileId.
   *
   * Hasta el 26/10/2026 el alta no tenía dónde llevarlos: el selector aceptaba
   * el archivo, lo mostraba con su nombre y su peso, y al crear la cuenta lo
   * tiraba en silencio. Sólo se sube el del SEDES si se escribió su número:
   * sin la habilitación la API no tiene fila donde dejarlo y respondería 422.
   */
  private uploadLicensePdfs(): Observable<void> {
    const raw = this.formProfesional.getRawValue();
    const claves = (['license', 'sedes'] as const).filter((clave) =>
      clave === 'license' ? raw.licenseNumber.trim() !== '' : raw.sedesLicenseNumber.trim() !== '',
    );
    return from(claves).pipe(
      concatMap((clave) => {
        const archivo = this.attachmentFiles()[clave]?.[0];
        if (archivo === undefined || this.fileIdDeHabilitacion()[clave] !== undefined) {
          return of(undefined);
        }
        return this.iam.uploadRegistrationDocument(archivo).pipe(
          filter(
            (evento): evento is HttpResponse<UploadedRegistrationDocument> =>
              evento instanceof HttpResponse,
          ),
          map((respuesta) => {
            const documento = respuesta.body;
            if (!documento?.fileId || documento.fileId.trim() === '') {
              throw new Error('No pudimos confirmar la carga del PDF. Vuelva a intentarlo.');
            }
            this.fileIdDeHabilitacion.update((actual) => ({
              ...actual,
              [clave]: documento.fileId,
            }));
            return undefined;
          }),
          throwIfEmpty(
            () => new Error('No pudimos confirmar la carga del PDF. Vuelva a intentarlo.'),
          ),
        );
      }),
      toArray(),
      map(() => undefined),
    );
  }

  /** Sube el diploma de cada especialidad con número, y lo recuerda en su fila. */
  private uploadSpecialtyPdfs(): Observable<void> {
    const pending = this.specialtyStudies()
      .map((study, index) => ({ study, index }))
      .filter(({ study }) => study.number.trim() !== '');
    return from(pending).pipe(
      concatMap(({ study, index }) => {
        const file = this.attachmentFiles()[this.specialtyFileKey(index)]?.[0];
        if (study.fileId !== null || file === undefined) {
          return of(undefined);
        }
        return this.iam.uploadRegistrationDocument(file).pipe(
          filter(
            (evento): evento is HttpResponse<UploadedRegistrationDocument> =>
              evento instanceof HttpResponse,
          ),
          map((respuesta) => {
            const documento = respuesta.body;
            if (!documento?.fileId || documento.fileId.trim() === '') {
              throw new Error('No pudimos confirmar la carga del PDF. Vuelva a intentarlo.');
            }
            this.updateSpecialtyStudy(index, (current) => ({
              ...current,
              fileId: documento.fileId,
            }));
            return undefined;
          }),
          throwIfEmpty(
            () => new Error('No pudimos confirmar la carga del PDF. Vuelva a intentarlo.'),
          ),
        );
      }),
    );
  }

  private uploadTitlePdfs(): Observable<void> {
    const titulosConNumero = this.titulosParaRegistro().filter(
      (titulo) => titulo.numero.trim() !== '',
    );
    return from(titulosConNumero).pipe(
      concatMap((titulo) => {
        const usaPrincipal = this.usaPdfPrincipal(titulo);
        const archivo =
          this.attachmentFiles()[usaPrincipal ? 'professional-title' : titulo.id]?.[0];
        if (this.fileIdDeTitulo(titulo) !== null || archivo === undefined) {
          return of(undefined);
        }
        return this.iam.uploadRegistrationDocument(archivo).pipe(
          filter(
            (evento): evento is HttpResponse<UploadedRegistrationDocument> =>
              evento instanceof HttpResponse,
          ),
          map((respuesta) => {
            const documento = respuesta.body;
            if (!documento?.fileId || documento.fileId.trim() === '') {
              throw new Error('No pudimos confirmar la carga del PDF. Vuelva a intentarlo.');
            }
            if (usaPrincipal) this.fileIdTituloPrincipal.set(documento.fileId);
            else this.recordarFileIdDelTitulo(titulo.id, documento.fileId);
            return undefined;
          }),
          throwIfEmpty(
            () => new Error('No pudimos confirmar la carga del PDF. Vuelva a intentarlo.'),
          ),
        );
      }),
      toArray(),
      map(() => undefined),
    );
  }

  /** Recuerda cada carga confirmada; un reintento no repite esa imagen. */
  private subirFirmaYSelloPendientes(): Observable<void> {
    if (environment.mockBackend) return of(undefined);
    const controles = ['signatureImageBase64', 'sealImageBase64'] as const;
    return from(controles).pipe(
      concatMap((control) => {
        const dataUrl = this.formProfesional.controls[control].value;
        if (!dataUrl || this.imagenesSubidas[control]?.dataUrl === dataUrl) {
          return of(undefined);
        }
        const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl);
        if (!match) throw new Error('La imagen de firma o sello no tiene un formato válido.');
        const bytes = Uint8Array.from(atob(match[2]), (caracter) => caracter.charCodeAt(0));
        const archivo = new File([bytes], `${control}.${match[1].split('/')[1]}`, {
          type: match[1],
        });
        return this.iam.uploadRegistrationSignatureImage(archivo).pipe(
          filter(
            (evento): evento is HttpResponse<UploadedRegistrationDocument> =>
              evento instanceof HttpResponse,
          ),
          map((respuesta) => {
            const fileId = respuesta.body?.fileId;
            if (!fileId || fileId.trim() === '') {
              throw new Error(
                'No pudimos confirmar la carga de firma o sello. Vuelva a intentarlo.',
              );
            }
            this.imagenesSubidas[control] = { dataUrl, fileId };
            return undefined;
          }),
          throwIfEmpty(
            () => new Error('No pudimos confirmar la carga de firma o sello. Vuelva a intentarlo.'),
          ),
        );
      }),
      toArray(),
      map(() => undefined),
    );
  }

  /** Recuerda el PDF subido en la fila que lo originó. */
  private recordarFileIdDelTitulo(id: string, fileId: string): void {
    this.actualizarTitulos((titulos) =>
      titulos.map((titulo) => (titulo.id === id ? { ...titulo, fileId } : titulo)),
    );
  }

  /**
   * Lleva al login en vez de iniciar sesión sola.
   *
   * El endpoint no devuelve tokens —devuelve los identificadores del perfil—,
   * así que entrar automáticamente exigiría un segundo viaje con las
   * credenciales recién escritas.
   */
  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  private datosProfesional(): PractitionerRegistration {
    const raw = this.formProfesional.getRawValue();
    const titulo = raw.professionalTitle.trim();
    const celularPersonal = raw.mobilePhone.trim();
    const celularTrabajo = raw.workMobilePhone.trim();
    const fijoTrabajo = raw.workLandline.trim();
    const correoPersonal = raw.personalEmail.trim();
    const correoTrabajo = raw.email.trim();
    const segundoNombre = this.nombresAdicionales();
    const apellidoMaterno = raw.motherLastName.trim();
    const documento = raw.nationalId.trim();
    const autoridad = raw.regulatoryAuthority.trim();
    const fechaNacimiento = raw.birthDate;
    const fechaInscripcion = raw.licenseIssueDate;
    const departamento = raw.issuerAdministrativeAreaConceptId;
    const municipio = this.municipioProfesional();
    const calleDomicilio = componerDireccion(raw.homeAddressLines, raw.homeDistrict);
    const gpsDomicilio = this.gpsDomicilio();
    const calleTrabajo = raw.workAddressLines.trim();
    const gpsTrabajo = this.gpsTrabajo();
    const consultorio = this.consultorioPropio();
    const sexoAlNacer = raw.sexAtBirth;
    const foto = raw.profilePhotoBase64;
    const firmaImagen = raw.signatureImageBase64;
    const selloImagen = raw.sealImageBase64;
    const respaldos = this.fileIdDeHabilitacion();

    return {
      // `email` del DTO es el campo de LOGIN de la API, y desde este cambio el
      // login es el correo personal: es el que el profesional conserva aunque
      // cambie de hospital. El institucional viaja aparte, en `workEmail`.
      email: correoPersonal,
      // El correo de acceso también viaja como personal: sin `workEmail` la API
      // lo tomaba por institucional. Con `personalEmail === email` y sin
      // `workEmail` sabe que es el único y no inventa un contacto de trabajo.
      personalEmail: correoPersonal,
      password: raw.password,
      name: raw.name.trim(),
      lastName: raw.lastName.trim(),
      ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
      ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      ...(fechaNacimiento === null ? {} : { birthDate: fechaIso(fechaNacimiento) }),
      ...(sexoAlNacer === null ? {} : { sexAtBirth: sexoAlNacer }),
      ...(foto ? { profilePhotoBase64: foto } : {}),
      ...(environment.mockBackend && firmaImagen ? { signatureImageBase64: firmaImagen } : {}),
      ...(!environment.mockBackend &&
      firmaImagen &&
      this.imagenesSubidas.signatureImageBase64?.dataUrl === firmaImagen
        ? { signatureFileId: this.imagenesSubidas.signatureImageBase64.fileId }
        : {}),
      ...(environment.mockBackend && selloImagen ? { sealImageBase64: selloImagen } : {}),
      ...(!environment.mockBackend &&
      selloImagen &&
      this.imagenesSubidas.sealImageBase64?.dataUrl === selloImagen
        ? { sealFileId: this.imagenesSubidas.sealImageBase64.fileId }
        : {}),
      ...(documento === '' ? {} : { nationalId: documento }),
      // Sólo tiene sentido con documento: sin CI no hay identificador al que
      // atarle un departamento de emisión.
      ...(documento !== '' && departamento !== null
        ? { issuerAdministrativeAreaConceptId: departamento }
        : {}),
      ...(municipio === null ? {} : { residenceMunicipalityConceptId: municipio }),
      // La calle y el punto del domicilio (AC-05-8).
      //
      // El punto viaja sólo si se confirmó sobre el mapa: `gpsDomicilio` es lo
      // que emite `app-map-location-picker`, y ese sólo emite lo confirmado.
      ...(calleDomicilio === '' ? {} : { homeAddressLines: calleDomicilio }),
      ...(gpsDomicilio === null
        ? {}
        : { homeLatitude: gpsDomicilio.lat, homeLongitude: gpsDomicilio.lng }),
      // Dirección laboral, que se persiste con uso WORK y no modifica HOME ni
      // el consultorio propio (ownSite).
      ...(calleTrabajo === '' ? {} : { workAddressLines: calleTrabajo }),
      ...(gpsTrabajo === null
        ? {}
        : { workLatitude: gpsTrabajo.lat, workLongitude: gpsTrabajo.lng }),
      // El consultorio propio, si declaró alguno. Ver `consultorioPropio()`.
      ...(consultorio === null ? {} : { ownSite: consultorio }),
      licenseNumber: raw.licenseNumber.trim(),
      sedesLicenseNumber: raw.sedesLicenseNumber.trim(),
      ...(autoridad === '' ? {} : { regulatoryAuthority: autoridad }),
      ...(fechaInscripcion === null ? {} : { licenseIssueDate: fechaIso(fechaInscripcion) }),
      // Los respaldos de la habilitación (P29), ya subidos por `uploadLicensePdfs`.
      ...(respaldos.license === undefined ? {} : { licenseFileId: respaldos.license }),
      ...(respaldos.sedes === undefined || raw.sedesLicenseNumber.trim() === ''
        ? {}
        : { sedesLicenseFileId: respaldos.sedes }),
      ...(titulo === '' ? {} : { professionalTitle: titulo }),
      // Los cuatro contactos por separado. `phone` ya no viaja: era el campo
      // único que mezclaba el número privado con el del consultorio, y la API
      // lo mantiene sólo por compatibilidad con clientes anteriores.
      ...(celularPersonal === '' ? {} : { mobilePhone: celularPersonal }),
      ...(celularTrabajo === '' ? {} : { workMobilePhone: celularTrabajo }),
      ...(fijoTrabajo === '' ? {} : { workLandline: fijoTrabajo }),
      ...(correoTrabajo === '' ? {} : { workEmail: correoTrabajo }),
      ...(this.especialidadesElegidas().length === 0
        ? {}
        : { specialtyConceptIds: this.especialidadesElegidas() }),
      // Los títulos declarados (subtarea 1.6). El PDF ya está precargado y su
      // fileId viaja con la credencial correspondiente, y la universidad del
      // título principal se une a la fila universitaria (`credencialesDeclaradas`).
      // Nombre, país y ciudad permanecen locales porque este contrato no los recibe.
      ...(this.credencialesDeclaradas().length === 0
        ? {}
        : { credentials: this.credencialesDeclaradas() }),
    };
  }

  /**
   * Las especialidades elegidas, en orden y sin repetidos: elegir la misma
   * dos veces declara una.
   *
   * El backend guarda la primera del arreglo como principal —el contrato no
   * cambió (D-01, 23/09/2026)—, así que queda como principal la primera
   * casilla con valor, sin que nadie la elija. Ninguna pantalla lo muestra.
   */
  private especialidadesElegidas(): readonly string[] {
    const elegidas = this.especialidadesExtra().filter((valor) => valor !== '');
    return [...new Set(elegidas)];
  }
}
