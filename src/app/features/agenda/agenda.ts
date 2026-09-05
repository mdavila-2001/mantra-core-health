import { DatePipe, formatDate } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  LOCALE_ID,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
import { StatusSeal } from '../../shared/components/organisms/status-seal/status-seal';
import { toBookingStatusPresentation, type BookingStatusPresentation } from './booking-status';
import {
  CITA_QUERY_PARAM,
  MOTIVO_QUERY_PARAM,
  patientChartRoute,
} from '../clinical-record/clinical-record.routes';
import { SchedulingClient } from '../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  AgendaSlot,
  Booking,
  NewPaymentState,
  PaymentStateCode,
  PaymentStateInfo,
} from '../../core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '../../core/data-access/terminology/terminology.client';
import type { ConceptLabels } from '../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../core/http/error-to-view-state';
import { NavigationService } from '../../core/navigation/navigation.service';
import { empty, loading, ready, stale } from '../../core/view-state/view-state';
import type { ViewState } from '../../core/view-state/view-state.types';
import { AppButton } from '../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../shared/components/atoms/button/button-link';
import { Badge } from '../../shared/components/atoms/badge/badge';
import { Menu } from '../../shared/components/molecules/menu/menu';
import { MenuItem } from '../../shared/components/molecules/menu/menu-item/menu-item';
import { MenuTrigger } from '../../shared/components/molecules/menu/menu-trigger/menu-trigger';
import { Link } from '../../shared/components/atoms/link/link';
import { Select } from '../../shared/components/atoms/select/select';
import type { SelectOption } from '../../shared/components/atoms/select/select.types';
import { Switch } from '../../shared/components/atoms/switch/switch';
import { Textarea } from '../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../shared/components/molecules/alert/alert';
import type { DialogDetail } from '../../shared/components/molecules/dialog/dialog.types';
import { DialogService } from '../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../shared/components/molecules/form-field/form-field';
import { Tab } from '../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../shared/components/molecules/tabs/tabs';
import { ToastService } from '../../shared/components/molecules/toast/toast.service';
import { DataTable } from '../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../shared/components/organisms/page-header/page-header';
import { AGENDA_CREATE_ROUTE, AGENDA_MINE_ROUTE, bookingNewRoute } from './agenda.routes';
import { MyAgenda } from './my-agenda/my-agenda';
import { TutorialTarget } from '../../shared/components/organisms/tutorial-overlay/tutorial-target.directive';

/**
 * Las ventanas que se ofrecen, en días.
 *
 * Presets y no un par de calendarios porque la pregunta real de una agenda es
 * «qué tengo hoy» y «qué viene»: elegir dos fechas exactas es la excepción, y
 * cobrarle ese costo a todo el mundo para servir a la excepción es al revés.
 */
const VENTANAS = [
  { clave: 'hoy', etiqueta: 'Hoy', dias: 1 },
  { clave: 'semana', etiqueta: 'Próximos 7 días', dias: 7 },
  { clave: 'mes', etiqueta: 'Próximos 30 días', dias: 30 },
] as const;

/** La clave de una ventana; es lo que viaja en la URL. */
export type VentanaClave = (typeof VENTANAS)[number]['clave'];

const VENTANA_POR_DEFECTO: VentanaClave = 'semana';

/** Tope de filas por lectura. La API admite hasta 500 en cupos y 100 en citas. */
const TOPE = 100;

/** Lo que se muestra cuando el registro no trae ese dato. */
const SIN_DATO = 'Sin registrar';

/** Roles que sí pueden abrir la ficha de un paciente (`GET /profiles/patients/:id`). */
const ROLES_CON_FICHA = ['SECURITY_ADMIN', 'SUPERADMIN'];

/**
 * Roles que sí pueden abrir el expediente clínico.
 *
 * Los declara el backend a nivel de controlador en las dos lecturas del
 * expediente (`GET /clinical/patients/:id/summary` y
 * `GET /charts/patients/:id/chart`). `SUPERADMIN` entra por lo mismo que en la
 * ficha: el `RolesGuard` lo trata como comodín, y esconderle el enlace lo
 * escondería a alguien a quien la API sí le responde.
 */
const ROLES_CON_EXPEDIENTE = ['CLINICIAN', 'PRACTITIONER', 'SUPERADMIN'];

/**
 * Cómo nombra un recurso a la tabla de perfiles profesionales.
 *
 * **Son dos porque el sistema dice las dos cosas**, y verificado contra la API
 * viva: el DTO de `scheduling` ejemplifica `health_practitioner_profiles` —que es
 * el nombre real de la tabla en el esquema `profiles`— pero los 14 recursos
 * sembrados traen `practitioner_profiles`. Aceptar sólo el del contrato haría que
 * la agenda propia no se encontrara nunca contra los datos de hoy; aceptar sólo
 * el de los datos la rompería el día que se corrijan los seeds.
 *
 * El fallo de esta lista es benigno en los dos sentidos: si ninguno coincide, la
 * agenda cae al primer recurso, que es exactamente lo que hacía antes.
 */
const TABLAS_DE_PERFIL_PROFESIONAL = ['practitioner_profiles', 'health_practitioner_profiles'];

/**
 * Roles que operan citas (`check-in`, `cancel`). Del backend: los dos
 * endpoints declaran `SCHEDULING_ADMIN`/`SCHEDULING_AGENT`, y `SUPERADMIN` es
 * el comodín de su `RolesGuard`.
 */
const ROLES_QUE_OPERAN_CITAS = ['SCHEDULING_ADMIN', 'SCHEDULING_AGENT', 'SUPERADMIN'];

/**
 * Roles que **atienden**: aceptan, rechazan, mueven, inician y cierran.
 *
 * Es la lista de mostrador más el profesional, y esa diferencia con
 * {@link ROLES_QUE_OPERAN_CITAS} no es un descuido: registrar la llegada es
 * trabajo del mostrador, mientras que decidir sobre la cita es de quien la
 * atiende. El backend declara los mismos cuatro roles en `accept`, `reject`,
 * `start`, `complete`, `cancel` y `reschedule`, y además comprueba que la cita
 * sea **de esa agenda** — un profesional no opera la de un colega.
 */
const ROLES_QUE_ATIENDEN = [...ROLES_QUE_OPERAN_CITAS, 'PRACTITIONER'];

/** Estados en los que una solicitud espera respuesta (corrección #11). */
const CODIGOS_POR_RESPONDER: ReadonlySet<string> = new Set([
  'BOOKING_REQUESTED',
  'BOOKING_PENDING_CONFIRMATION',
]);

/**
 * Estados desde los que se puede **iniciar** la atención (corrección #15).
 *
 * Con llegada registrada o sin ella: el check-in es el registro de que alguien
 * llegó al mostrador, y hay atenciones donde no hay mostrador.
 */
const CODIGOS_INICIABLES: ReadonlySet<string> = new Set([
  'BOOKING_CONFIRMED',
  'BOOKING_CHECKED_IN',
]);

/** El único estado desde el que se cierra una atención. */
const CODIGO_EN_CURSO = 'BOOKING_IN_PROGRESS';

/**
 * Estados que **no** admiten estado de pago (TAREA-13 punto 5).
 *
 * Es la mitad excluyente de la regla del propietario: «sí es excluyente con
 * rechazada y cancelada». Rechazar cancela con el motivo `CANCEL_REJECTED`, así
 * que las dos palabras caen en el mismo código y la lista tiene uno solo.
 *
 * Con el código vacío —estado sin resolver— **no se ofrece**, por lo mismo que
 * las demás acciones: ofrecer sobre un estado desconocido es adivinar.
 *
 * Esto NO es la garantía: el servidor responde 422 igual. Es no ofrecer un
 * botón que va a fallar.
 */
const CODIGOS_SIN_PAGO: ReadonlySet<string> = new Set(['BOOKING_CANCELLED']);

/** Estados en los que el backend acepta mover o cancelar una cita vigente. */
const CODIGOS_VIGENTES: ReadonlySet<string> = new Set(['BOOKING_CONFIRMED', 'BOOKING_CHECKED_IN']);

/**
 * Roles que pueden mirar la agenda **de otro recurso**.
 *
 * Son los mismos que operan citas, y el motivo es que ese es exactamente el
 * trabajo que necesita ver agendas ajenas: quien atiende el mostrador reparte
 * turnos entre todos los consultorios, y quien administra la agenda arma la
 * grilla de la organización. Nadie más.
 *
 * **Un profesional no está en la lista, y no es un olvido.** Que quien atiende
 * pueda desplegar una lista con las agendas de sus colegas y leer los pacientes
 * y los motivos de consulta de cada uno no es una comodidad: es exponer datos
 * clínicos de personas que ese profesional no atiende, dentro de una pantalla
 * que se abre todos los días. La agenda de quien atiende es la suya.
 *
 * Esto NO reemplaza a la autorización del backend —el `RolesGuard` sigue siendo
 * el que decide— pero deja de ofrecer en pantalla algo que no corresponde
 * ofrecer.
 */
const ROLES_QUE_ELIGEN_RECURSO = ROLES_QUE_OPERAN_CITAS;

/** Roles que pueden retener y confirmar un cupo. `PATIENT` reserva para sí. */
const ROLES_QUE_RESERVAN = [...ROLES_QUE_OPERAN_CITAS, 'PATIENT'];

/**
 * Roles que pueden construir agenda (UC-41-01 → UC-41-04).
 *
 * El agente de mostrador no arma la grilla; el profesional **sí**, desde el
 * autoservicio: las cinco escrituras del catálogo declaran
 * `@Roles('SCHEDULING_ADMIN', 'PRACTITIONER')`, y el backend le acota el
 * recurso al suyo. Dejarlo afuera escondía «Crear agenda» justo a quien la
 * pantalla le está pidiendo que la publique.
 */
const ROLES_QUE_CREAN_AGENDA = ['SCHEDULING_ADMIN', 'SUPERADMIN', 'PRACTITIONER'];

/**
 * Las demoras que se ofrecen (P8 · registro del cliente 4.2).
 *
 * Una lista corta y no un campo libre: la demora se avisa **mientras** la
 * consulta se corre, con el paciente siguiente esperando en la puerta, y en ese
 * momento nadie escribe un número. Son los tramos con los que se habla —«voy
 * veinte minutos atrasado»—, no una escala arbitraria.
 *
 * El backend acepta de 5 a 240 minutos; más que eso deja de ser una demora y se
 * resuelve reprogramando, y por eso la lista no llega ahí.
 */
const DEMORAS = [10, 15, 20, 30, 45, 60, 90] as const;

/** Cuál se ofrece puesta: la que más se avisa. */
const DEMORA_POR_DEFECTO = '20';

/** Tope del mensaje que acompaña la demora, el mismo que declara el DTO. */
const MAX_MENSAJE_DE_DEMORA = 300;

/** Una cita ya lista para pintar: sin uuid, con el recurso y el estado resueltos. */
export interface CitaVisible {
  readonly id: string;
  readonly cuando: Date | null;
  readonly hasta: Date | null;
  readonly recurso: string;
  /**
   * El estado con su sello: tono, forma y palabra.
   *
   * No es un `string` como en los cupos, y la diferencia es de la identidad:
   * el estado de una cita es información de estado, y el sistema de diseño
   * exige codificarla en **tres canales** —el color solo no alcanza para quien
   * no lo distingue—.
   */
  readonly estado: BookingStatusPresentation;
  readonly motivo: string;
  readonly patientProfileId: string | null;
  readonly rutaPaciente: string | null;
  /**
   * Cómo se nombra al paciente en el detalle.
   *
   * **Respeta la misma compuerta que la celda de la tabla**: la API manda
   * `patientName` sólo al titular y al profesional de esa agenda. Sin nombre se
   * dice «Paciente asignado» —que es información honesta: hay alguien, y no te
   * corresponde saber quién— y no un espacio en blanco, que se lee como un
   * error.
   */
  readonly paciente: string;
  /** El expediente clínico de la persona citada, si la sesión puede abrirlo. */
  readonly rutaExpediente: string | null;
  /**
   * El motivo tal cual vino, sin el relleno de ausencia.
   *
   * Viaja al expediente como parámetro para precargar el motivo de consulta del
   * encuentro: quien atiende no debería volver a teclear lo que la cita ya dice.
   */
  readonly motivoCrudo: string | null;
  /**
   * La cita clínica que respalda el turno, si la tiene.
   *
   * Viaja al expediente junto al motivo para que el encuentro quede atado al
   * turno que lo originó. `null` es lo corriente y no es un fallo: la reserva
   * nace en la agenda y la cita clínica es un registro posterior.
   */
  readonly appointmentId: string | null;
  /**
   * Lo que el enlace al expediente lleva en la URL, ya armado.
   *
   * Se compone acá y no en la plantilla porque son dos datos opcionales e
   * independientes: la expresión en línea que los combinaba se volvió ilegible
   * al segundo, y una plantilla que arma estructuras es una plantilla que nadie
   * puede probar por separado.
   */
  readonly paramsDelExpediente: Readonly<Record<string, string>>;
  /**
   * Cuándo se pidió la cita — la columna «fecha y hora de solicitud» del punto 1.
   *
   * Es `appointment_bookings.created_at`, que la lectura **ya traía** y que
   * ninguna pantalla mostraba. No hizo falta tocar la API para esta columna.
   */
  readonly solicitada: Date;
  /**
   * El estado de pago, o `null` si nadie lo marcó (TAREA-13 punto 5).
   *
   * `null` **no** es «pendiente de pago»: pendiente es una afirmación que
   * alguien firmó. La celda los distingue, y por eso muestra un guión y no una
   * etiqueta.
   */
  readonly pago: PaymentStateInfo | null;
  /**
   * Si esta cita admite estado de pago.
   *
   * Es la regla del propietario —«sí es excluyente con rechazada y
   * cancelada»— aplicada a la oferta: un botón que va a volver con 422 es un
   * error con forma de oferta. **La garantía real está en el servidor**, no acá.
   */
  readonly admitePago: boolean;
  /** Con la llegada ya registrada, el check-in no se vuelve a ofrecer. */
  readonly llegadaRegistrada: boolean;
}

/** Un cupo listo para pintar. */
export interface CupoVisible {
  readonly id: string;
  /** Para armar el enlace de reserva: la pantalla de reserva lo relee. */
  readonly resourceId: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly recurso: string;
  readonly estado: string;
  readonly capacidad: number;
  readonly libres: number;
  readonly disponible: boolean;
  /** «2 de 4 libres», ya con la concordancia resuelta. */
  readonly disponibilidad: string;
}

/**
 * **Agenda** (M41) — la sección que hasta ahora era un cartel.
 *
 * ## Por qué deja de ser un placeholder
 *
 * `APP_SECTIONS` la declaraba `planificada` con el motivo general del vault: el
 * backend no exponía el `GET` de colección. Para agenda **ya lo expone**: el
 * módulo se había construido entero de escritura —se generaban cupos y se
 * confirmaban citas, pero no había forma de verlos— y esa mitad que faltaba se
 * abrió con `GET /scheduling/resources`, `/slots` y `/bookings`.
 *
 * ## Qué muestra y por qué en dos pestañas
 *
 * **Citas** es lo comprometido; **Cupos** es lo que queda por ofrecer. Son dos
 * preguntas distintas —«qué tengo» y «qué puedo dar»— y mezclarlas en una tabla
 * obliga a leer una columna para saber qué se está mirando. Las pestañas también
 * evitan la lectura que no se pidió: el panel inactivo no existe en el DOM.
 *
 * ## Los identificadores que sí se muestran
 *
 * El de un cupo, y a propósito: es el que exige `POST /scheduling/slots/{id}/holds`
 * para reservar. Mismo criterio que el catálogo de terminología — se muestra el
 * dato que se vino a buscar, no se esconde por ser técnico.
 *
 * El del paciente **no** se muestra suelto. Se convierte en un enlace a su ficha
 * cuando la sesión puede abrirla, y en nada cuando no: `GET /profiles/patients/:id`
 * pide `SECURITY_ADMIN`, así que ofrecerle el enlace a quien agenda sería
 * ofrecerle un 403.
 *
 * ## Sin organización elegida no se pide nada
 *
 * `GET /scheduling/resources` exige `tenantId`. Pedirlo con la organización
 * todavía sin resolver daría un 400 que se leería como «la agenda falló», cuando
 * lo que falta es un paso previo que la propia aplicación resuelve.
 */
@Component({
  selector: 'app-agenda',
  imports: [
    TutorialTarget,
    Alert,
    AppButton,
    AppButtonLink,
    Badge,
    Menu,
    MenuItem,
    MenuTrigger,
    StatusSeal,
    DataTable,
    DatePipe,
    FormField,
    Link,
    PageHeader,
    RouterLink,
    Select,
    Switch,
    Tab,
    Tabs,
    Textarea,
    MyAgenda,
  ],
  templateUrl: './agenda.html',
  styleUrl: './agenda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Agenda {
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly navigation = inject(NavigationService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  /** El idioma activo, para formatear las fechas del detalle fuera de la plantilla. */
  private readonly idioma = inject(LOCALE_ID);
  private readonly toast = inject(ToastService);

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  /** Destino del enlace «Crear agenda» del encabezado. */
  protected readonly rutaCrearAgenda = AGENDA_CREATE_ROUTE;

  /**
   * La puerta a «Mi agenda», y la razón por la que existe este campo.
   *
   * `AGENDA_MINE_ROUTE` estaba declarada desde el principio y **nadie la
   * importaba**: las pantallas del horario —«Mi agenda», los bloqueos, cambiar
   * el horario— se enlazan entre ellas y ninguna se enlazaba desde acá, que es
   * donde el menú deja a quien entra por «Turnos». El resultado, dicho por el
   * médico que lo sufrió: «literalmente no puedo ver la agenda o horarios».
   *
   * Va primero y en primario, y «Crear agenda» pasa a secundario: publicar es
   * algo que se hace una vez, mirar la agenda es a lo que se entra todos los
   * días.
   */
  protected readonly rutaMiAgenda = AGENDA_MINE_ROUTE;

  private readonly celdaCuando =
    viewChild.required<TemplateRef<{ $implicit: CitaVisible }>>('celdaCuando');
  private readonly celdaEstado =
    viewChild.required<TemplateRef<{ $implicit: CitaVisible }>>('celdaEstado');

  private readonly celdaSolicitada =
    viewChild.required<TemplateRef<{ $implicit: CitaVisible }>>('celdaSolicitada');

  private readonly celdaPago =
    viewChild.required<TemplateRef<{ $implicit: CitaVisible }>>('celdaPago');
  private readonly celdaPaciente =
    viewChild.required<TemplateRef<{ $implicit: CitaVisible }>>('celdaPaciente');
  private readonly celdaFranja =
    viewChild.required<TemplateRef<{ $implicit: CupoVisible }>>('celdaFranja');
  private readonly celdaDisponibilidad =
    viewChild.required<TemplateRef<{ $implicit: CupoVisible }>>('celdaDisponibilidad');
  private readonly celdaCupoId =
    viewChild.required<TemplateRef<{ $implicit: CupoVisible }>>('celdaCupoId');
  private readonly celdaAccionesCita =
    viewChild.required<TemplateRef<{ $implicit: CitaVisible }>>('celdaAccionesCita');
  private readonly celdaReservar =
    viewChild.required<TemplateRef<{ $implicit: CupoVisible }>>('celdaReservar');

  /* -- Estado de la pantalla ---------------------------------------------- */

  private readonly recursos = signal<readonly AgendaResource[]>([]);
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  protected readonly citas = signal<ViewState<readonly CitaVisible[]>>(loading());
  protected readonly cupos = signal<ViewState<readonly CupoVisible[]>>(loading());

  /** Qué bloques llegaron recortados por el tope, para decirlo en pantalla. */
  protected readonly citasRecortadas = signal(false);
  protected readonly cuposRecortados = signal(false);

  protected readonly ventanas = VENTANAS;
  protected readonly tope = TOPE;

  /* -- Filtros, que viven en la URL ---------------------------------------
     Igual que el buscador de pacientes y el de terminología, y por las mismas
     razones: el enlace se comparte con el filtro puesto y «atrás» lo deshace. */

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });

  /** El recurso que la URL pide, tal cual, sin resolver. */
  private readonly recursoPedido = computed(() => this.params()?.get('recurso') ?? null);

  /**
   * El recurso que se está mirando. **Siempre hay uno** (o no hay ninguno que
   * mirar).
   *
   * No existe «todos los recursos», y no es una decisión de diseño: el backend
   * responde `422 PRECONDITION_FAILED — «Indique al menos patientProfileId o
   * resourceId para listar citas»` a `GET /scheduling/bookings` sin acotar. Una
   * agenda de la organización entera no se puede pedir, así que ofrecerla en el
   * selector sería ofrecer un botón que devuelve un error.
   *
   * Sin recurso en la URL manda **la agenda propia**, si la sesión tiene una: a
   * quien atiende le sirve la suya, no la primera de la organización.
   *
   * ## Quien no elige recurso se queda en el suyo, y en ninguno más
   *
   * Para una sesión sin rol de agenda (un profesional, un clínico) esto devuelve
   * **su recurso o `null`**, y nunca el primero de la organización. Antes caía
   * al primero, y esa caída tenía dos consecuencias feas a la vez: un médico sin
   * agenda propia en esa institución abría la pantalla y se encontraba mirando
   * los pacientes y los motivos de consulta de un colega, sin haber pedido nada;
   * y un enlace con `?recurso=` de otro le abría esa agenda directamente.
   *
   * Es mejor no mostrar ninguna agenda y explicar por qué —lo hace
   * `sinAgendaPropia()`— que mostrar la de otra persona.
   */
  protected readonly recursoElegido = computed(() => {
    const propia = this.recursoPropio();

    // Sin permiso para elegir, no hay negociación con la URL: la agenda es la
    // propia. Un enlace que apunte a otra no la abre.
    if (!this.puedeElegirRecurso()) {
      return propia;
    }

    const pedido = this.recursoPedido();
    const disponibles = this.recursos();
    if (pedido !== null && disponibles.some((recurso) => recurso.id === pedido)) {
      return pedido;
    }
    // La URL manda sobre la agenda propia: un enlace compartido tiene que abrir
    // lo que dice, aunque quien lo abra tenga la suya.
    if (propia !== null) {
      return propia;
    }
    // `.at(0)` y no `[0]`: el proyecto no usa `noUncheckedIndexedAccess`, así
    // que el índice se tipa como si siempre hubiera elemento y el compilador
    // daba por imposible el `null` que en tiempo de ejecución sí ocurre —una
    // organización sin recursos—. `.at()` sí declara el `undefined`.
    return disponibles.at(0)?.id ?? null;
  });

  /**
   * Si esta sesión puede mirar la agenda de otro recurso.
   *
   * De ella dependen tres cosas a la vez —el selector, el filtro de la URL y la
   * caída al primer recurso— y por eso es una sola bandera y no tres chequeos
   * sueltos que se puedan desincronizar.
   */
  protected readonly puedeElegirRecurso = computed(() => {
    const roles = this.auth.roles();
    return ROLES_QUE_ELIGEN_RECURSO.some((rol) => roles.includes(rol));
  });

  /**
   * El recurso de quien inició sesión, si la organización tiene uno suyo.
   *
   * El cruce es entre el claim `hpid` del token y el `resourceRefId` que declara
   * cada recurso. Se exige **además** que `resourceRefType` sea el de perfiles
   * profesionales: los identificadores no se comparan a ciegas entre tablas
   * distintas, porque dos filas de tablas distintas pueden compartir un uuid sin
   * tener nada que ver.
   *
   * `null` para pacientes, administración, o para un profesional que no tenga
   * agenda cargada en esta organización — que es lo corriente en las
   * instituciones donde no atiende.
   */
  private readonly recursoPropio = computed(() => {
    const perfil = this.auth.practitionerProfileId();
    if (perfil === null) {
      return null;
    }
    return (
      this.recursos().find(
        (recurso) =>
          recurso.resourceRefId === perfil &&
          TABLAS_DE_PERFIL_PROFESIONAL.includes(recurso.resourceRefType),
      )?.id ?? null
    );
  });

  /** Si lo que se está mirando es la agenda propia, para poder decirlo. */
  protected readonly mirandoAgendaPropia = computed(
    () => this.recursoPropio() !== null && this.recursoElegido() === this.recursoPropio(),
  );

  /**
   * Si la URL pide un recurso que la organización no tiene.
   *
   * Pasa con un enlace viejo o con un recurso dado de baja. Se cae al primero
   * —la agenda igual sirve— pero callarlo haría creer que se está mirando el
   * recurso del enlace.
   */
  protected readonly recursoInexistente = computed(() => {
    if (!this.puedeElegirRecurso()) {
      // Sin permiso para elegir, el parámetro se ignora por completo: avisar
      // «ese recurso ya no está» sobre un enlace que de todos modos no se iba a
      // abrir manda a buscar un problema que no es el que hay.
      return false;
    }
    const pedido = this.recursoPedido();
    return (
      pedido !== null &&
      this.recursos().length > 0 &&
      !this.recursos().some((recurso) => recurso.id === pedido)
    );
  });

  /**
   * Quien atiende no tiene agenda cargada en esta organización.
   *
   * Es el caso que antes se resolvía en silencio mostrando la agenda de otro.
   * Ahora no se muestra ninguna y se dice por qué: el dato que falta es un
   * recurso de agenda a nombre de esta persona, y eso lo carga la organización,
   * no ella.
   *
   * Se exige `recursosLeidos()` para no acusar el vacío mientras todavía se está
   * leyendo, y `falloDeRecursos() === null` porque un `403` en la lectura no es
   * «no tenés agenda»: es «no te dejo ver el catálogo».
   */
  protected readonly sinAgendaPropia = computed(
    () =>
      !this.puedeElegirRecurso() &&
      this.recursosLeidos() &&
      this.falloDeRecursos() === null &&
      this.recursos().length > 0 &&
      this.recursoPropio() === null,
  );

  /** Si los recursos ya se leyeron. Sin esto, «no hay» y «todavía no» se mezclan. */
  private readonly recursosLeidos = signal(false);

  /**
   * El error de la lectura de recursos, si lo hubo.
   *
   * Se guarda en vez de tragarse porque **`403` no es «no hay»**: a un
   * profesional sin rol de agenda el backend le niega la lista, y decirle que la
   * organización no tiene recursos lo manda a buscar un problema que no existe.
   */
  private readonly falloDeRecursos = signal<unknown>(null);

  /**
   * La organización no tiene ningún recurso agendable cargado.
   *
   * **Vacío de verdad**, no fallo: con un error la pantalla lo cuenta en las
   * tablas —con el estado que corresponda— y este aviso no aparece.
   */
  protected readonly sinRecursos = computed(
    () => this.recursosLeidos() && this.falloDeRecursos() === null && this.recursos().length === 0,
  );

  /** El nombre del recurso que se está mirando, para decirlo en pantalla. */
  protected readonly nombreDelRecurso = computed(() => {
    const id = this.recursoElegido();
    return id === null ? '' : (this.recursos().find((r) => r.id === id)?.name ?? '');
  });

  /**
   * **Dónde** atiende el recurso que se está mirando.
   *
   * La agenda sabía *cuándo* desde el principio y no sabía *dónde*: un turno
   * sin dirección obliga a averiguarla por fuera del sistema. Llega resuelto en
   * el propio `GET /scheduling/resources`, así que no cuesta una petición más
   * ni una por recurso.
   *
   * `null` cuando el recurso no tiene sede vigente. Es corriente, y la pantalla
   * lo dice con esas palabras en vez de dejar el hueco: un renglón vacío se lee
   * como un dato que no cargó.
   */
  protected readonly sedeDelRecurso = computed(() => {
    const id = this.recursoElegido();
    return id === null ? null : (this.recursos().find((r) => r.id === id)?.site ?? null);
  });

  /**
   * La ubicación en una línea, tal como se muestra.
   *
   * Nombre y dirección juntos, y la dirección sólo si la sede la tiene: repetir
   * el nombre como si fuera la dirección sería peor que no ponerla.
   */
  protected readonly ubicacionDelRecurso = computed(() => {
    const sede = this.sedeDelRecurso();
    if (sede === null) {
      return '';
    }
    return sede.addressText === null ? sede.name : `${sede.name} · ${sede.addressText}`;
  });

  protected readonly ventanaElegida = computed<VentanaClave>(() => {
    const pedida = this.params()?.get('rango');
    return VENTANAS.some((v) => v.clave === pedida)
      ? (pedida as VentanaClave)
      : VENTANA_POR_DEFECTO;
  });

  /**
   * Desde dónde arranca la ventana consultada (ALV-024).
   *
   * `?desde=YYYY-MM-DD`, en la URL para que «la semana que viene» se pueda
   * compartir por enlace y volver a ella siga trayendo la misma consulta. Sin
   * parámetro, o con uno que no parsea, es HOY — el comportamiento de
   * siempre, así que ningún enlace viejo cambia de significado.
   */
  protected readonly fechaBase = computed<Date>(() => {
    const pedida = this.params()?.get('desde');
    const fecha = pedida === null ? null : new Date(`${pedida}T00:00:00`);
    const valida = fecha !== null && !Number.isNaN(fecha.getTime());
    const base = valida ? fecha : new Date();
    base.setHours(0, 0, 0, 0);
    return base;
  });

  /** Si la ventana es la de hoy, o si se navegó a otra (ALV-024). */
  protected readonly enVentanaDeHoy = computed(() => {
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    return this.fechaBase().getTime() === hoy.getTime();
  });

  /**
   * Pestaña visible. En la URL para que un enlace pueda apuntar a una en
   * concreto.
   *
   * Son **tres**: «Consultas» —el ciclo completo, ALV-019—, «Mi agenda» —el
   * horario publicado, que era una pantalla aparte— y «Cupos», que es
   * disponibilidad y sigue siendo lo suyo (ALV-020).
   *
   * `vista=cupos` sigue significando lo mismo. `vista=citas` y
   * `vista=solicitudes` llevan a la lista unificada, que es donde vive lo que
   * antes estaba partido: un enlace viejo sigue llegando a donde quería llegar.
   */
  protected readonly pestana = computed(() => {
    const vista = this.params()?.get('vista');
    // «Mi agenda» sólo existe para quien atiende: quien reparte turnos no tiene
    // agenda propia y no se le ofrece una puerta que la otra pantalla no va a
    // reconocer como suya. Sin ella, «Cupos» corre un lugar.
    const indiceDeCupos = this.esQuienAtiende() ? 2 : 1;
    if (vista === 'cupos') return indiceDeCupos;
    return vista === 'agenda' && this.esQuienAtiende() ? 1 : 0;
  });

  protected readonly incluirCanceladas = computed(() => this.params()?.get('canceladas') === 'si');

  /* -- Derivados ----------------------------------------------------------- */

  protected readonly organizacion = this.auth.activeTenantId;

  /** Sin organización no hay agenda que pedir: `tenantId` es obligatorio. */
  protected readonly sinOrganizacion = computed(() => this.organizacion() === null);

  /**
   * Las agendas que esta sesión puede elegir, en orden y sin dos que se lean
   * igual.
   *
   * ## Por qué hay que desambiguar
   *
   * El nombre de un recurso no es único: lo escribe quien lo da de alta, y la
   * siembra de desarrollo lo arma con el título y el apellido del profesional,
   * así que dos altas del mismo médico producen dos recursos DISTINTOS con el
   * mismo texto. En pantalla eso es una lista con la misma línea repetida cinco
   * veces, donde elegir es adivinar — y el que quedaba marcado parecía un error.
   *
   * La solución no es esconder los repetidos: son agendas distintas, con citas
   * distintas, y ocultar una la vuelve inalcanzable. Se los desempata con el
   * final de su identificador, que es corto, estable y el único dato que con
   * seguridad los distingue. El desempate se agrega **sólo a los que repiten**,
   * para no ensuciar la lista entera por dos filas.
   *
   * Se ordena por nombre para que la lista no dependa del orden de inserción,
   * que es el que traía el backend y no significa nada para quien mira.
   */
  protected readonly opcionesDeRecurso = computed<readonly SelectOption<string>[]>(() => {
    const recursos = [...this.recursos()].sort((a, b) =>
      a.name.localeCompare(b.name, 'es', { numeric: true }),
    );

    const repetidos = new Set(
      recursos
        .map((recurso) => recurso.name)
        .filter((nombre, indice, todos) => todos.indexOf(nombre) !== indice),
    );

    return recursos.map((recurso) => ({
      value: recurso.id,
      label: repetidos.has(recurso.name)
        ? `${recurso.name} · ${discriminante(recurso.id)}`
        : recurso.name,
    }));
  });

  protected readonly opcionesDeVentana = computed<readonly SelectOption<string>[]>(() =>
    VENTANAS.map((ventana) => ({ value: ventana.clave, label: ventana.etiqueta })),
  );

  protected readonly resumenDeVentana = computed(() => {
    const ventana = VENTANAS.find((v) => v.clave === this.ventanaElegida());
    return ventana === undefined ? '' : ventana.etiqueta.toLowerCase();
  });

  /**
   * Los rótulos de las pestañas, con el conteo cuando ya se sabe.
   *
   * El conteo está en la pestaña y no adentro porque es la única forma de ver
   * cuánto hay del otro lado sin cambiar de panel: el panel inactivo no se
   * renderiza, así que un contador dentro del panel no se lee hasta abrirlo.
   */
  /**
   * Lo que espera respuesta — TAREA-13, punto 1.
   *
   * **Y sale de la solapa «Citas», no se duplica.** La ficha lo advierte: separar
   * las solicitudes mejora la lectura pero *«duplica el lugar donde se responde
   * una solicitud si la solapa queda como está»*. Dos lugares para aceptar la
   * misma cita es peor que ninguno — el día que uno de los dos cambie, nadie va
   * a acordarse del otro.
   */
  protected readonly solicitudes = computed(() =>
    filtrarEstado(this.citas(), (cita) => this.porResponder(cita)),
  );

  /**
   * **Una sola lista para todo el ciclo** (ALV-019).
   *
   * Solicitudes y citas se mostraban en dos solapas, y era una separación de
   * presentación: las dos salían de `citas()` filtrando por `porResponder`, con
   * las MISMAS acciones y la misma celda. Quien atendía tenía que mirar en dos
   * lugares para saber cómo venía el día, y una solicitud aceptada
   * «desaparecía» de una solapa para aparecer en la otra.
   *
   * Ahora es una lista con el estado adelante, que es lo que ordena el ciclo
   * `SOLICITADA → CONFIRMADA → EN CURSO → COMPLETADA`. Los cupos siguen aparte
   * (ALV-020): son disponibilidad, no consultas.
   *
   * `solicitudes()` sobrevive porque el conteo de lo que espera respuesta sigue
   * siendo la única cifra que urge: se muestra como aviso arriba de la tabla.
   */
  protected readonly consultas = this.citas;

  /** Lo que ya está agendado: lo que no espera respuesta. */
  protected readonly citasAgendadas = computed(() =>
    filtrarEstado(this.citas(), (cita) => !this.porResponder(cita)),
  );

  /** Cuántas esperan respuesta, para el aviso de arriba de la tabla. */
  protected readonly cuantasEsperanRespuesta = computed(() => cuenta(this.solicitudes()) ?? 0);

  protected readonly rotuloDeConsultas = computed(() =>
    rotulo('Consultas', cuenta(this.consultas())),
  );
  protected readonly rotuloDeCupos = computed(() => rotulo('Cupos', cuenta(this.cupos())));

  /** Si la sesión puede registrar llegadas y cancelar. Roles de los endpoints. */
  protected readonly puedeOperarCitas = computed(() => {
    const roles = this.auth.roles();
    return ROLES_QUE_OPERAN_CITAS.some((rol) => roles.includes(rol));
  });

  /**
   * Si la sesión puede decidir sobre las citas: aceptar, rechazar, mover,
   * iniciar y cerrar. Incluye al profesional, que es quien atiende.
   */
  protected readonly puedeAtender = computed(() => {
    const roles = this.auth.roles();
    return ROLES_QUE_ATIENDEN.some((rol) => roles.includes(rol));
  });

  /** La cita espera respuesta: se ofrece aceptar o rechazar. */
  protected porResponder(cita: CitaVisible): boolean {
    return CODIGOS_POR_RESPONDER.has(cita.estado.code);
  }

  /** Se puede empezar a atender, sin importar qué día es hoy. */
  protected sePuedeIniciar(cita: CitaVisible): boolean {
    return CODIGOS_INICIABLES.has(cita.estado.code);
  }

  /** Está en curso: lo único que queda es cerrarla. */
  protected sePuedeCompletar(cita: CitaVisible): boolean {
    return cita.estado.code === CODIGO_EN_CURSO;
  }

  /** Vigente: se puede mover o cancelar. */
  protected estaVigente(cita: CitaVisible): boolean {
    return CODIGOS_VIGENTES.has(cita.estado.code);
  }

  /** Si la sesión puede retener y confirmar un cupo. */
  protected readonly puedeReservar = computed(() => {
    const roles = this.auth.roles();
    return ROLES_QUE_RESERVAN.some((rol) => roles.includes(rol));
  });

  /**
   * Si la sesión puede construir agenda (recurso, política, plantilla, cupos,
   * excepciones). Es el enlace al alta por fases, y sólo lo ve quien la API deja
   * usarla: las cuatro fases de configuración exigen `SCHEDULING_ADMIN`, y
   * `SUPERADMIN` es su comodín en el `RolesGuard`. Ofrecerlo a otro rol sería
   * ofrecer un 403.
   */
  protected readonly puedeCrearAgenda = computed(() => {
    const roles = this.auth.roles();
    return ROLES_QUE_CREAN_AGENDA.some((rol) => roles.includes(rol));
  });

  /* ---- «me demoro» (P8 · registro del cliente 4.2) ------------------------ */

  /**
   * Qué demora se está por avisar.
   *
   * `undefined` = el panel está cerrado. `null` = la demora es de toda la
   * agenda del recurso («me demoro veinte minutos hoy»), que es como ocurre en
   * la práctica. Un id = la demora alcanza sólo a esa cita.
   */
  protected readonly demoraDe = signal<string | null | undefined>(undefined);

  protected readonly minutosDeDemora = signal<string>(DEMORA_POR_DEFECTO);
  protected readonly mensajeDeDemora = signal<string>('');
  protected readonly avisandoDemora = signal(false);
  protected readonly maxMensajeDeDemora = MAX_MENSAJE_DE_DEMORA;

  protected readonly panelDeDemoraAbierto = computed(() => this.demoraDe() !== undefined);

  /** Si el panel avisa de toda la agenda o de una cita concreta. */
  protected readonly demoraDeTodaLaAgenda = computed(() => this.demoraDe() === null);

  /**
   * Si quien mira es quien atiende.
   *
   * Decide el enlace a «Visitas de laboratorio»: es su bandeja, y desde §4.H
   * del plan de UX ya no tiene renglón propio en el menú del médico. A quien
   * reparte turnos no le corresponde —la bandeja declara `PRACTITIONER` y
   * `CLINICIAN`— y ofrecerle una puerta que la API va a cerrar es justo lo que
   * el filtrado del menú evita.
   */
  protected readonly esQuienAtiende = computed(() => {
    const roles = this.auth.roles();
    return roles.includes('PRACTITIONER') || roles.includes('CLINICIAN');
  });

  protected readonly opcionesDeDemora = computed<readonly SelectOption<string>[]>(() =>
    DEMORAS.map((minutos) => ({ value: String(minutos), label: `${minutos} minutos` })),
  );

  /**
   * Si se puede avisar una demora: hay a quién avisarle y quién la avisa.
   *
   * Exige recurso elegido porque la demora es **de una agenda**: sin saber cuál,
   * el aviso no tiene destinatarios.
   */
  protected readonly puedeAvisarDemora = computed(
    () => this.puedeAtender() && this.recursoElegido() !== null,
  );

  /** Abre el panel para avisar la demora de toda la agenda. */
  protected abrirDemoraDeAgenda(): void {
    this.demoraDe.set(null);
    this.minutosDeDemora.set(DEMORA_POR_DEFECTO);
    this.mensajeDeDemora.set('');
  }

  /** Abre el panel para avisar la demora de una cita concreta. */
  protected abrirDemoraDeCita(cita: CitaVisible): void {
    this.demoraDe.set(cita.id);
    this.minutosDeDemora.set(DEMORA_POR_DEFECTO);
    this.mensajeDeDemora.set('');
  }

  protected cerrarDemora(): void {
    this.demoraDe.set(undefined);
  }

  /**
   * Avisa la demora.
   *
   * No mueve ningún turno ni toca los cupos: el backend sólo la registra en el
   * historial de las citas alcanzadas y emite el aviso. Por eso la agenda **no**
   * se recarga como en las demás acciones —no hay nada distinto que leer— salvo
   * para reflejar la demora en el detalle del turno.
   */
  protected confirmarDemora(): void {
    const objetivo = this.demoraDe();
    if (objetivo === undefined || this.avisandoDemora()) {
      return;
    }
    const minutos = Number(this.minutosDeDemora());
    if (!Number.isFinite(minutos) || minutos <= 0) {
      return;
    }
    const mensaje = this.mensajeDeDemora().trim();

    const recurso = this.recursoElegido();
    if (objetivo === null && recurso === null) {
      return;
    }

    this.avisandoDemora.set(true);
    const peticion =
      objetivo === null
        ? this.scheduling.delayResource(recurso as string, {
            delayMinutes: minutos,
            ...(mensaje === '' ? {} : { message: mensaje }),
          })
        : this.scheduling.delayBooking(objetivo, {
            delayMinutes: minutos,
            ...(mensaje === '' ? {} : { message: mensaje }),
          });

    peticion.subscribe({
      next: (resultado) => {
        this.avisandoDemora.set(false);
        this.demoraDe.set(undefined);
        // Se dice cuántos pacientes se enteraron, no «listo»: un aviso que no
        // llegó a nadie —porque nadie tiene cuenta de portal— no es un éxito
        // y quien atiende necesita saberlo para avisar por otro medio.
        this.toast.success(
          resultado.affected === 0
            ? 'No había turnos vigentes en el horario informado.'
            : `Avisamos a ${resultado.notified} de ${resultado.affected} pacientes.`,
          'Demora informada',
        );
        this.cargarAgenda();
      },
      error: (error: unknown) => {
        this.avisandoDemora.set(false);
        this.avisarFallo(error, 'No se pudo avisar la demora.');
      },
    });
  }

  /**
   * Las columnas del ciclo completo (ALV-019), en el orden que ordena una lista
   * mixta: **el estado primero**. En una lista donde conviven lo que espera
   * respuesta y lo que ya está confirmado, lo que decide si la fila pide algo
   * es el estado, no la hora.
   *
   * `solicitada` sólo dice algo en las que esperan respuesta —en una confirmada
   * es ruido—, así que la celda la deja vacía y la columna cede primero en
   * pantalla chica.
   */
  protected readonly columnasDeConsultas = computed<readonly ColumnDef<CitaVisible>[]>(() => [
    { key: 'estado', header: 'Estado', priority: 1, cell: this.celdaEstado() },
    { key: 'cuando', header: 'Fecha y hora', priority: 1, cell: this.celdaCuando() },
    { key: 'paciente', header: 'Paciente', priority: 1, cell: this.celdaPaciente() },
    { key: 'solicitada', header: 'Solicitada', priority: 3, cell: this.celdaSolicitada() },
    // ALV-017: en la agenda propia el recurso es el MISMO en todas las filas —
    // el nombre del profesional repetido tantas veces como citas tenga, sin
    // distinguir nada. Sólo aparece cuando se mira la agenda de otro o cuando
    // la tabla puede mezclar recursos, que es cuando el dato separa filas.
    ...(this.mirandoAgendaPropia()
      ? []
      : [{ key: 'recurso', header: 'Recurso', priority: 2 } satisfies ColumnDef<CitaVisible>]),
    { key: 'motivo', header: 'Motivo', priority: 3 },
    // Prioridad 2: en pantalla chica cede antes que el estado de la cita y la
    // fecha, pero antes que el motivo. Quien mira la agenda en el teléfono
    // quiere saber a qué hora y con quién; el pago viene después.
    { key: 'pago', header: 'Pago', priority: 2, cell: this.celdaPago() },
    // La columna sólo existe para quien puede ejecutar las acciones: ofrecer
    // botones que la API va a rechazar con 403 es ofrecer un error.
    ...(this.puedeAtender()
      ? [
          {
            key: 'acciones',
            header: 'Acciones',
            priority: 1,
            cell: this.celdaAccionesCita(),
          } satisfies ColumnDef<CitaVisible>,
        ]
      : []),
  ]);

  /**
   * Las columnas de la tabla de solicitudes — TAREA-13, punto 1.
   *
   * Son **las cinco que pidió el propietario**, en su orden: estado, cuándo se
   * pidió, cuándo sería la cita, quién la pide y con quién.
   *
   * Dos diferencias con la tabla de citas, y las dos son a propósito:
   *
   * - **«Solicitada» va antes que «Cita».** En una lista de cosas por responder,
   *   lo que ordena es hace cuánto que alguien espera, no cuándo sería el turno.
   * - **No hay columna de pago.** Una solicitud sin aceptar no se cobra, y
   *   ofrecer el estado de pago ahí sería ofrecer una acción que el servidor
   *   permite pero que no significa nada todavía.
   *
   * `profesional` es constante mientras la agenda muestre **un** recurso, que es
   * lo que hace hoy. Se muestra igual porque el propietario la pidió y porque
   * deja de ser constante en cuanto la tabla mezcle recursos — decisión que **no
   * tomamos acá**: ensanchar quién ve la agenda de quién es privacidad, no
   * pantalla (P-13-2).
   */
  protected readonly columnasDeCupos = computed<readonly ColumnDef<CupoVisible>[]>(() => [
    { key: 'franja', header: 'Franja', priority: 1, cell: this.celdaFranja() },
    { key: 'recurso', header: 'Recurso', priority: 1 },
    {
      key: 'disponibilidad',
      header: 'Disponibilidad',
      priority: 1,
      cell: this.celdaDisponibilidad(),
    },
    { key: 'estado', header: 'Estado', priority: 2 },
    // Se muestra por lo mismo que el catálogo muestra el `conceptId`: es el
    // valor que hay que mandar para reservar, no ruido técnico.
    { key: 'id', header: 'Identificador del cupo', priority: 3, cell: this.celdaCupoId() },
    ...(this.puedeReservar()
      ? [
          {
            key: 'reservar',
            header: 'Reservar',
            priority: 1,
            cell: this.celdaReservar(),
          } satisfies ColumnDef<CupoVisible>,
        ]
      : []),
  ]);

  /** Para el rótulo del bloque cuando no hay selector: cuál agenda se mira. */
  protected readonly hayAgendaQueMirar = computed(() => this.recursoElegido() !== null);

  protected readonly porCita = (fila: CitaVisible): string => fila.id;
  protected readonly porCupo = (fila: CupoVisible): string => fila.id;

  constructor() {
    // Los recursos se leen una vez por organización: son el catálogo de la
    // agenda, no el contenido. Cambiar de ventana no debería volver a pedirlos.
    effect(() => {
      this.organizacion();
      untracked(() => this.cargarRecursos());
    });

    effect(() => {
      this.organizacion();
      this.recursoElegido();
      this.ventanaElegida();
      this.incluirCanceladas();
      // ALV-024: sin esto, mover la ventana cambia la URL y no recarga nada.
      // `ventanaElegida()` sólo dice el TAMAÑO (7/30 días); `fechaBase()` es
      // DESDE cuándo, y es lo que `moverVentana`/`irAHoy` cambian.
      this.fechaBase();
      // Se depende también de que los recursos ya se hayan leído: con una
      // organización sin ninguno, `recursoElegido()` se queda en `null` de
      // punta a punta y sin esta dependencia la pantalla no saldría nunca del
      // esqueleto de carga.
      this.recursosLeidos();
      untracked(() => this.cargarAgenda());
    });
  }

  /* -- Acciones ------------------------------------------------------------ */

  protected elegirRecurso(recursoId: string | null): void {
    if (recursoId === null || recursoId === '') {
      return;
    }
    // El selector ya no se dibuja sin permiso, pero la guarda va igual: es la
    // que hace que la regla viva en el componente y no en la plantilla, donde un
    // `@if` que alguien borre la desactivaría en silencio.
    if (!this.puedeElegirRecurso()) {
      return;
    }
    this.publicar({ recurso: recursoId });
  }

  protected elegirVentana(clave: string | null): void {
    // Cambiar el tamaño de la ventana vuelve a hoy (ALV-024): quedarse en un
    // desplazamiento de «7 días» al pasar a «30 días» sería una fecha que ya
    // no significa lo mismo para nadie que la mire.
    this.publicar({ rango: clave === VENTANA_POR_DEFECTO ? null : clave, desde: null });
  }

  /**
   * Mueve la ventana un tramo completo, hacia atrás o hacia adelante
   * (ALV-024). Un tramo es el tamaño de la ventana elegida: si se mira de a
   * 7 días, «Siguiente» salta 7 días — la próxima página, no un día suelto.
   */
  protected moverVentana(direccion: -1 | 1): void {
    const dias = VENTANAS.find((v) => v.clave === this.ventanaElegida())?.dias ?? 7;
    const siguiente = new Date(this.fechaBase());
    siguiente.setDate(siguiente.getDate() + dias * direccion);

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const iso = siguiente.toISOString().slice(0, 10);
    this.publicar({ desde: siguiente.getTime() === hoy.getTime() ? null : iso });
  }

  /** Vuelve a la ventana de hoy en un clic, sin contar los tramos de vuelta. */
  protected irAHoy(): void {
    this.publicar({ desde: null });
  }

  protected alternarCanceladas(incluir: boolean): void {
    this.publicar({ canceladas: incluir ? 'si' : null });
  }

  protected elegirPestana(indice: number): void {
    // El espejo de `pestana()`: sin «Mi agenda» los índices corren, y publicar
    // `vista=agenda` desde la solapa de cupos dejaría la URL diciendo una cosa
    // y la pantalla mostrando otra.
    const conAgendaPropia = this.esQuienAtiende();
    const vista =
      indice === (conAgendaPropia ? 2 : 1)
        ? 'cupos'
        : conAgendaPropia && indice === 1
          ? 'agenda'
          : null;
    this.publicar({ vista });
  }

  protected recargar(): void {
    this.cargarAgenda();
  }

  /* -- Acciones sobre una cita (UC-41-09 y UC-41-10) ----------------------- */

  /** La cita sobre la que hay una operación en vuelo, para frenar el doble clic. */
  protected readonly operando = signal<string | null>(null);

  /**
   * Registra la llegada. Sin diálogo: no es destructivo y se hace decenas de
   * veces por día — la fricción del mostrador es un costo real.
   */
  protected registrarLlegada(cita: CitaVisible): void {
    if (this.operando() !== null) {
      return;
    }
    this.operando.set(cita.id);

    this.scheduling.checkInBooking(cita.id).subscribe({
      next: () => {
        this.operando.set(null);
        this.toast.success('La llegada quedó registrada.', 'Check-in');
        this.cargarAgenda();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarFallo(error, 'No se pudo registrar la llegada.');
      },
    });
  }

  /**
   * Cancela con confirmación explícita — regla del M34 para acciones
   * destructivas. `cancelledBy: 'PROVIDER'`: desde esta pantalla cancela la
   * organización; la cancelación del propio paciente entra con su vista.
   */
  protected async cancelarCita(cita: CitaVisible): Promise<void> {
    if (this.operando() !== null) {
      return;
    }

    // El motivo es obligatorio y lo valida el servidor (corrección #14): al
    // paciente le llega junto con la cancelación, en el detalle de su turno.
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Cancelar la cita',
        message: 'La cita se cancela y el cupo vuelve a la agenda. La cancelación queda auditada.',
        confirmLabel: 'Cancelar la cita',
        cancelLabel: 'Volver',
        destructive: true,
      },
      {
        label: 'Motivo de la cancelación',
        placeholder: 'Por qué se cancela la cita',
        hint: 'El paciente lo va a ver en el detalle de su turno.',
      },
    );
    if (motivo === null) {
      return;
    }

    this.operando.set(cita.id);
    this.scheduling
      .cancelBooking(cita.id, { cancelledBy: 'PROVIDER', reasonText: motivo })
      .subscribe({
        next: (resultado) => {
          this.operando.set(null);
          this.toast.success(
            resultado.capacityReleased
              ? 'La cita se canceló y el cupo volvió a la agenda.'
              : 'La cita se canceló.',
            'Cancelación',
          );
          this.cargarAgenda();
        },
        error: (error: unknown) => {
          this.operando.set(null);
          this.avisarFallo(error, 'No se pudo cancelar la cita.');
        },
      });
  }

  /* -- lo que decide quien atiende (correcciones #11 y #15) ---------------- */

  /**
   * Acepta la solicitud: la cita queda confirmada y el paciente lo ve.
   *
   * Sin diálogo de confirmación: aceptar no es destructivo y es lo que se hace
   * decenas de veces por turno. Lo destructivo —rechazar— sí lo pide, y además
   * con motivo.
   */
  /**
   * Marca el estado de pago de la cita — TAREA-13, punto 5.
   *
   * **El seguro se conserva** cuando se cambia sólo el estado, y viceversa: son
   * dos preguntas distintas, y cambiar una no puede responder la otra por su
   * cuenta. Sin este cuidado, pasar de «pendiente» a «pagada» borraría en
   * silencio que la cita se había cubierto con seguro.
   *
   * No hay confirmación previa a propósito: es reversible en un clic y queda
   * firmado con quién y cuándo, así que un diálogo de más sólo agregaría
   * fricción a una acción que se repite muchas veces por día.
   */
  protected marcarPago(cita: CitaVisible, state: PaymentStateCode): void {
    this.aplicarPago(cita, { state, insuranceUsed: cita.pago?.insuranceUsed ?? false });
  }

  /** Alterna la marca de seguro sin tocar el estado. */
  protected alternarSeguro(cita: CitaVisible): void {
    // Sin estado marcado no hay qué alternar: la marca de seguro acompaña a un
    // estado, no existe suelta. El menú no la ofrece en ese caso.
    if (cita.pago === null) {
      return;
    }
    this.aplicarPago(cita, {
      state: cita.pago.state,
      insuranceUsed: !cita.pago.insuranceUsed,
    });
  }

  private aplicarPago(cita: CitaVisible, cambio: NewPaymentState): void {
    if (this.operando() !== null) {
      return;
    }
    this.operando.set(cita.id);

    this.scheduling.setPaymentState(cita.id, cambio).subscribe({
      next: (estado) => {
        this.operando.set(null);
        this.toast.success(
          estado.insuranceUsed ? `${estado.label}, con seguro.` : `${estado.label}.`,
          'Pago actualizado',
        );
        this.cargarAgenda();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarFallo(error, 'No se pudo cambiar el estado de pago.');
      },
    });
  }

  /** Los tres estados, para el menú. La etiqueta viene del servidor al leer. */
  protected readonly estadosDePago: readonly {
    readonly code: PaymentStateCode;
    readonly label: string;
  }[] = [
    { code: 'PENDING', label: 'Pendiente de pago' },
    { code: 'PARTIALLY_PAID', label: 'Parcialmente pagada' },
    { code: 'PAID', label: 'Pagada' },
  ];

  protected aceptarCita(cita: CitaVisible): void {
    if (this.operando() !== null) {
      return;
    }
    this.operando.set(cita.id);

    this.scheduling.acceptBooking(cita.id).subscribe({
      next: () => {
        this.operando.set(null);
        this.toast.success('La cita quedó confirmada.', 'Solicitud aceptada');
        this.cargarAgenda();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarFallo(error, 'No se pudo aceptar la solicitud.');
      },
    });
  }

  /**
   * Rechaza la solicitud con motivo obligatorio (corrección #14).
   *
   * El cupo vuelve a la agenda y el motivo le llega al paciente en el detalle
   * de su turno: rechazar sin decir por qué deja a alguien esperando una
   * explicación que nunca llega.
   */
  /**
   * «Ver detalle» — TAREA-13, punto 2.
   *
   * Abre el modal con **todo lo que la fila no muestra** y ofrece aceptar desde
   * ahí, que es la mitad del pedido que no se podía hacer sin salir de la
   * tabla.
   *
   * ## Por qué el diálogo compartido y no un modal nuevo
   *
   * `showModal()` trae gratis el fondo, la inertización de lo que queda atrás,
   * la trampa de foco y el cierre con `Escape`. Un modal propio para esta
   * pantalla haría esas cuatro cosas otra vez y, como pasa siempre, alguna a
   * medias. Lo que faltaba era mostrar **datos** y no un párrafo: se agregó
   * `details` al diálogo, que es parametrizar en vez de clonar.
   *
   * ## Rechazar NO está acá, y es a propósito
   *
   * Rechazar exige motivo, o sea un segundo diálogo. Encadenar
   * detalle → rechazar → motivo son tres modales, y el tercero aparece encima
   * de dos que la persona ya no puede leer. El botón de rechazar se queda en la
   * fila, a un clic de distancia, con su motivo en un solo paso.
   *
   * Es la parte de AC-13-4 que este slice deja abierta a propósito, no por
   * olvido.
   */
  protected async verDetalle(cita: CitaVisible): Promise<void> {
    const aceptar = await this.dialogs.confirm({
      title: 'Solicitud de consulta',
      message: 'Todo lo que el paciente mandó con su pedido.',
      details: this.detalleDeSolicitud(cita),
      confirmLabel: 'Aceptar solicitud',
      cancelLabel: 'Cerrar',
    });
    if (aceptar) {
      this.aceptarCita(cita);
    }
  }

  /**
   * Los datos del detalle, ya en texto.
   *
   * Se arman acá y no en el diálogo porque acá es donde se conoce el dominio:
   * una molécula compartida no tiene por qué saber cómo se escribe una fecha de
   * turno ni qué significa que no haya motivo.
   *
   * **Lo ausente se dice, no se omite.** Una fila sin fecha de cita o sin
   * motivo deja el rótulo con «Sin registrar»: un dato que desaparece parece un
   * dato que no se pidió, y acá lo que importa es saber qué falta.
   */
  private detalleDeSolicitud(cita: CitaVisible): readonly DialogDetail[] {
    const fecha = (valor: Date | null): string =>
      valor === null ? SIN_DATO : formatDate(valor, "EEEE d 'de' MMMM, HH:mm", this.idioma);

    return [
      { label: 'Estado', value: cita.estado.label },
      { label: 'Paciente', value: cita.paciente },
      { label: 'Solicitada', value: fecha(cita.solicitada) },
      { label: 'Cita', value: fecha(cita.cuando) },
      { label: 'Hasta', value: fecha(cita.hasta) },
      { label: 'Profesional', value: cita.recurso },
      { label: 'Motivo', value: cita.motivo },
    ];
  }

  /**
   * «Ver historial de solicitudes» — punto 4 del pedido original.
   *
   * Muestra **todas** las solicitudes de esa persona, **incluidas las
   * rechazadas y canceladas**, de la más reciente a la más vieja. Ese
   * `includeCancelled` no es un detalle: el historial existe justamente para
   * ver el patrón —quién pide y no viene, a quién se le rechazó y por qué— y
   * esconder lo cancelado lo volvería una lista de buenas noticias.
   *
   * Se lee al abrir y no al cargar la tabla: es una consulta por paciente, y
   * pedir el historial de cada fila de la agenda sería el mismo defecto que ya
   * evitamos en la columna de pago.
   */
  protected verHistorialDelPaciente(cita: CitaVisible): void {
    const paciente = cita.patientProfileId;
    if (paciente === null || this.operando() !== null) {
      return;
    }
    this.operando.set(cita.id);

    this.scheduling
      .searchBookings({ patientProfileId: paciente, includeCancelled: true, limit: 50 })
      .subscribe({
        next: (pagina) => {
          this.operando.set(null);
          void this.mostrarHistorial(cita, pagina.items);
        },
        error: (error: unknown) => {
          this.operando.set(null);
          this.avisarFallo(error, 'No se pudo leer el historial.');
        },
      });
  }

  private async mostrarHistorial(
    cita: CitaVisible,
    solicitudes: readonly Booking[],
  ): Promise<void> {
    // De la más reciente a la más vieja: en un historial, lo último es lo que
    // explica lo de ahora.
    const ordenadas = [...solicitudes].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const detalles: DialogDetail[] = ordenadas.map((s) => {
      const estado = toBookingStatusPresentation(
        s.statusConceptId === undefined ? undefined : this.etiquetas().get(s.statusConceptId),
        SIN_DATO,
      );
      const cuando =
        s.startAt === undefined
          ? SIN_DATO
          : formatDate(s.startAt, "d 'de' MMMM, HH:mm", this.idioma);
      return {
        label: formatDate(s.createdAt, 'd MMM yyyy', this.idioma),
        value: `${estado.label} · cita ${cuando}${s.reasonText === undefined ? '' : ` · ${s.reasonText}`}`,
      };
    });

    await this.dialogs.confirm({
      title: `Historial de ${cita.paciente}`,
      message:
        ordenadas.length === 0
          ? 'Esta persona todavía no pidió ningún turno acá.'
          : `${ordenadas.length} ${ordenadas.length === 1 ? 'solicitud' : 'solicitudes'}, de la más reciente a la más vieja. Incluye las rechazadas y canceladas.`,
      details: detalles,
      confirmLabel: 'Cerrar',
      cancelLabel: 'Volver',
    });
  }

  protected async rechazarCita(cita: CitaVisible): Promise<void> {
    if (this.operando() !== null) {
      return;
    }

    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Rechazar la solicitud',
        message: 'El cupo vuelve a la agenda y el paciente recibe el motivo.',
        confirmLabel: 'Rechazar',
        cancelLabel: 'Volver',
        destructive: true,
      },
      {
        label: 'Motivo del rechazo',
        placeholder: 'Por qué no se puede tomar este turno',
        hint: 'El paciente lo va a ver en el detalle de su turno.',
      },
    );
    if (motivo === null) {
      return;
    }

    this.operando.set(cita.id);
    this.scheduling.rejectBooking(cita.id, motivo).subscribe({
      next: () => {
        this.operando.set(null);
        this.toast.success('La solicitud se rechazó y el cupo volvió a la agenda.', 'Solicitud');
        this.cargarAgenda();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarFallo(error, 'No se pudo rechazar la solicitud.');
      },
    });
  }

  /**
   * Inicia la atención. **En cualquier momento** (corrección #15): no espera a
   * que llegue el día agendado, ni exige registrar la llegada antes.
   */
  protected iniciarAtencion(cita: CitaVisible): void {
    if (this.operando() !== null) {
      return;
    }
    this.operando.set(cita.id);

    this.scheduling.startBooking(cita.id).subscribe({
      next: () => {
        this.operando.set(null);
        this.toast.success('La atención quedó iniciada.', 'Consulta');
        this.cargarAgenda();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarFallo(error, 'No se pudo iniciar la atención.');
      },
    });
  }

  /**
   * Completa la cita. Es el botón «Completar cita» que la corrección #15 pide
   * que exista sin esperar la fecha; el paciente ve «completada» apenas ocurre.
   */
  protected completarCita(cita: CitaVisible): void {
    if (this.operando() !== null) {
      return;
    }
    this.operando.set(cita.id);

    this.scheduling.completeBooking(cita.id).subscribe({
      next: () => {
        this.operando.set(null);
        this.toast.success('La cita quedó completada.', 'Consulta');
        this.cargarAgenda();
      },
      error: (error: unknown) => {
        this.operando.set(null);
        this.avisarFallo(error, 'No se pudo completar la cita.');
      },
    });
  }

  /** El destino del enlace «Reservar» de un cupo. */
  protected rutaDeReserva(cupo: CupoVisible): string {
    return bookingNewRoute(cupo.id);
  }

  /**
   * La franja viaja con el enlace: la pantalla de reserva no puede leer un
   * cupo por id —no existe ese GET— y con esto lo reencuentra y revalida.
   */
  protected paramsDeReserva(cupo: CupoVisible): Record<string, string> {
    return {
      recurso: cupo.resourceId,
      desde: cupo.desde.toISOString(),
      hasta: cupo.hasta.toISOString(),
    };
  }

  /**
   * El fallo de una acción de fila sale por toast, no pisando la tabla: la
   * agenda que sí se leyó sigue siendo cierta aunque un botón haya fallado.
   */
  private avisarFallo(error: unknown, generico: string): void {
    const estado = errorToViewState<null>(error);
    const detalle =
      estado.status === 'validation'
        ? estado.issues.map((issue) => issue.message).join(' ')
        : estado.status === 'forbidden' || estado.status === 'error'
          ? (estado.message ?? '')
          : '';
    this.toast.error(detalle === '' ? generico : `${generico} ${detalle}`, 'Agenda');
  }

  /**
   * Escribe los filtros en la URL conservando los demás.
   *
   * `null` borra la clave en vez de dejarla vacía: `?recurso=` no significa lo
   * mismo que ausente para nadie que lea la dirección, y una URL con claves
   * huérfanas es una URL que no se puede comparar entre dos sesiones.
   */
  private publicar(cambios: Readonly<Record<string, string | null>>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: cambios,
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /* -- Lecturas ------------------------------------------------------------ */

  /**
   * Los recursos de la organización.
   *
   * Son la **precondición** de la agenda, no un adorno: sin un recurso no se
   * pueden pedir las citas, porque `GET /scheduling/bookings` sin acotar
   * responde `422`. Por eso su fallo deja la pantalla sin agenda y lo dice, en
   * vez de degradar los nombres y seguir como si nada.
   */
  private cargarRecursos(): void {
    const tenantId = this.organizacion();
    this.recursosLeidos.set(false);
    this.falloDeRecursos.set(null);

    if (tenantId === null) {
      this.recursos.set([]);
      return;
    }

    this.scheduling.listResources({ tenantId }).subscribe({
      next: (pagina) => {
        this.recursos.set(pagina.items);
        this.recursosLeidos.set(true);
      },
      error: (error: unknown) => {
        // **Se guarda el error, no se traga.** Antes se caía a una lista vacía y
        // la pantalla decía «esta organización todavía no tiene recursos
        // agendables» — que es lo que ve un profesional recién registrado, a
        // quien `GET /scheduling/resources` le responde `403` por rol. Confundir
        // «no hay» con «no podés ver» es exactamente lo que el M34 separa en S3
        // y S5, y en una agenda manda a buscar un problema que no existe.
        this.recursos.set([]);
        this.falloDeRecursos.set(error);
        this.recursosLeidos.set(true);
      },
    });
  }

  /**
   * Citas y cupos de la ventana, en paralelo.
   *
   * En paralelo y no encadenado porque no dependen entre sí, y con `forkJoin`
   * en vez de dos suscripciones porque las etiquetas de estado se piden una vez
   * para los dos bloques: son el mismo catálogo.
   */
  private cargarAgenda(): void {
    const tenantId = this.organizacion();
    if (tenantId === null) {
      // No es un error ni un vacío: es un paso previo. Que la pantalla lo diga
      // con su propio aviso y no con un estado de fallo es la diferencia entre
      // «elegí una organización» y «la agenda no anda».
      this.citas.set(ready([]));
      this.cupos.set(ready([]));
      return;
    }

    const recursoId = this.recursoElegido();
    if (recursoId === null) {
      // Sin recurso no hay nada que pedir, y pedirlo igual daría el `422` del
      // backend. Mientras los recursos no se hayan leído se queda en carga: un
      // vacío antes de preguntar afirmaría que la organización no tiene agenda.
      const fallo = this.falloDeRecursos();
      const espera: ViewState<never[]> =
        fallo !== null
          ? // Un `403` sale como S5 con su propia explicación; el resto, como lo
            // que sea. Traducirlo es de `errorToViewState`, no de acá.
            errorToViewState<never[]>(fallo)
          : this.recursosLeidos()
            ? empty(
                { label: 'Volver al panel', route: '/dashboard' },
                // Dos vacíos distintos con la misma forma: «la organización no
                // tiene agendas» y «no tenés una vos». Decir el primero cuando
                // pasa el segundo manda a reportar un problema que no existe.
                this.sinAgendaPropia()
                  ? 'Esta organización no tiene ninguna agenda a tu nombre.'
                  : 'Esta organización todavía no tiene recursos agendables cargados.',
              )
            : loading();
      this.citas.set(espera);
      this.cupos.set(espera);
      return;
    }

    this.citas.set(loading());
    this.cupos.set(loading());
    this.citasRecortadas.set(false);
    this.cuposRecortados.set(false);

    const { desde, hasta } = this.ventana();
    const recurso = { resourceId: recursoId };

    forkJoin({
      citas: this.scheduling
        .searchBookings({
          ...recurso,
          from: desde,
          to: hasta,
          includeCancelled: this.incluirCanceladas(),
          limit: TOPE,
        })
        .pipe(catchError((error: unknown) => of({ error }))),
      cupos: this.scheduling
        .listSlots({ ...recurso, from: desde, to: hasta, limit: TOPE })
        .pipe(catchError((error: unknown) => of({ error }))),
    }).subscribe(({ citas, cupos }) => {
      const conceptos = [
        ...('error' in citas ? [] : citas.items.map((cita) => cita.statusConceptId)),
        ...('error' in cupos ? [] : cupos.items.map((cupo) => cupo.statusConceptId)),
      ];

      this.terminology
        .readConceptLabels(conceptos)
        .pipe(catchError(() => of<ConceptLabels>(new Map())))
        .subscribe((etiquetas) => {
          this.etiquetas.set(etiquetas);
          this.aplicarCitas(citas);
          this.aplicarCupos(cupos);
        });
    });
  }

  private aplicarCitas(
    resultado: { error: unknown } | { items: readonly Booking[]; truncated: boolean },
  ): void {
    if ('error' in resultado) {
      this.citas.set(errorToViewState<readonly CitaVisible[]>(resultado.error));
      return;
    }

    this.citasRecortadas.set(resultado.truncated);

    if (resultado.items.length === 0) {
      this.citas.set(
        empty(
          { label: 'Ver los cupos libres', route: '/schedule' },
          `No hay citas ${this.resumenDeVentana()} con los filtros puestos.`,
        ),
      );
      return;
    }

    this.citas.set(ready(resultado.items.map((cita) => this.aCitaVisible(cita))));
  }

  private aplicarCupos(
    resultado: { error: unknown } | { items: readonly AgendaSlot[]; truncated: boolean },
  ): void {
    if ('error' in resultado) {
      this.cupos.set(errorToViewState<readonly CupoVisible[]>(resultado.error));
      return;
    }

    this.cuposRecortados.set(resultado.truncated);

    if (resultado.items.length === 0) {
      this.cupos.set(
        empty(
          { label: 'Ampliar a 30 días', route: '/schedule' },
          `No hay cupos generados ${this.resumenDeVentana()} para lo que estás mirando.`,
        ),
      );
      return;
    }

    this.cupos.set(ready(resultado.items.map((cupo) => this.aCupoVisible(cupo))));
  }

  /* -- Traducciones -------------------------------------------------------- */

  private aCitaVisible(cita: Booking): CitaVisible {
    const paciente = cita.patientProfileId ?? null;
    const estado = toBookingStatusPresentation(
      cita.statusConceptId === undefined
        ? undefined
        : this.etiquetas().get(cita.statusConceptId),
      SIN_DATO,
    );
    return {
      id: cita.id,
      cuando: cita.startAt ?? null,
      hasta: cita.endAt ?? null,
      recurso: this.nombreDeRecurso(cita.resourceId),
      estado,
      motivo: cita.reasonText ?? SIN_DATO,
      patientProfileId: paciente,
      rutaPaciente:
        paciente !== null && this.puedeVerFichas() ? `/administration/patients/${paciente}` : null,
      paciente: cita.patientName ?? (paciente === null ? 'Sin paciente' : 'Paciente asignado'),
      rutaExpediente:
        paciente !== null && this.puedeVerExpedientes() ? patientChartRoute(paciente) : null,
      motivoCrudo: cita.reasonText ?? null,
      appointmentId: cita.appointmentId ?? null,
      paramsDelExpediente: {
        ...(cita.reasonText === undefined ? {} : { [MOTIVO_QUERY_PARAM]: cita.reasonText }),
        ...(cita.appointmentId === undefined || cita.appointmentId === null
          ? {}
          : { [CITA_QUERY_PARAM]: cita.appointmentId }),
      },
      llegadaRegistrada: cita.checkedInAt !== undefined,
      solicitada: cita.createdAt,
      pago: cita.paymentState ?? null,
      admitePago: estado.code !== '' && !CODIGOS_SIN_PAGO.has(estado.code),
    };
  }

  private aCupoVisible(cupo: AgendaSlot): CupoVisible {
    return {
      id: cupo.id,
      resourceId: cupo.resourceId,
      desde: cupo.startAt,
      hasta: cupo.endAt,
      recurso: this.nombreDeRecurso(cupo.resourceId),
      estado: this.label(cupo.statusConceptId),
      capacidad: cupo.capacity,
      libres: cupo.remainingCapacity,
      // Derivado del contrato, no del estado: `remainingCapacity` no exige
      // resolver terminología para saber si queda lugar.
      disponible: cupo.remainingCapacity > 0,
      disponibilidad: `${cupo.remainingCapacity} de ${cupo.capacity} ${
        cupo.remainingCapacity === 1 ? 'libre' : 'libres'
      }`,
    };
  }

  /** El nombre del recurso, o el texto de ausencia. Nunca el uuid. */
  private nombreDeRecurso(resourceId: string | undefined): string {
    if (resourceId === undefined) {
      return SIN_DATO;
    }
    return this.recursos().find((recurso) => recurso.id === resourceId)?.name ?? SIN_DATO;
  }

  private label(conceptId: string | undefined): string {
    if (conceptId === undefined) {
      return SIN_DATO;
    }
    return this.etiquetas().get(conceptId)?.display ?? SIN_DATO;
  }

  /**
   * Si la sesión puede abrir la ficha de un paciente.
   *
   * `SUPERADMIN` entra porque el `RolesGuard` del backend lo trata como comodín:
   * si acá no figurara, el enlace se escondería para alguien a quien la API sí
   * le responde.
   */
  private puedeVerFichas(): boolean {
    const roles = this.auth.roles();
    return ROLES_CON_FICHA.some((rol) => roles.includes(rol));
  }

  /**
   * Si la sesión puede abrir el expediente clínico de la persona citada.
   *
   * Es el enlace que cierra el recorrido —del turno a la historia de quien
   * llega— y el que quien atiende sí tiene: `CLINICIAN` y `PRACTITIONER` no
   * pueden abrir la ficha de filiación (`SECURITY_ADMIN`), así que sin este
   * enlace la agenda del médico terminaba en un callejón.
   */
  private puedeVerExpedientes(): boolean {
    const roles = this.auth.roles();
    return ROLES_CON_EXPEDIENTE.some((rol) => roles.includes(rol));
  }

  /**
   * La ventana consultada, desde el arranque de `fechaBase` (ALV-024).
   *
   * Arranca al principio del día y no «ahora» a propósito: una cita de las
   * nueve de la mañana no debería desaparecer de la agenda a las nueve y
   * cinco. Antes arrancaba siempre en hoy; ahora es la fecha que la sesión
   * eligió navegar, y hoy sigue siendo el valor por omisión.
   */
  private ventana(): { desde: Date; hasta: Date } {
    const dias = VENTANAS.find((v) => v.clave === this.ventanaElegida())?.dias ?? 7;
    const desde = new Date(this.fechaBase());
    const hasta = new Date(desde);
    hasta.setDate(hasta.getDate() + dias);
    return { desde, hasta };
  }
}

/**
 * Parte un estado en dos sin perder ninguno de los nueve del M34.
 *
 * Las solicitudes y las citas agendadas salen de **la misma lectura**: pedir la
 * agenda dos veces para partirla en dos tablas sería duplicar una consulta que
 * ya trae todo. Lo que hay que cuidar es que `loading`, `forbidden`, `offline` y
 * los demás **sigan siendo los mismos** en las dos: si una tabla se quedara en
 * `ready` con cero filas mientras la otra está en `error`, la pantalla estaría
 * mintiendo sobre una de las dos.
 *
 * Por eso sólo se toca `ready` y `stale`, que son los únicos que transportan
 * datos. El resto viaja tal cual.
 */
function filtrarEstado<T>(
  estado: ViewState<readonly T[]>,
  predicado: (fila: T) => boolean,
): ViewState<readonly T[]> {
  if (estado.status === 'ready') {
    return ready(estado.data.filter(predicado));
  }
  if (estado.status === 'stale') {
    return stale(estado.data.filter(predicado), estado.asOf);
  }
  return estado;
}

/** Cuántas filas transporta un estado, o `null` si todavía no transporta ninguna. */
function cuenta<T>(estado: ViewState<readonly T[]>): number | null {
  if (estado.status === 'ready' || estado.status === 'stale') {
    return estado.data.length;
  }
  return estado.status === 'empty' ? 0 : null;
}

/**
 * El rótulo de una pestaña con su conteo.
 *
 * Sin conteo se devuelve el nombre pelado, no «Citas (…)»: un paréntesis vacío
 * mientras carga se lee como un dato, y el dato todavía no existe.
 */
function rotulo(nombre: string, total: number | null): string {
  return total === null ? nombre : `${nombre} (${total})`;
}

/**
 * El desempate visible de dos recursos que se llaman igual.
 *
 * Los últimos seis caracteres del uuid, en mayúscula. Seis y no el uuid entero
 * porque lo que hace falta es distinguir dos filas de una lista corta, no
 * identificar el registro: pegar 36 caracteres en cada opción rompe el
 * desplegable y no ayuda a leer. En mayúscula porque un uuid en minúscula, al
 * final de un nombre propio, se lee como parte del nombre.
 */
function discriminante(id: string): string {
  return id.replace(/-/g, '').slice(-6).toUpperCase();
}
