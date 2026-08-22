import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
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

/** Dígitos, espacios, paréntesis, `+` y guion — el mismo `@Matches` del backend. */
const TELEFONO_VALIDO = /^[+]?[0-9 ()-]{6,}$/;

/** Tope de la ocupación en texto libre, el mismo `@MaxLength` del backend. */
const MAX_OCUPACION = 200;

/**
 * Sexo al nacer, con sus etiquetas en castellano.
 *
 * Va como lista fija y no como lectura de terminología —a diferencia de los
 * departamentos— porque la API lo recibe **por código legible**
 * (`sexAtBirth: 'FEMALE'`), no por uuid de concepto: pedir el catálogo sólo
 * para pintar cuatro etiquetas agregaría una petición y un estado de fallo a
 * una pantalla pública, sin ganar nada. Los códigos son los que valida el
 * `@IsIn` del backend; el mapeo a concepto lo hace él.
 *
 * **El género administrativo ya no se pregunta.** Se preguntaba al lado de
 * éste, y la pantalla terminaba pidiendo dos veces algo que la persona lee como
 * lo mismo. De los dos, el que tiene consecuencia clínica —dosis, valores de
 * referencia, tamizajes— es el sexo al nacer, así que es el que se queda. El
 * campo `gender` del DTO sigue existiendo y otros clientes lo pueden mandar;
 * este formulario no lo manda, y ausente no es lo mismo que vacío.
 */
const OPCIONES_SEXO_AL_NACER: readonly SelectOption<BirthSexCode>[] = [
  { value: 'FEMALE', label: 'Femenino' },
  { value: 'MALE', label: 'Masculino' },
  { value: 'INTERSEX', label: 'Intersexual' },
  { value: 'UNKNOWN', label: 'Prefiero no decirlo' },
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
    // Mismo patrón que el backend (`@Matches` de `phone`): dígitos, espacios,
    // paréntesis, `+` y guion. Validarlo acá evita un viaje a la API para
    // enterarse de algo que se ve en el campo.
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(TELEFONO_VALIDO)],
    }),
    // Ocupación en texto libre: ver `PatientRegistration.occupationFreeText`
    // sobre por qué todavía no es un catálogo.
    occupationFreeText: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(MAX_OCUPACION)],
    }),
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

  /** La lista fija, expuesta a la plantilla. */
  protected readonly opcionesSexoAlNacer = OPCIONES_SEXO_AL_NACER;

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
    // Quién emitió la matrícula: Ministerio de Salud y Deportes para la
    // mayoría de las especialidades médicas, o el Colegio de Odontólogos para
    // quien ejerce odontología. Texto libre porque no todas las jurisdicciones
    // ni todos los colegios departamentales caben en un catálogo cerrado.
    regulatoryAuthority: new FormControl('', { nonNullable: true }),
    professionalTitle: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
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
          },
          {
            key: 'sexAtBirth',
            label: 'Sexo al nacer (opcional)',
            control: 'select',
            options: OPCIONES_SEXO_AL_NACER,
            placeholder: 'Sin especificar',
            testId: 'registro-sexo-al-nacer',
          },
          {
            key: 'municipio',
            label: '¿Dónde vivís? (opcional)',
            hint: 'Buscá tu municipio, o abrí tu departamento.',
            control: 'custom',
          },
          {
            key: 'occupationFreeText',
            label: 'Ocupación (opcional)',
            control: 'text',
            autocomplete: 'organization-title',
            placeholder: 'Docente',
            testId: 'registro-ocupacion',
          },
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
            mensajeDeError: 'Ese correo no tiene un formato válido.',
          },
          {
            key: 'phone',
            label: 'Teléfono (opcional)',
            // `tel` sale como `type="text"` en el motor, con el `autocomplete`
            // haciendo el trabajo: ver `tipoDeInput` de `app-paginated-form`.
            control: 'tel',
            autocomplete: 'tel',
            placeholder: '+591 70012345',
            testId: 'registro-telefono',
            mensajeDeError: 'Dígitos, espacios, paréntesis, + y guion.',
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
            mensajeDeError: 'Letras, números, punto y guion.',
          },
          this.campoDepartamentoEmisor('registro-pro-departamento-ci'),
          {
            key: 'birthDate',
            label: 'Fecha de nacimiento (opcional)',
            control: 'date',
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
            control: 'text',
            required: true,
            autocomplete: 'off',
            placeholder: 'MP-12345',
            testId: 'registro-pro-matricula',
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
            mensajeDeError: 'Ingresá el número de tu colegio.',
          },
          {
            key: 'regulatoryAuthority',
            label: 'Autoridad reguladora (opcional)',
            hint: 'Ministerio de Salud y Deportes, o Colegio de Odontólogos si tu especialidad es odontología.',
            control: 'text',
            autocomplete: 'off',
            placeholder: 'Ministerio de Salud y Deportes',
            testId: 'registro-pro-autoridad',
          },
          {
            key: 'licenseIssueDate',
            label: 'Fecha de inscripción de la matrícula (opcional)',
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
            control: 'text',
            autocomplete: 'off',
            placeholder: 'Cardiología',
            testId: 'registro-pro-titulo',
          },
          {
            key: 'phone',
            label: 'Teléfono (opcional)',
            control: 'tel',
            autocomplete: 'tel',
            placeholder: '+591 70012345',
            testId: 'registro-pro-telefono',
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
    const ocupacion = raw.occupationFreeText.trim();
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
      ...(ocupacion === '' ? {} : { occupationFreeText: ocupacion }),
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
