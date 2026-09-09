import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../core/data-access/terminology/bo-municipalities.service';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { IamClient } from '../../../core/data-access/iam/iam.client';
import type {
  BirthSexCode,
  PractitionerRegistration,
} from '../../../core/data-access/iam/iam.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
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
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import {
  RegistroAyuda,
  type TarjetaDeAyuda,
} from '../../../shared/components/organisms/registro-ayuda/registro-ayuda';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { LocationPicker } from '../registro-compartido/location-picker/location-picker';
import type { NewOwnSite } from '../../../core/data-access/practice-sites/practice-sites.types';
import {
  UbicacionPicker,
  type Coordenadas,
  type IdsDePrueba,
} from '../registro-compartido/ubicacion-picker/ubicacion-picker';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import type {
  CampoDeFormulario,
  PaginaDeFormulario,
} from '../../../shared/forms/paginated/paginated-form.types';

/**
 * `Date` → ISO `YYYY-MM-DD`, tal como lo esperan los DTO del backend.
 *
 * Copiada del alta de paciente en vez de compartida: son siete líneas sin
 * estado, y el repo ya la tiene repetida en `profiles.client.ts` y en
 * `practitioner-profile-edit`. Un módulo de utilidades para esto costaría más
 * de leer que la función.
 */
function fechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Mínimo que exige el DTO del backend. */
const MIN_PASSWORD = 8;

/** Sólo letras, dígitos, punto y guion — el mismo `@Matches` del backend. */
const DOCUMENTO_VALIDO = /^[A-Za-z0-9.-]+$/;

/**
 * Las especialidades que pertenecen a la odontología, por código de catálogo.
 *
 * El listado del stakeholder (`LISTA_DE_ESPECIALIDADES_ODONTOLOGICAS.md`) viene
 * como PROFESIÓN → ESPECIALIDAD: al elegir «Odontólogo» se ofrecen éstas y sólo
 * éstas, y al elegir una profesión médica, las demás. El vínculo es de
 * interfaz a propósito — el modelo no tiene tabla profesión→especialidad y no
 * se inventó una: un conjunto, un dueño, y esta lista decide qué se MUESTRA.
 *
 * `CIRUGIA_BUCOMAXILOFACIAL` está acá aunque venga del listado del SNRM: es la
 * única especialidad de residencia médica cuyo requisito es Odontología (así lo
 * exige el SNRM y así quedó en la nota del value set).
 *
 * **Se exporta para que una prueba pueda comprobar que estos códigos existen**
 * en el catálogo que la aplicación va a recibir. No es un detalle académico:
 * el backend simulado los tenía inventados (`SP-ODONTO` y compañía), así que
 * este conjunto no acertaba ninguno y la rama odontológica del alta ofrecía
 * una lista vacía. Un conjunto que filtra por código sólo sirve si los dos
 * lados dicen el mismo código, y eso hay que poder comprobarlo.
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

const TITULO_ODONTOLOGO = 'Odontólogo / Odontóloga';
const COLEGIO_MEDICO = 'Colegio Médico de Bolivia';
const COLEGIO_ODONTOLOGOS = 'Colegio de Odontólogos de Bolivia';
/** Títulos cuya autoridad natural es el Colegio Médico. */
const TITULOS_MEDICOS: ReadonlySet<string> = new Set([
  'Médico / Médica',
  'Médico especialista / Médica especialista',
]);

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
const OPCIONES_AUTORIDAD_REGULADORA: readonly SelectOption<string>[] = [
  { value: 'Ministerio de Salud y Deportes', label: 'Ministerio de Salud y Deportes' },
  { value: 'Colegio Médico de Bolivia', label: 'Colegio Médico de Bolivia' },
  { value: 'Colegio de Odontólogos de Bolivia', label: 'Colegio de Odontólogos de Bolivia' },
  { value: 'Colegio de Enfermeras de Bolivia', label: 'Colegio de Enfermeras de Bolivia' },
  {
    value: 'Colegio de Bioquímica y Farmacia de Bolivia',
    label: 'Colegio de Bioquímica y Farmacia de Bolivia',
  },
  {
    value: 'Colegio de Nutricionistas y Dietistas de Bolivia',
    label: 'Colegio de Nutricionistas y Dietistas de Bolivia',
  },
  { value: 'Colegio de Psicólogos de Bolivia', label: 'Colegio de Psicólogos de Bolivia' },
  {
    value: 'Colegio de Fisioterapia y Kinesiología de Bolivia',
    label: 'Colegio de Fisioterapia y Kinesiología de Bolivia',
  },
  {
    value: 'Colegio de Trabajadores Sociales de Bolivia',
    label: 'Colegio de Trabajadores Sociales de Bolivia',
  },
  {
    value: 'Servicio Departamental de Salud (SEDES)',
    label: 'Servicio Departamental de Salud (SEDES)',
  },
];

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
const OPCIONES_TITULO_PROFESIONAL: readonly SelectOption<string>[] = [
  { value: 'Médico / Médica', label: 'Médico / Médica' },
  {
    value: 'Médico especialista / Médica especialista',
    label: 'Médico especialista / Médica especialista',
  },
  { value: 'Odontólogo / Odontóloga', label: 'Odontólogo / Odontóloga' },
  {
    value: 'Licenciado / Licenciada en Enfermería',
    label: 'Licenciado / Licenciada en Enfermería',
  },
  {
    value: 'Licenciado / Licenciada en Bioquímica y Farmacia',
    label: 'Licenciado / Licenciada en Bioquímica y Farmacia',
  },
  { value: 'Licenciado / Licenciada en Nutrición', label: 'Licenciado / Licenciada en Nutrición' },
  {
    value: 'Licenciado / Licenciada en Psicología',
    label: 'Licenciado / Licenciada en Psicología',
  },
  {
    value: 'Licenciado / Licenciada en Fisioterapia y Kinesiología',
    label: 'Licenciado / Licenciada en Fisioterapia y Kinesiología',
  },
  {
    value: 'Licenciado / Licenciada en Fonoaudiología',
    label: 'Licenciado / Licenciada en Fonoaudiología',
  },
  {
    value: 'Licenciado / Licenciada en Trabajo Social',
    label: 'Licenciado / Licenciada en Trabajo Social',
  },
  { value: 'Técnico / Técnica en Radiología', label: 'Técnico / Técnica en Radiología' },
  { value: 'Auxiliar de Enfermería', label: 'Auxiliar de Enfermería' },
];

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
      'Si además de tu profesión de salud estudiaste otra carrera, cargala acá. Podés cargar las que tengas, y ninguna es obligatoria.',
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
 * Un título declarado en el alta, con su respaldo adjunto.
 *
 * **Sólo vive en el navegador.** Esta rama es el mockup: el archivo no se sube
 * a ningún lado y el título no se persiste. Lo que se guarda acá es lo mínimo
 * para dibujar la lista —qué título es, cómo se llama y qué archivo eligió la
 * persona—, no el contenido del archivo. Ver `docs/handoff/` para lo que falta
 * del lado de `dev`.
 */
interface TituloDeclarado {
  /** Identificador local, sólo para el `track` de la lista. */
  readonly id: string;
  readonly tipo: CodigoDeTitulo;
  /** Cómo se llama el título: «Medicina», «Salud Pública»… */
  readonly nombre: string;
  /** Dónde lo cursó: «Universidad Mayor de San Andrés». */
  readonly universidad: string;
  /** El país donde lo cursó. Ver {@link CampoDeEstudio} por qué es texto. */
  readonly pais: string;
  /** La ciudad donde lo cursó. */
  readonly ciudad: string;
  /** El nombre del archivo elegido, o `null` si todavía no adjuntó ninguno. */
  readonly archivo: string | null;
  readonly pesoBytes: number | null;
}

/**
 * Los tres datos de dónde se estudió un título, y por qué los tres son texto
 * libre y no listas cerradas.
 *
 * Es la pregunta que más veces vuelve, así que va escrita una sola vez acá:
 *
 * - **Universidad.** El modelo ya la guarda como texto a propósito: el JSDoc de
 *   `AddOwnCredentialDto.issuingInstitutionText` lo dice —«las universidades del
 *   exterior no están en ningún catálogo nuestro, y exigir que lo estén dejaría
 *   fuera a cualquiera que se formó afuera»—. No hay padrón de universidades en
 *   ninguna de las cuatro capas, y la regla de datos del proyecto pide
 *   justamente **no** hardcodear uno sin dataset ni estrategia de importación.
 * - **País.** La columna del modelo (`issuing_country_concept_id`) sí es un
 *   concepto, pero hoy existen **dos** en toda la aplicación —`COUNTRY_BO` y
 *   `COUNTRY_PE`— y `VS_COUNTRY` no tiene miembros sembrados. Un desplegable
 *   cerrado ofrecería dos opciones y dejaría afuera a quien estudió en Cuba,
 *   Argentina o España, que es exactamente el caso que este campo abre.
 * - **Ciudad.** `profiles.professional_credentials` **no tiene columna de
 *   ciudad**. Se pregunta igual porque el propietario la pidió, y el hueco
 *   queda declarado en `docs/handoff/` en vez de inventado acá: abrir una
 *   columna es cambio de modelo (`.puml` → `gen_ddl.py` → `SQL/` → base → ORM),
 *   y esta pantalla no es el lugar donde eso se decide.
 *
 * Cuando el país tenga value set y la universidad tenga padrón, esto pasa a ser
 * dos comboboxes sin tocar nada más: lo que cambia es de dónde salen las
 * opciones, no dónde se guarda la respuesta.
 */
type CampoDeEstudio = 'universidad' | 'pais' | 'ciudad';

/** Uno de los campos de una fila de título que se escriben a mano. */
type CampoEditableDeTitulo = 'nombre' | CampoDeEstudio;

/** Un respaldo suelto: el de la matrícula y el del registro del SEDES. */
interface RespaldoDeclarado {
  readonly archivo: string;
  readonly pesoBytes: number;
}

/** Cuál respaldo suelto se está tocando: el del título, la matrícula o el SEDES. */
type ClaveDeRespaldo = 'professional-title' | 'license' | 'sedes';

/** Tope de peso por adjunto. El mismo que la foto de perfil. */
const MAX_BYTES_ADJUNTO = 5 * 1024 * 1024;

/** Formatos que se aceptan como respaldo de un título o de una matrícula. */
const FORMATOS_DE_RESPALDO = 'application/pdf,image/jpeg,image/png';

const OPCIONES_SEXO: readonly SelectOption<BirthSexCode>[] = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
];

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
 * con los campos y se lee sólo si hace falta. Ver `app-registro-ayuda`.
 *
 * ## Por qué es un mapa por clave y no una lista
 *
 * Porque la respuesta cambia con la pregunta, y las páginas se reordenan. Con
 * un arreglo paralelo, mover una sección de sitio dejaría la explicación de la
 * matrícula al lado de la contraseña, y nadie se enteraría hasta verlo. La
 * clave la declara la propia página (`PaginaDeFormulario.clave`), así que las
 * dos mitades no se pueden separar de un descuido.
 */
const AYUDA_PROFESIONAL: Readonly<Record<string, readonly TarjetaDeAyuda[]>> = {
  name: [
    {
      icono: 'people',
      titulo: 'Así te van a ver tus pacientes',
      texto:
        'El nombre de tu ficha pública sale de acá, y se escribe como figura en tu documento: es lo que un paciente contrasta antes de elegirte.',
    },
  ],
  document: [
    {
      icono: 'patients',
      titulo: 'Tu cédula queda como documento oficial',
      texto:
        'No es con lo que entrás —eso es tu correo—, pero es lo que identifica a la persona detrás de la matrícula.',
    },
    {
      icono: 'pin',
      titulo: 'La expedición va con el número',
      texto: 'El «SC», «LP»… es parte del mismo carnet: por eso los dos se piden juntos.',
    },
  ],
  credentials: [
    {
      icono: 'shield',
      titulo: 'Es lo que te habilita a atender',
      texto:
        'Comprobamos matrícula y colegio antes de que aparezcas en el directorio. Es lo que le da certeza a quien te elige sin conocerte.',
    },
    {
      icono: 'history',
      titulo: 'Lo opcional podés dejarlo para después',
      texto:
        'La autoridad que la emitió y la fecha de inscripción no frenan tu alta: se cargan cuando las tengas a mano, desde tu perfil.',
    },
  ],
  practice: [
    {
      icono: 'stethoscope',
      titulo: 'Es tu carta de presentación',
      texto:
        'El título es lo primero que ve un paciente antes de pedirte un turno. Podés cambiarlo cuando quieras.',
    },
    {
      icono: 'directory',
      titulo: 'Y decide qué sigue',
      texto:
        'De él dependen el colegio que se te ofrece en la habilitación y las especialidades que vas a poder elegir: un odontólogo no elige entre las 36 del catálogo, elige entre las suyas. Por eso se pregunta antes que las dos cosas.',
    },
  ],
  profile: [
    {
      icono: 'stethoscope',
      titulo: 'Por qué te pedimos los dos',
      texto:
        'Sexo y fecha de nacimiento son dato clínico: mandan en dosis, valores de referencia y tamizajes. Los dos se guardan en tu perfil. Qué clase de profesional sos se pregunta más adelante, con tu título.',
    },
  ],
  residence: [
    {
      icono: 'pin',
      titulo: 'Para ubicarte en el directorio',
      texto:
        'Un paciente busca por ciudad antes que por nombre. Con tu localidad declarada aparecés en la búsqueda de quien te tiene cerca.',
    },
  ],
  specialties: [
    {
      icono: 'directory',
      titulo: 'Es por donde te encuentran',
      texto:
        'Un paciente busca por especialidad. Las que elijas son las búsquedas en las que vas a aparecer.',
    },
  ],
  'personal-contact': [
    {
      icono: 'mail',
      titulo: 'Con tu correo personal vas a entrar',
      texto:
        'Usá uno que sigas teniendo si cambiás de trabajo: es tu identidad de acceso y por donde se recupera la cuenta si perdés la clave.',
    },
  ],
  access: [
    {
      icono: 'phone',
      titulo: 'Todo esto es del consultorio',
      texto:
        'Son los datos por los que te ubican en el trabajo, no los de tu acceso. Podés dejarlos vacíos y cargarlos después desde tu perfil.',
    },
  ],
  'credential-files': [
    {
      icono: 'folder',
      titulo: 'Los verifica una persona, no un robot',
      texto:
        'Podés registrarte sin subirlos y cargarlos después desde tu perfil. Mientras no estén, tu matrícula figura como declarada y no como verificada.',
    },
  ],
  'academic-titles': [
    {
      icono: 'teach',
      titulo: 'Cuantos tengas, no sólo uno',
      texto:
        'Hay médicos con dos carreras, y con varios diplomados o maestrías. Cada título lleva su propio archivo, así se verifica de a uno.',
    },
  ],
  password: [
    {
      icono: 'lock',
      titulo: 'Tu contraseña, sólo tuya',
      texto:
        'Ocho caracteres o más. Se guarda cifrada: ni el equipo de AloVida puede verla, y nunca te la vamos a pedir por teléfono ni por correo.',
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
 * (`../registro-compartido/registro.css`) y un organismo
 * (`app-registro-ayuda`), no una clase en común.
 *
 * ## Por qué va por el motor
 *
 * Porque antes era una sola columna de doce a quince campos que no entraba en
 * ninguna pantalla. `app-paginated-form` lleva la barra de avance, el índice,
 * el «Atrás», la validación de a una página y el foco que la sigue; lo que
 * queda acá es lo que el motor no puede saber —qué se pregunta, en qué orden y
 * contra qué endpoint va—.
 *
 * El municipio de residencia va como campo `custom` —lo dibuja un árbol con
 * búsqueda que esta pantalla proyecta y el motor no conoce—, y el departamento
 * emisor pasa a serlo sólo si su catálogo no cargó, para poder mostrar ahí el
 * «Reintentar». El motor les reserva el sitio con su rótulo y su error, y no
 * aprende nada de terminología ni de árboles.
 */
@Component({
  selector: 'app-register-practitioner',
  imports: [
    RouterLink,
    AppButton,
    NavIcon,
    Tooltip,
    LocationPicker,
    UbicacionPicker,
    Link,
    Alert,
    AuthSplit,
    AnnounceOnAppear,
    PaginatedForm,
    CampoPersonalizado,
    ReferenceCombobox,
    RegistroAyuda,
    FormField,
    AppInput,
    Select,
    Avatar,
  ],
  templateUrl: './register-practitioner.html',
  styleUrls: ['../registro-compartido/registro.css', './register-practitioner.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPractitioner {
  private readonly iam = inject(IamClient);
  private readonly router = inject(Router);

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
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
    // Documento de identidad boliviano. Obligatorio en el alta de profesional:
    // la matrícula habilita a ejercer, pero es la cédula la que ata esa matrícula
    // a una persona verificable. Además del formato válido, ahora tiene que estar.
    nationalId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(DOCUMENTO_VALIDO)],
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
    professionalTitleUniversity: new FormControl('', { nonNullable: true }),
    professionalTitleCountry: new FormControl('', { nonNullable: true }),
    professionalTitleCity: new FormControl('', { nonNullable: true }),
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
      validators: [Validators.required, telefonoCompleto],
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
      validators: [Validators.required, Validators.email],
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
    // La principal es un control porque tiene semántica propia: es la que
    // responde «¿de qué sos?» y la que el backend guarda como principal. Las
    // demás no se distinguen entre sí, así que viven en `especialidadesExtra` y
    // se agregan las que hagan falta: hay profesionales con más de tres.
    // La calle del domicilio. Opcional, como en el alta de paciente: la
    // localidad es la que ubica, y esto es lo que hace falta para llegar a la
    // puerta.
    homeAddressLines: new FormControl('', { nonNullable: true }),
    // El consultorio propio: su nombre y su calle. Ver la página
    // «Tu consultorio propio» y el JSDoc de `datosProfesional`.
    officeName: new FormControl('', { nonNullable: true }),
    officeAddressLines: new FormControl('', { nonNullable: true }),
    specialtyPrimary: new FormControl('', { nonNullable: true }),
    profilePhotoBase64: new FormControl<string | null>(null),
  });

  /** Los cuatro tipos de título, para que la plantilla los recorra. */
  protected readonly tiposDeTitulo = TIPOS_DE_TITULO;

  /**
   * Las tres casillas de «dónde lo estudiaste» de cada fila de título.
   *
   * Misma lista que la del título principal, con la diferencia de que acá la
   * clave es la del objeto de la fila y no la de un `FormControl`: las filas no
   * viven en el formulario, viven en un signal.
   */
  protected readonly camposDeEstudioDeFila = [
    { campo: 'universidad', label: 'Universidad', placeholder: 'Universidad' },
    { campo: 'pais', label: 'País', placeholder: 'País' },
    { campo: 'ciudad', label: 'Ciudad', placeholder: 'Ciudad' },
  ] as const satisfies readonly { campo: CampoDeEstudio; label: string; placeholder: string }[];

  protected readonly formatosDeRespaldo = FORMATOS_DE_RESPALDO;

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
  readonly respaldoMatricula = signal<RespaldoDeclarado | null>(null);
  readonly respaldoSedes = signal<RespaldoDeclarado | null>(null);

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
    this.titulos.update((titulos) => [
      ...titulos,
      {
        // `crypto.randomUUID` existe en el navegador y en el Node del SSR.
        id: crypto.randomUUID(),
        tipo,
        nombre: '',
        universidad: '',
        pais: '',
        ciudad: '',
        archivo: null,
        pesoBytes: null,
      },
    ]);
  }

  /** Quita una fila entera, con su adjunto. */
  quitarTitulo(id: string): void {
    this.titulos.update((titulos) => titulos.filter((titulo) => titulo.id !== id));
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
    this.titulos.update((titulos) =>
      titulos.map((titulo) => (titulo.id === id ? { ...titulo, [campo]: valor } : titulo)),
    );
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

  /** Adjunta el archivo elegido a un título, o avisa por qué no se pudo. */
  adjuntarArchivoATitulo(id: string, evento: Event): void {
    const archivo = this.archivoValidado(evento);
    if (archivo === null) return;
    this.titulos.update((titulos) =>
      titulos.map((titulo) =>
        titulo.id === id
          ? { ...titulo, archivo: archivo.archivo, pesoBytes: archivo.pesoBytes }
          : titulo,
      ),
    );
  }

  /** Quita el adjunto de un título sin borrar la fila. */
  quitarArchivoDeTitulo(id: string): void {
    this.titulos.update((titulos) =>
      titulos.map((titulo) =>
        titulo.id === id ? { ...titulo, archivo: null, pesoBytes: null } : titulo,
      ),
    );
  }

  /** Adjunta el respaldo de la matrícula o el del SEDES. */
  adjuntarRespaldo(cual: ClaveDeRespaldo, evento: Event): void {
    const archivo = this.archivoValidado(evento);
    if (archivo === null) return;
    this.destinoDelRespaldo(cual).set(archivo);
  }

  /** Quita el respaldo de la matrícula o el del SEDES. */
  quitarRespaldo(cual: ClaveDeRespaldo): void {
    this.destinoDelRespaldo(cual).set(null);
    this.errorAdjunto.set(null);
  }

  /** El signal donde vive cada respaldo suelto. */
  private destinoDelRespaldo(cual: ClaveDeRespaldo) {
    if (cual === 'professional-title') return this.respaldoTituloProfesional;
    return cual === 'license' ? this.respaldoMatricula : this.respaldoSedes;
  }

  /**
   * Valida formato y peso del archivo elegido y devuelve con qué quedarse.
   *
   * Devuelve `null` cuando no hay archivo o cuando lo rechaza, y en ese caso
   * deja el motivo en `errorAdjunto`. Vacía el `<input>` siempre: si no, elegir
   * el mismo archivo dos veces seguidas no dispara `change` la segunda.
   */
  private archivoValidado(evento: Event): RespaldoDeclarado | null {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    this.errorAdjunto.set(null);
    entrada.value = '';
    if (!archivo) return null;

    if (!FORMATOS_DE_RESPALDO.split(',').includes(archivo.type)) {
      this.errorAdjunto.set('El respaldo tiene que ser un PDF, un JPG o un PNG.');
      return null;
    }
    if (archivo.size > MAX_BYTES_ADJUNTO) {
      this.errorAdjunto.set('El archivo supera el límite de 5 MB.');
      return null;
    }
    return { archivo: archivo.name, pesoBytes: archivo.size };
  }

  /** El peso de un adjunto, en la unidad que se lee de un vistazo. */
  pesoLegible(bytes: number | null): string {
    if (bytes === null) return '';
    const enMegas = bytes / (1024 * 1024);
    return enMegas >= 1 ? `${enMegas.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} kB`;
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
   * El municipio de residencia.
   *
   * Sigue fuera del `FormGroup` porque es un campo `custom` de verdad: lo
   * dibuja un árbol con búsqueda que esta pantalla proyecta y el motor no
   * conoce.
   */
  readonly municipioProfesional = signal<string | null>(null);

  /**
   * El punto del domicilio, ya confirmado sobre el mapa.
   *
   * Lo emite `app-ubicacion-picker` y llega **sólo confirmado**: el componente
   * se guarda para sí el estado intermedio —capturado y sin confirmar— y avisa
   * en pantalla que ese no se guarda. Acá no hace falta volver a preguntarlo.
   */
  readonly gpsDomicilio = signal<Coordenadas | null>(null);

  /**
   * La localidad del consultorio propio.
   *
   * Separada de la del domicilio a propósito: son dos lugares distintos, y hay
   * quien vive en una ciudad y atiende en otra. Es el mismo par de señales que
   * el alta de paciente tiene para su casa y su trabajo.
   */
  readonly municipioConsultorio = signal<string | null>(null);

  /** El punto del consultorio, ya confirmado sobre el mapa. */
  readonly gpsConsultorio = signal<Coordenadas | null>(null);

  /** Los identificadores de prueba del bloque de ubicación del consultorio. */
  protected readonly idsUbicacionConsultorio: IdsDePrueba = {
    mapa: 'registration-practitioner-office-map',
    confirmada: 'registration-practitioner-office-location-confirmed',
    avisoGeocodificacion: 'registration-practitioner-office-geocoding-notice',
    quitar: 'registration-practitioner-office-location-remove',
    sinConfirmar: 'registration-practitioner-office-location-unconfirmed',
    confirmar: 'registration-practitioner-office-location-confirm',
    usarUbicacion: 'registration-practitioner-office-location-use',
    marcarEnMapa: 'registration-practitioner-office-location-pick',
  };

  /** Los identificadores de prueba del bloque de ubicación del domicilio. */
  protected readonly idsUbicacionDomicilio: IdsDePrueba = {
    mapa: 'registration-practitioner-home-map',
    confirmada: 'registration-practitioner-home-location-confirmed',
    avisoGeocodificacion: 'registration-practitioner-home-geocoding-notice',
    quitar: 'registration-practitioner-home-location-remove',
    sinConfirmar: 'registration-practitioner-home-location-unconfirmed',
    confirmar: 'registration-practitioner-home-location-confirm',
    usarUbicacion: 'registration-practitioner-home-location-use',
    marcarEnMapa: 'registration-practitioner-home-location-pick',
  };

  /**
   * Casillas de nombres adicionales (cuarto, quinto, …) agregadas por el usuario.
   */
  readonly nombresExtra = signal<readonly string[]>([]);

  /**
   * Especialidades agregadas además de la principal.
   *
   * Mismo criterio que `nombresExtra`: casillas fijas que casi nadie llena son
   * ruido, y un techo arbitrario deja afuera al que sí las tiene. La cadena
   * vacía es «esta casilla todavía no eligió nada».
   */
  readonly especialidadesExtra = signal<readonly string[]>([]);

  /** Suma una casilla vacía de especialidad. */
  agregarEspecialidad(): void {
    this.especialidadesExtra.update((actuales) => [...actuales, '']);
  }

  /**
   * Quita una de las casillas agregadas.
   *
   * @param indice - Cuál de las casillas extra, empezando por 0.
   */
  quitarEspecialidad(indice: number): void {
    this.especialidadesExtra.update((actuales) => actuales.filter((_, i) => i !== indice));
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
   * Los tres controles de dónde se estudió el título con el que ejerce.
   *
   * Se listan acá y no en la plantilla para que agregar el cuarto —el año, si
   * alguna vez se pide— sea una entrada más y no una casilla suelta que alguien
   * se olvida de limpiar al reiniciar el formulario.
   */
  protected readonly camposDeEstudioDelTitulo = [
    {
      key: 'professionalTitleUniversity',
      label: 'Universidad',
      placeholder: 'Universidad Mayor de San Andrés',
      testId: 'registro-pro-titulo-universidad',
    },
    {
      key: 'professionalTitleCountry',
      label: 'País de estudio',
      placeholder: 'Bolivia',
      testId: 'registro-pro-titulo-pais',
    },
    {
      key: 'professionalTitleCity',
      label: 'Ciudad de estudio',
      placeholder: 'La Paz',
      testId: 'registro-pro-titulo-ciudad',
    },
  ] as const;

  /** Lo escrito en uno de los tres campos de estudio del título principal. */
  valorDeEstudio(key: (typeof this.camposDeEstudioDelTitulo)[number]['key']): string {
    return this.formProfesional.controls[key].value;
  }

  /** Escribe uno de los tres campos de estudio del título principal. */
  escribirEstudio(
    key: (typeof this.camposDeEstudioDelTitulo)[number]['key'],
    valor: string | number | null,
  ): void {
    this.formProfesional.controls[key].setValue(valor === null ? '' : String(valor));
  }

  /** Si hay que pintar en rojo el primer nombre. */
  readonly primerNombreEnRojo = computed(() => {
    const control = this.formProfesional.controls.name;
    return control.touched && control.invalid;
  });

  /**
   * Los nombres que no son el primero, en una sola cadena.
   *
   * El segundo, el tercero y los que se hayan agregado, separados por espacio y
   * sin los vacíos. La base guarda todo esto en `middle_name`: no hay columna
   * de tercer nombre, y `varchar` sin restricción admite los espacios.
   */
  private nombresAdicionales(): string {
    const raw = this.formProfesional.getRawValue();
    return [raw.middleName, raw.thirdName, ...this.nombresExtra()]
      .map((nombre) => nombre.trim())
      .filter((nombre) => nombre !== '')
      .join(' ');
  }

  /** Departamento que emitió el documento (VS_BO_DEPARTMENT), y su catálogo. */
  private readonly departamentos = inject(BoDepartmentsCatalog);
  readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);
  readonly catalogoDepartamentosCaido = signal(false);

  /**
   * Municipios (VS_BO_MUNICIPALITY), colgados de su departamento.
   *
   * Se guardan tal como los devuelve el catálogo, sin traducir a los grupos de
   * `app-tree-select`: quien los dibuja ahora es `app-location-picker`, que
   * necesita la rama entera para acotar el select de ciudad al departamento
   * pulsado en el mapa. Es el mismo control que monta el alta de paciente.
   */
  private readonly municipios = inject(BoMunicipalitiesCatalog);
  readonly ramasMunicipios = signal<readonly RamaDepartamento[]>([]);
  readonly catalogoMunicipiosCaido = signal(false);

  /**
   * Las especialidades (VS_MEDICAL_SPECIALTY, 63 desde el 27/08), y su catálogo.
   *
   * Se guardan CON su código además del par value/label: el código es lo que
   * decide si una especialidad es odontológica, y por lo tanto en cuál de las
   * dos listas —la del odontólogo o la del resto— aparece.
   */
  private readonly especialidades = inject(MedicalSpecialtiesCatalog);
  readonly opcionesEspecialidad = signal<readonly { value: string; label: string; code: string }[]>(
    [],
  );
  readonly catalogoEspecialidadesCaido = signal(false);

  /**
   * El título profesional elegido, **como señal**.
   *
   * Duplica el valor del `FormControl` a propósito. Las tres listas de
   * especialidad se arman dentro de `paginasProfesional`, que es un `computed`,
   * y un `computed` sólo se recalcula cuando cambia una SEÑAL que leyó: el
   * valor de un `FormControl` no lo despierta. Leerlo desde ahí hacía que el
   * filtro se evaluara una sola vez —con el título todavía vacío, o sea «no hay
   * con qué filtrar, devolvé todo»— y no volviera a correr nunca.
   *
   * Se veía así: un odontólogo elegía su profesión y en el paso siguiente le
   * seguían apareciendo las 52 especialidades médicas, con las 11 suyas al
   * final. El stakeholder lo reportó como «no están las especialidades de
   * odontología»; sí estaban, abajo de todo.
   *
   * La escribe la MISMA suscripción que ya acomodaba el colegio —por eso el
   * colegio se acomodaba y la lista no—, así que no hay dos fuentes de verdad:
   * el control manda, esto lo espeja para el grafo de señales.
   */
  private readonly tituloProfesionalElegido = signal('');

  /**
   * Lo escrito en la lupa del título. **Nunca reemplaza al valor del control**:
   * el `FormControl` sigue siendo el que manda, y de él cuelgan el colegio
   * automático y el filtro de especialidades.
   */
  readonly busquedaTituloProfesional = signal('');

  /** Las doce opciones locales, acotadas por lo que se escribió. */
  readonly titulosProfesionalesFiltrados = computed<readonly ReferenceOption[]>(() => {
    const busqueda = this.busquedaTituloProfesional().trim().toLowerCase();
    // Sin peticiones: la lista es cerrada y ya está en memoria. Una lupa que
    // consulta al servidor para filtrar doce opciones agrega latencia y un
    // estado de error donde no hacía falta ninguno.
    return busqueda === ''
      ? OPCIONES_TITULO_PROFESIONAL
      : OPCIONES_TITULO_PROFESIONAL.filter((opcion) =>
          opcion.label.toLowerCase().includes(busqueda),
        );
  });

  /** La opción elegida, para que el rótulo vuelva al regresar a este paso. */
  readonly tituloProfesionalSeleccionado = computed<ReferenceOption | null>(() => {
    const valor = this.tituloProfesionalElegido();
    return OPCIONES_TITULO_PROFESIONAL.find((opcion) => opcion.value === valor) ?? null;
  });

  /**
   * Escribe la elección en el mismo control de siempre.
   *
   * Es la línea que conserva la cadena entera: `professionalTitle` →
   * `regulatoryAuthority` → especialidades válidas. Escribir el título en un
   * estado propio de la lupa la habría cortado en silencio.
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
   * - **Universidad, lugar de estudio y otros títulos** (AC-05-13). La pantalla
   *   los pregunta desde el 09/09 —para el título con el que ejerce y para cada
   *   otra profesión, diplomado, maestría y doctorado que cargue— pero **no
   *   viajan**: viven en `credentials`, detrás de la sesión, con su propio
   *   endpoint, y el alta pública no los recibe. Dos de los tres tienen columna
   *   (`issuing_institution_text`, `issuing_country_concept_id`); la **ciudad no
   *   tiene ninguna**. Ver `docs/handoff/alta-profesional-titulos-y-adjuntos.md`.
   *
   * ## El tope de cuatro campos por página no se relaja (AC-05-2)
   *
   * Ninguna sección de acá llega a cinco, y aun así todas pasan por
   * `paginarCampos`: es la función la que hace cumplir el tope, y declararlo a
   * mano sería confiar en que quien agregue el campo trece se acuerde de contar.
   */
  readonly paginasProfesional = computed<readonly PaginaDeFormulario[]>(() => {
    const titulo = this.tituloProfesionalElegido();
    const esOdontologo = titulo === TITULO_ODONTOLOGO;
    const esMedico = TITULOS_MEDICOS.has(titulo);

    const rotuloMatricula = esOdontologo
      ? 'Matrícula de Odontólogo'
      : esMedico
        ? 'Matrícula Profesional (Médico)'
        : 'Matrícula profesional';

    const hintMatricula = esOdontologo
      ? 'La de tu habilitación profesional como odontólogo.'
      : 'La que te habilita a ejercer, la del registro del Ministerio.';

    const placeholderMatricula = esOdontologo ? 'ODO-12345' : 'MP-12345';

    // El segundo número es el registro del SEDES, y no cambia con el título:
    // el Servicio Departamental de Salud habilita a ejercer en su departamento
    // sea odontólogo o médico. Antes acá se pedía «Registro del Colegio», pero
    // lo que el padrón real trae en esa casilla —y lo que la gente cargaba— es
    // el número del SEDES, que además es una habilitación y no un título.

    return paginarCampos([
      {
        titulo: '¿Cómo te llamás?',
        clave: 'name',
        icon: 'people',
        hint: 'Como figura en tu documento. Si no tenés alguno, dejalo vacío.',
        // Nombres y apellidos van juntos en una página, como pide el registro
        // del cliente. Los tres nombres entran en UN campo proyectado —bajo la
        // `key` de `name`, para que el motor siga validando el obligatorio y
        // sepa a qué página volver al enviar— porque son cuatro casillas y el
        // tope del motor es de cuatro campos por página.
        campos: [
          {
            key: 'name',
            label: '',
            control: 'custom',
            mensajeDeError: 'Ingresá tu nombre.',
          },
          {
            key: 'lastName',
            label: 'Apellido paterno',
            control: 'text',
            required: true,
            autocomplete: 'family-name',
            placeholder: 'Rojas',
            testId: 'registro-pro-apellido-paterno',
            ancho: 'mitad',
            mensajeDeError: 'Ingresá tu apellido paterno.',
          },
          {
            key: 'motherLastName',
            label: 'Apellido materno',
            hint: 'Si no llevás, dejalo vacío.',
            control: 'text',
            autocomplete: 'family-name',
            placeholder: 'Paz',
            testId: 'registro-pro-apellido-materno',
            ancho: 'mitad',
          },
        ],
      },
      {
        titulo: 'Tu documento de identidad',
        clave: 'document',
        icon: 'patients',
        hint: 'Los dos hacen falta. Identifican a la persona detrás de la matrícula.',
        campos: [
          {
            key: 'nationalId',
            label: 'Cédula de identidad',
            required: true,
            hint: 'Se guarda como tu documento oficial.',
            description:
              'No es con lo que iniciás sesión —eso es tu correo—, pero es lo que ata tu matrícula a una persona.',
            control: 'text',
            autocomplete: 'off',
            placeholder: '1234567',
            testId: 'registro-pro-documento',
            icono: 'patients',
            // Media línea, con su departamento de emisión al lado: la misma
            // pareja que en el alta de paciente, y por lo mismo — el número y
            // su expedición son un solo documento.
            ancho: 'mitad',
            mensajeDeError: 'Ingresá un documento válido: letras, números, punto y guion.',
          },
          this.campoDepartamentoEmisor('registro-pro-departamento-ci'),
        ],
      },
      {
        titulo: 'Contanos un poco sobre vos',
        clave: 'profile',
        icon: 'stethoscope',
        hint: 'Los dos hacen falta. Se guardan en tu perfil profesional.',
        campos: [
          {
            key: 'sexAtBirth',
            label: 'Sexo',
            hint: 'Es el que registra tu documento de identidad.',
            control: 'select',
            required: true,
            options: OPCIONES_SEXO,
            placeholder: 'Elegí una opción',
            testId: 'registration-practitioner-sex',
            icono: 'heart',
            mensajeDeError: 'Elegí una opción.',
          },
          {
            key: 'birthDate',
            label: 'Fecha de nacimiento',
            control: 'date',
            required: true,
            maxDate: 'today',
            minDate: new Date(1900, 0, 1),
            mensajeDeError: 'Indicá tu fecha de nacimiento.',
          },
        ],
      },
      {
        titulo: 'Cómo te contactamos en privado',
        clave: 'personal-contact',
        icon: 'phone',
        hint: 'Los dos hacen falta, y con el correo entrás. Nada de esto se publica en tu ficha.',
        campos: [
          {
            key: 'mobilePhone',
            label: 'Tu celular personal',
            required: true,
            hint: 'Elegí el país si tu número no es de Bolivia.',
            description:
              'Es el número por el que te contactamos a vos. El que ve un paciente es el de tu consultorio, que se pide en la página siguiente.',
            control: 'tel',
            autocomplete: 'tel',
            testId: 'registro-pro-celular-personal',
            icono: 'phone',
            mensajeDeError: 'El número está incompleto para el país elegido.',
          },
          {
            key: 'personalEmail',
            label: 'Tu correo personal — con éste entrás',
            hint: 'Es tu identidad de acceso, no sólo un dato de contacto.',
            description:
              'Usá uno que sigas teniendo si cambiás de trabajo: es por donde se recupera la cuenta si perdés la clave.',
            control: 'email',
            required: true,
            // `username`: acá el correo SÍ es el identificador de acceso. Sin
            // esto el navegador guarda otra cosa como usuario.
            autocomplete: 'username',
            placeholder: 'ana.rojas@gmail.com',
            testId: 'registro-pro-correo-personal',
            icono: 'mail',
            mensajeDeError: 'Ingresá un correo válido.',
          },
        ],
      },
      {
        titulo: 'El contacto de tu trabajo',
        clave: 'access',
        icon: 'phone',
        hint: 'Los datos del consultorio. Todo opcional: tu acceso ya quedó definido.',
        campos: [
          {
            key: 'workMobilePhone',
            label: 'Celular del trabajo (opcional)',
            hint: 'Elegí el país si tu número no es de Bolivia.',
            control: 'tel',
            autocomplete: 'tel',
            testId: 'registro-pro-celular-trabajo',
            icono: 'phone',
            ancho: 'mitad',
            mensajeDeError: 'El número está incompleto para el país elegido.',
          },
          {
            key: 'workLandline',
            label: 'Fijo del trabajo (opcional)',
            hint: 'El de la línea del consultorio.',
            control: 'tel',
            autocomplete: 'tel',
            testId: 'registro-pro-fijo-trabajo',
            icono: 'phone',
            ancho: 'mitad',
            mensajeDeError: 'El número está incompleto para el país elegido.',
          },
          {
            key: 'email',
            label: 'Correo de trabajo (opcional)',
            hint: 'El institucional, si tenés. No es con el que entrás.',
            description:
              'Es un dato de contacto del consultorio: lo ve quien necesita escribirte por trabajo.',
            control: 'email',
            // `email` y no `username`: el identificador de acceso es el correo
            // personal del paso anterior. Marcar los dos como `username` haría
            // que el navegador guardara el equivocado.
            autocomplete: 'email',
            placeholder: 'matricula@hospital.bo',
            testId: 'registro-pro-correo',
            icono: 'mail',
            mensajeDeError: 'Ingresá un correo válido.',
          },
        ],
      },
      {
        titulo: '¿Dónde vivís?',
        clave: 'residence',
        icon: 'home',
        // Las mismas tres piezas que el alta de paciente: la localidad, la
        // calle y el punto del mapa. Eran una sola —la localidad— mientras el
        // DTO del profesional no tuvo dónde poner las otras dos; ver el aviso
        // de `datosProfesional` sobre lo que la API tiene que aceptar antes de
        // que esto llegue a `dev`.
        //
        // La **zona** sigue sin preguntarse, y eso no cambió: `common.addresses`
        // no tiene columna de zona para ninguno de los dos registros.
        hint: 'Tu localidad hace falta; la calle y el punto del mapa son opcionales.',
        campos: [
          {
            key: 'municipio',
            label: '',
            control: 'custom',
          },
          {
            key: 'homeAddressLines',
            label: 'Línea de dirección 1 (opcional)',
            hint: 'Como se lo dirías a quien te trae algo a casa.',
            description:
              'Calle, número y referencia. El punto del mapa no la escribe solo: ver el aviso de abajo.',
            control: 'text',
            autocomplete: 'street-address',
            placeholder: 'Av. Banzer, 3er anillo #42',
            testId: 'registration-practitioner-home-address',
            icono: 'route',
          },
          {
            key: 'gpsDomicilio',
            label: 'Ubicación GPS (opcional)',
            hint: 'Si la compartís, quien te busca llega sin llamarte.',
            description: 'Marcá el punto exacto de tu casa y confirmalo para que quede guardado.',
            control: 'custom',
          },
        ],
      },
      {
        titulo: 'Tu consultorio propio',
        clave: 'own-office',
        icon: 'building',
        // **Opcional, y aun así el que más importa** (punto 12/13/22 del módulo
        // médico del registro de procesos). Quien ejerce puede atender en
        // varios lugares, pero los demás son de otro: para figurar en una
        // clínica hace falta que esa clínica acepte la vinculación, y hasta que
        // eso pase su agenda no tiene dónde publicarse. El consultorio propio
        // es el único lugar que no depende de que nadie confirme nada.
        //
        // Por eso se pregunta acá y no sólo en el perfil: quien se registra
        // para empezar a atender lo necesita el primer día.
        hint: 'Opcional. Es el lugar que no depende de que otro te acepte, y desde donde vas a poder publicar tu agenda.',
        campos: [
          {
            key: 'officeName',
            label: 'Cómo se llama (opcional)',
            hint: 'El nombre con el que tus pacientes lo van a ver.',
            description:
              'Si no le ponés uno, no pasa nada: se puede completar después desde tu perfil.',
            control: 'text',
            placeholder: 'Consultorio Dr. Suárez',
            testId: 'registration-practitioner-office-name',
            icono: 'building',
          },
          {
            key: 'municipioConsultorio',
            label: '',
            control: 'custom',
          },
          {
            key: 'officeAddressLines',
            label: 'Línea de dirección 1 (opcional)',
            hint: 'Calle y número del consultorio.',
            description:
              'Es la dirección que ve un paciente antes de ir. El punto del mapa no la escribe solo.',
            control: 'text',
            placeholder: 'Calle Libertad #120, piso 2',
            testId: 'registration-practitioner-office-address',
            icono: 'route',
          },
          {
            key: 'gpsConsultorio',
            label: 'Ubicación GPS (opcional)',
            hint: 'Con el punto, un paciente llega sin preguntar.',
            description:
              'Marcá el punto exacto del consultorio y confirmalo. Se confirma aparte del de tu casa.',
            control: 'custom',
          },
        ],
      },
      {
        titulo: 'Tu título profesional y foto',
        clave: 'practice',
        icon: 'teach',
        // Página propia y no pegada a las especialidades: es la que DECIDE qué
        // especialidades se ofrecen, y verlas cambiar en la misma pantalla en
        // la que se elige el título hace pensar que algo se perdió.
        //
        // La universidad y el lugar de estudio SÍ se preguntan acá desde el
        // 09/09: el propietario los pidió en el alta, no en el perfil. Siguen
        // sin viajar —viven en `credentials`, detrás de la sesión— y el mapeo
        // campo por campo está en `docs/handoff/`.
        hint: 'Lo que van a ver tus pacientes. Podés cambiarlo cuando quieras.',
        campos: [
          {
            key: 'profilePhotoBase64',
            label: '',
            control: 'custom',
          },
          {
            key: 'professionalTitle',
            label: 'Título profesional',
            required: true,
            mensajeDeError: 'Elegí tu título profesional en la lista.',
            hint: 'Al elegirlo, la lista de especialidades y el colegio se acomodan solos.',
            description:
              'Es como aparecés en tu ficha pública. Sale de una lista cerrada para que la misma profesión no figure escrita de cuatro maneras distintas.',
            // `custom` y no `select`: la pantalla proyecta acá una lupa. La
            // lista sigue siendo cerrada —son doce— pero se busca escribiendo.
            control: 'custom',
            icono: 'teach',
          },
          {
            // Universidad, país y ciudad en UN campo proyectado, como los
            // nombres: son tres casillas y la página ya llegó al tope de
            // cuatro con la foto, el título y su diploma. Van pegadas al
            // título y no en una página propia porque las cuatro contestan la
            // misma pregunta —qué estudiaste y dónde—, y partirlas obligaría a
            // volver atrás para recordar de qué título se está hablando.
            key: 'professionalTitleEducation',
            label: 'Dónde lo estudiaste',
            control: 'custom',
          },
          {
            key: 'professionalTitleFile',
            label: 'Diploma del título (opcional)',
            hint: 'Podés adjuntarlo ahora o cargarlo después desde tu perfil.',
            control: 'custom',
          },
        ],
      },
      {
        titulo: 'Tu habilitación para ejercer',
        clave: 'credentials',
        icon: 'shield',
        hint: 'Sin matrícula y número de colegio no podemos darte de alta.',
        campos: [
          {
            key: 'licenseNumber',
            label: rotuloMatricula,
            hint: hintMatricula,
            description:
              'Es la que comprobamos antes de que aparezcas en el directorio: es lo que le da certeza a quien te elige sin conocerte.',
            control: 'text',
            required: true,
            autocomplete: 'off',
            placeholder: placeholderMatricula,
            testId: 'registro-pro-matricula',
            icono: 'shield',
            // Los dos números de la habilitación, en el mismo renglón: se
            // copian de la misma credencial y se contestan de una sentada.
            ancho: 'mitad',
            mensajeDeError: 'Ingresá tu matrícula profesional.',
          },
          {
            key: 'sedesLicenseNumber',
            label: 'Registro del SEDES',
            hint: 'El de tu habilitación departamental, como figura en tu título del SEDES.',
            control: 'text',
            required: true,
            autocomplete: 'off',
            placeholder: 'T.I. 538/14',
            testId: 'registro-pro-credencial',
            icono: 'briefcase',
            ancho: 'mitad',
            mensajeDeError: 'Ingresá tu número de registro del SEDES.',
          },
          {
            key: 'regulatoryAuthority',
            label: 'Autoridad que la emitió (opcional)',
            hint: 'Quién emitió tu matrícula.',
            control: 'select',
            options: OPCIONES_AUTORIDAD_REGULADORA,
            placeholder: 'Sin especificar',
            testId: 'registro-pro-autoridad',
            icono: 'building',
          },
          {
            key: 'licenseIssueDate',
            label: 'Fecha de inscripción (opcional)',
            hint: 'Cuándo te registraste, no cuándo vence.',
            control: 'date',
          },
        ],
      },
      // Página propia y no dos campos más en la anterior: `MAX_CAMPOS_POR_PAGINA`
      // ya está lleno ahí (cuatro), y un adjunto ocupa mucho más alto que un
      // input. Va inmediatamente después para que cada archivo se vea al lado
      // del número que respalda.
      {
        titulo: 'Los respaldos de tu habilitación',
        clave: 'credential-files',
        icon: 'folder',
        hint: 'Opcional al registrarte. Un administrativo los verifica después.',
        campos: [
          {
            key: 'credentialAttachments',
            label: 'Respaldos',
            control: 'custom',
          },
        ],
      },
      {
        titulo: 'Tus títulos',
        clave: 'academic-titles',
        icon: 'teach',
        hint: 'Todos opcionales, y podés cargar más de uno de cada tipo.',
        campos: [
          {
            key: 'academicTitles',
            label: 'Títulos',
            control: 'custom',
          },
        ],
      },
      {
        titulo: 'Tus especialidades',
        clave: 'specialties',
        icon: 'directory',
        hint: 'Las que hagan falta. Son lo que un paciente busca cuando necesita a alguien como vos.',
        campos: [
          {
            key: 'specialtyPrimary',
            label: 'Especialidad principal (opcional)',
            hint: 'La que responde «¿de qué sos?».',
            control: 'select',
            options: this.opcionesEspecialidadFiltradas(),
            placeholder: 'Sin especialidad',
            testId: 'registro-pro-especialidad-1',
            icono: 'stethoscope',
          },
          // Sin control propio: es una ranura que la plantilla llena con las
          // casillas agregadas y su botón. Mismo mecanismo que `municipio`.
          {
            key: 'especialidadesExtra',
            label: '',
            control: 'custom',
          },
        ],
      },
      // La contraseña cierra el alta, sola. Estaba en el paso del correo de
      // trabajo, mezclada con los teléfonos del consultorio: el mismo paso
      // pedía datos de contacto —que son del trabajo y opcionales— y la clave
      // de la cuenta, que no es ninguna de las dos cosas. Separarla también
      // deja el gesto de «elegir contraseña» pegado al de terminar.
      {
        titulo: 'Tu contraseña',
        clave: 'password',
        icon: 'lock',
        hint: 'Lo último. Con ella y tu correo personal vas a iniciar sesión.',
        campos: [
          {
            key: 'password',
            label: 'Contraseña',
            hint: 'Al menos 8 caracteres.',
            description:
              'Se guarda cifrada: ni el equipo de AloVida puede verla, y nunca te la vamos a pedir por teléfono ni por correo.',
            control: 'password',
            required: true,
            autocomplete: 'new-password',
            placeholder: 'Tu contraseña',
            testId: 'registro-pro-password',
            icono: 'lock',
            mensajeDeError: 'La contraseña necesita al menos 8 caracteres.',
          },
        ],
      },
    ]);
  });

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
      hint: 'El «SC», «LP»... de tu cédula.',
      mensajeDeError: 'Elegí el departamento que expidió tu cédula.',
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
          placeholder: 'Elegí el departamento',
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
  readonly accessHint = 'tu correo';

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
  readonly ayudaVisible = computed<readonly TarjetaDeAyuda[]>(
    () => AYUDA_PROFESIONAL[this.claveVisible()] ?? [],
  );

  /** Lo que el motor avisa al cambiar de página. */
  protected recordarPaso(pagina: PaginaDeFormulario): void {
    this.claveVisible.set(pagina.clave ?? '');
  }

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
    this.cargarDepartamentos();
    this.cargarMunicipios();
    this.cargarEspecialidades();
    this.acomodarColegioYEspecialidades();

    // El aviso de un envío fallido se va en cuanto se corrige algo.
    //
    // Se ata a lo único que de verdad significa «estoy corrigiendo» —que el
    // formulario cambie—, que cubre además el caso que el avance de página no
    // cubría: corregir en la misma página donde falló el envío.
    this.limpiarElErrorAlCorregir();
  }

  /**
   * El registro del cliente, §1.4.4: al elegir la profesión, el colegio cambia
   * SOLO. Elegir «Odontólogo» pone Colegio de Odontólogos; una profesión médica
   * pone Colegio Médico — pero únicamente si la autoridad estaba vacía o era el
   * otro colegio del par: una elección explícita distinta (SEDES, Enfermería…)
   * no se pisa, porque el automatismo es una ayuda, no una regla.
   *
   * Y al cambiar de profesión, las especialidades elegidas que ya no pertenecen
   * a la lista nueva se limpian: un desplegable con un valor que no está entre
   * sus opciones muestra un vacío que miente.
   *
   * Se llama desde el constructor: `takeUntilDestroyed` pide contexto de
   * inyección. Sin eso el espejo del título no se instala y el filtro de
   * especialidades vuelve a congelarse — ver {@link tituloProfesionalElegido}.
   */
  private acomodarColegioYEspecialidades(): void {
    const titulo = this.formProfesional.controls.professionalTitle;
    const autoridad = this.formProfesional.controls.regulatoryAuthority;
    titulo.valueChanges.pipe(takeUntilDestroyed()).subscribe((valor) => {
      // Primero el espejo: de acá leen las listas del `computed`, y también la
      // limpieza de más abajo.
      this.tituloProfesionalElegido.set(valor);

      const esOdontologo = valor === TITULO_ODONTOLOGO;
      if (esOdontologo && (autoridad.value === '' || autoridad.value === COLEGIO_MEDICO)) {
        autoridad.setValue(COLEGIO_ODONTOLOGOS);
      } else if (
        TITULOS_MEDICOS.has(valor) &&
        (autoridad.value === '' || autoridad.value === COLEGIO_ODONTOLOGOS)
      ) {
        autoridad.setValue(COLEGIO_MEDICO);
      }

      // Cambiar de profesión cambia la lista que se ofrece, así que lo ya
      // elegido que dejó de estar en ella se vacía. Alcanza también a las
      // casillas agregadas: si no, quedarían mostrando una especialidad que el
      // desplegable ya no ofrece.
      const validas = new Set(this.opcionesEspecialidadFiltradas().map((o) => o.value));
      for (const control of this.controlesDeEspecialidad()) {
        if (control.value !== '' && !validas.has(control.value)) {
          control.setValue('');
        }
      }
      this.especialidadesExtra.update((actuales) =>
        actuales.map((especialidad) =>
          especialidad !== '' && !validas.has(especialidad) ? '' : especialidad,
        ),
      );
    });
  }

  private controlesDeEspecialidad() {
    return [this.formProfesional.controls.specialtyPrimary] as const;
  }

  /**
   * Las especialidades que corresponde OFRECER según la profesión elegida:
   * odontólogo → las odontológicas; cualquier otra → el resto del catálogo.
   * Sin profesión elegida se ofrece todo, porque no hay con qué filtrar.
   */
  protected opcionesEspecialidadFiltradas(): readonly SelectOption<string>[] {
    const titulo = this.tituloProfesionalElegido();
    const todas = this.opcionesEspecialidad();
    const filtradas =
      titulo === ''
        ? todas
        : titulo === TITULO_ODONTOLOGO
          ? todas.filter((o) => ESPECIALIDADES_ODONTOLOGICAS.has(o.code))
          : todas.filter((o) => !ESPECIALIDADES_ODONTOLOGICAS.has(o.code));
    return filtradas.map(({ value, label }) => ({ value, label }));
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
    const calle = raw.officeAddressLines.trim();
    const municipio = this.municipioConsultorio();
    const punto = this.gpsConsultorio();

    if (nombre === '' && calle === '' && municipio === null && punto === null) {
      return null;
    }

    // La dirección sólo viaja si tiene algo adentro: una dirección vacía no es
    // «sin dirección», es una fila vacía en `common.addresses`. Es la misma
    // regla que ya aplica `work-history.ts` al registrar una sede.
    const conDireccion = calle !== '' || municipio !== null || punto !== null;

    return {
      name: nombre === '' ? NOMBRE_CONSULTORIO_POR_OMISION : nombre,
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

  /**
   * Trae el árbol de municipios, para «dónde vivís».
   *
   * Mismo criterio que los departamentos ante un fallo: el campo es opcional y
   * el alta sigue. Lo que llega ya viene agrupado por departamento; acá sólo se
   * traduce a la forma que espera `app-tree-select`.
   */
  protected cargarMunicipios(): void {
    this.municipios.listar().subscribe({
      next: (ramas) => {
        this.catalogoMunicipiosCaido.set(false);
        this.ramasMunicipios.set(ramas);
      },
      error: () => {
        this.ramasMunicipios.set([]);
        this.catalogoMunicipiosCaido.set(true);
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

  /** Reintenta la lectura del árbol de municipios. Ver `reintentarDepartamentos`. */
  protected reintentarMunicipios(): void {
    this.municipios.olvidar();
    this.cargarMunicipios();
    // El árbol arrastra el catálogo de departamentos, que `olvidar()` también
    // limpia: se recarga para que el desplegable de emisión no quede vacío.
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

    if (this.formProfesional.invalid) {
      this.formProfesional.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.iam.registerPractitioner(this.datosProfesional()).subscribe({
      next: () => {
        this.state.set(ready(null));
        this.registered.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
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
    const calleDomicilio = raw.homeAddressLines.trim();
    const gpsDomicilio = this.gpsDomicilio();
    const consultorio = this.consultorioPropio();
    const sexoAlNacer = raw.sexAtBirth;
    const foto = raw.profilePhotoBase64;

    return {
      // `email` del DTO es el campo de LOGIN de la API, y desde este cambio el
      // login es el correo personal: es el que el profesional conserva aunque
      // cambie de hospital. El institucional viaja aparte, en `workEmail`.
      //
      // OJO AL PASE A `dev`: hoy el DTO de la API documenta lo contrario
      // —«Correo de trabajo; es la identidad de login del profesional»— y NO
      // declara `workEmail`, así que con `forbidNonWhitelisted` rechazaría el
      // alta entera. La API tiene que aceptar `workEmail` (opcional, se guarda
      // como contacto de uso `CONTACT_USE_WORK`, que ya existe) ANTES de que
      // esta rama llegue a `dev`.
      email: correoPersonal,
      password: raw.password,
      name: raw.name.trim(),
      lastName: raw.lastName.trim(),
      ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
      ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      ...(fechaNacimiento === null ? {} : { birthDate: fechaIso(fechaNacimiento) }),
      ...(sexoAlNacer === null ? {} : { sexAtBirth: sexoAlNacer }),
      ...(foto ? { profilePhotoBase64: foto } : {}),
      ...(documento === '' ? {} : { nationalId: documento }),
      // Sólo tiene sentido con documento: sin CI no hay identificador al que
      // atarle un departamento de emisión.
      ...(documento !== '' && departamento !== null
        ? { issuerAdministrativeAreaConceptId: departamento }
        : {}),
      ...(municipio === null ? {} : { residenceMunicipalityConceptId: municipio }),
      // La calle y el punto del domicilio (AC-05-8).
      //
      // OJO AL PASE A `dev`, igual que `workEmail`: `RegisterPractitionerDto`
      // hoy acepta `residenceMunicipalityConceptId` y nada más, y con
      // `forbidNonWhitelisted: true` (ver `main.ts`) tres claves que no
      // declara **rechazan el alta entera con 400**. No es que el dato se
      // pierda: no se registra nadie. La API tiene que aceptar
      // `homeAddressLines`, `homeLatitude` y `homeLongitude` —los tres ya
      // existen en `RegisterPatientDto`, son copiables tal cual— ANTES de que
      // esta rama llegue a `dev`. Está anotado en `PENDIENTES-BACKEND.md`.
      //
      // El punto viaja sólo si se confirmó sobre el mapa: `gpsDomicilio` es lo
      // que emite `app-ubicacion-picker`, y ese sólo emite lo confirmado.
      ...(calleDomicilio === '' ? {} : { homeAddressLines: calleDomicilio }),
      ...(gpsDomicilio === null
        ? {}
        : { homeLatitude: gpsDomicilio.lat, homeLongitude: gpsDomicilio.lng }),
      // El consultorio propio, si declaró alguno. Ver `consultorioPropio()`.
      ...(consultorio === null ? {} : { ownSite: consultorio }),
      licenseNumber: raw.licenseNumber.trim(),
      sedesLicenseNumber: raw.sedesLicenseNumber.trim(),
      ...(autoridad === '' ? {} : { regulatoryAuthority: autoridad }),
      ...(fechaInscripcion === null ? {} : { licenseIssueDate: fechaIso(fechaInscripcion) }),
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
    };
  }

  /**
   * Las especialidades elegidas, en orden y sin repetidos: la primera del
   * formulario es la principal, y elegir la misma dos veces declara una.
   */
  private especialidadesElegidas(): readonly string[] {
    // El orden importa: la primera del arreglo es la que el backend guarda
    // como principal, así que la del control va siempre adelante.
    const elegidas = [
      ...this.controlesDeEspecialidad().map((control) => control.value),
      ...this.especialidadesExtra(),
    ].filter((valor) => valor !== '');
    return [...new Set(elegidas)];
  }
}
