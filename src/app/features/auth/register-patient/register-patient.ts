import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import { BoOccupationsCatalog } from '../../../core/data-access/terminology/bo-occupations.service';
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

/**
 * La forma única en que este formulario compone un teléfono: `+591` y ocho
 * dígitos.
 *
 * Es **más estrecho** que el `@Matches` del backend —que acepta espacios,
 * paréntesis y guiones— y a propósito: quien escribe ya no elige el formato,
 * lo compone `app-phone-input`, así que lo único que puede fallar es que el
 * número esté incompleto. Validar acá lo que el campo produce evita el caso en
 * que el control deja pasar cuatro dígitos y el error llega de la API.
 */
const TELEFONO_BOLIVIANO = /^\+591 [0-9]{8}$/;

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
  { value: 'Servicio Departamental de Salud (SEDES)', label: 'Servicio Departamental de Salud (SEDES)' },
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
  { value: 'Médico especialista / Médica especialista', label: 'Médico especialista / Médica especialista' },
  { value: 'Odontólogo / Odontóloga', label: 'Odontólogo / Odontóloga' },
  { value: 'Licenciado / Licenciada en Enfermería', label: 'Licenciado / Licenciada en Enfermería' },
  {
    value: 'Licenciado / Licenciada en Bioquímica y Farmacia',
    label: 'Licenciado / Licenciada en Bioquímica y Farmacia',
  },
  { value: 'Licenciado / Licenciada en Nutrición', label: 'Licenciado / Licenciada en Nutrición' },
  { value: 'Licenciado / Licenciada en Psicología', label: 'Licenciado / Licenciada en Psicología' },
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

  readonly formPaciente = new FormGroup({
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
    lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    motherLastName: new FormControl('', { nonNullable: true }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(MIN_PASSWORD)],
    }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    // El control guarda lo que `app-phone-input` compone —`+591` y ocho
    // dígitos—, así que el validador comprueba justamente eso: ver
    // `TELEFONO_BOLIVIANO`.
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(TELEFONO_BOLIVIANO)],
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
  });

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
      validators: [Validators.pattern(TELEFONO_BOLIVIANO)],
    }),
    birthDate: new FormControl<Date | null>(null),
    licenseIssueDate: new FormControl<Date | null>(null),
    issuerAdministrativeAreaConceptId: new FormControl<string | null>(null),
  });

  /** El municipio de residencia del profesional. Ver el del paciente. */
  readonly municipioProfesional = signal<string | null>(null);

  /** Departamento que emitió el documento (VS_BO_DEPARTMENT), y su catálogo. */
  private readonly departamentos = inject(BoDepartmentsCatalog);
  readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);
  readonly catalogoDepartamentosCaido = signal(false);

  /** Ocupación del paciente (VS_BO_OCCUPATION), y su catálogo. */
  private readonly ocupaciones = inject(BoOccupationsCatalog);
  readonly opcionesOcupacion = signal<readonly SelectOption<string>[]>([]);
  readonly catalogoOcupacionesCaido = signal(false);

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
            mensajeDeError: 'Ingresá tu documento: letras, números, punto y guion.',
          },
          // Pegado al documento porque es un dato DE ese documento: la
          // terminación «SC», «LP»… que distingue dos cédulas homónimas.
          this.campoDepartamentoEmisor('registro-departamento-ci'),
        ],
      },
      {
        titulo: '¿Cómo te llamás?',
        hint: 'Como figura en tu documento. Si no tenés alguno, dejalo vacío.',
        campos: [
          {
            key: 'name',
            label: 'Nombre',
            control: 'text',
            required: true,
            autocomplete: 'given-name',
            placeholder: 'Lucía',
            testId: 'registro-nombre',
            mensajeDeError: 'Ingresá tu nombre.',
          },
          {
            key: 'middleName',
            label: 'Segundo nombre',
            hint: 'Si no tenés, dejalo vacío.',
            control: 'text',
            autocomplete: 'additional-name',
            placeholder: 'Andrea',
            testId: 'registro-segundo-nombre',
          },
          {
            key: 'lastName',
            label: 'Apellido paterno',
            control: 'text',
            required: true,
            autocomplete: 'family-name',
            placeholder: 'Mamani',
            testId: 'registro-apellido-paterno',
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
          },
        ],
      },
      {
        titulo: 'Contanos un poco sobre vos',
        hint: 'Todo esto es opcional, y sirve para atenderte mejor.',
        campos: [
          {
            key: 'birthDate',
            label: 'Fecha de nacimiento (opcional)',
            hint: 'Sirve para calcular dosis y valores de referencia.',
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
          {
            key: 'municipio',
            label: '¿Dónde vivís? (opcional)',
            hint: 'Buscá tu municipio, o abrí tu departamento.',
            control: 'custom',
          },
          this.campoOcupacion(),
        ],
      },
      {
        titulo: 'Tu acceso',
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
            hint: 'Ocho dígitos. El +591 lo pone el campo.',
            // `tel` lo dibuja `app-phone-input`: ver el motor.
            control: 'tel',
            autocomplete: 'tel',
            placeholder: '7001 2345',
            testId: 'registro-telefono',
            icono: 'phone',
            mensajeDeError: 'Ingresá los ocho dígitos de tu teléfono.',
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
        hint: 'Como figura en tu documento. Si no tenés alguno, dejalo vacío.',
        campos: [
          {
            key: 'name',
            label: 'Nombre',
            control: 'text',
            required: true,
            autocomplete: 'given-name',
            placeholder: 'Ana',
            testId: 'registro-pro-nombre',
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
          },
          {
            key: 'lastName',
            label: 'Apellido paterno',
            control: 'text',
            required: true,
            autocomplete: 'family-name',
            placeholder: 'Rojas',
            testId: 'registro-pro-apellido-paterno',
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
          },
        ],
      },
      {
        titulo: 'Tus datos',
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
        hint: 'Lo que van a ver tus pacientes. Podés completarlo después.',
        campos: [
          {
            key: 'professionalTitle',
            label: 'Título profesional (opcional)',
            hint: 'Cómo aparecés en tu ficha. Tu especialidad se elige después, desde el perfil.',
            control: 'select',
            options: OPCIONES_TITULO_PROFESIONAL,
            placeholder: 'Sin especificar',
            testId: 'registro-pro-titulo',
          },
          {
            key: 'phone',
            label: 'Teléfono (opcional)',
            hint: 'Ocho dígitos. El +591 lo pone el campo.',
            control: 'tel',
            autocomplete: 'tel',
            placeholder: '7001 2345',
            testId: 'registro-pro-telefono',
            icono: 'phone',
            mensajeDeError: 'Ingresá los ocho dígitos de tu teléfono.',
          },
        ],
      },
      {
        titulo: 'Tu acceso',
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
      ? { ...base, control: 'custom' }
      : {
          ...base,
          control: 'select',
          options: this.opcionesDepartamento(),
          placeholder: 'Sin especificar',
          testId,
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

    return this.catalogoOcupacionesCaido()
      ? { ...base, control: 'custom' }
      : {
          ...base,
          control: 'select',
          options: this.opcionesOcupacion(),
          placeholder: 'Sin especificar',
          testId: 'registro-ocupacion',
        };
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
        this.opcionesOcupacion.set(
          opciones.map((opcion) => ({ value: opcion.conceptId, label: opcion.display })),
        );
      },
      error: () => {
        this.opcionesOcupacion.set([]);
        this.catalogoOcupacionesCaido.set(true);
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
    const segundoNombre = raw.middleName.trim();
    const apellidoMaterno = raw.motherLastName.trim();
    const documento = raw.nationalId.trim();
    const telefono = raw.phone.trim();
    const ocupacion = raw.occupationConceptId;
    const fechaNacimiento = raw.birthDate;
    const departamento = raw.issuerAdministrativeAreaConceptId;
    const sexoAlNacer = raw.sexAtBirth;
    const municipio = this.municipioPaciente();

    return {
      nationalId: documento,
      name: raw.name.trim(),
      lastName: raw.lastName.trim(),
      ...(segundoNombre === '' ? {} : { middleName: segundoNombre }),
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
      ...(ocupacion === null ? {} : { occupationConceptId: ocupacion }),
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
    };
  }
}
