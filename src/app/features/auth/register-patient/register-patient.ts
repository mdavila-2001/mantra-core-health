import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import {
  BoEmployersCatalog,
  CODIGO_EMPRESA_OTRA,
} from '../../../core/data-access/terminology/bo-employers.service';
import {
  BoOccupationsCatalog,
  CODIGO_OCUPACION_OTRA,
} from '../../../core/data-access/terminology/bo-occupations.service';
import { MedicalSpecialtiesCatalog } from '../../../core/data-access/terminology/medical-specialties.service';
import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../core/data-access/terminology/bo-municipalities.service';
import { IamClient } from '../../../core/data-access/iam/iam.client';
import type {
  BirthSexCode,
  PatientRegistration,
  PractitionerRegistration,
} from '../../../core/data-access/iam/iam.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { TreeSelect } from '../../../shared/components/organisms/tree-select/tree-select';
import type { TreeSelectGroup } from '../../../shared/components/organisms/tree-select/tree-select.types';
import { Link } from '../../../shared/components/atoms/link/link';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { CampoPersonalizado } from '../../../shared/components/organisms/paginated-form/campo-personalizado';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import { paginarCampos } from '../../../shared/forms/paginated/paginar-campos';
import type {
  CampoDeFormulario,
  PaginaDeFormulario,
} from '../../../shared/forms/paginated/paginated-form.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type { CarrierCatalogEntry } from '../../../core/data-access/insurance/insurance.types';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import { RegistroAyuda, type TarjetaDeAyuda } from './registro-ayuda/registro-ayuda';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { AppMap } from '../../../shared/components/organisms/map/map';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import type { PinMapa } from '../../../shared/components/organisms/map/pin-mapa.types';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';

/** `Date` → ISO `YYYY-MM-DD`, tal como lo esperan los DTO del backend. */
function fechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Mínimos que exigen los DTO del backend. */
const MIN_PASSWORD = 8;
const MIN_DOCUMENTO = 4;

/** Sólo letras, dígitos, punto y guion — el mismo `@Matches` del backend. */
const DOCUMENTO_VALIDO = /^[A-Za-z0-9.-]+$/;

/** El NIT boliviano es sólo dígitos; el backend valida lo mismo. */
const NIT_VALIDO = /^[0-9]{4,20}$/;

/** Un punto en el mapa, tal como lo entrega el navegador. */
export interface Coordenadas {
  readonly lat: number;
  readonly lng: number;
}

/**
 * El identificador del pin del domicilio en el mapa.
 *
 * `app-map` habla de sus pines por `id` y exige uno; acá hay un solo pin, así
 * que es una constante y no un dato. No es un uuid a propósito: nada del mapa
 * debe poder filtrar identificadores.
 */
const PIN_DOMICILIO = 'domicilio';

/**
 * Cuánto se espera al navegador antes de dar la ubicación por perdida.
 *
 * Diez segundos: más que eso y la persona ya volvió a lo suyo.
 */
const GPS_TIMEOUT_MS = 10_000;

/** Ubicación de hasta cinco minutos: alcanza y evita volver a pedir el permiso. */
const GPS_MAX_AGE_MS = 300_000;

/**
 * El NIT, comprobado sobre el valor recortado.
 *
 * Se recorta antes de comprobar porque el número casi siempre llega pegado de
 * otro lado —una factura, un mensaje— con espacios alrededor, y rechazarlo por
 * eso sería castigar a quien copió bien. Al enviarlo también se recorta.
 *
 * @param control - El control del NIT.
 * @returns El error de formato, o `null` si está vacío o es válido.
 */
function nitValido(control: AbstractControl): ValidationErrors | null {
  const valor = String(control.value ?? '').trim();
  if (valor === '' || NIT_VALIDO.test(valor)) return null;
  return { nitInvalido: true };
}

/**
 * Un teléfono de tutor exige el nombre del tutor.
 *
 * El error se cuelga de `guardianPhone` y no del grupo porque el motor de
 * páginas muestra los errores por control, y porque es el campo que sobra: el
 * arreglo es escribir el nombre o borrar el teléfono.
 *
 * @param grupo - El formulario del paciente.
 * @returns `null` siempre; el error se fija en el control.
 */
function tutorConNombre(grupo: AbstractControl): null {
  const nombre = grupo.get('guardianName');
  const telefono = grupo.get('guardianPhone');
  if (!nombre || !telefono) return null;

  const falta = !nombre.value?.trim() && !!telefono.value?.trim();
  const errores = { ...(telefono.errors ?? {}) };
  if (falta) errores['tutorSinNombre'] = true;
  else delete errores['tutorSinNombre'];

  const quedan = Object.keys(errores).length ? errores : null;
  // `emitEvent: false`: fijar el error dispara la validación otra vez y el
  // validador del grupo volvería a entrar sin fin.
  telefono.setErrors(quedan, { emitEvent: false });
  return null;
}

/*
 * El teléfono lo valida `telefonoCompleto`, importado de `app-phone-input`.
 *
 * Acá vivía `/^\+591 [0-9]{8}$/`, escrito a mano. Era correcto mientras el
 * campo sólo componía Bolivia; desde que se le puede elegir el país, el largo
 * del número es del país y esta pantalla no tiene por qué saberlo — con el
 * regex fijo, todo número extranjero quedaba rechazado sin que el mensaje
 * dijera por qué («Ingresá los ocho dígitos», sobre un número brasileño de
 * once).
 */

/**
 * Género, con sus dos categorías.
 *
 * Va como lista fija y no como lectura de terminología —a diferencia de los
 * departamentos o de la ocupación— porque la API lo recibe **por código
 * legible** (`sexAtBirth: 'FEMALE'`), no por uuid de concepto: pedir el
 * catálogo sólo para pintar dos etiquetas agregaría una petición y un estado de
 * fallo a una pantalla pública, sin ganar nada. Los códigos son los que valida
 * el `@IsIn` del backend; el mapeo a concepto lo hace él.
 *
 * ## Por qué dos y no cuatro
 *
 * El campo ofrecía además «Intersexual» y «Prefiero no decirlo», y el equipo
 * pidió dejar sólo masculino y femenino: es lo que el documento de identidad
 * boliviano registra y lo que la ficha del paciente contrasta contra él. Sigue
 * siendo opcional —«Sin especificar» es el marcador del desplegable y deja el
 * control vacío—, así que quien no quiera contestar no tiene que elegir una
 * casilla que no lo describe: simplemente no elige.
 *
 * ## Por qué el rótulo dice «Género» y el dato viaja como `sexAtBirth`
 *
 * Porque son las dos mitades de la misma decisión. El rótulo es el que el
 * equipo pidió y el que la gente reconoce; el campo que se manda es el que
 * tiene consecuencia clínica —dosis, valores de referencia, tamizajes— y el
 * único que el backend traduce a concepto en el alta. El `gender`
 * administrativo del DTO sigue existiendo para otros clientes; este formulario
 * no lo manda, y ausente no es lo mismo que vacío.
 */
const OPCIONES_GENERO: readonly SelectOption<BirthSexCode>[] = [
  { value: 'MALE', label: 'Masculino' },
  { value: 'FEMALE', label: 'Femenino' },
];

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
 * **texto** (`regulatoryAuthority`, `@MaxLength(100)`), no un concepto: leer un
 * conjunto de valores para acabar mandando su etiqueta agregaría una petición y
 * un estado de fallo a una pantalla pública sin cambiar el dato que se
 * persiste. El día que la columna pase a `*_concept_id`, esto se cambia por una
 * lectura como la de la ocupación.
 */
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
 * Por qué se pide lo que se pide, paso por paso.
 *
 * ## Por qué esto existe
 *
 * Un alta de salud pregunta cosas que ningún otro formulario pregunta: qué
 * departamento emitió tu cédula, dónde trabajás, qué seguro tenés, a quién
 * avisamos si pasa algo. Cada una tiene un motivo bueno y ninguno cabe en la
 * pista del campo —la pista dice qué escribir, no por qué se guarda—, así que
 * hasta ahora el motivo no estaba en ningún lado y la pregunta quedaba sonando
 * a intromisión. Eso es de lo que más hace abandonar un registro.
 *
 * Va **al costado** y no dentro del formulario: no alarga la página, no compite
 * con los campos y se lee sólo si hace falta. Ver `app-registro-ayuda`.
 *
 * ## Por qué es un mapa por clave y no una lista
 *
 * Porque la respuesta cambia con la pregunta, y las páginas se reordenan. Con
 * un arreglo paralelo, mover una sección de sitio dejaría la explicación del
 * domicilio al lado de la contraseña, y nadie se enteraría hasta verlo. La
 * clave la declara la propia página (`PaginaDeFormulario.clave`), así que las
 * dos mitades no se pueden separar de un descuido.
 */
const AYUDA_PACIENTE: Readonly<Record<string, readonly TarjetaDeAyuda[]>> = {
  documento: [
    {
      icono: 'patients',
      titulo: 'Con tu documento vas a entrar',
      texto:
        'Es tu usuario: no tenés que inventar ni recordar otro. Lo pedimos primero para avisarte enseguida si ya tenías cuenta.',
    },
    {
      icono: 'pin',
      titulo: 'La expedición es parte del mismo carnet',
      texto:
        'El «SC», «LP»… distingue dos cédulas con el mismo número. Por eso va pegado al número y no en otra pregunta.',
    },
  ],
  nombre: [
    {
      icono: 'people',
      titulo: 'Tu nombre, como figura en tu documento',
      texto:
        'Es lo que evita que tu historia clínica se mezcle con la de alguien que se llama parecido. Si no llevás segundo nombre o apellido materno, dejalos vacíos.',
    },
  ],
  perfil: [
    {
      icono: 'stethoscope',
      titulo: 'Cambia cómo te atienden',
      texto:
        'La edad y el sexo deciden dosis, valores de referencia de laboratorio y qué controles te corresponden por edad.',
    },
    {
      icono: 'briefcase',
      titulo: 'Tu oficio también es un dato clínico',
      texto:
        'Cada trabajo trae sus riesgos —químicos, esfuerzo, turnos de noche— y tu médico los tiene en cuenta.',
    },
  ],
  domicilio: [
    {
      icono: 'pin',
      titulo: 'Para mostrarte lo que tenés cerca',
      texto:
        'Farmacias, laboratorios y consultorios de tu zona, en vez de los del otro lado de la ciudad.',
    },
    {
      icono: 'package',
      titulo: 'El mapa es opcional',
      texto:
        'Si marcás tu punto en el mapa y lo confirmás, la entrega de tus medicamentos llega sin que tengas que explicar dónde vivís. Si no, tu alta sigue igual.',
    },
  ],
  trabajo: [
    {
      icono: 'building',
      titulo: 'Con la empresa alcanza',
      texto:
        'No hace falta la dirección: el nombre de dónde trabajás basta. Sirve para los convenios con empresas y para los controles de salud laboral.',
    },
    {
      icono: 'note',
      titulo: 'Si no está en la lista, escribila',
      texto:
        'La lista tiene las empresas más grandes del país. Si la tuya no aparece, elegí «Otra empresa» y ponés el nombre vos.',
    },
  ],
  seguro: [
    {
      icono: 'umbrella',
      titulo: 'Para que no pagues lo que ya está cubierto',
      texto:
        'Con tu seguro declarado, la cobertura se aplica cuando reservás o comprás, sin que tengas que reclamarla después.',
    },
    {
      icono: 'billing',
      titulo: 'El NIT es sólo para tus facturas',
      texto: 'Lo usamos cuando hay que emitir una. Si no lo tenés a mano, dejalo vacío.',
    },
  ],
  tutor: [
    {
      icono: 'phone',
      titulo: 'A quién avisamos si hace falta',
      texto:
        'Es la persona a la que llamamos en una urgencia, o quien te acompaña si sos menor de edad. Sólo se usa para eso.',
    },
  ],
  acceso: [
    {
      icono: 'lock',
      titulo: 'Tu contraseña, sólo tuya',
      texto:
        'Ocho caracteres o más. Se guarda cifrada: ni el equipo de AloVida puede verla, y por eso nunca te la vamos a pedir por teléfono ni por correo.',
    },
    {
      icono: 'mail',
      titulo: 'El correo es opcional',
      texto:
        'Sirve para recuperar tu cuenta y para avisarte de un turno. Podés entrar sin él, con tu documento.',
    },
  ],
};

/** Lo mismo para el alta de profesional. Ver {@link AYUDA_PACIENTE}. */
const AYUDA_PROFESIONAL: Readonly<Record<string, readonly TarjetaDeAyuda[]>> = {
  nombre: [
    {
      icono: 'people',
      titulo: 'Así te van a ver tus pacientes',
      texto:
        'El nombre de tu ficha pública sale de acá, y se escribe como figura en tu documento: es lo que un paciente contrasta antes de elegirte.',
    },
  ],
  documento: [
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
  habilitacion: [
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
  practica: [
    {
      icono: 'stethoscope',
      titulo: 'Es tu carta de presentación',
      texto:
        'El título y el teléfono son lo primero que ve un paciente antes de pedirte un turno. Podés cambiarlos cuando quieras.',
    },
  ],
  especialidades: [
    {
      icono: 'directory',
      titulo: 'Es por donde te encuentran',
      texto:
        'Un paciente busca por especialidad. Las que elijas son las búsquedas en las que vas a aparecer.',
    },
  ],
  acceso: [
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

/** Quién se está registrando. Define qué endpoint y qué campos. */
type TipoCuenta = 'paciente' | 'profesional';

/**
 * Registro público, para los dos perfiles que la API permite dar de alta sin
 * intervención de un administrador.
 *
 * Son **dos altas distintas**, no una con campos extra:
 *
 * - El **paciente** entra con su documento; el correo es opcional y no
 *   condiciona el acceso.
 * - El **profesional** entra con su correo, y necesita matrícula y número de
 *   colegio: sin habilitación comprobable no hay alta.
 *
 * Por eso hay dos formularios en vez de uno condicional: los campos
 * obligatorios no se solapan y mezclarlos obligaría a validar «obligatorio si
 * el tipo es…», que es de donde salen los formularios que mienten.
 *
 * ## Por qué va por el motor
 *
 * Porque antes era una sola columna de doce a quince campos que no entraba en
 * ninguna pantalla: en un monitor de 1366×768 la persona veía tres campos y una
 * barra de scroll, sin saber cuánto faltaba ni si valía la pena empezar.
 *
 * Esta pantalla tuvo durante un día su propio recorrido por pasos, escrito a
 * mano acá: su barra, su índice, su validación por paso y su foco. Hacía lo
 * mismo que `app-paginated-form` y era la **única** de las cuarenta y cinco
 * pantallas del producto que se servía a sí misma. Eso es exactamente lo que el
 * motor existe para que no pase: dos implementaciones del mismo recorrido se
 * separan al primer arreglo que sólo se hace en una. Lo que queda acá es lo que
 * el motor no puede saber —qué se pregunta, en qué orden y contra qué endpoint
 * va—; el cómo se sirve es de él.
 *
 * Los dos catálogos bolivianos —departamento emisor y municipio de residencia—
 * van como campo `custom`: el motor les reserva el sitio con su rótulo y su
 * error, y no aprende nada de terminología ni de árboles con búsqueda. El del
 * municipio, además, trae su propio estado de «no cargó, reintentá», que un
 * `select` genérico no tiene dónde poner.
 */
@Component({
  selector: 'app-register-patient',
  imports: [
    RouterLink,
    AppButton,
    TreeSelect,
    Link,
    Alert,
    AuthSplit,
    AnnounceOnAppear,
    PaginatedForm,
    CampoPersonalizado,
    ReferenceCombobox,
    RegistroAyuda,
    AppMap,
    FormField,
    AppInput,
  ],
  templateUrl: './register-patient.html',
  styleUrl: './register-patient.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPatient {
  private readonly auth = inject(AuthService);
  private readonly iam = inject(IamClient);
  private readonly router = inject(Router);

  /**
   * Quién se está registrando, según la ruta por la que se entró.
   *
   * Antes lo decidía una pestaña dentro de esta misma pantalla; ahora lo decide
   * la rejilla de `/auth/register`, y cada alta tiene su URL. El valor llega
   * como dato de la ruta: sin ruta —en una prueba que monta el componente
   * suelto— se cae en paciente, que es el alta más común.
   */
  readonly tipo = signal<TipoCuenta>(
    inject(ActivatedRoute).snapshot.data['tipoDeCuenta'] === 'profesional'
      ? 'profesional'
      : 'paciente',
  );

  readonly titulo = computed(() =>
    this.tipo() === 'paciente' ? 'Crear cuenta de paciente' : 'Crear cuenta de profesional',
  );

  readonly formPaciente = new FormGroup(
    {
      nationalId: new FormControl('', {
        nonNullable: true,
        validators: [
          Validators.required,
          Validators.minLength(MIN_DOCUMENTO),
          Validators.pattern(DOCUMENTO_VALIDO),
        ],
      }),
      // El nombre va en sus cuatro partes, no en un campo libre: es como lo emite
      // el documento de identidad y como se comparan dos personas al buscar
      // duplicados. Partir después una cadena es una conjetura que falla con los
      // nombres compuestos y con los apellidos de más de una palabra.
      name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      middleName: new FormControl('', { nonNullable: true }),
      thirdName: new FormControl('', { nonNullable: true }),
      lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      motherLastName: new FormControl('', { nonNullable: true }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
      }),
      email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
      // El control guarda lo que `app-phone-input` compone —el prefijo del país
      // elegido y su número—, así que el validador comprueba justamente eso, y
      // viene del propio campo: es él quien sabe qué largo tiene cada país.
      phone: new FormControl('', {
        nonNullable: true,
        validators: [telefonoCompleto],
      }),
      // La ocupación es un concepto de `VS_BO_OCCUPATION`, no un texto: ver
      // `campoOcupacion`.
      occupationConceptId: new FormControl<string | null>(null),
      // La fecha y el sexo al nacer viven **en el formulario**, no en signals
      // aparte: el motor puentea `app-date-picker` —que trabaja con `model()`—
      // contra este mismo control, y así el dato tiene una sola fuente. Tenerlo
      // en dos terminaba siempre en la que se olvidó de actualizarse.
      birthDate: new FormControl<Date | null>(null),
      sexAtBirth: new FormControl<BirthSexCode | null>(null),
      // El departamento emisor es un `select` del motor cuando su catálogo llegó,
      // así que su valor vive donde viven los demás: en el formulario.
      issuerAdministrativeAreaConceptId: new FormControl<string | null>(null),
      // Calle y número del domicilio. El municipio va aparte —es un árbol con
      // buscador— y las coordenadas también: no se escriben, se confirman sobre
      // el mapa.
      homeAddressLines: new FormControl('', { nonNullable: true }),
      // El nombre escrito a mano, sólo para «Otra empresa». Sin validador
      // propio: el campo entero es opcional, y exigirlo convertiría la salida
      // de la lista en una trampa.
      workEmployerFreeText: new FormControl('', { nonNullable: true }),
      // El oficio escrito a mano, para quien elige «Otra ocupación». La base lo
      // guarda en `profiles.persons.occupation_free_text`, al lado del concepto.
      occupationFreeText: new FormControl('', { nonNullable: true }),
      // El tutor o persona autorizada. El teléfono usa el mismo validador que el
      // propio: un número incompleto no sirve para avisarle a nadie.
      guardianName: new FormControl('', { nonNullable: true }),
      guardianPhone: new FormControl('', {
        nonNullable: true,
        validators: [telefonoCompleto],
      }),
      // Los seguros declarados: el valor es el **plan**, no la compañía.
      privateInsurancePlanId: new FormControl<string | null>(null),
      publicInsurancePlanId: new FormControl<string | null>(null),
      billingTaxId: new FormControl('', {
        nonNullable: true,
        validators: [nitValido],
      }),
    },
    {
      // Un teléfono de tutor sin nombre sería un contacto sin dueño: imposible de
      // mostrar y de corregir. El backend lo rechaza; acá se avisa antes de
      // viajar, y el error se cuelga del teléfono porque es el campo que sobra.
      validators: [tutorConNombre],
    },
  );

  /**
   * El municipio de residencia del paciente.
   *
   * Sigue fuera del `FormGroup` porque es el único campo `custom` de verdad: lo
   * dibuja un árbol con búsqueda que esta pantalla proyecta y el motor no
   * conoce. Separado del municipio del profesional —no compartido— porque las
   * dos altas conviven en el mismo componente y un valor elegido en una
   * reaparecía en la otra: un dato que nadie escribió ahí.
   */
  readonly municipioPaciente = signal<string | null>(null);

  /**
   * La empresa donde trabaja, como concepto de `VS_BO_EMPLOYER`.
   *
   * Vive **fuera** del `FormGroup`, y no por gusto: de ella depende si la
   * página muestra el campo «¿en cuál?», y esa decisión la toma
   * `paginasPaciente()`, que es un `computed`. Un `computed` no se entera de
   * que cambió un `FormControl` —no es un signal—, así que con la empresa
   * dentro del formulario el campo del texto libre no llegaba a aparecer.
   * Mismo motivo de fondo que el municipio: es un campo `custom` que esta
   * pantalla dibuja y de cuyo valor depende lo que se dibuja después.
   */
  readonly empresaSeleccionada = signal<string | null>(null);
  /**
   * Las coordenadas que la persona compartió, si las compartió.
   *
   * Viven en un signal y no en el formulario porque no se escriben: las trae el
   * navegador de una sola vez. Nulas mientras nadie pulse el botón.
   *
   * **Nunca se muestran como números.** Son la entrada del mapa, y lo que la
   * persona ve es el pin sobre el plano: «-17,7833, -63,1821» no le dice a
   * nadie si el punto está bien, y era exactamente lo que había que confirmar.
   */
  readonly gpsDomicilio = signal<Coordenadas | null>(null);

  /** Si se está esperando al navegador ahora mismo. */
  readonly pidiendoGps = signal(false);

  /**
   * Si la persona ya dio por buena la ubicación del mapa.
   *
   * Es el paso que hacía falta: el navegador acierta la manzana, no la puerta,
   * así que entre «esto es lo que encontramos» y «esta es mi dirección» tiene
   * que haber alguien mirando el plano y diciendo que sí. Hasta entonces el
   * punto está capturado pero **no** viaja en el alta.
   */
  readonly direccionConfirmada = signal(false);

  /**
   * El pin del domicilio, tal como lo espera `app-map`.
   *
   * Vacío mientras no haya punto: el mapa acepta la lista vacía y se queda en
   * su vista por defecto, que es lo que corresponde antes de pedir nada.
   */
  readonly pinesDomicilio = computed<readonly PinMapa[]>(() => {
    const punto = this.gpsDomicilio();
    if (punto === null) return [];
    return [
      {
        id: PIN_DOMICILIO,
        lat: punto.lat,
        lng: punto.lng,
        titulo: this.direccionConfirmada() ? 'Tu dirección' : 'Acá te encontramos',
      },
    ];
  });

  /** Si el navegador negó la ubicación, para poder decirlo sin frenar el alta. */
  readonly gpsRechazado = signal(false);

  /** Las listas fijas, expuestas a la plantilla. */
  protected readonly opcionesGenero = OPCIONES_GENERO;

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
    // Mismo control y mismo validador que el del paciente: el teléfono no
    // cambia de forma según quién se registre.
    phone: new FormControl('', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    birthDate: new FormControl<Date | null>(null),
    licenseIssueDate: new FormControl<Date | null>(null),
    issuerAdministrativeAreaConceptId: new FormControl<string | null>(null),
    // Las «3 espacios adicionales a la profesión» del registro del cliente
    // (módulo Médico §1.4.2), literales: tres desplegables, no un multiselect.
    // La primera es la principal; las otras dos, opcionales.
    specialtyPrimary: new FormControl('', { nonNullable: true }),
    specialtySecond: new FormControl('', { nonNullable: true }),
    specialtyThird: new FormControl('', { nonNullable: true }),
  });

  /** El municipio de residencia del profesional. Ver el del paciente. */
  readonly municipioProfesional = signal<string | null>(null);

  /** Departamento que emitió el documento (VS_BO_DEPARTMENT), y su catálogo. */
  private readonly departamentos = inject(BoDepartmentsCatalog);
  readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);
  readonly catalogoDepartamentosCaido = signal(false);

  /** Ocupación del paciente (VS_BO_OCCUPATION), y su catálogo. */
  private readonly ocupaciones = inject(BoOccupationsCatalog);
  private readonly empresas = inject(BoEmployersCatalog);

  /**
   * Las especialidades (VS_MEDICAL_SPECIALTY, 63 desde el 27/08), y su catálogo.
   *
   * Se guardan CON su código además del par value/label: el código es lo que
   * decide si una especialidad es odontológica, y por lo tanto en cuál de las
   * dos listas —la del odontólogo o la del resto— aparece.
   */
  private readonly especialidades = inject(MedicalSpecialtiesCatalog);
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

  readonly opcionesEspecialidad = signal<readonly { value: string; label: string; code: string }[]>(
    [],
  );
  readonly catalogoEspecialidadesCaido = signal(false);
  readonly opcionesOcupacion = signal<readonly (SelectOption<string> & { code: string })[]>([]);
  readonly catalogoOcupacionesCaido = signal(false);

  /**
   * Las empresas, con el **código** del concepto además del uuid.
   *
   * El código viaja porque es lo que distingue a la salida «Otra empresa» del
   * resto (`employer:bo:OTRA`), y compararlo por el nombre visible sería atar
   * una regla de la pantalla a una cadena de texto que el catálogo puede
   * reescribir.
   */
  readonly opcionesEmpresa = signal<readonly (SelectOption<string> & { code: string })[]>([]);
  readonly catalogoEmpresasCaido = signal(false);

  /** Municipio de residencia (VS_BO_MUNICIPALITY), colgado de su departamento. */
  private readonly municipios = inject(BoMunicipalitiesCatalog);
  readonly arbolMunicipios = signal<readonly TreeSelectGroup<string>[]>([]);
  readonly catalogoMunicipiosCaido = signal(false);

  /**
   * Las páginas del alta de paciente.
   *
   * El orden no es el del formulario viejo partido en trozos: empieza por el
   * documento porque es con lo que va a entrar —y si ya tiene cuenta, el choque
   * salta en la primera página y no después de escribir doce campos—, sigue por
   * quién es, después por lo que hace falta para atenderlo, y termina por la
   * contraseña, que es lo único que no se puede corregir después desde el
   * perfil.
   *
   * Pasa por `paginarCampos` aunque ninguna sección llegue a cinco campos: es
   * la función la que hace cumplir el tope, y declararlo a mano sería confiar en
   * que quien agregue el campo trece se acuerde de contar.
   */
  readonly paginasPaciente = computed<readonly PaginaDeFormulario[]>(() =>
    paginarCampos([
      {
        titulo: 'Tu documento de identidad',
        clave: 'documento',
        hint: 'Es lo primero que preguntamos: si ya tenés cuenta, te lo decimos acá y no después de llenar todo.',
        campos: [
          {
            key: 'nationalId',
            label: 'Documento de identidad',
            hint: 'Con este número vas a iniciar sesión.',
            control: 'text',
            required: true,
            // Es el identificador con el que va a entrar: `username`.
            autocomplete: 'username',
            placeholder: '1234567',
            testId: 'registro-documento',
            icono: 'patients',
            // Medio renglón: el número y su expedición son UN documento
            // escrito en dos casillas. Ver `campoDepartamentoEmisor`.
            ancho: 'mitad',
            mensajeDeError: 'Ingresá tu documento: letras, números, punto y guion.',
          },
          // Pegado al documento porque es un dato DE ese documento: la
          // terminación «SC», «LP»… que distingue dos cédulas homónimas. Y en
          // la MISMA LÍNEA, no debajo: separados en dos renglones se leían como
          // dos preguntas distintas, y la segunda se contestaba mal o no se
          // contestaba.
          this.campoDepartamentoEmisor('registro-departamento-ci'),
        ],
      },
      {
        titulo: '¿Cómo te llamás?',
        clave: 'nombre',
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
            placeholder: 'Mamani',
            testId: 'registro-apellido-paterno',
            ancho: 'mitad',
            mensajeDeError: 'Ingresá tu apellido paterno.',
          },
          {
            key: 'motherLastName',
            label: 'Apellido materno',
            hint: 'Si no llevás, dejalo vacío.',
            control: 'text',
            autocomplete: 'family-name',
            placeholder: 'Quispe',
            testId: 'registro-apellido-materno',
            ancho: 'mitad',
          },
        ],
      },
      {
        titulo: 'Contanos un poco sobre vos',
        clave: 'perfil',
        hint: 'Todo esto es opcional, y sirve para atenderte mejor.',
        campos: [
          {
            key: 'birthDate',
            label: 'Fecha de nacimiento (opcional)',
            // La edad sale sola de la fecha —el registro del cliente la pide
            // así (módulo Paciente §1.5)— y se dice acá mismo, debajo del
            // campo: es la forma de que quien la escribió vea si se equivocó de
            // año antes de seguir.
            hint: this.edadEnPalabras() ?? 'Sirve para calcular dosis y valores de referencia.',
            control: 'date',
            maxDate: 'today',
            minDate: new Date(1900, 0, 1),
          },
          {
            key: 'sexAtBirth',
            label: 'Género (opcional)',
            hint: 'Dato clínico: cambia las dosis, los valores de referencia y los tamizajes.',
            control: 'select',
            options: OPCIONES_GENERO,
            placeholder: 'Sin especificar',
            testId: 'registro-genero',
          },
          this.campoOcupacion(),
          ...this.campoOtraOcupacion(),
        ],
      },
      {
        titulo: '¿Dónde vivís?',
        clave: 'domicilio',
        hint: 'Opcional. Sirve para encontrarte farmacias y laboratorios cerca.',
        campos: [
          {
            key: 'municipio',
            label: 'Municipio (opcional)',
            hint: 'Buscá tu municipio, o abrí tu departamento.',
            control: 'custom',
          },
          {
            key: 'homeAddressLines',
            label: 'Calle y número (opcional)',
            hint: 'Como se lo dirías a quien te trae algo a casa.',
            control: 'text',
            autocomplete: 'street-address',
            placeholder: 'Av. Banzer, 3er anillo #42',
            testId: 'registro-domicilio-calle',
          },
          {
            key: 'gpsDomicilio',
            label: 'Ubicación exacta (opcional)',
            hint: 'Si la compartís, el delivery llega sin llamarte.',
            control: 'custom',
          },
        ],
      },
      {
        titulo: '¿Dónde trabajás?',
        clave: 'trabajo',
        hint: 'Opcional. Con el nombre de la empresa alcanza.',
        campos: [this.campoEmpresa(), ...this.campoOtraEmpresa()],
      },
      {
        titulo: 'Tu seguro de salud',
        clave: 'seguro',
        hint: 'Opcional. Si tenés los dos, podés declararlos.',
        campos: [
          this.campoSeguro('privado'),
          this.campoSeguro('publico'),
          {
            key: 'billingTaxId',
            label: 'NIT para facturas (opcional)',
            hint: 'Sólo el número. Lo usamos para las facturas que recibís.',
            control: 'text',
            placeholder: '1023456789',
            testId: 'registro-nit',
            mensajeDeError: 'El NIT es sólo números.',
          },
        ],
      },
      {
        titulo: 'Tu tutor o persona de confianza',
        clave: 'tutor',
        hint: 'Opcional. A quién avisamos si hace falta, o quién te acompaña si sos menor.',
        campos: [
          {
            key: 'guardianName',
            label: 'Nombre (opcional)',
            control: 'text',
            placeholder: 'Rosa Quispe',
            testId: 'registro-tutor-nombre',
          },
          {
            key: 'guardianPhone',
            label: 'Su teléfono (opcional)',
            hint: 'Elegí el país si el número no es de Bolivia.',
            control: 'tel',
            testId: 'registro-tutor-telefono',
            mensajeDeError: 'Para guardar el teléfono, contanos también su nombre.',
          },
        ],
      },
      {
        titulo: 'Tu acceso',
        clave: 'acceso',
        hint: 'La contraseña con la que vas a entrar, y cómo contactarte.',
        campos: [
          {
            key: 'password',
            label: 'Contraseña',
            hint: 'Al menos 8 caracteres.',
            control: 'password',
            required: true,
            autocomplete: 'new-password',
            placeholder: 'Tu contraseña',
            testId: 'registro-password',
            icono: 'lock',
            mensajeDeError: 'La contraseña necesita al menos 8 caracteres.',
          },
          {
            key: 'email',
            label: 'Correo (opcional)',
            hint: 'Sirve para contactarte. No hace falta para entrar.',
            // `email` y no `username`: acá el correo NO es con lo que entra.
            control: 'email',
            autocomplete: 'email',
            placeholder: 'correo@ejemplo.com',
            testId: 'registro-correo',
            icono: 'mail',
            mensajeDeError: 'Ese correo no tiene un formato válido.',
          },
          {
            key: 'phone',
            label: 'Teléfono (opcional)',
            hint: 'Elegí el país si tu número no es de Bolivia.',
            // `tel` lo dibuja `app-phone-input`: ver el motor.
            control: 'tel',
            autocomplete: 'tel',
            testId: 'registro-telefono',
            icono: 'phone',
            mensajeDeError: 'El número está incompleto para el país elegido.',
          },
        ],
      },
    ]),
  );

  /**
   * Las páginas del alta de profesional.
   *
   * Son cinco y no cuatro porque el profesional aporta más datos, y el límite es
   * de **campos por página**, no de páginas: apretar seis en una para tener una
   * página menos es justamente lo que este motor vino a deshacer.
   */
  readonly paginasProfesional = computed<readonly PaginaDeFormulario[]>(() =>
    paginarCampos([
      {
        titulo: '¿Cómo te llamás?',
        clave: 'nombre',
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
        titulo: 'Tus datos',
        clave: 'documento',
        hint: 'Todo opcional: se guarda en tu perfil profesional.',
        campos: [
          {
            key: 'nationalId',
            label: 'Cédula de identidad (opcional)',
            hint: 'Se guarda como tu documento oficial.',
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
          {
            key: 'birthDate',
            label: 'Fecha de nacimiento (opcional)',
            control: 'date',
            maxDate: 'today',
            minDate: new Date(1900, 0, 1),
          },
          {
            key: 'municipio',
            label: '¿Dónde vivís? (opcional)',
            hint: 'Buscá tu municipio, o abrí tu departamento.',
            control: 'custom',
          },
        ],
      },
      {
        titulo: 'Tu habilitación para ejercer',
        clave: 'habilitacion',
        hint: 'Sin matrícula y número de colegio no podemos darte de alta.',
        campos: [
          {
            key: 'licenseNumber',
            label: 'Número de matrícula',
            hint: 'La que te habilita a ejercer, la del registro del Ministerio.',
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
            label: 'Número de credencial',
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
            label: 'Autoridad reguladora (opcional)',
            hint: 'Quién emitió tu matrícula.',
            control: 'select',
            options: OPCIONES_AUTORIDAD_REGULADORA,
            placeholder: 'Sin especificar',
            testId: 'registro-pro-autoridad',
          },
          {
            key: 'licenseIssueDate',
            label: 'Fecha de inscripción de la matrícula (opcional)',
            hint: 'Cuándo te registraste, no cuándo vence.',
            control: 'date',
          },
        ],
      },
      {
        titulo: 'Tu práctica',
        clave: 'practica',
        hint: 'Lo que van a ver tus pacientes. Podés completarlo después.',
        campos: [
          {
            key: 'professionalTitle',
            label: 'Título profesional (opcional)',
            hint: 'Cómo aparecés en tu ficha. Al elegirlo, la lista de especialidades y el colegio se acomodan solos.',
            control: 'custom',
          },
          {
            key: 'phone',
            label: 'Teléfono (opcional)',
            hint: 'Elegí el país si tu número no es de Bolivia.',
            control: 'tel',
            autocomplete: 'tel',
            testId: 'registro-pro-telefono',
            icono: 'phone',
            mensajeDeError: 'El número está incompleto para el país elegido.',
          },
        ],
      },
      // Página propia y no cuatro campos apretados en «Tu práctica»: el motor
      // existe para no volver a apretar. Y va DESPUÉS de la profesión porque
      // es la que decide qué especialidades se ofrecen.
      {
        titulo: 'Tus especialidades',
        clave: 'especialidades',
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
      {
        titulo: 'Tu acceso',
        clave: 'acceso',
        hint: 'Con este correo y esta contraseña vas a iniciar sesión.',
        campos: [
          {
            key: 'email',
            label: 'Correo profesional',
            hint: 'Con este correo vas a iniciar sesión.',
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

  /**
   * El campo de la ocupación.
   *
   * Misma mecánica que el departamento emisor: es un `select` del motor
   * mientras el catálogo esté, y pasa a `custom` si la lectura falló, para que
   * la pantalla pueda proyectar ahí el aviso con su «Reintentar». Un desplegable
   * vacío no tiene dónde decir que no cargó.
   *
   * Y por lo mismo que aquél, un fallo no bloquea el alta: el campo es
   * opcional, así que sin catálogo la persona se registra igual y completa la
   * ocupación después desde su perfil.
   */
  private campoOcupacion(): CampoDeFormulario {
    const base = {
      key: 'occupationConceptId',
      label: 'Ocupación (opcional)',
      hint: 'En qué trabajás. Ayuda a tu médico con los riesgos propios de cada oficio.',
    } as const;

    // Siempre `custom`: son cientos de ocupaciones y el registro del cliente
    // pide «una lupa de buscar» (módulo Paciente §1.4.2). Un `<select>` nativo
    // con esa lista es una tira interminable sin filtro. La pantalla proyecta
    // acá el combobox — y, si el catálogo no cargó, el aviso con «Reintentar».
    return { ...base, control: 'custom' };
  }

  /**
   * El campo de la empresa donde se trabaja.
   *
   * **Reemplazó a la ubicación del trabajo.** El alta pedía municipio, calle y
   * coordenadas del lugar de trabajo: tres campos —uno de ellos un árbol con
   * buscador, otro un permiso del navegador— para un dato que casi nadie
   * completaba y que, completado, no agrupaba a nadie. La empresa es una sola
   * pregunta, se sabe de memoria, y sí agrupa: es el eje de la salud
   * ocupacional y de los convenios corporativos.
   *
   * Siempre `custom`, por lo mismo que la ocupación: la lista tiene ciento y
   * pico de entradas y se recorre con la lupa, no con un `<select>` nativo. La
   * pantalla proyecta acá el combobox —y, si el catálogo no cargó, el aviso con
   * «Reintentar»—.
   */
  /**
   * El «¿cuál?» de la ocupación, que sólo existe si se eligió «Otra ocupación».
   *
   * Es el «dejar uno al final libre para que él pueda detallar la ocupación que
   * no encontró» del registro del cliente (módulo Paciente §1.4.1). Mismo patrón
   * que {@link campoOtraEmpresa}: entra y sale de la lista de campos en vez de
   * esconderse con CSS, porque un campo escondido igual se tabula.
   */
  private campoOtraOcupacion(): readonly CampoDeFormulario[] {
    if (!this.ocupacionEsOtra()) return [];
    return [
      {
        key: 'occupationFreeText',
        label: '¿Cuál?',
        hint: 'Escribí tu oficio como lo dirías vos.',
        control: 'text',
        placeholder: 'Apicultor',
        testId: 'registro-ocupacion-otra',
      },
    ];
  }

  private campoEmpresa(): CampoDeFormulario {
    return {
      key: 'workEmployerConceptId',
      label: 'Empresa donde trabajás (opcional)',
      hint: 'Buscá el nombre. Si no está, elegí «Otra empresa» y la escribís.',
      control: 'custom',
    };
  }

  /**
   * El «¿cuál?» del texto libre, que sólo existe si se eligió «Otra empresa».
   *
   * Devuelve una lista —vacía o de un elemento— para poder desparramarla en la
   * página: el motor pagina campos, así que aparecer y desaparecer es entrar y
   * salir de esa lista, y no un campo escondido con CSS que igual se tabula.
   */
  private campoOtraEmpresa(): readonly CampoDeFormulario[] {
    if (!this.empresaEsOtra()) return [];
    return [
      {
        key: 'workEmployerFreeText',
        label: '¿En cuál?',
        hint: 'Escribí el nombre como lo conocés.',
        control: 'text',
        placeholder: 'Ferretería San Martín',
        testId: 'registro-empresa-otra',
      },
    ];
  }

  /**
   * El campo de un seguro declarado.
   *
   * Es un `select` mientras el catálogo esté, y pasa a `custom` si la lectura
   * falló, para que la pantalla proyecte ahí el aviso con «Reintentar» — misma
   * mecánica que el departamento emisor.
   *
   * @param sector - Si es el seguro privado o el público.
   * @returns El campo, listo para el motor de páginas.
   */
  private campoSeguro(sector: 'privado' | 'publico'): CampoDeFormulario {
    const esPrivado = sector === 'privado';
    const base = esPrivado
      ? {
          key: 'privateInsurancePlanId',
          label: 'Seguro privado (opcional)',
          hint: 'La compañía con la que tenés tu póliza de salud.',
        }
      : {
          key: 'publicInsurancePlanId',
          label: 'Seguro público (opcional)',
          hint: 'La caja o el seguro estatal al que estás afiliado.',
        };

    return this.catalogoAseguradorasCaido()
      ? { ...base, control: 'custom' }
      : {
          ...base,
          control: 'select',
          options: esPrivado ? this.opcionesSeguroPrivado() : this.opcionesSeguroPublico(),
          placeholder: 'No tengo',
          testId: esPrivado ? 'registro-seguro-privado' : 'registro-seguro-publico',
        };
  }

  /* ---- Título profesional ---------------------------------------------- */

  /** Las doce opciones locales, filtradas por lo escrito en la lupa. */
  readonly titulosProfesionalesFiltrados = computed<readonly ReferenceOption[]>(() => {
    const busqueda = this.busquedaTituloProfesional().trim().toLowerCase();
    return busqueda
      ? OPCIONES_TITULO_PROFESIONAL.filter((opcion) =>
          opcion.label.toLowerCase().includes(busqueda),
        )
      : OPCIONES_TITULO_PROFESIONAL;
  });

  /** La opción elegida, para restaurar su rótulo al volver a este paso. */
  readonly tituloProfesionalSeleccionado = computed<ReferenceOption | null>(() => {
    const valor = this.tituloProfesionalElegido();
    return OPCIONES_TITULO_PROFESIONAL.find((opcion) => opcion.value === valor) ?? null;
  });

  /** Lo escrito en la lupa; nunca reemplaza al valor del `FormControl`. */
  readonly busquedaTituloProfesional = signal('');

  /**
   * Escribe la elección en el mismo control que gobierna colegio y especialidades.
   */
  elegirTituloProfesional(opcion: ReferenceOption | null): void {
    this.formProfesional.controls.professionalTitle.setValue(opcion?.value ?? '');
  }

  /**
   * Las ocupaciones que se ofrecen para lo que se escribió en la lupa.
   *
   * El filtrado es en memoria y no otra consulta: el catálogo entero ya llegó
   * —lo trae `BoOccupationsCatalog` paginado— y volver a la red por cada tecla
   * sería pagar dos veces por la misma lista.
   */
  readonly ocupacionesFiltradas = computed<readonly ReferenceOption[]>(() => {
    const busqueda = this.busquedaOcupacion().trim().toLowerCase();
    const todas = this.opcionesOcupacion();
    const elegidas = busqueda
      ? todas.filter((o) => o.label.toLowerCase().includes(busqueda))
      : todas;
    return elegidas.map((o) => ({ value: o.value, label: o.label }));
  });

  /** La ocupación elegida, para que el combobox la muestre al volver atrás. */
  readonly ocupacionElegida = computed<ReferenceOption | null>(() => {
    const id = this.formPaciente.controls.occupationConceptId.value;
    if (!id) return null;
    const opcion = this.opcionesOcupacion().find((o) => o.value === id);
    return opcion ? { value: opcion.value, label: opcion.label } : null;
  });

  /** Lo tecleado en la lupa de ocupaciones. */
  readonly busquedaOcupacion = signal('');

  /**
   * Guarda la ocupación elegida en el combobox.
   *
   * @param opcion - La ocupación elegida, o `null` si la limpió.
   */
  elegirOcupacion(opcion: ReferenceOption | null): void {
    this.formPaciente.controls.occupationConceptId.setValue(opcion?.value ?? null);
    // El signal es el que ven las páginas: un `FormControl` no avisa a un
    // `computed`, y de él depende que aparezca el «¿cuál?» de más abajo.
    this.ocupacionSeleccionada.set(opcion?.value ?? null);
    // Mismo criterio que la empresa: al dejar de ser «Otra ocupación» se borra
    // lo escrito, para que no viaje un oficio a mano que ya no describe a nadie.
    if (!this.ocupacionEsOtra()) {
      this.formPaciente.controls.occupationFreeText.setValue('');
    }
  }

  /** La ocupación elegida, en un signal: ver {@link elegirOcupacion}. */
  readonly ocupacionSeleccionada = signal<string | null>(null);

  /* ---- Edad ---------------------------------------------------------------- */

  /**
   * La fecha de nacimiento como signal.
   *
   * El motor la escribe en el `FormControl` —es su puente con
   * `app-date-picker`—, y un `FormControl` no despierta a un `computed`: sin
   * esto, la edad se calcularía una vez y no volvería a mirarse.
   */
  private readonly fechaDeNacimiento = toSignal(this.formPaciente.controls.birthDate.valueChanges, {
    initialValue: null,
  });

  /**
   * La edad que sale de la fecha, dicha en palabras, o `null` si no hay fecha.
   *
   * «La app tiene que arrojar de manera automática la edad del paciente con la
   * fecha de nacimiento ingresada» (registro del cliente, módulo Paciente §1.5).
   * Se cuenta por cumpleaños, no dividiendo días: quien nació el 30 de agosto
   * tiene un año menos hasta ese día, y un año más ese mismo día.
   */
  readonly edadEnPalabras = computed<string | null>(() => {
    const fecha = this.fechaDeNacimiento();
    if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return null;

    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();
    const cumplioEsteAno =
      hoy.getMonth() > fecha.getMonth() ||
      (hoy.getMonth() === fecha.getMonth() && hoy.getDate() >= fecha.getDate());
    if (!cumplioEsteAno) edad -= 1;

    if (edad < 0 || edad > 130) return null;
    return edad === 1 ? 'Tenés 1 año.' : `Tenés ${edad} años.`;
  });

  /**
   * Si la ocupación elegida es «Otra», la salida del catálogo.
   *
   * Es lo que destraba el «¿cuál?» escrito a mano que pide el registro del
   * cliente (módulo Paciente §1.4.1) para la ocupación que no está en la lista.
   */
  readonly ocupacionEsOtra = computed(() => {
    const id = this.ocupacionSeleccionada();
    if (id === null) return false;
    return this.opcionesOcupacion().find((o) => o.value === id)?.code === CODIGO_OCUPACION_OTRA;
  });

  /**
   * Los nombres que se agregaron después del tercero.
   *
   * Viven **sólo en la pantalla**: hay gente con cuatro y cinco nombres, y una
   * casilla fija por cada uno sería un formulario largo para todos por lo que
   * necesitan pocos. Al enviar, éstos y el segundo y el tercero se concatenan
   * en `middleName`, que es la única columna que la base tiene para los nombres
   * que no son el primero — ver {@link nombresAdicionales}.
   */
  readonly nombresExtra = signal<readonly string[]>([]);

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
   * Las tres casillas de nombre se dibujan a mano —no las dibuja el motor—
   * porque entran en un solo campo de la página. Siguen siendo los mismos
   * `FormControl`: se leen y escriben acá en vez de por `formControlName`.
   *
   * @param key - Cuál de los tres controles de nombre.
   */
  valorDeNombre(key: 'name' | 'middleName' | 'thirdName'): string {
    return this.formPaciente.controls[key].value;
  }

  /**
   * Escribe en un control de nombre desde el campo proyectado.
   *
   * @param key - Cuál de los tres controles de nombre.
   * @param valor - Lo que se escribió.
   */
  escribirNombre(key: 'name' | 'middleName' | 'thirdName', valor: string | number | null): void {
    this.formPaciente.controls[key].setValue(valor === null ? '' : String(valor));
  }

  /** Si hay que pintar en rojo el primer nombre. */
  readonly primerNombreEnRojo = computed(() => {
    const control = this.formPaciente.controls.name;
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
    const raw = this.formPaciente.getRawValue();
    return [raw.middleName, raw.thirdName, ...this.nombresExtra()]
      .map((nombre) => nombre.trim())
      .filter((nombre) => nombre !== '')
      .join(' ');
  }

  /* ---- Empresa donde trabaja --------------------------------------------- */

  /**
   * Las empresas que se ofrecen para lo que se escribió en la lupa.
   *
   * Filtrado en memoria y no otra consulta, por lo mismo que las ocupaciones:
   * el catálogo entero ya llegó paginado y volver a la red por cada tecla sería
   * pagar dos veces por la misma lista.
   */
  readonly empresasFiltradas = computed<readonly ReferenceOption[]>(() => {
    const busqueda = this.busquedaEmpresa().trim().toLowerCase();
    const todas = this.opcionesEmpresa();
    const elegidas = busqueda
      ? todas.filter((o) => o.label.toLowerCase().includes(busqueda))
      : todas;
    return elegidas.map((o) => ({ value: o.value, label: o.label }));
  });

  /** La empresa elegida, para que el combobox la muestre al volver atrás. */
  readonly empresaElegida = computed<ReferenceOption | null>(() => {
    const id = this.empresaSeleccionada();
    if (id === null) return null;
    const opcion = this.opcionesEmpresa().find((o) => o.value === id);
    return opcion ? { value: opcion.value, label: opcion.label } : null;
  });

  /**
   * Si lo elegido es la salida «no está en la lista».
   *
   * Se compara por el **código** del concepto y no por su nombre: el nombre es
   * texto que el catálogo puede reescribir mañana, y la regla dejaría de
   * cumplirse sin que nada avise.
   */
  readonly empresaEsOtra = computed(() => {
    const id = this.empresaSeleccionada();
    if (id === null) return false;
    return this.opcionesEmpresa().find((o) => o.value === id)?.code === CODIGO_EMPRESA_OTRA;
  });

  /** Lo tecleado en la lupa de empresas. */
  readonly busquedaEmpresa = signal('');

  /**
   * Guarda la empresa elegida en el combobox.
   *
   * Al dejar de ser «Otra empresa» se borra el nombre escrito: si no, quedaba
   * colgado un texto libre que ya no describe a nadie y que igual viajaba en el
   * alta.
   *
   * @param opcion - La empresa elegida, o `null` si la limpió.
   */
  elegirEmpresa(opcion: ReferenceOption | null): void {
    this.empresaSeleccionada.set(opcion?.value ?? null);
    if (!this.empresaEsOtra()) {
      this.formPaciente.controls.workEmployerFreeText.setValue('');
    }
  }

  /* ---- Seguros declarados ------------------------------------------------ */

  private readonly insurance = inject(InsuranceClient);
  private readonly plataforma = inject(PLATFORM_ID);

  /** El catálogo de aseguradoras, tal como llegó. */
  readonly catalogoAseguradoras = signal<readonly CarrierCatalogEntry[]>([]);
  readonly catalogoAseguradorasCaido = signal(false);

  /**
   * Las opciones de seguro privado, aplanadas a «Compañía — Plan».
   *
   * Se aplana porque la cobertura apunta al **plan**, y preguntar primero la
   * compañía y después el plan serían dos pasos para un dato que la mayoría
   * responde de una: casi todas las compañías publican uno solo.
   */
  readonly opcionesSeguroPrivado = computed<readonly SelectOption<string>[]>(() =>
    this.opcionesDeSeguro(false),
  );

  /** Las opciones de seguro público (CNS, CPS, SUS…). */
  readonly opcionesSeguroPublico = computed<readonly SelectOption<string>[]>(() =>
    this.opcionesDeSeguro(true),
  );

  /**
   * Aplana el catálogo a opciones de un desplegable.
   *
   * @param publicas - Si se quieren las públicas o las privadas.
   * @returns Un plan por opción, etiquetado con su compañía.
   */
  private opcionesDeSeguro(publicas: boolean): readonly SelectOption<string>[] {
    const opciones: SelectOption<string>[] = [];
    for (const carrier of this.catalogoAseguradoras()) {
      if (carrier.isPublic !== publicas) continue;
      for (const plan of carrier.plans) {
        // `BASE` es el comodín de cada compañía: se nombra por lo que es para
        // quien lo elige, no por su nombre técnico.
        const esComodin = plan.code === 'BASE';
        const soloUno = carrier.plans.length === 1;
        opciones.push({
          value: plan.id,
          label:
            soloUno || esComodin
              ? esComodin && !soloUno
                ? `${carrier.name} — Otro plan / No sé`
                : carrier.name
              : `${carrier.name} — ${plan.name}`,
        });
      }
    }
    return opciones.sort((a, b) => a.label.localeCompare(b.label, 'es'));
  }

  /* ---- Ubicación --------------------------------------------------------- */

  private readonly documento = inject(DOCUMENT);

  /**
   * Pide al navegador la ubicación del domicilio y la muestra en el mapa.
   *
   * Lo que devuelve el navegador **no se da por bueno solo**: queda dibujado
   * como un pin sobre el plano y espera a que la persona lo confirme. Antes se
   * escribía el par de coordenadas en pantalla —«-17,7833, -63,1821»—, que no
   * le permite a nadie darse cuenta de si el punto cayó en su casa o a cuatro
   * cuadras; sobre el mapa se ve de un vistazo.
   *
   * Nunca bloquea el alta: si el navegador no la da —porque no hay API, porque
   * se corre en el servidor, o porque la persona dijo que no— se anota el
   * rechazo y el formulario sigue como estaba. La ubicación es una comodidad,
   * no un requisito.
   */
  usarMiUbicacion(): void {
    const geo = this.documento.defaultView?.navigator?.geolocation;
    if (!geo) {
      this.gpsRechazado.set(true);
      return;
    }

    this.pidiendoGps.set(true);
    // Volver a pedirla es empezar de nuevo: lo confirmado antes valía para el
    // punto anterior, no para el que está por llegar.
    this.direccionConfirmada.set(false);
    geo.getCurrentPosition(
      (posicion) => {
        this.gpsDomicilio.set({
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        });
        this.gpsRechazado.set(false);
        this.pidiendoGps.set(false);
      },
      () => {
        this.gpsRechazado.set(true);
        this.pidiendoGps.set(false);
      },
      {
        enableHighAccuracy: false,
        timeout: GPS_TIMEOUT_MS,
        maximumAge: GPS_MAX_AGE_MS,
      },
    );
  }

  /**
   * Da por buena la dirección que muestra el mapa.
   *
   * Es lo que convierte un punto capturado en un dato del alta: hasta que
   * alguien mira el plano y dice que sí, lo que hay es una lectura del GPS, y
   * el GPS acierta la manzana, no la puerta.
   */
  confirmarDireccionActual(): void {
    if (this.gpsDomicilio() === null) return;
    this.direccionConfirmada.set(true);
  }

  /** Olvida la ubicación capturada, y con ella su confirmación. */
  quitarUbicacion(): void {
    this.gpsDomicilio.set(null);
    this.direccionConfirmada.set(false);
  }

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');

  readonly registered = signal(false);
  readonly verificationSent = signal(false);

  /** Con qué va a iniciar sesión, para decírselo en la confirmación. */
  readonly accessHint = computed(() => (this.tipo() === 'paciente' ? 'tu documento' : 'tu correo'));

  /**
   * El titular de la columna de marca cambia con el tipo elegido.
   *
   * El diseño original es solo de profesional —«Potencia tu práctica médica»—,
   * pero esta pantalla sirve a los dos perfiles: prometerle eso a alguien que
   * se registra como paciente sería hablarle de otra cosa.
   */
  readonly claim = computed(() =>
    this.tipo() === 'paciente' ? 'Tu salud, en un solo lugar' : 'Potenciá tu práctica médica',
  );

  readonly tagline = computed(() =>
    this.tipo() === 'paciente'
      ? 'Llevá tu historia clínica, tus turnos y tus estudios siempre con vos.'
      : 'Sumate a la red de salud más grande de Bolivia y conectá con miles de pacientes.',
  );

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
  readonly ayudaVisible = computed<readonly TarjetaDeAyuda[]>(() => {
    const catalogo = this.tipo() === 'paciente' ? AYUDA_PACIENTE : AYUDA_PROFESIONAL;
    return catalogo[this.claveVisible()] ?? [];
  });

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
    this.cargarOcupaciones();
    this.cargarEmpresas();
    this.cargarAseguradoras();
    this.cargarEspecialidades();
    this.acomodarColegioYEspecialidades();

    // El aviso de un envío fallido se va en cuanto se corrige algo.
    //
    // Antes lo limpiaba el «Siguiente» de esta pantalla, que ya no es suyo: el
    // motor lleva su propio avance y no sabe nada de errores de la API. Se ata
    // entonces a lo único que de verdad significa «estoy corrigiendo» —que el
    // formulario cambie—, que además cubre el caso que el avance no cubría:
    // corregir en la misma página donde falló el envío.
    this.limpiarElErrorAlCorregir(this.formPaciente);
    this.limpiarElErrorAlCorregir(this.formProfesional);
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
  private limpiarElErrorAlCorregir(grupo: FormGroup): void {
    grupo.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.errorMessage() !== null) {
        this.state.set(ready(null));
      }
    });
  }

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
        this.arbolMunicipios.set(ramas.map((rama) => this.aGrupo(rama)));
      },
      error: () => {
        this.arbolMunicipios.set([]);
        this.catalogoMunicipiosCaido.set(true);
      },
    });
  }

  private aGrupo(rama: RamaDepartamento): TreeSelectGroup<string> {
    return {
      label: rama.nombre,
      items: rama.municipios.map((municipio) => ({
        value: municipio.conceptId,
        label: municipio.nombre,
      })),
    };
  }

  /**
   * Trae el catálogo de ocupaciones de Bolivia, para «¿en qué trabajás?».
   *
   * Mismo criterio que los departamentos ante un fallo: el campo es opcional y
   * el alta sigue.
   */
  protected cargarOcupaciones(): void {
    this.ocupaciones.listar().subscribe({
      next: (opciones) => {
        this.catalogoOcupacionesCaido.set(false);
        // El `code` viaja por lo mismo que en las empresas: es lo que
        // identifica a la salida «Otra ocupación» sin atarse al texto visible.
        this.opcionesOcupacion.set(
          opciones.map((opcion) => ({
            value: opcion.conceptId,
            label: opcion.display,
            code: opcion.code,
          })),
        );
      },
      error: () => {
        this.opcionesOcupacion.set([]);
        this.catalogoOcupacionesCaido.set(true);
      },
    });
  }

  /**
   * Trae el catálogo de aseguradoras para los dos campos de seguro.
   *
   * Es una lectura pública —se hace antes de que exista la cuenta— y un fallo
   * no bloquea: los dos campos son opcionales y la cobertura se puede declarar
   * después.
   */
  protected cargarAseguradoras(): void {
    // Bajo SSR no se pide nada, por lo mismo que los catálogos de terminología:
    // el registro es una ruta pública y prerenderizada, y durante el prerender
    // no hay API a la que preguntar. En el navegador, tras hidratar, se pide de
    // verdad. Sin esta guarda el build de producción falla al prerenderizar.
    if (!isPlatformBrowser(this.plataforma)) {
      return;
    }

    this.insurance.listCarrierCatalog().subscribe({
      next: (carriers) => {
        this.catalogoAseguradorasCaido.set(false);
        this.catalogoAseguradoras.set(carriers);
      },
      error: () => {
        this.catalogoAseguradoras.set([]);
        this.catalogoAseguradorasCaido.set(true);
      },
    });
  }

  /** Vuelve a pedir el catálogo de aseguradoras tras un fallo. */
  reintentarAseguradoras(): void {
    this.cargarAseguradoras();
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

  /** Reintenta la lectura del catálogo de ocupaciones. Ver `reintentarDepartamentos`. */
  protected reintentarOcupaciones(): void {
    this.ocupaciones.olvidar();
    this.cargarOcupaciones();
  }

  /**
   * Trae el catálogo de empresas de Bolivia, para «¿dónde trabajás?».
   *
   * Mismo criterio que las ocupaciones ante un fallo: el campo es opcional, así
   * que sin catálogo la persona se registra igual y completa la empresa después
   * desde su perfil.
   *
   * Se guarda el `code` además del uuid porque es lo que identifica a la salida
   * «Otra empresa» sin depender de cómo se llame en pantalla.
   */
  protected cargarEmpresas(): void {
    this.empresas.listar().subscribe({
      next: (opciones) => {
        this.catalogoEmpresasCaido.set(false);
        this.opcionesEmpresa.set(
          opciones.map((opcion) => ({
            value: opcion.conceptId,
            label: opcion.display,
            code: opcion.code,
          })),
        );
      },
      error: () => {
        this.opcionesEmpresa.set([]);
        this.catalogoEmpresasCaido.set(true);
      },
    });
  }

  /** Reintenta la lectura del catálogo de empresas. Ver `reintentarDepartamentos`. */
  protected reintentarEmpresas(): void {
    this.empresas.olvidar();
    this.cargarEmpresas();
  }

  /** Reintenta la lectura del árbol de municipios. Ver `reintentarDepartamentos`. */
  protected reintentarMunicipios(): void {
    this.municipios.olvidar();
    this.cargarMunicipios();
    // El árbol arrastra el catálogo de departamentos, que `olvidar()` también
    // limpia: se recarga para que el desplegable de emisión no quede vacío.
    this.cargarDepartamentos();
  }

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

    return this.tipo() === 'paciente' ? this.submitPaciente() : this.submitProfesional();
  }

  /**
   * Lleva al login en vez de iniciar sesión sola.
   *
   * Ninguno de los dos endpoints devuelve tokens —devuelven los identificadores
   * del perfil—, así que entrar automáticamente exigiría un segundo viaje con
   * las credenciales recién escritas.
   */
  goToLogin(): void {
    void this.router.navigateByUrl('/auth');
  }

  private submitPaciente(): void {
    if (this.formPaciente.invalid) {
      this.formPaciente.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.auth.registerPatient(this.datosPaciente()).subscribe({
      next: (resultado) => {
        this.state.set(ready(null));
        this.verificationSent.set(resultado.emailVerificationSent);
        this.registered.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  private submitProfesional(): void {
    if (this.formProfesional.invalid) {
      this.formProfesional.markAllAsTouched();
      return;
    }

    this.state.set(loading());

    this.iam.registerPractitioner(this.datosProfesional()).subscribe({
      next: () => {
        this.state.set(ready(null));
        // El alta de profesional no encola verificación de correo.
        this.verificationSent.set(false);
        this.registered.set(true);
      },
      error: (error: unknown) => this.state.set(errorToViewState<null>(error)),
    });
  }

  private datosPaciente(): PatientRegistration {
    const raw = this.formPaciente.getRawValue();
    const correo = raw.email.trim();
    const nombresAdicionales = this.nombresAdicionales();
    const apellidoMaterno = raw.motherLastName.trim();
    const documento = raw.nationalId.trim();
    const telefono = raw.phone.trim();
    const ocupacion = raw.occupationConceptId;
    const fechaNacimiento = raw.birthDate;
    const departamento = raw.issuerAdministrativeAreaConceptId;
    const sexoAlNacer = raw.sexAtBirth;
    const municipio = this.municipioPaciente();
    const calleDomicilio = raw.homeAddressLines.trim();
    const empresa = this.empresaSeleccionada();
    const otraEmpresa = raw.workEmployerFreeText.trim();
    // Sólo viaja lo confirmado sobre el mapa: un punto capturado y no mirado es
    // una lectura del GPS, no la dirección de nadie.
    const gpsCasa = this.direccionConfirmada() ? this.gpsDomicilio() : null;
    const nombreTutor = raw.guardianName.trim();
    const telefonoTutor = raw.guardianPhone.trim();
    const seguroPrivado = raw.privateInsurancePlanId;
    const seguroPublico = raw.publicInsurancePlanId;
    const nit = raw.billingTaxId.trim();
    const otraOcupacion = this.ocupacionEsOtra() ? raw.occupationFreeText.trim() : '';

    return {
      nationalId: documento,
      name: raw.name.trim(),
      lastName: raw.lastName.trim(),
      ...(nombresAdicionales === '' ? {} : { middleName: nombresAdicionales }),
      ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      password: raw.password,
      // Ausente si no se completó: `forbidNonWhitelisted` rechaza lo que sobra,
      // y una cadena vacía no es lo mismo que la ausencia del campo.
      ...(correo === '' ? {} : { email: correo }),
      // El departamento emisor viaja atado al documento: sin CI no hay
      // identificador al que atarlo, y el backend lo escribe en la fila del
      // identificador, no en la persona. Acá el documento es obligatorio, así
      // que la única condición real es haber elegido departamento.
      ...(departamento === null ? {} : { issuerAdministrativeAreaConceptId: departamento }),
      // Sólo el municipio: el departamento de residencia lo deriva el backend
      // del código del INE, para que el par no pueda llegar incoherente.
      ...(municipio === null ? {} : { residenceMunicipalityConceptId: municipio }),
      ...(fechaNacimiento === null ? {} : { birthDate: fechaIso(fechaNacimiento) }),
      ...(telefono === '' ? {} : { phone: telefono }),
      ...(sexoAlNacer === null ? {} : { sexAtBirth: sexoAlNacer }),
      // Con «Otra ocupación» viaja el oficio escrito y NO el concepto: el
      // backend descarta el texto libre en cuanto recibe un concepto
      // (`occupationFreeText: dto.occupationConceptId ? undefined : …`), y de
      // los dos datos el que dice algo es el que la persona escribió — «Otra»
      // no describe ningún oficio. Sin «Otra», viaja el concepto y nada más.
      ...(ocupacion === null || this.ocupacionEsOtra() ? {} : { occupationConceptId: ocupacion }),
      ...(otraOcupacion === '' ? {} : { occupationFreeText: otraOcupacion }),
      // Domicilio: calle y coordenadas, cada una por su cuenta. La calle sin
      // municipio es un dato válido —mucha gente sabe su dirección y no el
      // nombre de su municipio—, así que no se condicionan entre sí.
      ...(calleDomicilio === '' ? {} : { homeAddressLines: calleDomicilio }),
      ...(gpsCasa === null ? {} : { homeLatitude: gpsCasa.lat, homeLongitude: gpsCasa.lng }),
      // Trabajo: la empresa, y nada más. El municipio, la calle y las
      // coordenadas del trabajo ya no se preguntan — ver `campoEmpresa`.
      ...(empresa === null ? {} : { workEmployerConceptId: empresa }),
      // El nombre a mano sólo acompaña a «Otra empresa»: con cualquier otra
      // elegida sería un texto que contradice al concepto.
      ...(this.empresaEsOtra() && otraEmpresa !== ''
        ? { workEmployerFreeText: otraEmpresa }
        : {}),
      // El teléfono del tutor sólo viaja con su nombre: el backend rechaza un
      // contacto sin dueño, y el formulario ya lo impide antes de llegar acá.
      ...(nombreTutor === '' ? {} : { guardianName: nombreTutor }),
      ...(nombreTutor === '' || telefonoTutor === '' ? {} : { guardianPhone: telefonoTutor }),
      ...(seguroPrivado === null ? {} : { privateInsurancePlanId: seguroPrivado }),
      ...(seguroPublico === null ? {} : { publicInsurancePlanId: seguroPublico }),
      ...(nit === '' ? {} : { billingTaxId: nit }),
    };
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

    return {
      email: raw.email.trim(),
      password: raw.password,
      name: raw.name.trim(),
      lastName: raw.lastName.trim(),
      ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
      ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      ...(fechaNacimiento === null ? {} : { birthDate: fechaIso(fechaNacimiento) }),
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
