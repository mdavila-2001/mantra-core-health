import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  PLATFORM_ID,
  signal,
  type WritableSignal,
} from '@angular/core';
import { soloLetrasDeNombre } from '../../../shared/forms/input-filters';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { Subject, catchError, map, of, switchMap, timeout } from 'rxjs';
import {
  AbstractControl,
  FormArray,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/auth/auth.service';
import { CORREO_CON_DOMINIO } from '../../../core/data-access/iam/strict-email';
import { BoDepartmentsCatalog } from '../../../core/data-access/terminology/bo-departments.service';
import {
  BoEmployersCatalog,
  CODIGO_EMPRESA_OTRA,
} from '../../../core/data-access/terminology/bo-employers.service';
import {
  BoOccupationsCatalog,
  CODIGO_OCUPACION_OTRA,
} from '../../../core/data-access/terminology/bo-occupations.service';
import {
  ReverseGeocodingClient,
  type StreetFromPoint,
} from '../../../core/data-access/geo/reverse-geocoding.client';
import { TrustedAmbulanceStore } from '../../../core/emergency/trusted-ambulance.store';
import {
  AMBULANCE_DIRECTORY_SEED,
  DEPARTAMENTOS_BOLIVIA,
  ambulancesForDepartment,
  isSeededAmbulancePhone,
} from '../../../core/emergency/ambulance-directory.seed';
import {
  PhoneInput,
  telefonoCompleto,
} from '../../../shared/components/molecules/phone-input/phone-input';
import {
  BoMunicipalitiesCatalog,
  type RamaDepartamento,
} from '../../../core/data-access/terminology/bo-municipalities.service';
import { RelatedPersonRelationshipsCatalog } from '../../../core/data-access/system-context/related-person-relationships.service';
import type {
  BirthSexCode,
  PatientRegistration,
} from '../../../core/data-access/iam/iam.types';
import { registrationErrorToViewState } from '../shared-registration/registration-errors';
import { loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { Tooltip } from '../../../shared/components/atoms/tooltip/tooltip';
import {
  identityDocumentValidators,
} from '../shared-registration/national-id';
import {
  MapLocationPicker,
  type LocalityFromPoint,
  type TestIds as IdsDeUbicacion,
} from '../shared-registration/map-location-picker/map-location-picker';
import { Link } from '../../../shared/components/atoms/link/link';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { AuthSplit } from '../../../shared/components/organisms/auth-split/auth-split';
import { CustomField } from '../../../shared/components/organisms/paginated-form/custom-field';
import { PaginatedForm } from '../../../shared/components/organisms/paginated-form/paginated-form';
import {
  MESSAGE_SHORT_PASSWORD,
  passwordValidators,
} from '../shared-registration/password-policy';
import type {
  CampoDeFormulario,
  PaginaDeFormulario,
} from '../../../shared/forms/paginated/paginated-form.types';
import { AnnounceOnAppear } from '../../../shared/a11y/announce-on-appear';
import { NOTICE_REWRITE_ADDRESS } from '../shared-registration/map-location-picker/map-location-picker';
import { InsuranceClient } from '../../../core/data-access/insurance/insurance.client';
import type { CarrierCatalogEntry } from '../../../core/data-access/insurance/insurance.types';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import {
  RegistrationHelp,
  type HelpCard,
} from '../../../shared/components/organisms/registration-help/registration-help';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { Select } from '../../../shared/components/atoms/select/select';
import { Input as AppInput } from '../../../shared/components/atoms/input/input';
import type { PinMap } from '../../../shared/components/organisms/map/map-pin.types';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { OnboardingDraftBanner } from '../../../shared/components/molecules/onboarding-draft-banner/onboarding-draft-banner';
import { OnboardingDraftService } from '../../../core/onboarding/onboarding-draft.service';
import type { OnboardingDraft } from '../../../core/onboarding/onboarding-draft.types';
import { RegistrationBadge } from '../shared-registration/registration-badge';

/** `Date` → ISO `YYYY-MM-DD`, tal como lo esperan los DTO del backend. */
function fechaIso(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** El NIT boliviano es sólo dígitos; el backend valida lo mismo. */
const NIT_VALIDO = /^[0-9]{4,20}$/;

/**
 * Cuántos teléfonos y contactos de emergencia más se pueden sumar con el «+».
 * Los mismos topes que `MAX_ADDITIONAL_PHONES` y
 * `MAX_ADDITIONAL_EMERGENCY_CONTACTS` del DTO de la API: uno más y la API
 * contestaría 400.
 */
export const MAX_TELEFONOS_EXTRA = 4;
export const MAX_CONTACTOS_EXTRA = 4;

/** Un contacto de emergencia sumado con el «+»: los mismos tres datos que el primero. */
type ContactoExtra = FormGroup<{
  name: FormControl<string>;
  phone: FormControl<string>;
  relationshipConceptId: FormControl<string | null>;
}>;

/**
 * Un teléfono sumado con el «+». Obligatorio una vez agregado: la casilla vacía
 * se quita con su botón, no se manda en blanco.
 */
function nuevoTelefonoExtra(valor = ''): FormControl<string> {
  return new FormControl(valor, {
    nonNullable: true,
    validators: [Validators.required, telefonoCompleto],
  });
}

/** Un contacto de emergencia sumado con el «+». Su nombre es lo único obligatorio. */
function nuevoContactoExtra(
  valor: { name?: string; phone?: string; relationshipConceptId?: string | null } = {},
): ContactoExtra {
  return new FormGroup({
    name: new FormControl(valor.name ?? '', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    phone: new FormControl(valor.phone ?? '', {
      nonNullable: true,
      validators: [telefonoCompleto],
    }),
    relationshipConceptId: new FormControl<string | null>(valor.relationshipConceptId ?? null),
  });
}

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
  /** Si se pidió el mapa vacío para poner el pin a mano. */
  readonly marcando: WritableSignal<boolean>;
  /** Si el punto actual lo dio el navegador y no un toque sobre el plano. */
  readonly delNavegador: WritableSignal<boolean>;
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
 * Lo que se le dice a quien fijó un punto, según qué pasó con la calle
 * (AC-03-8 / AC-03-9, y el pedido del cliente del 26/10/2026: «llene la línea
 * de dirección»).
 *
 * **P-03-7 quedó resuelta así:** la calle la pide la API
 * (`POST /public/geo/reverse`, OpenStreetMap vía Nominatim) y no el navegador,
 * así que la política de seguridad del front sigue con `connect-src 'self'`.
 *
 * Lo que AC-03-9 sigue exigiendo cuando la calle no sale —el proveedor no la
 * conoce o no respondió— es que el formulario lo **diga** y **deje seguir**.
 * Nunca se rellena con un texto inventado: una dirección falsa en la ficha de
 * un paciente es peor que un campo vacío, porque nadie la vuelve a mirar.
 */
const AVISOS_DE_CALLE: Readonly<Record<EstadoDeCalle, string>> = {
  'sin-pedir': '',
  buscando: 'Buscando el nombre de la calle de este punto…',
  escrita:
    'Escribimos la calle a partir del punto (datos de © OpenStreetMap). Revísela y agregue el número si falta.',
  conservada:
    'Dejamos la calle que usted escribió. Revise que corresponda al punto del mapa.',
  'sin-calle':
    'No encontramos el nombre de la calle en este punto: escríbala usted arriba. El punto se guarda igual.',
  caida:
    'El punto del mapa se guarda tal cual, pero ahora no podemos convertirlo en el nombre de la calle: escríbala usted arriba.',
};

/** Qué pasó con la calle del último punto del domicilio. */
type EstadoDeCalle = 'sin-pedir' | 'buscando' | 'escrita' | 'conservada' | 'sin-calle' | 'caida';

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
 * Sexo, con sus dos categorías.
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
 * boliviano registra y lo que la ficha del paciente contrasta contra él.
 *
 * ## Por qué es «Sexo» y no «Género», y por qué es obligatorio
 *
 * Es dato clínico —dosis, valores de referencia, tamizajes—, no una cortesía
 * demográfica: llamarlo «Género» sugería lo segundo, y dejarlo opcional
 * dejaba fichas sin el dato que las decisiones clínicas necesitan. El `gender`
 * administrativo del DTO sigue existiendo para otros clientes; este formulario
 * no lo manda.
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
 * departamento emitió tu cédula, dónde trabajás, qué seguro tenés, a quién
 * avisamos si pasa algo. Cada una tiene un motivo bueno y ninguno cabe en la
 * pista del campo —la pista dice qué escribir, no por qué se guarda—, así que
 * hasta ahora el motivo no estaba en ningún lado y la pregunta quedaba sonando
 * a intromisión. Eso es de lo que más hace abandonar un registro.
 *
 * Va **al costado** y no dentro del formulario: no alarga la página, no compite
 * con los campos y se lee sólo si hace falta. Ver `app-registration-help`.
 *
 * ## Por qué es un mapa por clave y no una lista
 *
 * Porque la respuesta cambia con la pregunta, y las páginas se reordenan. Con
 * un arreglo paralelo, mover una sección de sitio dejaría la explicación del
 * domicilio al lado de la contraseña, y nadie se enteraría hasta verlo. La
 * clave la declara la propia página (`PaginaDeFormulario.clave`), así que las
 * dos mitades no se pueden separar de un descuido.
 */
const AYUDA_PACIENTE: Readonly<Record<string, readonly HelpCard[]>> = {
  identity: [
    {
      icono: 'patients',
      titulo: 'Con su documento va a entrar',
      texto:
        'Es su usuario: no tiene que inventar ni recordar otro. Lo pedimos primero para avisarle enseguida si ya tenía cuenta.',
    },
    {
      icono: 'people',
      titulo: 'Su nombre, como figura en su documento',
      texto:
        'Es lo que evita que su historia clínica se mezcle con la de alguien que se llama parecido. Si no lleva segundo nombre o apellido materno, déjelos vacíos.',
    },
    {
      icono: 'stethoscope',
      titulo: 'Cambia cómo le atienden',
      texto:
        'La edad y el sexo deciden dosis, valores de referencia de laboratorio y qué controles le corresponden por edad.',
    },
    {
      icono: 'briefcase',
      titulo: 'Su oficio también es un dato clínico',
      texto:
        'Cada trabajo trae sus riesgos —químicos, esfuerzo, turnos de noche— y su médico los tiene en cuenta.',
    },
  ],
  misc: [
    {
      icono: 'lock',
      titulo: 'Su contraseña, sólo suya',
      texto:
        'Ocho caracteres o más. Se guarda cifrada: ni el equipo de AloVida puede verla, y por eso nunca se la vamos a pedir por teléfono ni por correo.',
    },
    {
      icono: 'umbrella',
      titulo: 'Para que no pague lo que ya está cubierto',
      texto:
        'Con su seguro declarado, la cobertura se aplica cuando reserva o compra, sin que tenga que reclamarla después.',
    },
    {
      icono: 'billing',
      titulo: 'El NIT es sólo para sus facturas',
      texto: 'Lo usamos cuando hay que emitir una. Si no lo tiene a mano, déjelo vacío.',
    },
  ],
  document: [
    {
      icono: 'patients',
      titulo: 'Con su documento va a entrar',
      texto:
        'Es su usuario: no tiene que inventar ni recordar otro. Lo pedimos primero para avisarle enseguida si ya tenía cuenta.',
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
      titulo: 'Su nombre, como figura en su documento',
      texto:
        'Es lo que evita que su historia clínica se mezcle con la de alguien que se llama parecido. Si no lleva segundo nombre o apellido materno, déjelos vacíos.',
    },
  ],
  profile: [
    {
      icono: 'stethoscope',
      titulo: 'Cambia cómo le atienden',
      texto:
        'La edad y el sexo deciden dosis, valores de referencia de laboratorio y qué controles le corresponden por edad.',
    },
    {
      icono: 'briefcase',
      titulo: 'Su oficio también es un dato clínico',
      texto:
        'Cada trabajo trae sus riesgos —químicos, esfuerzo, turnos de noche— y su médico los tiene en cuenta.',
    },
  ],
  residence: [
    {
      icono: 'pin',
      titulo: 'Para mostrarle lo que tiene cerca',
      texto:
        'Farmacias, laboratorios y consultorios de su zona, en vez de los del otro lado de la ciudad.',
    },
    {
      icono: 'package',
      titulo: 'Su casa en el mapa',
      texto:
        'Hace falta marcarla y confirmarla: con ese punto la entrega de sus medicamentos llega sin que tenga que explicar dónde vive.',
    },
    {
      icono: 'route',
      titulo: 'La calle sale del punto',
      texto:
        'Al marcar su casa escribimos el nombre de la calle con datos de OpenStreetMap. Con el mismo punto sabemos su departamento, provincia, municipio y zona. Si algo no coincide, mueva el pin.',
    },
  ],
  work: [
    {
      icono: 'building',
      titulo: 'Para qué sirve dónde trabaja',
      texto:
        'Para los convenios con empresas y para los controles de salud laboral: cada oficio y cada lugar traen sus riesgos, y su médico los tiene en cuenta.',
    },
    {
      icono: 'note',
      titulo: 'Si no está en la lista, escríbala',
      texto:
        'La lista tiene las empresas más grandes del país. Si la suya no aparece, elija «Otra empresa» y pone el nombre usted.',
    },
  ],
  'work-location': [
    {
      icono: 'pin',
      titulo: 'Todo esto es opcional',
      texto:
        'Si su trabajo queda lejos de su casa, saberlo nos deja mostrarle farmacias y laboratorios cerca de los dos sitios, no sólo de uno.',
    },
    {
      icono: 'route',
      titulo: 'La calle la escribe usted',
      texto:
        'El punto del mapa del trabajo se guarda tal cual, pero el nombre de la calle lo pone usted.',
    },
  ],
  insurance: [
    {
      icono: 'umbrella',
      titulo: 'Para que no pague lo que ya está cubierto',
      texto:
        'Con su seguro declarado, la cobertura se aplica cuando reserva o compra, sin que tenga que reclamarla después.',
    },
  ],
  billing: [
    {
      icono: 'billing',
      titulo: 'El NIT es sólo para sus facturas',
      texto: 'Lo usamos cuando hay que emitir una. Si no lo tiene a mano, déjelo vacío.',
    },
  ],
  contact: [
    {
      icono: 'phone',
      titulo: 'Su celular hace falta',
      texto:
        'Es por donde le avisamos de una cita, de un resultado listo o de un cambio de hora. No se muestra en ninguna ficha ni se comparte.',
    },
    {
      icono: 'people',
      titulo: 'A quién avisamos si hace falta',
      texto:
        'El contacto de emergencia es opcional: la persona a la que llamamos en una urgencia, o quien le acompaña si es menor de edad. Sólo se usa para eso.',
    },
  ],
  access: [
    {
      icono: 'lock',
      titulo: 'Su contraseña, sólo suya',
      texto:
        'Ocho caracteres o más. Se guarda cifrada: ni el equipo de AloVida puede verla, y por eso nunca se la vamos a pedir por teléfono ni por correo.',
    },
    {
      icono: 'mail',
      titulo: 'Entra con su documento, no con el correo',
      texto:
        'El correo hace falta igual: es la única forma de devolverle el acceso si pierde la contraseña, y por donde le llegan los avisos de sus turnos.',
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
 * eso es CSS (`../shared-registration/registration.css`) y un organismo
 * (`app-registration-help`), y el alta de profesional es `register-practitioner`,
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
const SIGLA_POR_PREFIJO_INE: ReadonlyMap<string, string> = new Map([
  ['01', 'CH'],
  ['02', 'LP'],
  ['03', 'CB'],
  ['04', 'OR'],
  ['05', 'PT'],
  ['06', 'TJ'],
  ['07', 'SC'],
  ['08', 'BE'],
  ['09', 'PA'],
]);

/** El borrador antiguo de `localStorage` (formato versión 1). */
interface BorradorLocal {
  readonly version: number;
  readonly pasoIndice?: number;
  readonly formValores?: Record<string, unknown>;
  readonly [extra: string]: unknown;
}

@Component({
  selector: 'app-register-patient',
  imports: [RegistrationBadge, 
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
    Select,
    AppInput,
    OnboardingDraftBanner,
    // Los teléfonos y contactos sumados con el «+» se dibujan fuera del
    // `[formGroup]` del motor, así que se enchufan con `[formControl]`: igual
    // que las gerencias del alta de organización.
    ReactiveFormsModule,
    PhoneInput,
  ],
  templateUrl: './register-patient.html',
  styleUrls: ['../shared-registration/registration.css', './register-patient.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegisterPatient {
  /** Nombres y apellidos no admiten dígitos. Ver `Input.inputFilter`. */
  protected readonly soloLetras = soloLetrasDeNombre;

  private readonly platformId = inject(PLATFORM_ID);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly ambulanciaDeConfianza = inject(TrustedAmbulanceStore);
  private readonly draftService = inject(OnboardingDraftService);
  private readonly dialogs = inject(DialogService);

  readonly STORAGE_KEY = 'alovida.registro-paciente.borrador';
  readonly borradorDetectado = signal<OnboardingDraft | null>(null);
  readonly pasoGuardado = signal<number>(0);
  readonly ocupacionesPersonalizadas = signal<readonly (SelectOption<string> & { code: string })[]>([]);

  readonly departamentosAmbulancia = DEPARTAMENTOS_BOLIVIA.map((department) => ({
    value: department.code,
    label: department.name,
  }));

  /**
   * Departamento detectado automáticamente a partir de las preguntas anteriores:
   * 1) Municipio de residencia (elegido en el paso 2 de residencia).
   * 2) O departamento de emisión del documento (paso 1 de documento).
   */
  readonly departamentoDetectado = computed<string | null>(() => {
    const municipio =
      this.municipioPaciente() ??
      this.formPaciente.controls.residenceMunicipalityConceptId.value;
    const ramas = this.ramasMunicipios();
    if (municipio) {
      if (ramas.length > 0) {
        for (const rama of ramas) {
          if (
            rama.municipios.some(
              (m) =>
                m.conceptId === municipio ||
                m.ine === municipio ||
                m.nombre.toLowerCase() === municipio.toLowerCase(),
            )
          ) {
            return rama.sigla;
          }
        }
      }
      if (municipio.length >= 2) {
        const prefijo = municipio.slice(0, 2);
        const sigla = SIGLA_POR_PREFIJO_INE.get(prefijo);
        if (sigla) return sigla;
      }
    }

    const emisor = this.formPaciente.controls.issuerAdministrativeAreaConceptId.value;
    if (emisor) {
      if (ramas.length > 0) {
        const rama = ramas.find(
          (r) =>
            r.conceptId === emisor ||
            r.sigla.toUpperCase() === emisor.toUpperCase() ||
            r.nombre.toLowerCase() === emisor.toLowerCase(),
        );
        if (rama) return rama.sigla;
      }
      if (emisor.length === 2 && SIGLA_POR_PREFIJO_INE.has(emisor)) {
        return SIGLA_POR_PREFIJO_INE.get(emisor)!;
      }
      const mayusc = emisor.toUpperCase();
      if (['CH', 'LP', 'CB', 'OR', 'PT', 'PO', 'TJ', 'SC', 'BE', 'PA', 'PD'].includes(mayusc)) {
        return mayusc;
      }
      const deptSlug = DEPARTAMENTOS_BOLIVIA.find(
        (d) => d.code === emisor || d.name.toLowerCase() === emisor.toLowerCase(),
      );
      if (deptSlug) return deptSlug.code;
    }

    return this.formPaciente.controls.trustedAmbulanceDepartment.value ?? null;
  });

  opcionesDeAmbulancia() {
    const department = this.departamentoDetectado();
    return ambulancesForDepartment(department).map((service) => ({
      value: service.id,
      label: service.name,
      description: `${service.scope} · ${service.phone}`,
    }));
  }

  elegirDepartamentoAmbulancia(departmentCode: string | null): void {
    const anterior = this.formPaciente.controls.trustedAmbulanceService.value;
    this.formPaciente.controls.trustedAmbulanceDepartment.setValue(departmentCode);
    this.formPaciente.controls.trustedAmbulanceService.setValue(null);
    if (anterior) {
      this.formPaciente.controls.trustedAmbulanceName.setValue('');
      this.formPaciente.controls.trustedAmbulancePhone.setValue('');
    }
  }

  elegirServicioAmbulancia(serviceId: string | null): void {
    this.formPaciente.controls.trustedAmbulanceService.setValue(serviceId);
    const service = AMBULANCE_DIRECTORY_SEED.find((entry) => entry.id === serviceId);
    if (!service) return;
    this.formPaciente.controls.trustedAmbulanceName.setValue(service.name);
    this.formPaciente.controls.trustedAmbulancePhone.setValue(service.phone);
  }

  readonly formPaciente = new FormGroup(
    {
      nationalId: new FormControl('', {
        nonNullable: true,
        validators: [...identityDocumentValidators],
      }),
      // El nombre va en sus cuatro partes, no en un campo libre: es como lo emite
      // el documento de identidad y como se comparan dos personas al buscar
      // duplicados. Partir después una cadena es una conjetura que falla con los
      // nombres compuestos y con los apellidos de más de una palabra.
      //
      // **`name` y `lastName` son obligatorios pese a que la lista de la TAREA
      // 03 §1.2 no los nombra** (sólo lista documento, correo, sexo, teléfono,
      // fecha de nacimiento y localidad). Es una restricción YA EXISTENTE
      // —anterior a esta tarea (`9dd07ca`, «el nombre se pide en sus cuatro
      // partes»)— y AC-03-4 la contempla explícitamente: «más lo que el
      // servidor exija por contrato» (ver P-03-2). El contrato es real, no una
      // costumbre de este formulario: `RegisterPatientDto.name`/`lastName`
      // (wt-pablo-api) sólo se vuelven opcionales si se manda `displayName` —el
      // formulario nunca lo hace—, y `composeAccountDisplayName()` escribe
      // `iam.users.display_name`, una columna `NOT NULL` que es lo que muestran
      // el saludo, el directorio y la búsqueda de toda la plataforma: un alta
      // sin nombre no crea una cuenta usable, crea una fila con el nombre en
      // blanco en todas partes. Por eso se mantiene como una restricción ya
      // existente y justificada bajo FT-03-R04, no como un vacío de esta
      // corrección. Ver `register-patient.spec.ts` →
      // `describe('obligatoriedad (AC-03-3, AC-03-4)')`, que fija por prueba el
      // conjunto exacto de obligatorios y falla si alguien agrega un décimo sin
      // el mismo tipo de justificación (AG49-FT03-R04-001).
      name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      middleName: new FormControl('', { nonNullable: true }),
      thirdName: new FormControl('', { nonNullable: true }),
      // Mismo criterio y misma justificación que `name`. Ver el comentario de
      // arriba.
      lastName: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      motherLastName: new FormControl('', { nonNullable: true }),
      password: new FormControl('', {
        nonNullable: true,
        validators: [...passwordValidators],
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
        validators: [
          Validators.required,
          Validators.email,
          Validators.pattern(CORREO_CON_DOMINIO),
        ],
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
      //
      // Obligatorio, igual que en el alta de profesional: el número y su
      // expedición son UN documento escrito en dos casillas, y con el número
      // obligatorio y la expedición no, la cédula queda a medias. Además es lo
      // que distingue dos documentos con el mismo número.
      issuerAdministrativeAreaConceptId: new FormControl<string | null>(null, {
        validators: [Validators.required],
      }),
      // Calle y número del domicilio. Las coordenadas van aparte: no se
      // escriben, se confirman sobre el mapa.
      homeAddressLines: new FormControl('', { nonNullable: true }),
      // Distrito o zona: viaja dentro de la línea de dirección.
      homeDistrict: new FormControl('', { nonNullable: true }),
      // **La localidad de residencia es obligatoria (AC-03-3)** y por eso vive
      // en el formulario y no en un signal suelto: el motor valida de a una
      // página, y un dato fuera del `FormGroup` no lo puede frenar. El signal
      // que lo espeja (`municipioPaciente`) sigue existiendo para el grafo de
      // señales; lo escriben los dos el mismo método. Ver `elegirMunicipio`.
      residenceMunicipalityConceptId: new FormControl<string | null>(null, {
        validators: [Validators.required],
      }),
      // **El punto del domicilio es obligatorio** (pedido del cliente del
      // 26/10/2026). Vive en el formulario por lo mismo que la localidad: el
      // motor valida de a una página y sólo frena lo que está en el `FormGroup`.
      // No se escribe: lo llena el efecto del constructor con el punto
      // CONFIRMADO, y vuelve a `null` si se quita o se mueve el pin.
      gpsDomicilio: new FormControl<Coordenadas | null>(null, {
        validators: [Validators.required],
      }),
      // El lugar de trabajo **vuelve al alta** (AC-03-1). Revierte lo que
      // documenta `campoEmpresa`: se habían sacado municipio, calle y
      // coordenadas del trabajo porque casi nadie las completaba. El
      // propietario las volvió a pedir, y el DTO nunca dejó de aceptarlas.
      // Opcional, las tres.
      workMunicipalityConceptId: new FormControl<string | null>(null),
      workAddressLines: new FormControl('', { nonNullable: true }),
      workDistrict: new FormControl('', { nonNullable: true }),
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
      // Qué es esa persona del paciente, como concepto de
      // `related-person-relationship` (AC-03-11). Opcional, y sin validador
      // propio: exigirlo convertiría en obligatorio un contacto que no lo es.
      // Sin parentesco declarado la API escribe «tutor o representante legal»,
      // que es lo que escribía siempre.
      guardianRelationshipConceptId: new FormControl<string | null>(null),
      // Los teléfonos y contactos de emergencia que se suman con el «+». Son
      // arreglos de verdad de punta a punta: viajan como `additionalPhones` y
      // `additionalEmergencyContacts`, y la API guarda cada uno en su fila.
      additionalPhones: new FormArray<FormControl<string>>([]),
      additionalEmergencyContacts: new FormArray<ContactoExtra>([]),
      // La ambulancia de confianza (propietario, 2026-10-08). NO viaja al servidor —el modelo no
      // tiene dónde guardarla—: se guarda en este dispositivo al registrarse (`TrustedAmbulanceStore`).
      trustedAmbulanceName: new FormControl('', { nonNullable: true }),
      trustedAmbulancePhone: new FormControl('', {
        nonNullable: true,
        validators: [
          (control) =>
            isSeededAmbulancePhone(String(control.value ?? ''))
              ? null
              : telefonoCompleto(control),
        ],
      }),
      // Filtros locales del seed: no contienen información de paciente y no
      // viajan a la API. Nombre y teléfono se guardan sólo en este equipo.
      trustedAmbulanceDepartment: new FormControl<string | null>(null),
      trustedAmbulanceService: new FormControl<string | null>(null),
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
    this.sembrarDireccion(this.formPaciente.controls.homeAddressLines, conceptId);
  }

  /** Lo mismo, para el lugar de trabajo. Opcional: no se marca como tocado. */
  elegirMunicipioDeTrabajo(conceptId: string | null): void {
    this.formPaciente.controls.workMunicipalityConceptId.setValue(conceptId);
    this.municipioTrabajo.set(conceptId);
    this.sembrarDireccion(this.formPaciente.controls.workAddressLines, conceptId);
  }

  /**
   * Lo último que el formulario sembró en cada «dirección 1».
   *
   * Es lo que permite distinguir **lo que puso el formulario de lo que escribió
   * la persona**, que es la única pregunta que importa para saber si un
   * prellenado puede reescribirse. El valor del control no alcanza: «Sacaba»
   * puede haberlo puesto la elección de la localidad o haberlo tecleado alguien,
   * y las dos cosas se tratan al revés.
   *
   * Se indexa por control y no por página porque son dos campos independientes
   * —domicilio y trabajo— con su propia historia. Vacío significa «acá el
   * formulario no escribió nada».
   */
  private readonly direccionSembrada = new WeakMap<FormControl<string>, string>();

  /**
   * Copia el nombre de la localidad elegida a su «dirección 1».
   *
   * ## Qué problema resuelve, y cuál NO
   *
   * El pedido es «copiar el nombre del lugar que se elige en el mapa a la
   * dirección» (AC-03-8). La lectura literal —convertir el pin del GPS en «Av.
   * Banzer 3er anillo»— la hace {@link traerCalleDelPunto} a través de la API
   * (ver {@link AVISOS_DE_CALLE}).
   *
   * Lo que sí sabe el sistema, sin salir a la red, es **cómo se llama la
   * localidad que la persona acaba de elegir**. Eso es lo que se copia mientras
   * no haya punto: un arranque cierto de la dirección, sobre el que se sigue
   * escribiendo la calle y el número. Con punto, manda la calle del punto.
   *
   * ## La regla: el formulario sólo reescribe lo que él mismo puso
   *
   * «Sólo si está vacío» no alcanza en cuanto se puede **corregir** la
   * localidad, que es lo normal —se elige el departamento equivocado, se busca
   * la ciudad y se cambia—. Con esa guarda sola, elegir Sacaba y corregir a
   * Quillacollo dejaba el municipio nuevo con la dirección vieja: viajaba
   * «Quillacollo» con «Sacaba» escrito al lado. Un domicilio que no existe es
   * peor que un campo vacío, porque nadie lo vuelve a mirar.
   *
   * Por eso se recuerda lo sembrado ({@link direccionSembrada}) y se decide así:
   *
   * - **Vacío, o exactamente lo que sembró el formulario** → se re-siembra con
   *   el nombre nuevo. Es un valor del que nadie es dueño.
   * - **Distinto de lo sembrado** → lo escribió la persona y no se toca, ni para
   *   corregir la localidad ni para nada.
   * - **Al soltar la localidad** → el texto se conserva. Una navegación no
   *   puede costar datos: el mapa de departamentos es un grupo de dos estados,
   *   así que volver a pulsar el que ya estaba elegido lo suelta, y ese gesto
   *   —el natural para «ahora elijo la ciudad»— borraría lo que la persona
   *   tiene delante. Dejarlo no descuadra nada: elegir otra localidad lo
   *   reescribe igual, la de residencia hace falta para enviar, y lo que queda
   *   entretanto es un texto que se corrige tecleando.
   *
   * ## Dos cuidados que no cambian
   *
   * - **No se marca `touched` ni `dirty`**, tampoco al re-sembrar: no lo
   *   escribió la persona, y marcarlo dispararía la validación y los mensajes
   *   de un campo que nadie tocó.
   * - **Sin nombre, no se escribe nada.** Si el catálogo no cargó todavía, el
   *   municipio no se encuentra en el árbol y el campo queda como estaba. Nunca
   *   se rellena con un identificador ni con un texto inventado.
   *
   * @param control - El control de «dirección 1» que corresponde.
   * @param conceptId - La localidad elegida, o `null` si se soltó.
   */
  private sembrarDireccion(
    control: FormControl<string>,
    conceptId: string | null,
  ): void {
    // Soltar la localidad no borra: ver el porqué en la nota de arriba.
    if (conceptId === null) {
      return;
    }

    const actual = control.value.trim();
    const sembrado = this.direccionSembrada.get(control);
    // De lo que hay ahí no es dueño nadie: o está vacío, o es exactamente lo
    // que puso el formulario la vez anterior.
    const esNuestro = actual === '' || actual === sembrado;
    if (!esNuestro) {
      return;
    }
    // La calle que salió del punto GPS dice más que el nombre del municipio
    // que el mismo punto eligió. Si la persona elige OTRO a mano, la calle del
    // punto ya no corresponde y se re-siembra como siempre.
    if (
      sembrado !== undefined &&
      sembrado !== '' &&
      sembrado === this.lineaDelPunto &&
      conceptId === this.municipioDelPunto
    ) {
      return;
    }

    const nombre = this.nombreDeMunicipio(conceptId);
    if (nombre === null) {
      return;
    }

    this.escribirDireccionSembrada(control, nombre);
  }

  /**
   * Escribe en una «dirección 1» **en nombre del formulario**, y lo anota.
   *
   * Anotarlo es la mitad que hace que la regla funcione la vez siguiente: sin
   * dejar registro de lo que se acaba de poner, el próximo cambio de localidad
   * no sabría si ese texto es suyo o de la persona.
   *
   * @param control - El control de «dirección 1» que corresponde.
   * @param valor - El nombre de la localidad, o `''` para limpiar.
   */
  private escribirDireccionSembrada(
    control: FormControl<string>,
    valor: string,
  ): void {
    // `emitEvent: false` no: el cambio tiene que llegar al `valueChanges` que
    // limpia el error del envío anterior, igual que si se hubiera tecleado.
    // Y sin `markAsTouched`/`markAsDirty`: no lo escribió la persona.
    control.setValue(valor);
    this.direccionSembrada.set(control, valor);
  }

  /**
   * Cómo se llama el municipio de un concepto, según el árbol ya cargado.
   *
   * @param conceptId - El municipio buscado.
   * @returns Su nombre, o `null` si el árbol todavía no lo tiene.
   */
  private nombreDeMunicipio(conceptId: string): string | null {
    for (const rama of this.ramasMunicipios()) {
      const municipio = rama.municipios.find((m) => m.conceptId === conceptId);
      if (municipio !== undefined) {
        return municipio.nombre;
      }
    }
    return null;
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
    return control.touched && control.invalid ? 'Elija su ciudad o municipio.' : '';
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
  readonly pinesDomicilio = computed<readonly PinMap[]>(() => {
    const punto = this.gpsDomicilio();
    if (punto === null) return [];
    return [
      {
        id: PIN_DOMICILIO,
        lat: punto.lat,
        lng: punto.lng,
        titulo: this.direccionConfirmada()
          ? 'Su dirección'
          : this.gpsDomicilioDelNavegador()
            ? 'Acá le encontramos'
            : 'El punto que marcó',
      },
    ];
  });

  /** Si el navegador negó la ubicación, para poder decirlo sin frenar el alta. */
  readonly gpsRechazado = signal(false);

  /**
   * Si la persona pidió el mapa vacío para poner el pin del domicilio a mano.
   *
   * Es la segunda puerta del selector —la primera es el navegador— y existe
   * porque la casa casi nunca se declara desde la casa. Sólo importa mientras
   * no hay punto: con un pin puesto el mapa está abierto igual y tocarlo lo
   * corre.
   */
  readonly marcandoDomicilio = signal(false);

  /** Si el punto del domicilio lo dio el navegador; sólo cambia cómo se llama el pin. */
  readonly gpsDomicilioDelNavegador = signal(false);

  /** Si el mapa del domicilio tiene que estar en pantalla: hay pin, o se está por poner. */
  readonly mapaDomicilioAbierto = computed(
    () => this.gpsDomicilio() !== null || this.marcandoDomicilio(),
  );

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
  readonly marcandoTrabajo = signal(false);
  readonly gpsTrabajoDelNavegador = signal(false);
  readonly mapaTrabajoAbierto = computed(
    () => this.gpsTrabajo() !== null || this.marcandoTrabajo(),
  );

  readonly pinesTrabajo = computed<readonly PinMap[]>(() => {
    const punto = this.gpsTrabajo();
    if (punto === null) return [];
    return [
      {
        id: PIN_TRABAJO,
        lat: punto.lat,
        lng: punto.lng,
        titulo: this.direccionTrabajoConfirmada()
          ? 'Su lugar de trabajo'
          : this.gpsTrabajoDelNavegador()
            ? 'Acá le encontramos'
            : 'El punto que marcó',
      },
    ];
  });

  /** Las listas fijas, expuestas a la plantilla. */
  protected readonly opcionesSexo = OPCIONES_SEXO;

  /** El aviso de AC-03-9, expuesto a la plantilla. Ver la constante. */
  /**
   * El aviso del lugar de TRABAJO, donde la calle no se pide: el trabajo es
   * opcional y su punto rara vez se marca. Ver {@link AVISOS_DE_CALLE}.
   */
  protected readonly avisoSinGeocodificacion = AVISOS_DE_CALLE.caida.replace(' ahora', '');

  private readonly geocodificador = inject(ReverseGeocodingClient);

  /** Qué pasó con la calle del último punto del domicilio. */
  readonly calleDelPunto = signal<EstadoDeCalle>('sin-pedir');

  /** El aviso que acompaña al mapa, según {@link calleDelPunto}. */
  protected readonly avisoDeCalle = computed(() => AVISOS_DE_CALLE[this.calleDelPunto()]);

  /**
   * La última línea que escribió el geocodificador. Sirve para que elegir la
   * localidad —que el GPS también hace— no la reemplace por el nombre del
   * municipio: ver {@link sembrarDireccion}.
   */
  private lineaDelPunto: string | null = null;

  /**
   * Pide la calle del punto del domicilio y la escribe en «Calle» **en nombre
   * del formulario**: si la persona ya había escrito la suya, no se toca, y si
   * después la corrige, la corrección manda.
   *
   * Una respuesta que llega tarde —la persona ya movió el pin— se descarta.
   */
  private traerCalleDelPunto(punto: Coordenadas): void {
    this.calleDelPunto.set('buscando');
    this.pedidosDeCalle.next(punto);
  }

  /**
   * Los pedidos de calle, uno vivo a la vez: un punto nuevo cancela el pedido
   * del anterior (`switchMap`), cada uno tiene diez segundos, y todo se corta
   * al salir de la pantalla. La API además limita y encola contra el proveedor.
   */
  private readonly pedidosDeCalle = new Subject<Coordenadas>();
  /** Ver {@link pedidosDeCalle}. Se llama desde el constructor (`takeUntilDestroyed`). */
  private escucharPedidosDeCalle(): void {
    this.pedidosDeCalle
      .pipe(
      switchMap((punto) =>
        this.geocodificador.streetAt(punto.lat, punto.lng).pipe(
          timeout(10_000),
          map((calle) => ({ punto, calle })),
          catchError(() => of({ punto, calle: null })),
        ),
      ),
        takeUntilDestroyed(),
      )
      .subscribe(({ punto, calle }) => this.escribirCalleDelPunto(punto, calle));
  }

  private escribirCalleDelPunto(punto: Coordenadas, calle: StreetFromPoint | null): void {
    if (this.gpsDomicilio() !== punto) return;
    if (calle === null) {
      this.calleDelPunto.set('caida');
      return;
    }
    if (!calle.found || !calle.line) {
      this.calleDelPunto.set('sin-calle');
      return;
    }
    const control = this.formPaciente.controls.homeAddressLines;
    const actual = control.value.trim();
    const esNuestro = actual === '' || actual === this.direccionSembrada.get(control);
    if (!esNuestro) {
      // La persona ya escribió su calle: se respeta y se dice, sin mentir que
      // se escribió otra.
      this.calleDelPunto.set('conservada');
      return;
    }
    this.lineaDelPunto = calle.line;
    this.escribirDireccionSembrada(control, calle.line);
    this.domicilioVaciadoPorElMapa.set(false);
    this.calleDelPunto.set('escrita');
  }

  /**
   * El municipio que eligió el PUNTO (lo avisa `app-location-picker`). Elegir
   * ese municipio no reemplaza la calle del punto; elegir otro a mano, sí.
   */
  protected municipioDelPunto: string | null = null;

  /**
   * Si el mapa vació la dirección escrita y todavía nadie la reescribió (D-06).
   *
   * Es la misma regla que `app-map-location-picker` avisa con `puntoElegido`,
   * aplicada a las dos copias en línea de esta pantalla: tocar el mapa deja
   * «Línea de dirección 1» en blanco y lo dice al lado. El aviso acompaña al
   * campo vacío, no a la persona: en cuanto vuelve a escribir, se va solo.
   */
  private readonly domicilioVaciadoPorElMapa = signal(false);
  private readonly trabajoVaciadoPorElMapa = signal(false);
  private readonly domicilioEscrito = toSignal(
    this.formPaciente.controls.homeAddressLines.valueChanges,
    { initialValue: '' },
  );
  private readonly trabajoEscrito = toSignal(
    this.formPaciente.controls.workAddressLines.valueChanges,
    { initialValue: '' },
  );
  readonly domicilioPorReescribir = computed(
    () => this.domicilioVaciadoPorElMapa() && this.domicilioEscrito().trim() === '',
  );
  readonly trabajoPorReescribir = computed(
    () => this.trabajoVaciadoPorElMapa() && this.trabajoEscrito().trim() === '',
  );
  protected readonly avisoReescribir = NOTICE_REWRITE_ADDRESS;

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
   * El parentesco del contacto de emergencia, y su catálogo (AC-03-11).
   *
   * Es el único catálogo de esta pantalla que se lee por **campo destino** y no
   * por código de conjunto de valores: su columna declara enumeración dinámica.
   * Ver {@link RelatedPersonRelationshipsCatalog}.
   */
  private readonly parentescos = inject(RelatedPersonRelationshipsCatalog);
  readonly opcionesParentesco = signal<readonly SelectOption<string>[]>([]);
  readonly catalogoParentescosCaido = signal(false);

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
   *   migraciones (ADR-0021): el cambio va por el pipeline del modelo
   *   (`.puml` → generadores), que vive en el repo `mantra-core-health-model`
   *   — **ese repo no está clonado en este checkout** (verificado: `find`
   *   por `*.puml` y `gen_ddl.py` desde la raíz del workspace no encuentra
   *   ninguno de los dos), así que el pipeline no es utilizable desde acá
   *   aunque exista en algún otro lado. Es el único pendiente del alta con
   *   dependencia de un tercero (quien lleve `mantra-core-health-model`), y
   *   por eso va como entrega aparte y no atado a ésta.
   *
   * ## Lo que sí pregunta desde esta entrega
   *
   * - **Relación del contacto de emergencia** (AC-03-11). Ya no falta nada:
   *   la columna `profiles.related_persons.relationship_concept_id` existía, el
   *   conjunto `related-person-relationship` también —con sus 9 miembros reales
   *   (guardián, madre, padre, cónyuge, hijo/a, hermano/a, otro familiar,
   *   amistad, otro; ver `dynamic-enum-catalog.ts`)—, y lo que faltaba eran el
   *   campo del alta y el desplegable. Se lee por campo destino (`?target=`) y
   *   **no** con un `enum` de TypeScript, que es lo que la regla del proyecto
   *   prohíbe. Ver {@link campoRelacionDelContacto}.
   * - **Razón social** de facturación: Se captura mediante `billingLegalName`
   *   y viaja asociada al NIT para la emisión de facturas.
   *
   * Pasa por `paginarCampos` aunque ninguna sección llegue a cinco campos: es
   * la función la que hace cumplir el tope, y declararlo a mano sería confiar en
   * que quien agregue el campo trece se acuerde de contar.
   */
  readonly paginasPaciente = computed<readonly PaginaDeFormulario[]>(() => [
    {
      titulo: 'Identidad y ocupación',
      clave: 'identity',
      icon: 'patients',
      hint: 'Como figura en su documento. Si no tiene algún dato opcional, déjelo vacío.',
      campos: [
        {
          key: 'name',
          label: '',
          control: 'custom',
          mensajeDeError: 'Ingrese su nombre.',
        },
        {
          key: 'lastName',
          label: 'Apellido paterno',
          description: 'El apellido de su papá, como figura en su documento.',
          control: 'text',
          soloLetras: true,
          required: true,
          autocomplete: 'family-name',
          placeholder: 'Mamani',
          testId: 'registro-apellido-paterno',
          icono: 'people',
          ancho: 'mitad',
          mensajeDeError: 'Ingrese su apellido paterno.',
        },
        {
          key: 'motherLastName',
          label: 'Apellido materno',
          hint: 'Si no lleva, déjelo vacío.',
          description: 'El apellido de su mamá, tal como aparece en su documento.',
          control: 'text',
          soloLetras: true,
          autocomplete: 'family-name',
          placeholder: 'Quispe',
          testId: 'registro-apellido-materno',
          icono: 'people',
          ancho: 'mitad',
        },
        {
          key: 'nationalId',
          label: 'Documento de identidad',
          hint: 'Con este número va a iniciar sesión.',
          description:
            'El número de su cédula, sin el complemento: el departamento que la emitió va en la casilla de al lado.',
          control: 'text',
          required: true,
          autocomplete: 'username',
          placeholder: '1234567',
          testId: 'registro-documento',
          soloAlfanumerico: true,
          icono: 'patients',
          ancho: 'mitad',
          mensajeDeError: 'Ingrese su documento: solo letras y números, sin espacios.',
        },
        this.campoDepartamentoEmisor('registro-departamento-ci'),
        {
          key: 'birthDate',
          label: 'Fecha de nacimiento',
          hint: this.edadEnPalabras() ?? 'Sirve para calcular dosis y valores de referencia.',
          description:
            'Con ella calculamos su edad, y con la edad las dosis, los valores de referencia del laboratorio y qué controles le tocan.',
          control: 'date',
          required: true,
          maxDate: 'today',
          minDate: new Date(1910, 0, 1),
          mensajeDeError: 'Ingrese su fecha de nacimiento.',
          ancho: 'mitad',
        },
        {
          key: 'sexAtBirth',
          label: 'Sexo',
          hint: 'Dato clínico: cambia las dosis, los valores de referencia y los tamizajes.',
          description:
            'Es el sexo que registra su documento de identidad. Lo usamos como dato clínico, no para dirigirnos a usted.',
          control: 'select',
          required: true,
          options: OPCIONES_SEXO,
          placeholder: 'Elija una opción',
          testId: 'registro-genero',
          icono: 'heart',
          ancho: 'mitad',
          mensajeDeError: 'Elija una opción.',
        },
        this.campoOcupacion(),
        ...this.campoOtraOcupacion(),
      ],
    },
    {
      titulo: 'Lugares donde vive',
      clave: 'residence',
      icon: 'home',
      hint: 'Marque su casa en el mapa. La calle, el departamento, la provincia, el municipio y la zona salen solos del punto.',
      campos: [
        // Pedido del cliente (26/10/2026): el punto es lo único que se elige,
        // y es obligatorio. El resto se deduce de él y se muestra en sólo
        // lectura dentro del mismo selector (calle, mapa de Bolivia acercado,
        // departamento, provincia, municipio y zona). La calle y la zona viajan
        // en sus controles, que llena el punto: ver `aplicarLocalidadDeCasa`.
        {
          key: 'gpsDomicilio',
          label: 'Ubicación de su casa',
          hint: 'Toque el mapa donde vive o use su ubicación actual, y confírmelo.',
          description: 'Marque el punto exacto de su casa y confírmelo para que quede guardado.',
          control: 'custom',
          required: true,
          mensajeDeError: 'Marque su casa en el mapa y pulse «Confirmar dirección actual».',
        },
        // El municipio sale del punto. El campo sigue en la página sólo para
        // que su validación —obligatoria— tenga dónde decir que falta.
        {
          key: 'residenceMunicipalityConceptId',
          label: '',
          control: 'custom',
          required: true,
          mensajeDeError:
            'No pudimos ubicar su municipio con ese punto. Mueva el pin dentro de Bolivia.',
        },
      ],
    },
    {
      titulo: 'Datos de contacto y emergencia',
      clave: 'contact',
      icon: 'phone',
      hint: 'Su celular, a quién avisamos si hace falta y su ambulancia de confianza.',
      campos: [
        {
          key: 'phone',
          label: 'Su celular',
          hint: 'Elija el país si su número no es de Bolivia.',
          description:
            'Es por donde le avisamos de una cita o de un resultado. No se muestra a nadie más.',
          control: 'tel',
          required: true,
          autocomplete: 'tel',
          testId: 'registro-telefono',
          mensajeDeError: 'Ingrese un número completo para el país elegido.',
        },
        {
          key: 'additionalPhones',
          label: '',
          control: 'custom',
        },
        {
          key: 'guardianName',
          label: 'Contacto de emergencia (opcional)',
          hint: 'A quién llamamos si pasa algo, o quién le acompaña si es menor.',
          description: 'A quién llamamos si le pasa algo y no puede responder usted.',
          control: 'text',
          soloLetras: true,
          placeholder: 'Rosa Quispe',
          testId: 'registro-tutor-nombre',
          icono: 'people',
          ancho: 'mitad',
        },
        {
          key: 'guardianPhone',
          label: 'Su teléfono (opcional)',
          hint: 'Elija el país si el número no es de Bolivia.',
          description: 'El número al que llamamos a esa persona. Sin su nombre no se guarda.',
          control: 'tel',
          testId: 'registro-tutor-telefono',
          ancho: 'mitad',
          mensajeDeError: 'Para guardar el teléfono, cuéntenos también su nombre.',
        },
        this.campoRelacionDelContacto(),
        {
          key: 'additionalEmergencyContacts',
          label: '',
          control: 'custom',
        },
        {
          // Sin `label`, `hint` ni `description`: el motor envuelve cada campo
          // `custom` en un `app-form-field` con esos textos, y la plantilla de este
          // campo ya lleva el suyo (es el que cablea el selector por DI con su
          // etiqueta y su ayuda). Declararlos aquí dibujaba título y ayuda dos veces.
          key: 'trustedAmbulanceService',
          label: '',
          control: 'custom',
          icono: 'hospital',
        },
        {
          key: 'trustedAmbulanceName',
          label: 'Nombre de la ambulancia (opcional)',
          hint: 'Puede editarlo o escribir la ambulancia de su seguro o clínica.',
          description: 'Se guarda sólo en este dispositivo.',
          control: 'text',
          placeholder: 'Ambulancias de mi seguro',
          testId: 'registro-ambulancia-nombre',
          icono: 'heart',
          ancho: 'mitad',
        },
        {
          key: 'trustedAmbulancePhone',
          label: 'Teléfono de la ambulancia (opcional)',
          hint: 'Elija el país si el número no es de Bolivia.',
          description: 'Con este número, el botón de emergencia llama sin mostrar la lista de números.',
          control: 'tel',
          testId: 'registro-ambulancia-telefono',
          ancho: 'mitad',
          mensajeDeError: 'Ingrese el número completo para el país elegido.',
        },
      ],
    },
    {
      titulo: 'Empresa y lugar de trabajo',
      clave: 'work',
      icon: 'briefcase',
      hint: 'Opcional. Con el nombre de la empresa o su lugar de trabajo alcanza.',
      campos: [
        this.campoEmpresa(),
        ...this.campoOtraEmpresa(),
        // Igual que la casa: se marca el punto y el resto sale de él. Acá es
        // opcional; si se marca, el municipio, la calle y la zona se llenan solos.
        {
          key: 'gpsTrabajo',
          label: 'Ubicación de su trabajo (opcional)',
          hint: 'Toque el mapa donde trabaja, o use su ubicación actual.',
          description: 'El punto exacto de su trabajo en el mapa. Se confirma aparte del de su casa.',
          control: 'custom',
        },
        {
          key: 'workMunicipalityConceptId',
          label: '',
          control: 'custom',
        },
      ],
    },
    {
      titulo: 'Resto de datos (acceso, seguros y facturación)',
      clave: 'misc',
      icon: 'lock',
      hint: 'Su contraseña de acceso, seguros de salud y datos para facturación.',
      campos: [
        {
          key: 'email',
          label: 'Correo electrónico',
          hint: 'Por acá recupera su cuenta y le avisamos de sus turnos.',
          description:
            'No es con lo que entra —eso es su documento—, pero sin él no hay forma de devolverle el acceso si pierde la contraseña.',
          control: 'email',
          required: true,
          autocomplete: 'email',
          placeholder: 'correo@ejemplo.com',
          testId: 'registro-correo',
          icono: 'mail',
          mensajeDeError: 'Ingrese un correo válido.',
          ancho: 'mitad',
        },
        {
          key: 'password',
          label: 'Contraseña',
          hint: 'Al menos 8 caracteres.',
          description:
            'Se guarda cifrada: ni el equipo de AloVida puede verla, y por eso nunca se la vamos a pedir por teléfono ni por correo.',
          control: 'password',
          required: true,
          autocomplete: 'new-password',
          placeholder: 'Su contraseña',
          testId: 'registro-password',
          icono: 'lock',
          mensajeDeError: MESSAGE_SHORT_PASSWORD,
          ancho: 'mitad',
        },
        this.campoSeguro('privado'),
        this.campoSeguro('publico'),
        {
          key: 'billingTaxId',
          label: 'NIT (opcional)',
          hint: 'Sólo el número.',
          description:
            'Lo usamos cuando hay que emitir una factura. Si no lo tiene a mano, déjelo vacío.',
          control: 'text',
          placeholder: '1023456789',
          testId: 'registro-nit',
          icono: 'billing',
          ancho: 'mitad',
          mensajeDeError: 'El NIT es sólo números.',
        },
        {
          key: 'billingLegalName',
          label: 'Nombre o Razón Social (opcional)',
          hint: 'A nombre de quién se emite la factura.',
          description:
            'Si declara NIT, ingrese el nombre o razón social correspondiente.',
          control: 'text',
          placeholder: 'Carlos Roca Aguilera',
          testId: 'registro-razon-social',
          icono: 'billing',
          ancho: 'mitad',
        },
      ],
    },
  ]);

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
      description:
        'El departamento que emitió su cédula: distingue dos documentos con el mismo número.',
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
          icono: 'pin',
          // La otra mitad del renglón del documento. Ver la página que lo usa.
          ancho: 'mitad',
        };
  }

  /**
   * El campo de «Relación» del contacto de emergencia (AC-03-11).
   *
   * ## Por qué es opcional
   *
   * Porque el contacto entero lo es: pedir el parentesco de una persona que
   * quizá no se declaró no tiene sentido, y volverlo obligatorio en cuanto hay
   * nombre convertiría en una traba lo que hoy se contesta en un segundo. La
   * bitácora lo pide junto al contacto, no como requisito.
   *
   * ## Por qué el valor es un uuid y no una palabra
   *
   * Porque `profiles.related_persons.relationship_concept_id` es una columna de
   * concepto, y el conjunto que la gobierna se publica como enumeración
   * dinámica. Lo que se manda es el `conceptId` que el propio catálogo devolvió;
   * lo que se ve es la palabra en castellano de {@link ETIQUETAS_PARENTESCO}.
   * Un `enum` de TypeScript acá sería inventar una taxonomía paralela a la del
   * modelo, que es exactamente lo que la regla del proyecto prohíbe.
   *
   * ## Y por qué desaparece si el catálogo no cargó
   *
   * Misma mecánica que el departamento emisor y los seguros: sin opciones, un
   * `select` es un desplegable vacío indistinguible de un catálogo que de verdad
   * no tiene ninguna. El campo pasa a `custom` y la pantalla proyecta ahí el
   * aviso con su «Reintentar». El alta sigue en pie: es opcional.
   */
  private campoRelacionDelContacto(): CampoDeFormulario {
    const base = {
      key: 'guardianRelationshipConceptId',
      label: 'Su relación con usted (opcional)',
      hint: 'Qué es suyo el contacto de emergencia: madre, pareja, una amistad…',
      description: 'Sirve para saber cómo presentarnos cuando llamemos a esa persona.',
    } as const;

    return this.catalogoParentescosCaido()
      ? { ...base, control: 'custom' }
      : {
          ...base,
          control: 'select',
          options: this.opcionesParentesco(),
          placeholder: 'Sin especificar',
          testId: 'registro-tutor-relacion',
          icono: 'people',
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
      hint: 'En qué trabaja. Ayuda a su médico con los riesgos propios de cada oficio.',
      description: 'Su oficio le dice a su médico qué riesgos son propios de su trabajo.',
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
        label: 'Especifique su ocupación',
        hint: 'Escriba su oficio como lo diría usted.',
        description: 'El oficio que no encontró en la lista: se guarda tal cual lo escriba.',
        control: 'text',
        placeholder: 'Apicultor',
        testId: 'registro-ocupacion-otra',
        icono: 'briefcase',
      },
    ];
  }

  private campoEmpresa(): CampoDeFormulario {
    return {
      key: 'workEmployerConceptId',
      label: 'Empresa donde trabaja (opcional)',
      hint: 'Busque el nombre. Si no está, elija «Otra empresa» y la escribe.',
      description: 'Sirve para los convenios con empresas y los controles de salud laboral.',
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
        hint: 'Escriba el nombre como lo conoce.',
        description: 'El nombre de la empresa que no está en la lista, como figura en su cartel.',
        control: 'text',
        placeholder: 'Ferretería San Martín',
        testId: 'registro-empresa-otra',
        icono: 'building',
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
          hint: 'La compañía con la que tiene su póliza de salud.',
          description: 'Con su póliza declarada, la cobertura se aplica cuando reserva o compra.',
        }
      : {
          key: 'publicInsurancePlanId',
          label: 'Seguro público (opcional)',
          hint: 'La caja o el seguro estatal al que está afiliado.',
          description:
            'La caja o el seguro del Estado al que aporta por su trabajo o el de su familia.',
        };

    return this.catalogoAseguradorasCaido()
      ? { ...base, control: 'custom' }
      : {
          ...base,
          control: 'select',
          options: esPrivado ? this.opcionesSeguroPrivado() : this.opcionesSeguroPublico(),
          placeholder: 'No tengo',
          testId: esPrivado ? 'registro-seguro-privado' : 'registro-seguro-publico',
          // Dos glifos y no uno: el paraguas es la cobertura que se contrata y
          // el hospital la del Estado. Con el mismo dibujo, las dos preguntas
          // de esta página se leerían como la misma repetida.
          icono: esPrivado ? 'umbrella' : 'hospital',
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
    return edad === 1 ? 'Tiene 1 año.' : `Tiene ${edad} años.`;
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

  /** Los topes del «+», para la plantilla. */
  readonly maxTelefonosExtra = MAX_TELEFONOS_EXTRA;
  readonly maxContactosExtra = MAX_CONTACTOS_EXTRA;

  /** Los avisos de los campos sumados con el «+». */
  readonly errorTelefonoExtra = 'Ingrese un número completo para el país elegido, o quite la casilla.';
  readonly errorNombreContacto = 'Escriba su nombre, o quite este contacto.';
  readonly errorTelefonoContacto = 'Ingrese el número completo para el país elegido.';

  /** Los teléfonos sumados con el «+», en el orden en que se agregaron. */
  get telefonosExtra(): FormArray<FormControl<string>> {
    return this.formPaciente.controls.additionalPhones;
  }

  /** Los contactos de emergencia sumados con el «+». */
  get contactosExtra(): FormArray<ContactoExtra> {
    return this.formPaciente.controls.additionalEmergencyContacts;
  }

  /** Suma una casilla de teléfono, hasta el tope que acepta la API. */
  agregarTelefono(): void {
    if (this.telefonosExtra.length >= MAX_TELEFONOS_EXTRA) return;
    this.telefonosExtra.push(nuevoTelefonoExtra());
  }

  /**
   * Quita uno de los teléfonos sumados.
   *
   * @param indice - Cuál de los teléfonos extra, empezando por 0.
   */
  async quitarTelefono(indice: number): Promise<void> {
    const numero = this.telefonosExtra.at(indice)?.value.trim() ?? '';
    if (
      numero !== '' &&
      !(await this.confirmarQuitar(`Quitar el celular ${indice + 1}`, 'Se borra el número que escribió en esta casilla.'))
    ) {
      return;
    }
    this.telefonosExtra.removeAt(indice);
  }

  /** Suma un contacto de emergencia, hasta el tope que acepta la API. */
  agregarContacto(): void {
    if (this.contactosExtra.length >= MAX_CONTACTOS_EXTRA) return;
    this.contactosExtra.push(nuevoContactoExtra());
  }

  /**
   * Quita uno de los contactos sumados.
   *
   * @param indice - Cuál de los contactos extra, empezando por 0.
   */
  async quitarContacto(indice: number): Promise<void> {
    const contacto = this.contactosExtra.at(indice)?.getRawValue();
    const tieneDatos =
      contacto !== undefined &&
      (contacto.name.trim() !== '' || contacto.phone.trim() !== '' || contacto.relationshipConceptId !== null);
    if (
      tieneDatos &&
      !(await this.confirmarQuitar(
        `Quitar el contacto de emergencia ${indice + 1}`,
        'Se borran el nombre, el teléfono y la relación que escribió para esta persona.',
      ))
    ) {
      return;
    }
    this.contactosExtra.removeAt(indice);
  }

  /**
   * Pregunta antes de borrar algo que la persona ya escribió (TAREA 04, AC-04-7).
   *
   * Una casilla vacía se quita sin preguntar: no hay nada que perder, y un
   * diálogo ahí sólo agrega un clic. Con datos, el botón de ícono queda a un
   * toque de borrar un contacto entero, y eso sí se confirma.
   *
   * @param titulo - Qué se quita, tal como lo dice el `aria-label` del botón.
   * @param mensaje - Qué se pierde.
   * @returns `true` si la persona confirmó.
   */
  private confirmarQuitar(titulo: string, mensaje: string): Promise<boolean> {
    return this.dialogs.confirm({
      title: titulo,
      message: mensaje,
      confirmLabel: 'Quitar',
      cancelLabel: 'Conservar',
      destructive: true,
    });
  }

  /**
   * Si un control de los sumados con el «+» tiene que mostrarse en rojo.
   *
   * El motor marca como tocado el arreglo entero al intentar avanzar, no a sus
   * hijos: por eso cuenta tanto el control como su arreglo.
   *
   * @param control - El teléfono, o el nombre o teléfono de un contacto.
   * @param arreglo - El arreglo al que pertenece.
   * @returns `true` si es inválido y ya se intentó avanzar o se lo tocó.
   */
  enRojo(control: AbstractControl, arreglo: AbstractControl): boolean {
    return control.invalid && (control.touched || arreglo.touched);
  }

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
  async quitarNombre(indice: number): Promise<void> {
    const nombre = this.nombresExtra()[indice]?.trim() ?? '';
    if (
      nombre !== '' &&
      !(await this.confirmarQuitar(`Quitar el nombre ${indice + 4}`, `Se borra «${nombre}» de esta casilla.`))
    ) {
      return;
    }
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
    // «Otra empresa» va PRIMERA y no se filtra (pedido del cliente del
    // 26/10/2026, igual que «Otra ocupación»): quien no encuentra la suya tiene
    // que ver la salida sin bajar hasta el final ni borrar lo que tecleó.
    const otra = todas.filter((o) => o.code === CODIGO_EMPRESA_OTRA);
    const resto = todas.filter((o) => o.code !== CODIGO_EMPRESA_OTRA);
    const elegidas = busqueda
      ? resto.filter((o) => o.label.toLowerCase().includes(busqueda))
      : resto;
    return [...otra, ...elegidas].map((o) => ({ value: o.value, label: o.label }));
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
    this.pedirUbicacion(this.destinoDomicilio);
  }

  /** Lo mismo, para el lugar de trabajo. Ver {@link usarMiUbicacion}. */
  usarMiUbicacionDeTrabajo(): void {
    this.pedirUbicacion(this.destinoTrabajo);
  }

  /**
   * Abre el mapa vacío para poner el pin del domicilio a mano.
   *
   * No pide nada al navegador ni toca lo que hubiera: es la puerta para quien
   * no quiere —o no puede— compartir dónde está ahora, que casi nunca es donde
   * vive.
   */
  marcarDomicilioEnMapa(): void {
    this.abrirMapa(this.destinoDomicilio);
  }

  /** Lo mismo, para el trabajo. */
  marcarTrabajoEnMapa(): void {
    this.abrirMapa(this.destinoTrabajo);
  }

  /**
   * Un toque sobre el mapa del domicilio: el pin va ahí.
   *
   * Sirve para poner el primer pin sobre el mapa vacío y para correr uno que
   * ya estaba, viniera del GPS o de otro toque. En los dos casos el punto queda
   * **sin confirmar**: quien lo movió es quien tiene que mirarlo y decir que sí.
   */
  fijarPuntoDomicilio(punto: Coordenadas): void {
    this.fijarPunto(this.destinoDomicilio, punto);
    // D-06: el punto nuevo ya no es la calle que estaba escrita. Se vacía «en
    // nombre del formulario», igual que al sembrar: no lo tecleó la persona.
    this.escribirDireccionSembrada(this.formPaciente.controls.homeAddressLines, '');
    this.domicilioVaciadoPorElMapa.set(true);
    this.sincronizarCasa();
    this.traerCalleDelPunto(this.gpsDomicilio()!);
  }

  /** Lo mismo, para el trabajo. */
  fijarPuntoDeTrabajo(punto: Coordenadas): void {
    this.fijarPunto(this.destinoTrabajo, punto);
    this.escribirDireccionSembrada(this.formPaciente.controls.workAddressLines, '');
    this.trabajoVaciadoPorElMapa.set(true);
  }

  /** Las seis señales del domicilio, con el nombre que espera {@link pedirUbicacion}. */
  private get destinoDomicilio(): DestinoDeUbicacion {
    return {
      punto: this.gpsDomicilio,
      pidiendo: this.pidiendoGps,
      confirmada: this.direccionConfirmada,
      rechazado: this.gpsRechazado,
      marcando: this.marcandoDomicilio,
      delNavegador: this.gpsDomicilioDelNavegador,
    };
  }

  /** Las seis señales del trabajo. Ver {@link destinoDomicilio}. */
  private get destinoTrabajo(): DestinoDeUbicacion {
    return {
      punto: this.gpsTrabajo,
      pidiendo: this.pidiendoGpsTrabajo,
      confirmada: this.direccionTrabajoConfirmada,
      rechazado: this.gpsTrabajoRechazado,
      marcando: this.marcandoTrabajo,
      delNavegador: this.gpsTrabajoDelNavegador,
    };
  }

  private abrirMapa(destino: DestinoDeUbicacion): void {
    destino.marcando.set(true);
    destino.rechazado.set(false);
  }

  private fijarPunto(destino: DestinoDeUbicacion, punto: Coordenadas): void {
    // Mover el pin es empezar de nuevo la confirmación: lo confirmado valía
    // para el punto anterior.
    destino.confirmada.set(false);
    destino.punto.set({ lat: punto.lat, lng: punto.lng });
    destino.delNavegador.set(false);
    destino.marcando.set(false);
    destino.rechazado.set(false);
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
        destino.delNavegador.set(true);
        destino.marcando.set(false);
        destino.rechazado.set(false);
        destino.pidiendo.set(false);
        if (destino.punto === this.gpsDomicilio) {
          this.traerCalleDelPunto(this.gpsDomicilio()!);
        }
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
   * La calle la escribe el punto, no la confirmación: ver {@link traerCalleDelPunto}.
   */
  /* ---- El flujo del 26/10/2026: el punto y nada más -----------------------
     El selector compartido (`app-map-location-picker`) abre el mapa, pide la
     calle, acerca el mapa de Bolivia y deduce la localidad. Acá sólo se
     guarda lo que avisa: el punto confirmado y lo deducido de él. */

  protected readonly idsUbicacionCasa: IdsDeUbicacion = {
    mapa: 'registro-mapa-domicilio',
    confirmada: 'registro-direccion-confirmada',
    avisoGeocodificacion: 'registration-home-geocoding-notice',
    quitar: 'registration-home-location-remove',
    confirmar: 'registro-confirmar-direccion',
    usarUbicacion: 'registro-usar-ubicacion',
    marcarEnMapa: 'registration-home-location-pick',
  };

  protected readonly idsUbicacionTrabajo: IdsDeUbicacion = {
    mapa: 'registration-work-map',
    confirmada: 'registration-work-location-confirmed',
    avisoGeocodificacion: 'registration-work-geocoding-notice',
    quitar: 'registration-work-location-remove',
    confirmar: 'registration-work-location-confirm',
    usarUbicacion: 'registration-work-location-use',
    marcarEnMapa: 'registration-work-location-pick',
  };

  /** El punto de la casa, confirmado o soltado en el selector. */
  confirmarCasa(punto: Coordenadas | null): void {
    if (punto !== null) this.gpsDomicilio.set(punto);
    this.direccionConfirmada.set(punto !== null);
    this.sincronizarCasa();
  }

  /** El punto del trabajo, confirmado o soltado en el selector. */
  confirmarTrabajo(punto: Coordenadas | null): void {
    if (punto !== null) this.gpsTrabajo.set(punto);
    this.direccionTrabajoConfirmada.set(punto !== null);
  }

  /**
   * Lo deducido del punto de la casa llena los controles que viajan en el
   * alta. No se editan a mano: si algo no es así, se mueve el pin.
   */
  aplicarLocalidadDeCasa(localidad: LocalityFromPoint | null): void {
    const c = this.formPaciente.controls;
    if (localidad === null) {
      this.escribirDireccionSembrada(c.homeAddressLines, '');
      c.homeDistrict.setValue('');
      return;
    }
    const municipio = localidad.municipioConceptId;
    if (municipio !== null && municipio !== c.residenceMunicipalityConceptId.value) {
      this.elegirMunicipio(municipio);
    }
    this.escribirDireccionSembrada(c.homeAddressLines, localidad.calleSola ?? '');
    c.homeDistrict.setValue(localidad.zona ?? '');
  }

  /** Lo mismo, para el lugar de trabajo. */
  aplicarLocalidadDeTrabajo(localidad: LocalityFromPoint | null): void {
    const c = this.formPaciente.controls;
    if (localidad === null) {
      this.escribirDireccionSembrada(c.workAddressLines, '');
      c.workDistrict.setValue('');
      return;
    }
    const municipio = localidad.municipioConceptId;
    if (municipio !== null && municipio !== c.workMunicipalityConceptId.value) {
      this.elegirMunicipioDeTrabajo(municipio);
    }
    this.escribirDireccionSembrada(c.workAddressLines, localidad.calleSola ?? '');
    c.workDistrict.setValue(localidad.zona ?? '');
  }

  confirmarDireccionActual(): void {
    if (this.gpsDomicilio() === null) return;
    this.direccionConfirmada.set(true);
    this.sincronizarCasa();
  }

  /**
   * Copia el punto CONFIRMADO al control obligatorio `gpsDomicilio`.
   *
   * La corre un `effect` (cubre el borrador y el GPS del navegador, que llegan
   * solos) y además, en el acto, cada acción de la persona sobre el punto: el
   * `effect` espera a la próxima detección de cambios, y un envío inmediato
   * vería el control atrasado.
   */
  private sincronizarCasa(): void {
    const confirmado = this.direccionConfirmada() ? this.gpsDomicilio() : null;
    const control = this.formPaciente.controls.gpsDomicilio;
    if (control.value !== confirmado) control.setValue(confirmado);
  }

  /** Lo mismo, para el trabajo. */
  confirmarDireccionDeTrabajo(): void {
    if (this.gpsTrabajo() === null) return;
    this.direccionTrabajoConfirmada.set(true);
  }

  /** Olvida la ubicación capturada, y con ella su confirmación; cierra el mapa. */
  quitarUbicacion(): void {
    this.gpsDomicilio.set(null);
    this.direccionConfirmada.set(false);
    this.marcandoDomicilio.set(false);
    this.calleDelPunto.set('sin-pedir');
    this.sincronizarCasa();
  }

  /** Lo mismo, para el trabajo. */
  quitarUbicacionDeTrabajo(): void {
    this.gpsTrabajo.set(null);
    this.direccionTrabajoConfirmada.set(false);
    this.marcandoTrabajo.set(false);
  }

  readonly state = signal<ViewState<null>>(ready(null));
  readonly isSubmitting = computed(() => this.state().status === 'loading');

  readonly registered = signal(false);
  readonly verificationSent = signal(false);

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
    () => AYUDA_PACIENTE[this.claveVisible()] ?? [],
  );

  /** Guarda el borrador del avance del formulario en caché (localStorage) y backend remoto. */
  guardarBorrador(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const paginas = this.paginasPaciente();
      const clave = this.claveVisible();
      const indice = Math.max(0, paginas.findIndex((p) => p.clave === clave));
      const titulo = paginas[indice]?.titulo ?? clave;
      const raw = this.formPaciente.getRawValue();
      // La contraseña nunca se escribe en el almacenamiento del navegador.
      const valores: Record<string, unknown> = {
        ...raw,
        birthDate: raw.birthDate instanceof Date ? raw.birthDate.toISOString() : null,
      };
      delete valores['password'];
      delete valores['confirmPassword'];
      const extraData = {
        nombresExtra: this.nombresExtra(),
        empresaSeleccionada: this.empresaSeleccionada(),
        ocupacionSeleccionada: this.ocupacionSeleccionada(),
        ocupacionesPersonalizadas: this.ocupacionesPersonalizadas(),
        gpsDomicilio: this.gpsDomicilio(),
        direccionConfirmada: this.direccionConfirmada(),
        gpsTrabajo: this.gpsTrabajo(),
        direccionTrabajoConfirmada: this.direccionTrabajoConfirmada(),
      };
      // Compatibilidad con pruebas unitarias legacy
      const borrador = {
        version: 1,
        pasoIndice: indice,
        pasoClave: clave,
        formValores: valores,
        ...extraData,
        fechaModificacion: new Date().toISOString(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(borrador));

      // Servicio fullstack con debounce hacia la API
      this.draftService.saveProgress(
        'patient',
        indice,
        clave,
        titulo,
        valores,
        extraData,
        paginas.length,
      );
      this.draftService.trackEvent('step_view', 'patient', indice, {
        stepKey: clave,
      });
    } catch {
      // Ignorar restricciones en almacenamiento local
    }
  }

  /**
   * Lee el borrador antiguo de `localStorage` (sólo la versión 1) y lo deja
   * limpio: los borradores viejos guardaban la contraseña en claro, así que se
   * borra y se reescribe la clave sin ella.
   */
  private leerBorradorLocal(): BorradorLocal | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      const serializado = localStorage.getItem(this.STORAGE_KEY);
      const parseado = serializado ? JSON.parse(serializado) : null;
      // Sólo la versión 1 del formato antiguo; otra cosa es basura o futuro.
      const legacy: BorradorLocal | null =
        parseado && typeof parseado === 'object' && parseado.version === 1 ? parseado : null;
      if (legacy?.formValores && typeof legacy.formValores === 'object') {
        // Borradores viejos guardaban la contraseña en claro: se borra y se
        // reescribe la clave limpia, para que no se reinyecte ni se quede.
        const tenia = 'password' in legacy.formValores || 'confirmPassword' in legacy.formValores;
        delete legacy.formValores['password'];
        delete legacy.formValores['confirmPassword'];
        if (tenia) localStorage.setItem(this.STORAGE_KEY, JSON.stringify(legacy));
      } else if (parseado && !legacy) {
        localStorage.removeItem(this.STORAGE_KEY);
      }
      return legacy;
    } catch {
      return null;
    }
  }

  /** Restaura el avance previo del formulario desde caché si existe. */
  restaurarBorrador(draftParam?: OnboardingDraft): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      const legacy = this.leerBorradorLocal();
      const draft = draftParam ?? (legacy ? undefined : this.draftService.detectDraft('patient') ?? undefined);

      const rawValores = draft ? draft.data : legacy?.formValores;
      if (rawValores) {
        const valores = { ...rawValores } as Record<string, unknown>;
        delete valores['password'];
        delete valores['confirmPassword'];
        if (typeof valores['birthDate'] === 'string' && valores['birthDate']) {
          const d = new Date(valores['birthDate']);
          valores['birthDate'] = !Number.isNaN(d.getTime()) ? d : null;
        }
        // `patchValue` no crea filas en un `FormArray`: sólo llena las que hay.
        // Se arman primero, del largo guardado, y después se llenan.
        if (Array.isArray(valores['additionalPhones'])) {
          this.telefonosExtra.clear();
          for (const telefono of valores['additionalPhones'].slice(0, MAX_TELEFONOS_EXTRA)) {
            this.telefonosExtra.push(nuevoTelefonoExtra(String(telefono ?? '')));
          }
          delete valores['additionalPhones'];
        }
        if (Array.isArray(valores['additionalEmergencyContacts'])) {
          this.contactosExtra.clear();
          const contactos = valores['additionalEmergencyContacts'] as Parameters<
            typeof nuevoContactoExtra
          >[0][];
          for (const contacto of contactos.slice(0, MAX_CONTACTOS_EXTRA)) {
            this.contactosExtra.push(nuevoContactoExtra(contacto ?? {}));
          }
          delete valores['additionalEmergencyContacts'];
        }
        this.formPaciente.patchValue(valores);
      }

      const extra = (draft ? draft.extraData : legacy) ?? {};
      if (Array.isArray(extra['nombresExtra'])) {
        this.nombresExtra.set(extra['nombresExtra'] as readonly string[]);
      }
      if (extra['empresaSeleccionada'] !== undefined) {
        this.empresaSeleccionada.set(extra['empresaSeleccionada'] as string | null);
      }
      if (extra['ocupacionSeleccionada'] !== undefined) {
        this.ocupacionSeleccionada.set(extra['ocupacionSeleccionada'] as string | null);
      }
      if (Array.isArray(extra['ocupacionesPersonalizadas'])) {
        this.ocupacionesPersonalizadas.set(extra['ocupacionesPersonalizadas'] as readonly (SelectOption<string> & { code: string })[]);
      }
      if (extra['gpsDomicilio'] !== undefined) {
        this.gpsDomicilio.set(extra['gpsDomicilio'] as Coordenadas | null);
      }
      if (typeof extra['direccionConfirmada'] === 'boolean') {
        this.direccionConfirmada.set(extra['direccionConfirmada']);
      }
      if (extra['gpsTrabajo'] !== undefined) {
        this.gpsTrabajo.set(extra['gpsTrabajo'] as Coordenadas | null);
      }
      if (typeof extra['direccionTrabajoConfirmada'] === 'boolean') {
        this.direccionTrabajoConfirmada.set(extra['direccionTrabajoConfirmada']);
      }
      const pasoIndice = draft?.stepIndex ?? legacy?.pasoIndice;
      if (typeof pasoIndice === 'number' && pasoIndice >= 0) {
        this.pasoGuardado.set(pasoIndice);
      }

      this.borradorDetectado.set(null);
    } catch {
      // Ignorar si el borrador estaba corrupto
    }
  }

  /** Descarta el borrador y limpia el estado. */
  descartarBorrador(): void {
    this.limpiarBorrador();
    this.draftService.trackEvent('abandon', 'patient', 0);
  }

  /** Elimina el borrador en caché al completar exitosamente el registro. */
  limpiarBorrador(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.draftService.clearDraft('patient');
      this.borradorDetectado.set(null);
    } catch {
      // Ignorar
    }
  }

  /** Lo que el motor avisa al cambiar de página. */
  recordarPaso(pagina: PaginaDeFormulario): void {
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
    this.leerBorradorLocal();
    const detectado = this.draftService.detectDraft('patient');
    if (detectado && (detectado.stepIndex > 0 || Object.keys(detectado.data).length > 2)) {
      this.borradorDetectado.set(detectado);
    } else {
      // Soporte para pruebas directas que no muestran banner
      this.restaurarBorrador();
    }
    this.draftService.trackEvent('start', 'patient', 0);

    this.cargarDepartamentos();
    this.cargarMunicipios();
    this.cargarOcupaciones();
    this.cargarEmpresas();
    this.cargarAseguradoras();
    this.cargarParentescos();

    this.limpiarElErrorAlCorregir(this.formPaciente);
    this.escucharPedidosDeCalle();

    // El punto del domicilio, al control obligatorio: sólo el CONFIRMADO. Sin
    // `emitEvent: false`: el cambio tiene que llegar al borrador y al aviso de
    // error del motor, igual que un campo escrito.
    effect(() => this.sincronizarCasa());

    this.formPaciente.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.guardarBorrador();
    });

    this.formPaciente.controls.occupationFreeText.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((valor) => {
        if (this.ocupacionEsOtra() && valor && valor.trim().length >= 3) {
          this.registrarNuevaOcupacion(valor);
        }
      });
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
   * Garantiza que «Otra ocupación» aparezca al principio de la lista para fácil acceso
   * y combina las ocupaciones ingresadas dinámicamente por el usuario.
   */
  protected cargarOcupaciones(): void {
    this.ocupaciones.list().subscribe({
      next: (opciones) => {
        this.catalogoOcupacionesCaido.set(false);
        const mapeadas = opciones.map((opcion) => ({
          value: opcion.conceptId,
          label: opcion.display,
          code: opcion.code,
        }));
        // Asegurar que «Otra ocupación» aparezca primero
        const ordenadas = [...mapeadas];
        const idxOtra = ordenadas.findIndex(
          (o) =>
            o.code === CODIGO_OCUPACION_OTRA ||
            o.code.toLowerCase().includes('otra') ||
            o.label.toLowerCase().startsWith('otra'),
        );
        if (idxOtra > 0) {
          const [otra] = ordenadas.splice(idxOtra, 1);
          ordenadas.unshift(otra);
        } else if (idxOtra === -1 && ordenadas.length > 0) {
          ordenadas.unshift({
            value: 'o-otra',
            label: 'Otro',
            code: CODIGO_OCUPACION_OTRA,
          });
        }
        // Incorporar las ocupaciones personalizadas registradas previamente
        const personalizadas = this.ocupacionesPersonalizadas();
        const combinadas =
          personalizadas.length > 0
            ? [ordenadas[0], ...personalizadas, ...ordenadas.slice(1)]
            : ordenadas;
        this.opcionesOcupacion.set(combinadas);
      },
      error: () => {
        this.opcionesOcupacion.set([]);
        this.catalogoOcupacionesCaido.set(true);
      },
    });
  }

  /** Normaliza texto eliminando acentos y espacios superfluos para cotejar similitudes. */
  private normalizarParaComparar(cadena: string): string {
    return cadena
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  /**
   * Normaliza la ocupación ingresada a Title Case con conectores estándar en minúsculas.
   */
  normalizarOcupacion(texto: string): string {
    const limpio = texto.trim().replace(/\s+/g, ' ');
    if (!limpio) return '';
    const conectores = new Set(['de', 'del', 'la', 'el', 'en', 'y', 'o', 'a', 'por', 'con']);
    return limpio
      .toLowerCase()
      .split(' ')
      .map((palabra, idx) => {
        if (idx > 0 && conectores.has(palabra)) return palabra;
        return palabra.charAt(0).toUpperCase() + palabra.slice(1);
      })
      .join(' ');
  }

  /**
   * Busca si existe una ocupación similar en las opciones activas.
   */
  buscarOcupacionSimilar(texto: string): (SelectOption<string> & { code: string }) | null {
    const buscada = this.normalizarParaComparar(texto);
    if (!buscada) return null;
    return (
      this.opcionesOcupacion().find((opcion) => {
        if (opcion.code === CODIGO_OCUPACION_OTRA) return false;
        const candidata = this.normalizarParaComparar(opcion.label);
        return candidata === buscada || candidata.startsWith(buscada);
      }) ?? null
    );
  }

  /**
   * Registra una nueva ocupación introducida por la persona:
   * La normaliza, verifica si ya existe una similar, y si es nueva la añade a la lista seleccionable.
   */
  registrarNuevaOcupacion(texto: string): void {
    const normalizada = this.normalizarOcupacion(texto);
    if (!normalizada) return;

    const similar = this.buscarOcupacionSimilar(normalizada);
    if (similar) {
      return;
    }

    const comparada = this.normalizarParaComparar(normalizada);
    const yaExiste = this.opcionesOcupacion().some(
      (o) => this.normalizarParaComparar(o.label) === comparada,
    );
    if (!yaExiste) {
      const nuevaOpcion = {
        value: `custom:occupation:${encodeURIComponent(normalizada)}`,
        label: normalizada,
        code: 'occupation:bo:CUSTOM',
      };
      this.ocupacionesPersonalizadas.update((actuales) => [...actuales, nuevaOpcion]);
      this.opcionesOcupacion.update((actuales) => {
        if (actuales.length === 0) return [nuevaOpcion];
        const idxOtra = actuales.findIndex((o) => o.code === CODIGO_OCUPACION_OTRA);
        if (idxOtra >= 0) {
          const otra = actuales[idxOtra];
          const resto = actuales.filter((_, i) => i !== idxOtra);
          return [otra, nuevaOpcion, ...resto];
        }
        return [nuevaOpcion, ...actuales];
      });
      this.guardarBorrador();
    }
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
    this.ocupaciones.forget();
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

  /**
   * Trae los parentescos publicados, para «¿qué es tuyo el contacto?».
   *
   * Mismo criterio que los demás ante un fallo: el campo es opcional, así que
   * sin catálogo la persona se registra igual y su contacto queda con el valor
   * por defecto que escribe la API.
   *
   * Las etiquetas se traducen acá, por código: el catálogo devuelve su `display`
   * en inglés técnico —«Mother relationship»— porque es terminología, no copy de
   * producto.
   */
  protected cargarParentescos(): void {
    this.parentescos.listar().subscribe({
      next: (opciones) => {
        this.catalogoParentescosCaido.set(false);
        this.opcionesParentesco.set(
          opciones.map((opcion) => ({
            value: opcion.conceptId,
            label: this.parentescos.etiquetaDe(opcion),
          })),
        );
      },
      error: () => {
        this.opcionesParentesco.set([]);
        this.catalogoParentescosCaido.set(true);
      },
    });
  }

  /** Reintenta la lectura del catálogo de parentescos. Ver `reintentarDepartamentos`. */
  protected reintentarParentescos(): void {
    this.parentescos.olvidar();
    this.cargarParentescos();
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
        const { trustedAmbulanceName, trustedAmbulancePhone } = this.formPaciente.getRawValue();
        this.ambulanciaDeConfianza.guardar(trustedAmbulanceName, trustedAmbulancePhone);
        this.limpiarBorrador();
        this.draftService.trackEvent('complete', 'patient', 4);
      },
      error: (error: unknown) => this.state.set(registrationErrorToViewState(error, 'patient')),
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
    // La calle y el distrito viajan separados (ADR-0028 de la API): la API
    // guarda el distrito en su propia columna y deduce la provincia del municipio.
    const calleDomicilio = raw.homeAddressLines.trim();
    const distritoDomicilio = raw.homeDistrict.trim();
    const municipioTrabajo = raw.workMunicipalityConceptId;
    const calleTrabajo = raw.workAddressLines.trim();
    const distritoTrabajo = raw.workDistrict.trim();
    const empresa = this.empresaSeleccionada();
    const otraEmpresa = raw.workEmployerFreeText.trim();
    // Sólo viaja lo confirmado sobre el mapa: un punto capturado y no mirado es
    // una lectura del GPS, no la dirección de nadie.
    const gpsCasa = this.direccionConfirmada() ? this.gpsDomicilio() : null;
    const gpsTrabajo = this.direccionTrabajoConfirmada() ? this.gpsTrabajo() : null;
    const nombreTutor = raw.guardianName.trim();
    const telefonoTutor = raw.guardianPhone.trim();
    const relacionTutor = raw.guardianRelationshipConceptId;
    const telefonosExtra = raw.additionalPhones.map((t) => t.trim()).filter((t) => t !== '');
    const contactosExtra = raw.additionalEmergencyContacts
      .map((c) => ({ ...c, name: c.name.trim(), phone: c.phone.trim() }))
      .filter((c) => c.name !== '')
      .map((c) => ({
        name: c.name,
        ...(c.phone === '' ? {} : { phone: c.phone }),
        ...(c.relationshipConceptId === null
          ? {}
          : { relationshipConceptId: c.relationshipConceptId }),
      }));
    const seguroPrivado = raw.privateInsurancePlanId;
    const seguroPublico = raw.publicInsurancePlanId;
    const nit = raw.billingTaxId.trim();
    const razonSocial = raw.billingLegalName.trim();
    const rawOtraOcupacion = this.ocupacionEsOtra() ? raw.occupationFreeText.trim() : '';
    const otraOcupacion = rawOtraOcupacion ? this.normalizarOcupacion(rawOtraOcupacion) : '';
    if (otraOcupacion) {
      this.registrarNuevaOcupacion(otraOcupacion);
    }

    return {
      nationalId: documento,
      name: raw.name.trim(),
      lastName: raw.lastName.trim(),
      ...(nombresAdicionales === '' ? {} : { middleName: nombresAdicionales }),
      ...(apellidoMaterno === '' ? {} : { motherLastName: apellidoMaterno }),
      password: raw.password,
      // Los cinco campos que la API exige (correo, nacimiento, teléfono, sexo al
      // nacer y departamento emisor) van siempre y el tipo lo impone: el control
      // los valida, así que `submit()` no llega acá sin ellos. El vacío es la
      // red por si alguien llamara a este método sin esa comprobación: hace que
      // la API conteste 400 nombrando el campo, en vez de un cuerpo al que le
      // falta una propiedad obligatoria (mismo criterio que el municipio).
      email: correo,
      // El departamento emisor viaja atado al documento: sin CI no hay
      // identificador al que atarlo, y el backend lo escribe en la fila del
      // identificador, no en la persona. Acá el documento es obligatorio, así
      // que la única condición real es haber elegido departamento.
      issuerAdministrativeAreaConceptId: departamento ?? '',
      // Sólo el municipio: el departamento de residencia lo deriva el backend
      // del código del INE, para que el par no pueda llegar incoherente.
      //
      // Va siempre, sin condicional: el contrato lo declara obligatorio —igual
      // que el DTO del servidor— y el control lo valida, así que `submit()` no
      // llega hasta acá sin él. La cadena vacía es la red por si alguien
      // llamara a este método sin pasar por esa comprobación: hace que la API
      // conteste 400 nombrando el campo, en vez de un cuerpo al que le falta
      // una propiedad obligatoria.
      residenceMunicipalityConceptId: municipio ?? '',
      birthDate: fechaNacimiento === null ? '' : fechaIso(fechaNacimiento),
      phone: telefono,
      // `''` no es un código válido: la API responde 400 nombrando el campo.
      sexAtBirth: sexoAlNacer ?? ('' as BirthSexCode),
      ...(telefonosExtra.length === 0 ? {} : { additionalPhones: telefonosExtra }),
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
      ...(distritoDomicilio === '' ? {} : { homeDistrict: distritoDomicilio }),
      ...(gpsCasa === null ? {} : { homeLatitude: gpsCasa.lat, homeLongitude: gpsCasa.lng }),
      // Trabajo: la empresa **y** dónde queda. Los cuatro campos de ubicación
      // vuelven al alta por AC-03-1; el DTO nunca dejó de aceptarlos. Ver el
      // JSDoc de `workMunicipalityConceptId` en el `FormGroup`.
      // Con «Otra empresa» viaja el texto escrito y NO el concepto, igual que la
      // ocupación: el backend descarta el texto libre en cuanto recibe un
      // concepto, y «Otra» no nombra a ninguna empresa (ID-11).
      ...(empresa === null || this.empresaEsOtra() ? {} : { workEmployerConceptId: empresa }),
      ...(municipioTrabajo === null ? {} : { workMunicipalityConceptId: municipioTrabajo }),
      ...(calleTrabajo === '' ? {} : { workAddressLines: calleTrabajo }),
      ...(distritoTrabajo === '' ? {} : { workDistrict: distritoTrabajo }),
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
      // El parentesco sólo viaja si hay contacto **y** si se eligió uno: sin
      // contacto no describe a nadie, y sin elección la API escribe su valor
      // por defecto —«tutor o representante legal»—, que es lo que escribía
      // antes de que este campo existiera.
      ...(nombreTutor === '' || relacionTutor === null
        ? {}
        : { guardianRelationshipConceptId: relacionTutor }),
      ...(contactosExtra.length === 0 ? {} : { additionalEmergencyContacts: contactosExtra }),
      ...(seguroPrivado === null ? {} : { privateInsurancePlanId: seguroPrivado }),
      ...(seguroPublico === null ? {} : { publicInsurancePlanId: seguroPublico }),
      ...(nit === '' ? {} : { billingTaxId: nit }),
      ...(razonSocial === '' ? {} : { billingLegalName: razonSocial }),
    };
  }
}
