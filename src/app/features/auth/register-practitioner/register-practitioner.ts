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
import { LocationPicker } from '../registro-compartido/location-picker/location-picker';
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
 */
const ESPECIALIDADES_ODONTOLOGICAS: ReadonlySet<string> = new Set([
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
 * lectura como la de la ocupación.
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
        'De él dependen las especialidades que se te ofrecen en el paso siguiente: un odontólogo no elige entre las 36 del catálogo, elige entre las suyas.',
    },
  ],
  profile: [
    {
      icono: 'stethoscope',
      titulo: 'Todo esto es opcional',
      texto:
        'El sexo y la fecha de nacimiento se guardan en tu perfil profesional. Lo único que no podés dejar en blanco es tu habilitación.',
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
  access: [
    {
      icono: 'mail',
      titulo: 'Con tu correo vas a entrar',
      texto: 'Usá uno al que tengas acceso: es por donde se recupera la cuenta si perdés la clave.',
    },
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
    LocationPicker,
    Link,
    Alert,
    AuthSplit,
    AnnounceOnAppear,
    PaginatedForm,
    CampoPersonalizado,
    RegistroAyuda,
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
    // Documento de identidad: opcional para el profesional (se guarda como
    // identificador oficial, no como login — eso lo sigue siendo el correo).
    nationalId: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(DOCUMENTO_VALIDO)],
    }),
    licenseNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    credentialNumber: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    // Quién emitió la matrícula y con qué título ejerce: los dos salen de una
    // lista cerrada — ver `OPCIONES_AUTORIDAD_REGULADORA` y
    // `OPCIONES_TITULO_PROFESIONAL`. Siguen siendo controles de texto porque lo
    // que el desplegable escribe es la etiqueta, que es lo que el backend
    // guarda.
    regulatoryAuthority: new FormControl('', { nonNullable: true }),
    professionalTitle: new FormControl('', { nonNullable: true }),
    // El control guarda lo que `app-phone-input` compone —el prefijo del país
    // elegido y su número—, así que el validador comprueba justamente eso, y
    // viene del propio campo: es él quien sabe qué largo tiene cada país.
    phone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    birthDate: new FormControl<Date | null>(null),
    // AC-05-7: el DTO lo aceptaba desde siempre; lo que faltaba era
    // preguntarlo. Opcional, como el resto de los datos personales de esta
    // alta: lo que acá no se puede dejar en blanco es la habilitación.
    sexAtBirth: new FormControl<BirthSexCode | null>(null),
    licenseIssueDate: new FormControl<Date | null>(null),
    issuerAdministrativeAreaConceptId: new FormControl<string | null>(null),
    // Las «3 espacios adicionales a la profesión» del registro del cliente
    // (módulo Médico §1.4.2), literales: tres desplegables, no un multiselect.
    // La primera es la principal; las otras dos, opcionales.
    specialtyPrimary: new FormControl('', { nonNullable: true }),
    specialtySecond: new FormControl('', { nonNullable: true }),
    specialtyThird: new FormControl('', { nonNullable: true }),
  });

  /**
   * El municipio de residencia.
   *
   * Sigue fuera del `FormGroup` porque es un campo `custom` de verdad: lo
   * dibuja un árbol con búsqueda que esta pantalla proyecta y el motor no
   * conoce.
   */
  readonly municipioProfesional = signal<string | null>(null);

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
   * - **Segundo celular y segundo correo** (AC-05-6). `RegisterPractitionerDto`
   *   declara **un** `phone` y **un** `email`; no hay segundo campo ni tabla de
   *   puntos de contacto que los reciba.
   * - **Zona, línea de dirección y GPS** de residencia (AC-05-8). El DTO del
   *   profesional acepta `residenceMunicipalityConceptId` y nada más: no tiene
   *   `homeAddressLines` ni el par de coordenadas que sí tiene el de paciente. Y
   *   `common.addresses` no tiene columna de zona para ninguno de los dos.
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
   * - **Las tres matrículas por separado** (AC-05-5). Hay **dos** números
   *   (`licenseNumber`, `credentialNumber`) y **una** autoridad. Tres números en
   *   paralelo son un modelo distinto —o tres filas de `common.identifiers`— y
   *   eso es esquema.
   * - **Universidad y otros títulos** (AC-05-13). Viven en `credentials`, detrás
   *   de la sesión, con su propio endpoint. El alta pública no los recibe.
   *
   * ## El tope de cuatro campos por página no se relaja (AC-05-2)
   *
   * Ninguna sección de acá llega a cinco, y aun así todas pasan por
   * `paginarCampos`: es la función la que hace cumplir el tope, y declararlo a
   * mano sería confiar en que quien agregue el campo trece se acuerde de contar.
   */
  readonly paginasProfesional = computed<readonly PaginaDeFormulario[]>(() =>
    paginarCampos([
      {
        titulo: '¿Cómo te llamás?',
        clave: 'name',
        icon: 'people',
        hint: 'Como figura en tu documento. Si no tenés alguno, dejalo vacío.',
        // De a dos por renglón, igual que en el alta de paciente: son las
        // cuatro partes de un mismo nombre y ninguna necesita la fila entera.
        campos: [
          {
            key: 'name',
            label: 'Nombre',
            control: 'text',
            required: true,
            autocomplete: 'given-name',
            placeholder: 'Ana',
            testId: 'registro-pro-nombre',
            ancho: 'mitad',
            mensajeDeError: 'Ingresá tu nombre.',
          },
          {
            key: 'middleName',
            label: 'Segundo nombre',
            hint: 'Si no tenés, dejalo vacío.',
            control: 'text',
            autocomplete: 'additional-name',
            placeholder: 'Lucía',
            testId: 'registro-pro-segundo-nombre',
            ancho: 'mitad',
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
        hint: 'Opcional. No es con lo que entrás: identifica a la persona detrás de la matrícula.',
        campos: [
          {
            key: 'nationalId',
            label: 'Cédula de identidad (opcional)',
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
            mensajeDeError: 'Letras, números, punto y guion.',
          },
          this.campoDepartamentoEmisor('registro-pro-departamento-ci'),
        ],
      },
      {
        titulo: 'Contanos un poco sobre vos',
        clave: 'profile',
        icon: 'stethoscope',
        hint: 'Opcional. Se guarda en tu perfil profesional.',
        campos: [
          {
            key: 'sexAtBirth',
            label: 'Sexo (opcional)',
            hint: 'Es el que registra tu documento de identidad.',
            control: 'select',
            options: OPCIONES_SEXO,
            placeholder: 'Sin especificar',
            testId: 'registration-practitioner-sex',
            icono: 'heart',
          },
          {
            key: 'birthDate',
            label: 'Fecha de nacimiento (opcional)',
            control: 'date',
            maxDate: 'today',
            minDate: new Date(1900, 0, 1),
          },
        ],
      },
      {
        titulo: 'Tu acceso y tu contacto',
        clave: 'access',
        icon: 'mail',
        hint: 'Con este correo y esta contraseña vas a iniciar sesión.',
        campos: [
          {
            key: 'phone',
            label: 'Tu celular (opcional)',
            hint: 'Elegí el país si tu número no es de Bolivia.',
            description:
              'Es el número por el que te contactamos a vos, no el que ve un paciente en tu ficha.',
            control: 'tel',
            autocomplete: 'tel',
            testId: 'registro-pro-telefono',
            icono: 'phone',
            mensajeDeError: 'El número está incompleto para el país elegido.',
          },
          // El segundo celular y el segundo correo que pide AC-05-6 no están:
          // el DTO declara uno de cada. Ver el JSDoc de arriba.
          {
            key: 'email',
            label: 'Correo profesional',
            hint: 'Con este correo vas a iniciar sesión.',
            description:
              'Usá uno al que tengas acceso: es por donde se recupera la cuenta si perdés la clave.',
            control: 'email',
            required: true,
            // `username`: acá el correo SÍ es el identificador de acceso. Sin
            // esto el navegador guardaba el número de credencial como usuario.
            autocomplete: 'username',
            placeholder: 'matricula@hospital.bo',
            testId: 'registro-pro-correo',
            icono: 'mail',
            mensajeDeError: 'Ingresá un correo válido.',
          },
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
      {
        titulo: '¿Dónde vivís?',
        clave: 'residence',
        icon: 'home',
        // Una sola pregunta: la localidad. La zona, la línea de dirección y el
        // GPS que el orden también pide no tienen campo en el DTO del
        // profesional — ver el JSDoc de arriba.
        hint: 'Opcional. Nos deja mostrarte lo que tenés cerca.',
        campos: [
          {
            key: 'municipio',
            label: '',
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
            label: 'Matrícula profesional',
            hint: 'La que te habilita a ejercer, la del registro del Ministerio.',
            description:
              'Es la que comprobamos antes de que aparezcas en el directorio: es lo que le da certeza a quien te elige sin conocerte.',
            control: 'text',
            required: true,
            autocomplete: 'off',
            placeholder: 'MP-12345',
            testId: 'registro-pro-matricula',
            icono: 'shield',
            // Los dos números de la habilitación, en el mismo renglón: se
            // copian de la misma credencial y se contestan de una sentada.
            ancho: 'mitad',
            mensajeDeError: 'Ingresá tu matrícula profesional.',
          },
          {
            key: 'credentialNumber',
            label: 'Número de colegio',
            hint: 'El de tu colegio profesional.',
            control: 'text',
            required: true,
            autocomplete: 'off',
            placeholder: 'TIT-6789',
            testId: 'registro-pro-credencial',
            icono: 'briefcase',
            ancho: 'mitad',
            mensajeDeError: 'Ingresá el número de tu colegio.',
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
      {
        titulo: 'Tu título profesional',
        clave: 'practice',
        icon: 'teach',
        // Página propia y no pegada a las especialidades: es la que DECIDE qué
        // especialidades se ofrecen, y verlas cambiar en la misma pantalla en
        // la que se elige el título hace pensar que algo se perdió.
        //
        // La universidad y los otros títulos que el orden pide junto a esto
        // (AC-05-13) no están: viven en `credentials`, detrás de la sesión.
        hint: 'Lo que van a ver tus pacientes. Podés cambiarlo cuando quieras.',
        campos: [
          {
            key: 'professionalTitle',
            label: 'Título profesional (opcional)',
            hint: 'Al elegirlo, la lista de especialidades y el colegio se acomodan solos.',
            description:
              'Es como aparecés en tu ficha pública. Sale de una lista cerrada para que la misma profesión no figure escrita de cuatro maneras distintas.',
            control: 'select',
            options: OPCIONES_TITULO_PROFESIONAL,
            placeholder: 'Sin especificar',
            testId: 'registro-pro-titulo',
            icono: 'teach',
          },
        ],
      },
      {
        titulo: 'Tus especialidades',
        clave: 'specialties',
        icon: 'directory',
        hint: 'Hasta tres. Son lo que un paciente busca cuando necesita a alguien como vos.',
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
          {
            key: 'specialtySecond',
            label: 'Segunda especialidad (opcional)',
            control: 'select',
            options: this.opcionesEspecialidadFiltradas(),
            placeholder: 'Sin especificar',
            testId: 'registro-pro-especialidad-2',
          },
          {
            key: 'specialtyThird',
            label: 'Tercera especialidad (opcional)',
            control: 'select',
            options: this.opcionesEspecialidadFiltradas(),
            placeholder: 'Sin especificar',
            testId: 'registro-pro-especialidad-3',
          },
        ],
      },
    ]),
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
      label: 'Departamento de emisión (opcional)',
      hint: 'El «SC», «LP»... de tu cédula.',
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
          placeholder: 'Sin especificar',
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

      const validas = new Set(this.opcionesEspecialidadFiltradas().map((o) => o.value));
      for (const control of this.controlesDeEspecialidad()) {
        if (control.value !== '' && !validas.has(control.value)) {
          control.setValue('');
        }
      }
    });
  }

  private controlesDeEspecialidad() {
    const c = this.formProfesional.controls;
    return [c.specialtyPrimary, c.specialtySecond, c.specialtyThird] as const;
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
    const telefono = raw.phone.trim();
    const segundoNombre = raw.middleName.trim();
    const apellidoMaterno = raw.motherLastName.trim();
    const documento = raw.nationalId.trim();
    const autoridad = raw.regulatoryAuthority.trim();
    const fechaNacimiento = raw.birthDate;
    const fechaInscripcion = raw.licenseIssueDate;
    const departamento = raw.issuerAdministrativeAreaConceptId;
    const municipio = this.municipioProfesional();
    const sexoAlNacer = raw.sexAtBirth;

    return {
      email: raw.email.trim(),
      password: raw.password,
      name: raw.name.trim(),
      lastName: raw.lastName.trim(),
      ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
      ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      ...(fechaNacimiento === null ? {} : { birthDate: fechaIso(fechaNacimiento) }),
      ...(sexoAlNacer === null ? {} : { sexAtBirth: sexoAlNacer }),
      ...(documento === '' ? {} : { nationalId: documento }),
      // Sólo tiene sentido con documento: sin CI no hay identificador al que
      // atarle un departamento de emisión.
      ...(documento === '' || departamento === null
        ? {}
        : { issuerAdministrativeAreaConceptId: departamento }),
      ...(municipio === null ? {} : { residenceMunicipalityConceptId: municipio }),
      licenseNumber: raw.licenseNumber.trim(),
      credentialNumber: raw.credentialNumber.trim(),
      ...(autoridad === '' ? {} : { regulatoryAuthority: autoridad }),
      ...(fechaInscripcion === null ? {} : { licenseIssueDate: fechaIso(fechaInscripcion) }),
      ...(titulo === '' ? {} : { professionalTitle: titulo }),
      ...(telefono === '' ? {} : { phone: telefono }),
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
    const elegidas = this.controlesDeEspecialidad()
      .map((control) => control.value)
      .filter((valor) => valor !== '');
    return [...new Set(elegidas)];
  }
}
