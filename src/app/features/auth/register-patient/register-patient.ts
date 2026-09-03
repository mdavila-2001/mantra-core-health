import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
  type WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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
import { telefonoCompleto } from '../../../shared/components/molecules/phone-input/phone-input';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../core/data-access/terminology/bo-municipalities.service';
import type {
  BirthSexCode,
  PatientRegistration,
} from '../../../core/data-access/iam/iam.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import { LocationPicker } from '../registro-compartido/location-picker/location-picker';
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
import {
  RegistroAyuda,
  type TarjetaDeAyuda,
} from '../../../shared/components/organisms/registro-ayuda/registro-ayuda';
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
 * Las cuatro señales de una ubicación declarada sobre el mapa.
 *
 * Se agrupan para que `pedirUbicacion` sirva a las dos que el alta pregunta
 * —casa y trabajo— sin duplicar el trato del permiso del navegador. No es un
 * estado compartido: son dos juegos de señales distintos, y esto es sólo cómo
 * se los nombra al pasarlos.
 */
interface DestinoDeUbicacion {
  readonly punto: WritableSignal<Coordenadas | null>;
  readonly pidiendo: WritableSignal<boolean>;
  readonly confirmada: WritableSignal<boolean>;
  readonly rechazado: WritableSignal<boolean>;
}

/**
 * El identificador del pin del domicilio en el mapa.
 *
 * `app-map` habla de sus pines por `id` y exige uno; acá hay un solo pin, así
 * que es una constante y no un dato. No es un uuid a propósito: nada del mapa
 * debe poder filtrar identificadores.
 */
const PIN_DOMICILIO = 'domicilio';

/** El pin del lugar de trabajo. Ver {@link PIN_DOMICILIO}. */
const PIN_TRABAJO = 'trabajo';

/**
 * Lo que se le dice a quien fijó un punto y espera que la calle se escriba
 * sola (AC-03-8 / AC-03-9).
 *
 * **La resolución del nombre de la dirección no está disponible, y decirlo es
 * el requisito.** Convertir un par de coordenadas en «Av. Banzer 3er anillo»
 * necesita un geocodificador externo, y la política de seguridad del servidor
 * no lo permite: `src/server/security-headers.ts` deja `connect-src` en
 * `'self'` y `img-src` sólo abierto a `tile.openstreetmap.org`, con una prueba
 * que lo fija (`security-headers.spec.ts`). Abrirla es decisión de
 * arquitectura —P-03-7 de la ficha, sin resolver: qué proveedor, con qué
 * licencia y quién paga— y no se toma desde este carril.
 *
 * Lo que AC-03-9 exige mientras tanto es exactamente esto: que el formulario lo
 * **diga** y **deje seguir**. Lo que nunca se hace es rellenar el campo con un
 * texto inventado: una dirección falsa en la ficha de un paciente es peor que
 * un campo vacío, porque nadie la vuelve a mirar.
 */
const AVISO_SIN_GEOCODIFICACION =
  'El punto del mapa se guarda tal cual, pero no podemos convertirlo en el nombre de la calle: escribila vos arriba.';

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
  document: [
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
  name: [
    {
      icono: 'people',
      titulo: 'Tu nombre, como figura en tu documento',
      texto:
        'Es lo que evita que tu historia clínica se mezcle con la de alguien que se llama parecido. Si no llevás segundo nombre o apellido materno, dejalos vacíos.',
    },
  ],
  profile: [
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
  residence: [
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
    {
      icono: 'route',
      titulo: 'La calle la escribís vos',
      texto:
        'El punto del mapa no se convierte solo en el nombre de una calle: eso necesita un servicio que hoy no tenemos. Por eso la línea de dirección se escribe a mano, y por eso nunca vas a encontrar ahí algo que no hayas escrito.',
    },
  ],
  work: [
    {
      icono: 'building',
      titulo: 'Para qué sirve dónde trabajás',
      texto:
        'Para los convenios con empresas y para los controles de salud laboral: cada oficio y cada lugar traen sus riesgos, y tu médico los tiene en cuenta.',
    },
    {
      icono: 'note',
      titulo: 'Si no está en la lista, escribila',
      texto:
        'La lista tiene las empresas más grandes del país. Si la tuya no aparece, elegí «Otra empresa» y ponés el nombre vos.',
    },
  ],
  'work-location': [
    {
      icono: 'pin',
      titulo: 'Todo esto es opcional',
      texto:
        'Si tu trabajo queda lejos de tu casa, saberlo nos deja mostrarte farmacias y laboratorios cerca de los dos sitios, no sólo de uno.',
    },
    {
      icono: 'route',
      titulo: 'La calle la escribís vos',
      texto:
        'Igual que en tu domicilio: el punto del mapa se guarda tal cual, pero el nombre de la calle lo ponés vos.',
    },
  ],
  insurance: [
    {
      icono: 'umbrella',
      titulo: 'Para que no pagues lo que ya está cubierto',
      texto:
        'Con tu seguro declarado, la cobertura se aplica cuando reservás o comprás, sin que tengas que reclamarla después.',
    },
  ],
  billing: [
    {
      icono: 'billing',
      titulo: 'El NIT es sólo para tus facturas',
      texto: 'Lo usamos cuando hay que emitir una. Si no lo tenés a mano, dejalo vacío.',
    },
  ],
  contact: [
    {
      icono: 'phone',
      titulo: 'Tu celular hace falta',
      texto:
        'Es por donde te avisamos de un turno, de un resultado listo o de un cambio de hora. No se muestra en ninguna ficha ni se comparte.',
    },
    {
      icono: 'people',
      titulo: 'A quién avisamos si hace falta',
      texto:
        'El contacto de emergencia es opcional: la persona a la que llamamos en una urgencia, o quien te acompaña si sos menor de edad. Sólo se usa para eso.',
    },
  ],
  access: [
    {
      icono: 'lock',
      titulo: 'Tu contraseña, sólo tuya',
      texto:
        'Ocho caracteres o más. Se guarda cifrada: ni el equipo de AloVida puede verla, y por eso nunca te la vamos a pedir por teléfono ni por correo.',
    },
    {
      icono: 'mail',
      titulo: 'Entrás con tu documento, no con el correo',
      texto:
        'El correo hace falta igual: es la única forma de devolverte el acceso si perdés la contraseña, y por donde te llegan los avisos de tus turnos.',
    },
  ],
};

/**
 * Alta pública de un paciente.
 *
 * ## Por qué el alta de profesional no está acá
 *
 * Estuvo, como la otra rama de un `@if`, con su propio `FormGroup` y su propia
 * lista de páginas dentro de esta misma clase. Son **dos altas distintas**, no
 * una con campos extra —el paciente entra con su documento y el correo le es
 * opcional; el profesional entra con su correo y sin habilitación comprobable
 * no hay alta—, así que lo único que compartían de verdad era el cascarón. Hoy
 * eso es CSS (`../registro-compartido/registro.css`) y un organismo
 * (`app-registro-ayuda`), y el alta de profesional es `register-practitioner`,
 * con su propia ruta.
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
    NavIcon,
    Tooltip,
    LocationPicker,
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
  styleUrls: ['../registro-compartido/registro.css', './register-patient.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPatient {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

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
      // **Obligatorio desde la TAREA 03 (AC-03-3).** Invierte una decisión
      // escrita: el correo era opcional a propósito —«podés entrar sin él, con
      // tu documento»— y el documento sigue siendo el identificador de acceso.
      // Lo que cambia es que ahora, además, hace falta una dirección de correo
      // para poder recuperar la cuenta y avisar de un turno. El pedido es
      // explícito y la inversión queda escrita acá para que se revierta a
      // sabiendas si el propietario cambia de idea (P-03-2).
      email: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.email],
      }),
      // El control guarda lo que `app-phone-input` compone —el prefijo del país
      // elegido y su número—, así que el validador comprueba justamente eso, y
      // viene del propio campo: es él quien sabe qué largo tiene cada país.
      // Obligatorio por AC-03-3.
      phone: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, telefonoCompleto],
      }),
      // La ocupación es un concepto de `VS_BO_OCCUPATION`, no un texto: ver
      // `campoOcupacion`.
      occupationConceptId: new FormControl<string | null>(null),
      // La fecha y el sexo al nacer viven **en el formulario**, no en signals
      // aparte: el motor puentea `app-date-picker` —que trabaja con `model()`—
      // contra este mismo control, y así el dato tiene una sola fuente. Tenerlo
      // en dos terminaba siempre en la que se olvidó de actualizarse.
      // Los dos son obligatorios por AC-03-3: deciden dosis, valores de
      // referencia de laboratorio y qué tamizajes corresponden por edad.
      birthDate: new FormControl<Date | null>(null, { validators: [Validators.required] }),
      sexAtBirth: new FormControl<BirthSexCode | null>(null, {
        validators: [Validators.required],
      }),
      // El departamento emisor es un `select` del motor cuando su catálogo llegó,
      // así que su valor vive donde viven los demás: en el formulario.
      issuerAdministrativeAreaConceptId: new FormControl<string | null>(null),
      // Calle y número del domicilio. Las coordenadas van aparte: no se
      // escriben, se confirman sobre el mapa.
      homeAddressLines: new FormControl('', { nonNullable: true }),
      // **La localidad de residencia es obligatoria (AC-03-3)** y por eso vive
      // en el formulario y no en un signal suelto: el motor valida de a una
      // página, y un dato fuera del `FormGroup` no lo puede frenar. El signal
      // que lo espeja (`municipioPaciente`) sigue existiendo para el grafo de
      // señales; lo escriben los dos el mismo método. Ver `elegirMunicipio`.
      residenceMunicipalityConceptId: new FormControl<string | null>(null, {
        validators: [Validators.required],
      }),
      // El lugar de trabajo **vuelve al alta** (AC-03-1). Revierte lo que
      // documenta `campoEmpresa`: se habían sacado municipio, calle y
      // coordenadas del trabajo porque casi nadie las completaba. El
      // propietario las volvió a pedir, y el DTO nunca dejó de aceptarlas.
      // Opcional, las tres.
      workMunicipalityConceptId: new FormControl<string | null>(null),
      workAddressLines: new FormControl('', { nonNullable: true }),
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
      billingLegalName: new FormControl('', {
        nonNullable: true,
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
   * El municipio de residencia, **espejado** para el grafo de señales.
   *
   * El dato vive en `formPaciente.controls.residenceMunicipalityConceptId`, que
   * es quien lo valida (es obligatorio, AC-03-3). Esto lo copia porque
   * `paginasPaciente()` es un `computed` y un `FormControl` no despierta a un
   * `computed`: sin el espejo, el mensaje de error del municipio no llegaría a
   * repintarse. Escriben los dos el mismo método —{@link elegirMunicipio}—, así
   * que no hay dos fuentes de verdad: el control manda, esto lo refleja.
   */
  readonly municipioPaciente = signal<string | null>(null);

  /** El municipio del lugar de trabajo, espejado igual. Opcional. */
  readonly municipioTrabajo = signal<string | null>(null);

  /**
   * Guarda la localidad de residencia en el control **y** en su espejo.
   *
   * Es el único escritor de los dos, que es lo que evita que se separen. Marca
   * el control como tocado porque el municipio se elige con un mapa y un
   * desplegable, no escribiendo: sin esto, quien vuelve atrás desde la página
   * siguiente vería el asterisco pero nunca el mensaje de que falta.
   *
   * @param conceptId - El municipio elegido, o `null` si se soltó.
   */
  elegirMunicipio(conceptId: string | null): void {
    this.formPaciente.controls.residenceMunicipalityConceptId.setValue(conceptId);
    this.formPaciente.controls.residenceMunicipalityConceptId.markAsTouched();
    this.municipioPaciente.set(conceptId);
  }

  /** Lo mismo, para el lugar de trabajo. Opcional: no se marca como tocado. */
  elegirMunicipioDeTrabajo(conceptId: string | null): void {
    this.formPaciente.controls.workMunicipalityConceptId.setValue(conceptId);
    this.municipioTrabajo.set(conceptId);
  }

  /**
   * El error del municipio de residencia, para pasárselo al `app-form-field`
   * que el propio `app-location-picker` dibuja.
   *
   * No sale del motor: el campo del motor no tiene rótulo —lo ponen las dos
   * partes del selector— y un error colgado de un rótulo vacío se lee flotando
   * sobre el mapa, lejos del desplegable que hay que contestar.
   */
  readonly errorDeMunicipio = computed<string>(() => {
    const control = this.formPaciente.controls.residenceMunicipalityConceptId;
    void this.municipioPaciente();
    return control.touched && control.invalid ? 'Elegí tu ciudad o municipio.' : '';
  });

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

  /* ---- La misma ubicación, para el lugar de trabajo ------------------------
     Cuatro señales gemelas de las de arriba, no una estructura compartida: el
     alta pregunta DOS ubicaciones distintas —dónde vivís y dónde trabajás— y
     cada una tiene su propio estado de «pedida / capturada / confirmada /
     negada». Lo que sí se comparte es el comportamiento: las dos pasan por
     {@link pedirUbicacion}, así que arreglar el permiso del navegador se hace
     una vez. */

  readonly gpsTrabajo = signal<Coordenadas | null>(null);
  readonly pidiendoGpsTrabajo = signal(false);
  readonly direccionTrabajoConfirmada = signal(false);
  readonly gpsTrabajoRechazado = signal(false);

  readonly pinesTrabajo = computed<readonly PinMapa[]>(() => {
    const punto = this.gpsTrabajo();
    if (punto === null) return [];
    return [
      {
        id: PIN_TRABAJO,
        lat: punto.lat,
        lng: punto.lng,
        titulo: this.direccionTrabajoConfirmada()
          ? 'Tu lugar de trabajo'
          : 'Acá te encontramos',
      },
    ];
  });

  /** Las listas fijas, expuestas a la plantilla. */
  protected readonly opcionesGenero = OPCIONES_GENERO;

  /** El aviso de AC-03-9, expuesto a la plantilla. Ver la constante. */
  protected readonly avisoSinGeocodificacion = AVISO_SIN_GEOCODIFICACION;

  /** Departamento que emitió el documento (VS_BO_DEPARTMENT), y su catálogo. */
  private readonly departamentos = inject(BoDepartmentsCatalog);
  readonly opcionesDepartamento = signal<readonly SelectOption<string>[]>([]);
  readonly catalogoDepartamentosCaido = signal(false);

  /** Ocupación del paciente (VS_BO_OCCUPATION), y su catálogo. */
  private readonly ocupaciones = inject(BoOccupationsCatalog);
  private readonly empresas = inject(BoEmployersCatalog);

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

  /**
   * Municipios (VS_BO_MUNICIPALITY), colgados de su departamento.
   *
   * Se guardan **tal como los devuelve el catálogo** —departamento con sus
   * municipios— y no traducidos a los grupos de `app-tree-select`: quien los
   * dibuja ahora es `app-location-picker`, que necesita la rama entera para
   * poder acotar el select de ciudad al departamento pulsado en el mapa
   * (AC-03-7).
   */
  private readonly municipios = inject(BoMunicipalitiesCatalog);
  readonly ramasMunicipios = signal<readonly RamaDepartamento[]>([]);
  readonly catalogoMunicipiosCaido = signal(false);

  /**
   * Las páginas del alta de paciente, en el orden que pide AC-03-1.
   *
   * ## El orden, y de dónde sale
   *
   * Nombres y apellidos → CI + expedición → fecha de nacimiento → sexo →
   * ocupación → celular → contacto de emergencia → residencia → trabajo →
   * correo → seguros → facturación. Es literalmente la lista del propietario
   * (TAREA 03 §1.1), y **reemplaza** al orden anterior, que empezaba por el
   * documento «para avisar enseguida si ya tenías cuenta». Esa razón sigue
   * siendo buena y el choque de documento repetido ahora salta un paso más
   * tarde: es el precio de un orden pedido explícitamente, y queda anotado acá
   * para que se revierta a sabiendas si se decide otra cosa.
   *
   * ## Cómo se partieron los bloques largos, y por qué
   *
   * El tope del motor es de **cuatro campos por página** y no se relaja
   * (AC-03-2, `MAX_CAMPOS_POR_PAGINA`). Dos bloques del pedido no entran:
   *
   * - **El trabajo son cinco**: nombre de la empresa, localidad, zona, calle y
   *   GPS. Se parte en dos páginas —«¿Dónde trabajás?» (la empresa) y «El lugar
   *   donde trabajás» (dónde queda)— porque son dos preguntas distintas: la
   *   primera se contesta de memoria, la segunda mirando un mapa. Partirlo por
   *   la mitad de la dirección habría dejado la calle en una página y su punto
   *   en la siguiente.
   * - **La residencia son cuatro** una vez que la zona queda fuera (ver abajo),
   *   así que entra entera. El mapa y el select de ciudad cuentan como **un**
   *   campo: son un solo dato —la localidad— con dos formas de llegar a él.
   *
   * ## Lo que el pedido incluye y esta pantalla NO pregunta
   *
   * Y no es un olvido: es que **no tiene dónde guardarse**, y un formulario que
   * pide un dato y lo tira es peor que uno que no lo pide.
   *
   * - **Zona / barrio**, en residencia y en trabajo (AC-03-10). `common.addresses`
   *   no tiene columna de zona y el DTO no tiene el campo. Acá no hay
   *   migraciones (ADR-0021): el cambio va por el pipeline del modelo, que no
   *   está disponible en este workspace.
   * - **Relación del contacto de emergencia** (AC-03-11). Es un value set que no
   *   existe en ninguna capa —ni catálogo, ni columna—, y la regla del proyecto
   *   prohíbe resolverlo con un `enum` de TypeScript.
   * - **Razón social** de facturación: Se captura mediante `billingLegalName`
   *   y viaja asociada al NIT para la emisión de facturas.
   *
   * Pasa por `paginarCampos` aunque ninguna sección llegue a cinco campos: es
   * la función la que hace cumplir el tope, y declararlo a mano sería confiar en
   * que quien agregue el campo trece se acuerde de contar.
   */
  readonly paginasPaciente = computed<readonly PaginaDeFormulario[]>(() =>
    paginarCampos([
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
        titulo: 'Tu documento de identidad',
        clave: 'document',
        icon: 'patients',
        hint: 'Con este número vas a iniciar sesión.',
        campos: [
          {
            key: 'nationalId',
            label: 'Documento de identidad',
            hint: 'Con este número vas a iniciar sesión.',
            description:
              'El número de tu cédula, sin el complemento: el departamento que la emitió va en la casilla de al lado.',
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
        titulo: 'Contanos un poco sobre vos',
        clave: 'profile',
        icon: 'stethoscope',
        hint: 'La fecha y el sexo deciden dosis, valores de laboratorio y controles por edad.',
        campos: [
          {
            key: 'birthDate',
            label: 'Fecha de nacimiento',
            // La edad sale sola de la fecha —el registro del cliente la pide
            // así (módulo Paciente §1.5)— y se dice acá mismo, debajo del
            // campo: es la forma de que quien la escribió vea si se equivocó de
            // año antes de seguir.
            hint: this.edadEnPalabras() ?? 'Sirve para calcular dosis y valores de referencia.',
            description:
              'Con ella calculamos tu edad, y con la edad las dosis, los valores de referencia del laboratorio y qué controles te tocan.',
            control: 'date',
            required: true,
            maxDate: 'today',
            minDate: new Date(1900, 0, 1),
            mensajeDeError: 'Ingresá tu fecha de nacimiento.',
          },
          {
            key: 'sexAtBirth',
            label: 'Sexo',
            hint: 'Dato clínico: cambia las dosis, los valores de referencia y los tamizajes.',
            description:
              'Es el sexo que registra tu documento de identidad. Lo usamos como dato clínico, no para dirigirnos a vos.',
            control: 'select',
            required: true,
            options: OPCIONES_GENERO,
            placeholder: 'Elegí una opción',
            testId: 'registro-genero',
            icono: 'heart',
            mensajeDeError: 'Elegí una opción.',
          },
          this.campoOcupacion(),
          ...this.campoOtraOcupacion(),
        ],
      },
      {
        titulo: '¿Cómo te contactamos?',
        clave: 'contact',
        icon: 'phone',
        hint: 'Tu celular, y a quién avisamos si hace falta.',
        campos: [
          {
            key: 'phone',
            label: 'Tu celular',
            hint: 'Elegí el país si tu número no es de Bolivia.',
            description:
              'Es por donde te avisamos de un turno o de un resultado. No se muestra a nadie más.',
            // `tel` lo dibuja `app-phone-input`: ver el motor.
            control: 'tel',
            required: true,
            autocomplete: 'tel',
            testId: 'registro-telefono',
            icono: 'phone',
            mensajeDeError: 'Ingresá un número completo para el país elegido.',
          },
          {
            key: 'guardianName',
            label: 'Contacto de emergencia (opcional)',
            hint: 'A quién llamamos si pasa algo, o quién te acompaña si sos menor.',
            control: 'text',
            placeholder: 'Rosa Quispe',
            testId: 'registro-tutor-nombre',
            icono: 'people',
            ancho: 'mitad',
          },
          {
            key: 'guardianPhone',
            label: 'Su teléfono (opcional)',
            hint: 'Elegí el país si el número no es de Bolivia.',
            control: 'tel',
            testId: 'registro-tutor-telefono',
            icono: 'phone',
            ancho: 'mitad',
            mensajeDeError: 'Para guardar el teléfono, contanos también su nombre.',
          },
          // La «Relación» que el orden pide junto al contacto de emergencia
          // (AC-03-11) no está: es un value set que no existe y una columna que
          // tampoco. Ver el JSDoc de arriba.
        ],
      },
      {
        titulo: '¿Dónde vivís?',
        clave: 'residence',
        icon: 'home',
        hint: 'Tu localidad hace falta; la calle y el punto del mapa son opcionales.',
        campos: [
          {
            // El mapa de departamentos y el select de ciudad son UN campo: son
            // un solo dato —la localidad— con dos formas de llegar a él. El
            // rótulo va vacío porque el propio `app-location-picker` rotula sus
            // dos partes; con rótulo acá habría dos nombres para lo mismo.
            key: 'residenceMunicipalityConceptId',
            label: '',
            control: 'custom',
            required: true,
            mensajeDeError: 'Elegí tu departamento en el mapa y después tu ciudad.',
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
            testId: 'registro-domicilio-calle',
            icono: 'route',
          },
          {
            key: 'gpsDomicilio',
            label: 'Ubicación GPS (opcional)',
            hint: 'Si la compartís, el delivery llega sin llamarte.',
            control: 'custom',
          },
        ],
      },
      {
        titulo: '¿Dónde trabajás?',
        clave: 'work',
        icon: 'briefcase',
        hint: 'Opcional. Con el nombre de la empresa alcanza.',
        campos: [this.campoEmpresa(), ...this.campoOtraEmpresa()],
      },
      {
        titulo: 'El lugar donde trabajás',
        clave: 'work-location',
        icon: 'building',
        hint: 'Opcional, y va aparte de la empresa: son dos preguntas distintas.',
        campos: [
          {
            key: 'workMunicipalityConceptId',
            label: '',
            control: 'custom',
          },
          {
            key: 'workAddressLines',
            label: 'Línea de dirección 1 (opcional)',
            hint: 'Calle y número de tu trabajo.',
            control: 'text',
            placeholder: 'Calle Libertad #120',
            testId: 'registration-work-address',
            icono: 'route',
          },
          {
            key: 'gpsTrabajo',
            label: 'Ubicación GPS (opcional)',
            hint: 'El punto exacto de tu lugar de trabajo.',
            control: 'custom',
          },
        ],
      },
      {
        titulo: 'Tu acceso',
        clave: 'access',
        icon: 'lock',
        hint: 'Entrás con tu documento; el correo es por donde recuperás la cuenta.',
        campos: [
          {
            key: 'email',
            label: 'Correo electrónico',
            hint: 'Por acá recuperás tu cuenta y te avisamos de tus turnos.',
            description:
              'No es con lo que entrás —eso es tu documento—, pero sin él no hay forma de devolverte el acceso si perdés la contraseña.',
            // `email` y no `username`: acá el correo NO es con lo que entra.
            control: 'email',
            required: true,
            autocomplete: 'email',
            placeholder: 'correo@ejemplo.com',
            testId: 'registro-correo',
            icono: 'mail',
            mensajeDeError: 'Ingresá un correo válido.',
          },
          {
            key: 'password',
            label: 'Contraseña',
            hint: 'Al menos 8 caracteres.',
            description:
              'Se guarda cifrada: ni el equipo de AloVida puede verla, y por eso nunca te la vamos a pedir por teléfono ni por correo.',
            control: 'password',
            required: true,
            autocomplete: 'new-password',
            placeholder: 'Tu contraseña',
            testId: 'registro-password',
            icono: 'lock',
            mensajeDeError: 'La contraseña necesita al menos 8 caracteres.',
          },
        ],
      },
      {
        titulo: 'Tu seguro de salud',
        clave: 'insurance',
        icon: 'umbrella',
        hint: 'Opcional. Si tenés los dos, podés declararlos.',
        campos: [this.campoSeguro('privado'), this.campoSeguro('publico')],
      },
      {
        titulo: 'Datos de facturación',
        clave: 'billing',
        icon: 'billing',
        hint: 'Opcional. Sólo para las facturas que recibís.',
        campos: [
          {
            key: 'billingTaxId',
            label: 'NIT (opcional)',
            hint: 'Sólo el número.',
            description:
              'Lo usamos cuando hay que emitir una factura. Si no lo tenés a mano, dejalo vacío.',
            control: 'text',
            placeholder: '1023456789',
            testId: 'registro-nit',
            icono: 'billing',
            mensajeDeError: 'El NIT es sólo números.',
          },
          {
            key: 'billingLegalName',
            label: 'Nombre o Razón Social (opcional)',
            hint: 'A nombre de quién se emite la factura.',
            description:
              'Si declarás NIT, ingresá el nombre o razón social correspondiente.',
            control: 'text',
            placeholder: 'Carlos Roca Aguilera',
            testId: 'registro-razon-social',
            icono: 'billing',
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
    this.pedirUbicacion({
      punto: this.gpsDomicilio,
      pidiendo: this.pidiendoGps,
      confirmada: this.direccionConfirmada,
      rechazado: this.gpsRechazado,
    });
  }

  /** Lo mismo, para el lugar de trabajo. Ver {@link usarMiUbicacion}. */
  usarMiUbicacionDeTrabajo(): void {
    this.pedirUbicacion({
      punto: this.gpsTrabajo,
      pidiendo: this.pidiendoGpsTrabajo,
      confirmada: this.direccionTrabajoConfirmada,
      rechazado: this.gpsTrabajoRechazado,
    });
  }

  /**
   * El pedido al navegador, con las cuatro señales de una ubicación.
   *
   * Existe porque el alta pide **dos** ubicaciones —casa y trabajo— y el
   * permiso del navegador, el tiempo de espera y el trato del rechazo son los
   * mismos para las dos. Escribirlo dos veces garantizaba que el arreglo del
   * segundo caso se hiciera sólo en el primero.
   *
   * @param destino - Las cuatro señales de la ubicación que se está pidiendo.
   */
  private pedirUbicacion(destino: DestinoDeUbicacion): void {
    const geo = this.documento.defaultView?.navigator?.geolocation;
    if (!geo) {
      destino.rechazado.set(true);
      return;
    }

    destino.pidiendo.set(true);
    // Volver a pedirla es empezar de nuevo: lo confirmado antes valía para el
    // punto anterior, no para el que está por llegar.
    destino.confirmada.set(false);
    geo.getCurrentPosition(
      (posicion) => {
        destino.punto.set({
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        });
        destino.rechazado.set(false);
        destino.pidiendo.set(false);
      },
      () => {
        destino.rechazado.set(true);
        destino.pidiendo.set(false);
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
   *
   * Lo que **no** hace es escribir la calle: ver {@link AVISO_SIN_GEOCODIFICACION}.
   */
  confirmarDireccionActual(): void {
    if (this.gpsDomicilio() === null) return;
    this.direccionConfirmada.set(true);
  }

  /** Lo mismo, para el trabajo. */
  confirmarDireccionDeTrabajo(): void {
    if (this.gpsTrabajo() === null) return;
    this.direccionTrabajoConfirmada.set(true);
  }

  /** Olvida la ubicación capturada, y con ella su confirmación. */
  quitarUbicacion(): void {
    this.gpsDomicilio.set(null);
    this.direccionConfirmada.set(false);
  }

  /** Lo mismo, para el trabajo. */
  quitarUbicacionDeTrabajo(): void {
    this.gpsTrabajo.set(null);
    this.direccionTrabajoConfirmada.set(false);
  }

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');

  readonly registered = signal(false);
  readonly verificationSent = signal(false);

  /**
   * Con qué va a iniciar sesión, para decírselo en la confirmación.
   *
   * Fijo, y ésa es la mitad del sentido de esta pantalla: el paciente entra con
   * su documento y el correo le es opcional. El alta de profesional dice «tu
   * correo», y mientras las dos vivían en el mismo componente esto era un
   * `computed` sobre el tipo de cuenta.
   */
  readonly accessHint = 'tu documento';

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
    () => AYUDA_PACIENTE[this.claveVisible()] ?? [],
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
    this.cargarOcupaciones();
    this.cargarEmpresas();
    this.cargarAseguradoras();

    // El aviso de un envío fallido se va en cuanto se corrige algo.
    //
    // Antes lo limpiaba el «Siguiente» de esta pantalla, que ya no es suyo: el
    // motor lleva su propio avance y no sabe nada de errores de la API. Se ata
    // entonces a lo único que de verdad significa «estoy corrigiendo» —que el
    // formulario cambie—, que además cubre el caso que el avance no cubría:
    // corregir en la misma página donde falló el envío.
    this.limpiarElErrorAlCorregir(this.formPaciente);
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
   * el alta sigue... salvo en residencia, que desde AC-03-3 es obligatoria: ahí
   * el aviso con «Reintentar» es lo único que deja continuar, y por eso se
   * muestra en el sitio del campo y no como un error del formulario.
   *
   * Lo que llega ya viene agrupado por departamento y se guarda así: no hay
   * traducción intermedia.
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
    const municipio = raw.residenceMunicipalityConceptId;
    const calleDomicilio = raw.homeAddressLines.trim();
    const municipioTrabajo = raw.workMunicipalityConceptId;
    const calleTrabajo = raw.workAddressLines.trim();
    const empresa = this.empresaSeleccionada();
    const otraEmpresa = raw.workEmployerFreeText.trim();
    // Sólo viaja lo confirmado sobre el mapa: un punto capturado y no mirado es
    // una lectura del GPS, no la dirección de nadie.
    const gpsCasa = this.direccionConfirmada() ? this.gpsDomicilio() : null;
    const gpsTrabajo = this.direccionTrabajoConfirmada() ? this.gpsTrabajo() : null;
    const nombreTutor = raw.guardianName.trim();
    const telefonoTutor = raw.guardianPhone.trim();
    const seguroPrivado = raw.privateInsurancePlanId;
    const seguroPublico = raw.publicInsurancePlanId;
    const nit = raw.billingTaxId.trim();
    const razonSocial = raw.billingLegalName.trim();
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
      // Trabajo: la empresa **y** dónde queda. Los cuatro campos de ubicación
      // vuelven al alta por AC-03-1; el DTO nunca dejó de aceptarlos. Ver el
      // JSDoc de `workMunicipalityConceptId` en el `FormGroup`.
      ...(empresa === null ? {} : { workEmployerConceptId: empresa }),
      ...(municipioTrabajo === null ? {} : { workMunicipalityConceptId: municipioTrabajo }),
      ...(calleTrabajo === '' ? {} : { workAddressLines: calleTrabajo }),
      ...(gpsTrabajo === null
        ? {}
        : { workLatitude: gpsTrabajo.lat, workLongitude: gpsTrabajo.lng }),
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
      ...(razonSocial === '' ? {} : { billingLegalName: razonSocial }),
    };
  }
}
