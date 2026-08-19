import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ProfilesClient } from '../../../core/data-access/profiles/profiles.client';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  AgendaResource,
  AgendaSlot,
  Booking,
  WaitlistEntry,
} from '../../../core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '../../../core/data-access/terminology/terminology.client';
import type {
  ConceptLabels,
  ValueSetOption,
} from '../../../core/data-access/terminology/terminology.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { ReferenceCombobox } from '../../../shared/components/molecules/reference-combobox/reference-combobox';
import type { ReferenceOption } from '../../../shared/components/molecules/reference-combobox/reference-combobox.types';
import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../shared/components/molecules/alert/alert';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FormField } from '../../../shared/components/molecules/form-field/form-field';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { AGENDA_ROUTE } from '../../agenda/agenda.routes';
import { AppointmentCalendar } from './appointment-calendar/appointment-calendar';
import type { CalendarAppointment } from './appointment-calendar/appointment-calendar.types';
import { reservaDelPortalRoute } from './appointments.routes';
import { sufijoDeCodigo, toBookingStatusPresentation } from './booking-status';

/**
 * Cuántos días hacia adelante se ofrecen.
 *
 * Dos semanas y no un calendario abierto porque la pregunta de quien pide un
 * turno es «cuándo puedo ir», no «qué hay dentro de tres meses»; y porque
 * `GET /scheduling/slots` rechaza con 422 las ventanas de más de 92 días.
 */
const DIAS_DE_BUSQUEDA = 14;

/** Tope de horarios que se listan. El backend admite hasta 500. */
const TOPE_DE_HORARIOS = 100;

/**
 * Cuántos profesionales se traen de la Guía para explicar un «no coincide».
 *
 * Es una fuente secundaria y de una sola lectura: alcanza con una página amplia
 * para reconocer un nombre, y no se pagina — si alguien no entra en esta, el
 * mensaje vuelve al genérico, que es lo que había antes.
 */
const TOPE_DE_GUIA = 200;

/** Tope de turnos propios que se traen. Nadie tiene cien turnos a la vez. */
const TOPE_DE_TURNOS = 50;

/**
 * Los códigos de estado en los que el backend acepta cancelar una reserva.
 *
 * Allowlist a propósito, no denylist: el catálogo mezcla convenciones
 * —`BOOKING_CONFIRMED` a secas y `scheduling:BOOKING_REQUESTED` con prefijo— y
 * «completada» aparece con más de un código (`EV_BOOKING_DONE`), así que
 * enumerar lo cancelable es más seguro que enumerar lo que no lo es: un estado
 * nuevo o desconocido no ofrece el botón. El backend sigue siendo la última
 * palabra —un 409/422 se trata con aviso amable—, pero no se ofrece una acción
 * que casi seguro va a fallar.
 *
 * Verificado contra la API viva (2026-08-12): los reservables presentes en datos
 * llegan como `BOOKING_CONFIRMED` y `BOOKING_CHECKED_IN`; `REQUESTED` y
 * `PENDING_CONFIRMATION` existen en el catálogo con prefijo de módulo.
 */
const CODIGOS_CANCELABLES: ReadonlySet<string> = new Set([
  'BOOKING_REQUESTED',
  'BOOKING_PENDING_CONFIRMATION',
  'BOOKING_CONFIRMED',
  'BOOKING_CHECKED_IN',
]);

/**
 * Los códigos de estado en los que el backend acepta **reprogramar** una
 * reserva. Es una lista propia y más corta que la de cancelar, y la
 * diferencia no es un descuido: el backend sólo reprograma una cita
 * *vigente* —confirmada o con llegada—, así que una solicitada o pendiente
 * de confirmación se puede cancelar pero **no** mover. Verificado contra el
 * código del endpoint y contra la API viva (2026-08-12).
 */
const CODIGOS_REPROGRAMABLES: ReadonlySet<string> = new Set([
  'BOOKING_CONFIRMED',
  'BOOKING_CHECKED_IN',
]);

/**
 * Las dos formas de mirar los mismos turnos (corrección #10).
 *
 * Viven en la URL para que el enlace se comparta con la vista puesta y para que
 * «atrás» deshaga el cambio, igual que los filtros del resto del repo.
 */
export type VistaDeTurnos = 'lista' | 'calendario';

/** La vista por omisión: la lista es la que además permite operar. */
const VISTA_POR_DEFECTO: VistaDeTurnos = 'lista';

/** Clave del parámetro de la URL que recuerda la vista elegida. */
const PARAM_DE_VISTA = 'vista';

/**
 * Clave del parámetro que abre un turno concreto (P8).
 *
 * Es lo que hace navegable un aviso: la notificación de demora, de cambio de
 * estado o de recordatorio lleva `?turno=<id>` y el detalle se abre solo. Sin
 * esto, un aviso deja a la persona buscando a mano el turno del que le acaban
 * de hablar.
 */
const PARAM_DE_TURNO = 'turno';

/** Un turno propio, ya listo para mostrarse. */
interface TurnoVisible {
  readonly id: string;
  readonly cuando: Date | null;
  readonly hasta: Date | null;
  /** El uuid del catálogo. Se conserva para poder reetiquetar cuando llegue. */
  readonly statusConceptId: string;
  /** El código del catálogo ya resuelto. `''` hasta que terminología llegue. */
  readonly codigo: string;
  readonly estado: string;
  /** El tono del badge, que sale del mismo código que la palabra. */
  readonly tono: BadgeVariant;
  /** La agenda del turno. Se conserva el id para reetiquetar cuando llegue. */
  readonly resourceId: string;
  /** Con quién es el turno, en palabras. Vacío mientras no se sepa. */
  readonly agenda: string;
  readonly motivo: string;
  /**
   * Por qué te cambiaron el turno, ya redactado (corrección #14).
   *
   * Vacío cuando el último cambio no exigía motivo —o cuando el turno es
   * anterior a la corrección—. Se arma acá y no en la plantilla porque quién lo
   * hizo cambia la frase entera: «tu médico canceló» no es «cancelaste».
   */
  readonly avisoDelCambio: string;
  /** Cuándo se hizo ese cambio, para fecharlo en pantalla. */
  readonly cambioCuando: Date | null;
  /**
   * La demora que informó el profesional, ya redactada (P8).
   *
   * Vacío cuando no informó ninguna. Se arma acá y no en la plantilla porque el
   * mensaje del profesional es opcional y la frase cambia con él.
   */
  readonly avisoDeDemora: string;
  /** Cuándo la informó, para fecharla en pantalla. */
  readonly demoraCuando: Date | null;
}

/** Una espera activa, ya lista para mostrarse (P8). */
interface EsperaVisible {
  readonly id: string;
  readonly resourceId: string;
  readonly agenda: string;
  readonly desde: Date | null;
  readonly hasta: Date | null;
  readonly anotadaEl: Date;
}

/** Un horario que se puede pedir. */
interface HorarioVisible {
  readonly id: string;
  readonly desde: Date;
  readonly hasta: Date;
  readonly resourceId: string;
  readonly lugaresLibres: number;
}

/**
 * El portal de turnos del paciente (las vistas `PATIENT` de M41).
 *
 * Responde las dos preguntas que tiene quien entra: **qué turnos tengo** y
 * **cuándo puedo ir**. La segunda termina en la pantalla de reserva, que es la
 * misma del mostrador con la otra entrada.
 *
 * ## Por qué no reusa la pantalla de agenda
 *
 * La agenda de la organización existe y funciona, pero mira los datos desde el
 * otro lado: elige un recurso y muestra TODAS sus citas, de todos los
 * pacientes. Acá el eje es la persona —sus turnos— y el recurso es apenas el
 * filtro para encontrar hueco. Además su sección exige roles de agenda, que un
 * paciente no tiene ni debería tener.
 *
 * ## Los estados salen de terminología, no de un mapa en el código
 *
 * `statusConceptId` es un uuid de catálogo. Se traduce con
 * `TerminologyClient.readConceptLabels`, igual que la ficha de paciente: un
 * mapa de uuid a etiqueta escrito acá se desactualiza en silencio el día que el
 * catálogo cambia, y nadie se entera hasta que un socio ve un uuid en pantalla.
 */
@Component({
  selector: 'app-appointments',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    AppointmentCalendar,
    Badge,
    DatePipe,
    FormField,
    PageHeader,
    ReferenceCombobox,
    RouterLink,
    Select,
  ],
  templateUrl: './appointments.html',
  styleUrl: './appointments.css',
  // `DatePipe` inyectable para nombrar el turno concreto en la confirmación de
  // cancelación (mismo locale es-BO que la plantilla).
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Appointments {
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);
  private readonly auth = inject(AuthService);
  private readonly dialogs = inject(DialogService);
  private readonly toast = inject(ToastService);
  private readonly fecha = inject(DatePipe);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly profiles = inject(ProfilesClient);

  /** Quién es el titular. Sin esto no hay turnos propios que pedir ni mostrar. */
  private readonly perfil = this.auth.patientProfileId();

  /**
   * La cuenta no es de un paciente.
   *
   * No es un error ni una falta de permisos: el personal de salud tiene sesión
   * válida y ninguna razón para tener turnos propios acá.
   */
  protected readonly sinPerfilDePaciente = this.perfil === null;

  /**
   * La salida cuando la cuenta no es de un paciente: la agenda de la
   * organización, que es a donde el propio aviso manda. Mismo destino que
   * ofrece `booking-new` en su caso equivalente.
   */
  protected readonly rutaDeAgenda = AGENDA_ROUTE;

  /** La organización, que `GET /scheduling/resources` exige explícita. */
  protected readonly organizacion = this.auth.activeTenantId;

  /** Etiquetas de los conceptos de estado, para no mostrar uuid. */
  private readonly etiquetas = signal<ConceptLabels>(new Map());

  /* ---- lista o calendario, y en la URL (corrección #10) ------------------- */

  private readonly params = toSignal(this.route.queryParamMap, { initialValue: null });

  /**
   * Qué vista se está mirando.
   *
   * Sale de la URL y no de un signal suelto para que el enlace se comparta con
   * la vista puesta y «atrás» la deshaga — el mismo criterio que los filtros de
   * la agenda y del buscador de pacientes.
   */
  protected readonly vista = computed<VistaDeTurnos>(() =>
    this.params()?.get(PARAM_DE_VISTA) === 'calendario' ? 'calendario' : VISTA_POR_DEFECTO,
  );

  protected readonly enCalendario = computed(() => this.vista() === 'calendario');

  /**
   * El turno abierto en el detalle.
   *
   * Es **uno solo para las dos vistas**: clickear un evento del calendario abre
   * exactamente el mismo detalle que clickear una fila de la lista, con las
   * mismas acciones. Dos detalles distintos serían dos implementaciones de lo
   * mismo, que es lo que la regla 3 del carril prohíbe.
   */
  protected readonly seleccionado = signal<string | null>(
    this.route.snapshot.queryParamMap.get(PARAM_DE_TURNO),
  );

  protected elegirVista(vista: VistaDeTurnos): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [PARAM_DE_VISTA]: vista === VISTA_POR_DEFECTO ? null : vista },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** Abre —o cierra, si ya estaba abierto— el detalle de un turno. */
  protected alternarDetalle(id: string): void {
    this.seleccionado.update((actual) => (actual === id ? null : id));
  }

  /**
   * Se señaló un día en el calendario: se ofrecen los horarios libres de ese día.
   *
   * No navega ni cambia de vista: el calendario sigue a la vista y debajo
   * aparece lo que hay ese día. Cambiar de pantalla en respuesta a un clic en
   * un número obligaría a volver para probar con otro día, que es la queja que
   * originó esto.
   */
  protected elegirDiaDeHorarios(dia: Date): void {
    this.diaDeHorarios.set(dia);
  }

  /** Vuelve a ofrecer los horarios de toda la ventana. */
  protected verTodosLosHorarios(): void {
    this.diaDeHorarios.set(null);
  }

  /** Desde el calendario el clic siempre abre: nunca cierra por segunda vez. */
  protected abrirDetalle(id: string): void {
    this.seleccionado.set(id);
  }

  /* ---- mis turnos --------------------------------------------------------- */

  protected readonly turnos = signal<ViewState<readonly TurnoVisible[]>>(loading());

  /** El turno que se está cancelando, para el `[isLoading]` del botón. `null` = ninguno. */
  protected readonly operando = signal<string | null>(null);

  /**
   * El turno que se está por mover, si hay uno. Mientras no sea `null`, la
   * grilla de horarios deja de ofrecer «pedir un turno nuevo» y ofrece «mover
   * acá»: el mismo clic no puede significar dos cosas a la vez.
   */
  protected readonly reprogramando = signal<string | null>(null);

  /** El turno origen de la reprogramación, ya resuelto para nombrarlo. */
  protected readonly turnoEnReprogramacion = computed<TurnoVisible | null>(() => {
    const id = this.reprogramando();
    if (id === null) {
      return null;
    }
    return this.turnosListos().find((turno) => turno.id === id) ?? null;
  });

  /* ---- lista de espera (P8) ----------------------------------------------- */

  /**
   * En qué esperas está el titular.
   *
   * Es una lista aparte y no un turno más: una espera **no** es un turno —no
   * tiene hora ni compromiso— y mezclarlas haría creer que hay cita cuando lo
   * que hay es una posición en una cola.
   */
  protected readonly esperas = signal<readonly EsperaVisible[]>([]);

  /** La espera que se está dando de alta, para el `[isLoading]` del botón. */
  protected readonly anotandose = signal(false);

  /** Si el titular ya espera en la agenda elegida: no tiene sentido anotarse dos veces. */
  protected readonly yaEnEspera = computed(() => {
    const recurso = this.recursoElegido();
    if (recurso === null) return false;
    return this.esperas().some((espera) => espera.resourceId === recurso);
  });

  /* ---- pedir un turno ----------------------------------------------------- */

  /**
   * Con quién se pide el turno: un profesional o un laboratorio.
   *
   * ## Por qué es la misma pantalla y no una nueva
   *
   * Porque el motor es el mismo —recurso, cupos, retener, confirmar— y lo único
   * que cambia es qué recursos se ofrecen. Duplicar la pantalla duplicaría
   * también la lista de espera, la reprogramación y la cancelación, que ya
   * tienen sus reglas resueltas acá.
   *
   * ## Por qué hay que filtrar, y no es cosmético
   *
   * `GET /scheduling/resources` devuelve **todos** los recursos del tenant. Sin
   * el filtro, en cuanto un laboratorio publique agenda aparecería en la lista
   * de «¿con quién te querés atender?», y alguien pediría consulta médica en
   * una sala de toma de muestras. El filtro existe en la API desde siempre;
   * esta pantalla no lo estaba usando.
   */
  protected readonly tipoDeRecurso = signal<'PRACTITIONER' | 'ROOM'>('PRACTITIONER');

  /** Se está pidiendo turno en un laboratorio, no con un profesional. */
  protected readonly esLaboratorio = computed(() => this.tipoDeRecurso() === 'ROOM');

  /**
   * Los recursos que se OFRECEN para elegir: sólo los del tipo activo.
   *
   * Se vacía al cambiar de tipo, porque un profesional no es una opción válida
   * cuando se está pidiendo turno en un laboratorio.
   */
  protected readonly recursos = signal<readonly AgendaResource[]>([]);

  /**
   * Todos los recursos vistos, para poder **rotular** los turnos ya reservados.
   *
   * Separado de {@link recursos} a propósito: los turnos de la persona incluyen
   * los de profesional y los de laboratorio a la vez, así que el nombre de su
   * agenda no puede salir de una lista que se filtra por el tipo que se está
   * eligiendo ahora. Con una sola lista, entrar al modo laboratorio dejaba sin
   * nombre a todos los turnos médicos ya sacados.
   *
   * Acumula y no reemplaza: un recurso que dejó de ofrecerse sigue siendo el
   * nombre correcto de un turno viejo.
   */
  private readonly catalogoDeRecursos = signal<ReadonlyMap<string, AgendaResource>>(new Map());

  protected readonly recursoElegido = signal<string | null>(null);

  /**
   * Los recursos agrupados por profesional (F-23, 18/08/2026).
   *
   * Un doctor con dos consultorios tiene dos agendas, y el buscador lo ofrecía
   * dos veces —el mismo nombre repetido, sin decir en qué se diferencian—. Se
   * elige **a la persona**; el lugar es la pregunta siguiente, y sólo cuando
   * hay más de uno.
   *
   * La clave es la referencia del recurso (el perfil profesional detrás) y cae
   * al identificador propio cuando no hay ninguna: salas y equipos no se
   * agrupan, que es lo correcto — dos boxes no son «el mismo lugar».
   */
  private readonly recursosPorProfesional = computed<ReadonlyMap<string, readonly AgendaResource[]>>(
    () => {
      const grupos = new Map<string, AgendaResource[]>();
      for (const recurso of this.recursos()) {
        // Sin referencia utilizable, cada recurso es su propio grupo: agrupar
        // por un valor ausente juntaría agendas de personas distintas.
        const referencia = recurso.resourceRefId ?? '';
        const clave = referencia === '' ? recurso.id : referencia;
        const grupo = grupos.get(clave) ?? [];
        grupo.push(recurso);
        grupos.set(clave, grupo);
      }
      return grupos;
    },
  );

  /** El grupo al que pertenece la agenda elegida, con todas sus sedes. */
  protected readonly sedesDelElegido = computed<readonly AgendaResource[]>(() => {
    const elegido = this.recursoElegido();
    if (elegido === null) return [];
    for (const grupo of this.recursosPorProfesional().values()) {
      if (grupo.some((recurso) => recurso.id === elegido)) return grupo;
    }
    return [];
  });

  /** Si hay que preguntar dónde: con una sola sede no se pregunta nada. */
  protected readonly hayVariasSedes = computed(() => this.sedesDelElegido().length > 1);

  /**
   * La sede elegida, o `null` para «cualquier lugar».
   *
   * `null` no es «ninguna»: es el modo que Pablo pidió primero —ver todos los
   * horarios sin importar el lugar— y es el que viene por defecto, porque quien
   * busca turno suele querer el más próximo antes que el más cercano.
   */
  protected readonly sedeElegida = signal<string | null>(null);

  protected readonly opcionesDeSede = computed<readonly SelectOption<string>[]>(() =>
    this.sedesDelElegido().map((recurso) => ({
      value: recurso.id,
      label: recurso.site?.name ?? recurso.name,
    })),
  );

  /** El nombre de la sede de un recurso, para rotular un horario. */
  protected nombreDeSede(resourceId: string): string {
    const recurso = this.catalogoDeRecursos().get(resourceId);
    return recurso?.site?.name ?? recurso?.name ?? '';
  }

  /**
   * Elige el lugar. `null` vuelve a «cualquier lugar».
   *
   * La agenda concreta pasa a ser la elegida —lo que reserva, lo que anota en
   * lista de espera— porque a partir de acá la persona ya dijo dónde. En modo
   * «cualquier lugar» se conserva la primera del grupo, que es la que el
   * buscador había elegido.
   */
  protected elegirSede(resourceId: string | null): void {
    this.sedeElegida.set(resourceId);
    if (resourceId !== null) {
      this.recursoElegido.set(resourceId);
    }
    this.cargarHorarios();
  }

  protected readonly opcionesDeRecurso = computed<readonly SelectOption<string>[]>(() =>
    [...this.recursosPorProfesional().values()].map(([recurso, ...otras]) => ({
      value: recurso.id,
      // La pregunta de la pantalla es «¿con quién te querés atender?»: la
      // respuesta honesta es la persona. El nombre del recurso queda de
      // respaldo para salas, equipos o perfiles que no resolvieron — que es
      // exactamente lo que esta opción mostraba siempre. Si el nombre interno
      // de la agenda agrega algo (sede, turno), va como aclaración.
      // Con varias sedes el rótulo de la agenda sobra —y confunde: la persona
      // es la misma—. El lugar se pregunta después.
      label:
        otras.length > 0
          ? (recurso.practitionerName ?? recurso.name)
          : etiquetaDeRecurso(recurso),
    })),
  );

  /**
   * Lo tecleado en el buscador de profesional.
   *
   * El listado ya está en memoria, así que filtrar es local: no se consulta a
   * la API por cada letra. Vacío = se ofrecen todos, que es como se comportaba
   * el desplegable.
   */
  protected readonly busquedaDeRecurso = signal('');

  /**
   * Las opciones del buscador, acotadas por lo tecleado.
   *
   * Con una organización de pocos profesionales daba igual, pero con un listado
   * largo había que recorrerlo a mano hasta encontrar al propio (F-13). Se busca
   * por lo que la persona conoce —el nombre— y también por el rótulo de la
   * agenda, que suele traer sede o especialidad.
   */
  protected readonly opcionesBuscadas = computed<readonly ReferenceOption[]>(() => {
    const termino = normalizar(this.busquedaDeRecurso());
    const todas = this.opcionesDeRecurso().map((opcion) => ({
      value: opcion.value,
      label: opcion.label,
    }));
    if (termino === '') return todas;
    return todas.filter((opcion) => normalizar(opcion.label).includes(termino));
  });

  /* ---- F-24: «no coincide» no es lo mismo que «todavía no publicó» ------- */

  /**
   * Los profesionales de la Guía, como **fuente secundaria** del buscador.
   *
   * El desplegable ofrece agendas, no profesionales, así que quien todavía no
   * publicó la suya simplemente no está — y la pantalla respondía «ningún
   * profesional coincide con esa búsqueda», que es falso y deja pensando que se
   * escribió mal el nombre. La Guía sí lo conoce, así que cuando la búsqueda no
   * encuentra agenda se le pregunta a ella y se dice lo que de verdad pasa.
   *
   * Se pide **una sola vez** y sólo cuando hace falta: mientras el buscador
   * encuentre agendas, esta lectura no ocurre.
   */
  private readonly profesionalesDeLaGuia = signal<readonly string[]>([]);
  private readonly guiaPedida = signal(false);

  private readonly consultarLaGuia = effect(() => {
    if (this.esLaboratorio()) return;
    if (this.busquedaDeRecurso().trim() === '') return;
    if (this.opcionesBuscadas().length > 0) return;
    if (this.guiaPedida()) return;

    this.guiaPedida.set(true);
    this.profiles
      .listPractitioners({ limit: TOPE_DE_GUIA })
      .pipe(catchError(() => of({ items: [], nextCursor: undefined })))
      .subscribe((pagina) =>
        this.profesionalesDeLaGuia.set(
          pagina.items
            .map((fila) => fila.displayName)
            .filter((nombre): nombre is string => nombre !== undefined && nombre !== ''),
        ),
      );
  });

  /**
   * Lo que el buscador dice cuando no encuentra ninguna agenda.
   *
   * Si la Guía conoce a alguien con ese nombre, el problema no es la búsqueda:
   * es que esa persona todavía no publicó sus horarios. Decirlo con su nombre
   * es la diferencia entre «buscá de nuevo» y «no hay nada que buscar».
   */
  protected readonly mensajeSinCoincidencias = computed(() => {
    if (this.esLaboratorio()) {
      return 'Ningún laboratorio coincide con esa búsqueda';
    }
    const termino = normalizar(this.busquedaDeRecurso());
    if (termino !== '') {
      const conocido = this.profesionalesDeLaGuia().find((nombre) =>
        normalizar(nombre).includes(termino),
      );
      if (conocido !== undefined) {
        return `${conocido} todavía no publicó sus horarios`;
      }
    }
    return 'Ningún profesional coincide con esa búsqueda';
  });

  /** El profesional elegido, con la forma que pide el buscador. */
  protected readonly recursoSeleccionado = computed<ReferenceOption | null>(() => {
    const id = this.recursoElegido();
    if (id === null) return null;
    // Por grupo y no por identificador exacto: si se eligió una sede concreta,
    // la opción del buscador sigue siendo la de la persona (F-23).
    const delGrupo = new Set(this.sedesDelElegido().map((recurso) => recurso.id));
    return (
      this.opcionesDeRecurso().find(
        (opcion) => opcion.value === id || delGrupo.has(opcion.value),
      ) ?? null
    );
  });

  /** La organización todavía no cargó ninguna agenda que ofrecer. */
  protected readonly sinRecursos = signal(false);

  /**
   * La próxima acción de todo vacío de esta pantalla es la misma: elegir una
   * agenda. No lleva `route` porque el control ya está acá arriba, en la misma
   * vista: mandar a otra ruta para volver al mismo lugar sería un rodeo.
   */
  private readonly elegirAgenda = { label: 'Elegí una agenda' } as const;

  protected readonly horarios = signal<ViewState<readonly HorarioVisible[]>>(
    empty(this.elegirAgenda, 'Elegí con quién te querés atender para ver los horarios libres.'),
  );

  /** El mensaje del vacío, que la plantilla no puede sacar del estado tipada. */
  protected readonly mensajeDeHorariosVacios = computed(() => {
    const estado = this.horarios();
    return estado.status === 'empty' ? (estado.message ?? '') : '';
  });

  protected readonly turnosListos = computed<readonly TurnoVisible[]>(() => {
    const estado = this.turnos();
    return estado.status === 'ready' ? estado.data : [];
  });

  /**
   * Los mismos turnos, en la forma que el calendario entiende.
   *
   * **Los mismos**, no otra lectura: las dos vistas tienen que decir lo mismo o
   * la agenda se contradice a sí misma.
   */
  protected readonly turnosDeCalendario = computed<readonly CalendarAppointment[]>(() =>
    this.turnosListos().map((turno) => ({
      id: turno.id,
      cuando: turno.cuando,
      hasta: turno.hasta,
      titulo: turno.agenda === '' ? 'Turno' : turno.agenda,
      estado: turno.estado,
      tono: turno.tono,
    })),
  );

  /** El turno abierto en el detalle, ya resuelto. */
  protected readonly turnoEnDetalle = computed<TurnoVisible | null>(() => {
    const id = this.seleccionado();
    return id === null ? null : (this.turnosListos().find((turno) => turno.id === id) ?? null);
  });

  /**
   * El día que se señaló en el calendario, o `null` si se miran los de la
   * ventana entera.
   *
   * Antes el calendario sólo servía para mirar: para pedir turno había que
   * bajar al formulario y recorrer catorce días de horarios, y para la semana
   * siguiente, más scroll (F-10). Ahora el día se elige donde se lo está
   * mirando, y esta señal es la que traduce ese gesto en un filtro.
   */
  protected readonly diaDeHorarios = signal<Date | null>(null);

  /** El día elegido, dicho en palabras para el aviso que lo ofrece deshacer. */
  protected readonly diaDeHorariosEnPalabras = computed(() => {
    const dia = this.diaDeHorarios();
    return dia === null
      ? ''
      : dia.toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' });
  });

  protected readonly horariosListos = computed<readonly HorarioVisible[]>(() => {
    const estado = this.horarios();
    const todos = estado.status === 'ready' ? estado.data : [];
    const dia = this.diaDeHorarios();
    if (dia === null) return todos;
    return todos.filter((horario) => mismoDia(horario.desde, dia));
  });

  constructor() {
    if (this.perfil !== null) {
      this.cargarTurnos();
      this.cargarRecursos();
      this.cargarEsperas();
    }
  }

  /* ---- lecturas ----------------------------------------------------------- */

  /** Los turnos del titular. El backend filtra por perfil, no por organización. */
  protected cargarTurnos(): void {
    const perfil = this.perfil;
    if (perfil === null) {
      return;
    }

    this.turnos.set(loading());
    // `includeCancelled: true` a propósito: tras cancelar, el turno tiene que
    // seguir viéndose —como cancelado— y no desaparecer. El backend lo oculta por
    // omisión; acá se quiere el historial reciente, no solo lo vigente.
    this.scheduling
      .searchBookings({ patientProfileId: perfil, includeCancelled: true, limit: TOPE_DE_TURNOS })
      .subscribe({
        next: (pagina) => {
          if (pagina.items.length === 0) {
            this.turnos.set(empty(this.elegirAgenda, 'Todavía no pediste ningún turno.'));
            return;
          }
          this.traducirEstados(pagina.items);
          this.turnos.set(ready(pagina.items.map((cita) => this.aTurnoVisible(cita))));
        },
        error: (error: unknown) =>
          this.turnos.set(errorToViewState<readonly TurnoVisible[]>(error)),
      });
  }

  /**
   * Las agendas de la organización.
   *
   * `tenantId` va explícito porque el contrato lo exige en la query, y tiene
   * que ser el mismo que viaja en `X-Tenant-Id`: si difieren, el interceptor de
   * tenant responde 403 antes de llegar al handler.
   */
  /**
   * Cambia entre pedir turno con un profesional o en un laboratorio.
   *
   * Limpia lo elegido antes de recargar: el recurso seleccionado pertenece a la
   * lista anterior, y dejarlo puesto mostraría horarios de un profesional bajo
   * el rótulo de laboratorio hasta que la lectura vuelva.
   *
   * @param tipo - Con quién se quiere pedir el turno.
   */
  protected cambiarTipoDeRecurso(tipo: 'PRACTITIONER' | 'ROOM'): void {
    if (this.tipoDeRecurso() === tipo) {
      return;
    }
    this.tipoDeRecurso.set(tipo);
    this.recursoElegido.set(null);
    this.recursos.set([]);
    this.busquedaDeRecurso.set('');
    this.cargarRecursos();
  }

  private cargarRecursos(): void {
    const tenantId = this.organizacion();
    if (tenantId === null) {
      return;
    }

    this.scheduling.listResources({ tenantId, resourceType: this.tipoDeRecurso() }).subscribe({
      next: (pagina) => {
        this.recursos.set(pagina.items);
        this.catalogoDeRecursos.update((previo) => {
          const mezcla = new Map(previo);
          for (const recurso of pagina.items) {
            mezcla.set(recurso.id, recurso);
          }
          return mezcla;
        });
        this.sinRecursos.set(pagina.items.length === 0);
        // Los turnos pueden haberse pintado antes que esto: las dos lecturas
        // del arranque salen a la vez. Se rehacen para que tomen el nombre de
        // su agenda, igual que con las etiquetas de estado.
        this.reetiquetarTurnos();
      },
      // Un fallo acá no se cuenta como «no hay agendas»: eso mandaría a la
      // persona a esperar a que la organización cargue algo que quizá ya tiene.
      error: () => this.sinRecursos.set(false),
    });
  }

  /**
   * El `Select` emite `null` cuando se vuelve al placeholder. Eso no es elegir
   * una agenda: se vuelve al estado inicial en vez de pedir horarios de nadie.
   */
  protected elegirRecurso(id: string | null): void {
    this.recursoElegido.set(id);
    // Cambiar de profesional vuelve a «cualquier lugar»: la sede anterior era
    // de otra persona (F-23).
    this.sedeElegida.set(null);
    if (id === null) {
      this.horarios.set(
        empty(this.elegirAgenda, 'Elegí con quién te querés atender para ver los horarios libres.'),
      );
      return;
    }
    this.cargarHorarios();
  }

  /** Los huecos de las próximas dos semanas del recurso elegido. */
  protected cargarHorarios(): void {
    const resourceId = this.recursoElegido();
    if (resourceId === null) {
      return;
    }

    const desde = new Date();
    const hasta = new Date(desde.getTime() + DIAS_DE_BUSQUEDA * 24 * 60 * 60 * 1000);

    // «Cualquier lugar» pregunta por todas las agendas de la persona y junta lo
    // que devuelvan (F-23): cada cupo ya sabe de qué recurso es, así que
    // reservar sigue funcionando igual desde cualquiera de ellos.
    const agendas =
      this.sedeElegida() === null && this.sedesDelElegido().length > 1
        ? this.sedesDelElegido().map((recurso) => recurso.id)
        : [resourceId];

    this.horarios.set(loading());
    forkJoin(
      agendas.map((id) =>
        this.scheduling
          .listSlots({
            resourceId: id,
            from: desde,
            to: hasta,
            onlyAvailable: true,
            limit: TOPE_DE_HORARIOS,
          })
          // Una sede que falla no deja sin horarios a las demás: se muestra lo
          // que hay. Si fallan todas, la lista queda vacía y el vacío lo dice.
          .pipe(catchError(() => of({ items: [], count: 0 }))),
      ),
    )
      .subscribe({
        next: (paginas) => {
          const pagina = {
            items: paginas
              .flatMap((p) => p.items)
              .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
              .slice(0, TOPE_DE_HORARIOS),
          };
          const libres = pagina.items.filter((cupo) => cupo.remainingCapacity > 0);
          if (libres.length === 0) {
            this.horarios.set(
              empty(
                { label: 'Probá con otra agenda' },
                'No hay horarios libres en las próximas dos semanas.',
              ),
            );
            return;
          }
          this.horarios.set(ready(libres.map((cupo) => this.aHorarioVisible(cupo))));
        },
        error: (error: unknown) =>
          this.horarios.set(errorToViewState<readonly HorarioVisible[]>(error)),
      });
  }

  /* ---- lista de espera (P8) ----------------------------------------------- */

  /**
   * Las esperas activas del titular.
   *
   * Un fallo no vacía la pantalla ni muestra un error: la lista de espera es
   * información secundaria y perderla no justifica romper «mis turnos». Se
   * queda sin bloque, que es exactamente lo que pasaba antes de que existiera.
   */
  protected cargarEsperas(): void {
    const perfil = this.perfil;
    if (perfil === null) {
      return;
    }

    this.scheduling
      .listWaitlist({ patientProfileId: perfil })
      .pipe(catchError(() => of({ items: [] as readonly WaitlistEntry[] })))
      .subscribe((pagina) => {
        this.esperas.set(pagina.items.map((entrada) => this.aEsperaVisible(entrada)));
      });
  }

  /**
   * Anota al titular en la lista de espera de la agenda elegida.
   *
   * Es la salida del callejón: sin cupos, la pantalla ofrecía «probá con otra
   * agenda» y nada más. Anotarse **no reserva** —cuando se libere un horario
   * llega el aviso y se confirma por el flujo normal—, y el diálogo lo dice
   * para que nadie se quede esperando una cita que no existe.
   */
  protected async anotarmeEnEspera(): Promise<void> {
    const perfil = this.perfil;
    const tenantId = this.organizacion();
    const resourceId = this.recursoElegido();
    if (perfil === null || tenantId === null || resourceId === null || this.anotandose()) {
      return;
    }

    const agenda = this.nombreDeLaAgenda(resourceId);
    const confirmado = await this.dialogs.confirm({
      title: 'Anotarte en la lista de espera',
      message:
        agenda === ''
          ? 'Te avisamos apenas se libere un horario. No reserva el turno: lo confirmás vos cuando llegue el aviso.'
          : `Te avisamos apenas se libere un horario con ${agenda}. No reserva el turno: lo confirmás vos cuando llegue el aviso.`,
      confirmLabel: 'Anotarme',
      cancelLabel: 'Volver',
    });
    if (!confirmado) {
      return;
    }

    const desde = new Date();
    const hasta = new Date(desde.getTime() + DIAS_DE_BUSQUEDA * 24 * 60 * 60 * 1000);

    this.anotandose.set(true);
    this.scheduling
      .enrollWaitlist({
        tenantId,
        patientProfileId: perfil,
        resourceId,
        desiredFrom: desde,
        desiredTo: hasta,
      })
      .subscribe({
        next: () => {
          this.anotandose.set(false);
          this.toast.success(
            'Te avisamos apenas se libere un horario.',
            'Estás en lista de espera',
          );
          this.cargarEsperas();
        },
        error: (error: unknown) => {
          this.anotandose.set(false);
          const estado = errorToViewState<null>(error);
          const detalle =
            estado.status === 'forbidden' || estado.status === 'error'
              ? (estado.message ?? '')
              : '';
          this.toast.error(
            detalle === '' ? 'No pudimos anotarte en la lista de espera.' : detalle,
            'Lista de espera',
          );
        },
      });
  }

  /* ---- cancelar ----------------------------------------------------------- */

  /**
   * Si el turno admite cancelarse, por su código de estado.
   *
   * Allowlist sobre el sufijo del código (ver {@link CODIGOS_CANCELABLES}): un
   * estado fuera de la lista —cancelado, atendido, completado o desconocido— no
   * ofrece el botón. Mientras el código no se resolvió (`''`) tampoco: nunca se
   * ofrece cancelar sobre un estado que no se conoce.
   */
  protected esCancelable(turno: TurnoVisible): boolean {
    return turno.codigo !== '' && CODIGOS_CANCELABLES.has(sufijoDeCodigo(turno.codigo));
  }

  /**
   * Cancela el turno propio, con confirmación previa.
   *
   * Es una acción destructiva, así que pide confirmación nombrando el turno. El
   * tono es calmo, no de alarma: cancelar un turno propio es corriente, no una
   * baja de la que haya que disuadir.
   */
  protected async cancelarTurno(turno: TurnoVisible): Promise<void> {
    if (this.operando() !== null) {
      return;
    }

    // El motivo es obligatorio y el servidor lo exige (corrección #14): se pide
    // en el mismo diálogo que confirma, no en un paso aparte ni después del 422.
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Cancelar el turno',
        message: `Vas a cancelar ${this.nombreDelTurno(turno)}. El horario queda libre para otra persona.`,
        confirmLabel: 'Cancelar el turno',
        cancelLabel: 'Volver',
      },
      {
        label: 'Motivo de la cancelación',
        placeholder: 'Contá brevemente por qué no vas a poder ir',
        hint: 'El profesional lo va a ver junto con la cancelación.',
      },
    );
    if (motivo === null) {
      return;
    }

    this.operando.set(turno.id);
    this.scheduling
      .cancelBooking(turno.id, { cancelledBy: 'PATIENT', reasonText: motivo })
      .subscribe({
        next: () => {
          this.operando.set(null);
          this.toast.success('Cancelamos tu turno y liberamos el horario.', 'Turno cancelado');
          // El servidor es la verdad: se relee en vez de tachar la fila y devolver
          // el cupo a mano. El turno reaparece como cancelado (por `includeCancelled`)
          // y el horario vuelve a ofrecerse.
          this.recargar();
        },
        error: (error: unknown) => {
          this.operando.set(null);
          this.avisarFalloCancelacion(error);
        },
      });
  }

  /** Cómo nombrar el turno en la confirmación: por su fecha, o genérico. */
  private nombreDelTurno(turno: TurnoVisible): string {
    if (turno.cuando === null) {
      return 'este turno';
    }
    const cuando = this.fecha.transform(turno.cuando, "EEEE d 'de' MMM 'a las' HH:mm");
    return cuando === null ? 'este turno' : `el turno del ${cuando}`;
  }

  /**
   * Traduce el fallo de cancelar a un aviso, sin pintar de rojo lo que no es un
   * error del titular.
   *
   * - **409 `CONFLICT`** (ya estaba cancelado, p. ej. desde la agenda del médico)
   *   y **422 / precondición** (la transición ya no está disponible) son estados
   *   esperados: aviso neutro y se relee, porque el mundo cambió mientras la
   *   pantalla estaba abierta y la lista tiene que ponerse al día.
   * - Cualquier otro fallo sigue el patrón del repo y **no** destruye la lista:
   *   la que se leyó sigue siendo cierta aunque un botón haya fallado.
   */
  private avisarFalloCancelacion(error: unknown): void {
    const estado = errorToViewState<null>(error);
    const codigos = estado.status === 'validation' ? estado.issues.map((issue) => issue.code) : [];

    if (codigos.includes('CONFLICT')) {
      this.toast.info('Este turno ya estaba cancelado. Actualizamos tu lista.', 'Turno');
      this.recargar();
      return;
    }
    if (estado.status === 'validation') {
      this.toast.info('Este turno ya no se puede cancelar. Actualizamos tu lista.', 'Turno');
      this.recargar();
      return;
    }

    const detalle =
      estado.status === 'forbidden' || estado.status === 'error' ? (estado.message ?? '') : '';
    this.toast.error(
      detalle === '' ? 'No pudimos cancelar el turno. Reintentá en un momento.' : detalle,
      'Turno',
    );
  }

  /** Relee lo que la operación cambió: los turnos y los horarios ofrecidos. */
  private recargar(): void {
    this.cargarTurnos();
    this.cargarHorarios();
  }

  /* ---- reprogramar -------------------------------------------------------- */

  /**
   * Si el turno admite moverse a otro horario.
   *
   * Allowlist **propia**, no la de cancelar: el backend sólo reprograma una
   * cita vigente (confirmada o con llegada). Una solicitada o pendiente se
   * puede cancelar pero no mover.
   */
  protected esReprogramable(turno: TurnoVisible): boolean {
    return turno.codigo !== '' && CODIGOS_REPROGRAMABLES.has(sufijoDeCodigo(turno.codigo));
  }

  /**
   * Entra al modo reprogramación: la grilla de horarios que ya existe pasa a
   * ofrecer «mover acá» en vez de «pedir este horario».
   *
   * Se preselecciona la agenda del turno para que lo primero que se vea sean
   * sus propios horarios; el selector sigue disponible para mirar otra.
   */
  protected iniciarReprogramacion(turno: TurnoVisible): void {
    if (this.operando() !== null) {
      return;
    }

    this.reprogramando.set(turno.id);
    if (turno.resourceId !== '' && this.recursoElegido() !== turno.resourceId) {
      this.elegirRecurso(turno.resourceId);
    }
  }

  /** Sale del modo reprogramación sin tocar nada. */
  protected cancelarReprogramacion(): void {
    this.reprogramando.set(null);
  }

  /**
   * Mueve el turno en reprogramación al horario elegido, con confirmación que
   * nombra origen y destino. Un solo POST: el backend libera el cupo viejo y
   * ocupa el nuevo en la misma operación; el estado de la cita no cambia.
   */
  protected async reprogramarA(horario: HorarioVisible): Promise<void> {
    const origenId = this.reprogramando();
    if (origenId === null || this.operando() !== null) {
      return;
    }

    const origen = this.turnoEnReprogramacion();
    const motivo = await this.dialogs.confirmWithReason(
      {
        title: 'Mover el turno',
        message: `Vas a mover ${origen === null ? 'este turno' : this.nombreDelTurno(origen)} al ${this.nombreDelHorario(horario)}. El horario anterior queda libre.`,
        confirmLabel: 'Mover el turno',
        cancelLabel: 'Volver',
      },
      {
        label: 'Motivo del cambio',
        placeholder: 'Contá brevemente por qué necesitás moverlo',
        hint: 'El profesional lo va a ver junto con el horario nuevo.',
      },
    );
    if (motivo === null) {
      return;
    }

    this.operando.set(origenId);
    this.scheduling
      .rescheduleBooking(origenId, { toSlotId: horario.id, reasonText: motivo })
      .subscribe({
        next: () => {
          this.operando.set(null);
          this.reprogramando.set(null);
          this.toast.success('Movimos tu turno al horario nuevo.', 'Turno reprogramado');
          // El servidor es la verdad: la lista muestra la hora nueva y el cupo
          // viejo vuelve a ofrecerse releyendo, no restando a mano.
          this.recargar();
        },
        error: (error: unknown) => {
          this.operando.set(null);
          this.avisarFalloReprogramacion(error);
        },
      });
  }

  /** Cómo nombrar el horario destino en la confirmación. */
  private nombreDelHorario(horario: HorarioVisible): string {
    return (
      this.fecha.transform(horario.desde, "EEEE d 'de' MMM 'a las' HH:mm") ?? 'horario elegido'
    );
  }

  /**
   * Traduce el fallo de reprogramar a un aviso, con el mismo criterio que la
   * cancelación: lo esperado no es rojo.
   *
   * - **409 `CONFLICT`**: el cupo destino se ocupó mientras se decidía. Se
   *   avisa y se relee —la grilla estaba vieja—, y el modo queda activo para
   *   elegir otro horario.
   * - **422 / precondición**: la cita dejó de estar vigente (p. ej. se canceló
   *   desde otra sesión). Se avisa, se sale del modo y se relee.
   * - Cualquier otro fallo sigue el patrón del repo, sin destruir la lista.
   */
  private avisarFalloReprogramacion(error: unknown): void {
    const estado = errorToViewState<null>(error);
    const codigos = estado.status === 'validation' ? estado.issues.map((issue) => issue.code) : [];

    if (codigos.includes('CONFLICT')) {
      this.toast.info('Ese horario se acaba de ocupar. Elegí otro de la lista.', 'Turno');
      this.recargar();
      return;
    }
    if (estado.status === 'validation') {
      this.toast.info('Este turno ya no se puede reprogramar. Actualizamos tu lista.', 'Turno');
      this.reprogramando.set(null);
      this.recargar();
      return;
    }

    const detalle =
      estado.status === 'forbidden' || estado.status === 'error' ? (estado.message ?? '') : '';
    this.toast.error(
      detalle === '' ? 'No pudimos mover el turno. Reintentá en un momento.' : detalle,
      'Turno',
    );
  }

  /**
   * Pide las etiquetas de los estados que aparecieron.
   *
   * Se traducen los que hay, no un catálogo entero: la lista de estados posibles
   * es del backend, y adivinarla acá sería inventar el catálogo.
   */
  private traducirEstados(citas: readonly Booking[]): void {
    const ids = [...new Set(citas.map((cita) => cita.statusConceptId))];
    if (ids.length === 0) {
      return;
    }

    this.terminology
      .readConceptLabels(ids)
      // Si el catálogo no responde, los turnos igual se muestran: el estado
      // cae a su texto neutro. Perder la etiqueta no justifica perder la lista.
      .pipe(catchError(() => of(new Map<string, ValueSetOption>())))
      .subscribe((etiquetas) => {
        this.etiquetas.set(new Map([...this.etiquetas(), ...etiquetas]));
        // La lista ya está pintada con el texto neutro: hay que rehacerla para
        // que tome las etiquetas que acaban de llegar.
        this.reetiquetarTurnos();
      });
  }

  /**
   * Rehace la lista ya pintada con lo que se sepa ahora.
   *
   * La pantalla arranca tres lecturas que terminan en cualquier orden —los
   * turnos, las agendas y el catálogo de estados— y las dos últimas aportan
   * texto a la primera. En vez de esperar a todas para pintar algo, se pinta lo
   * que hay y se rehace cuando llega el resto.
   */
  private reetiquetarTurnos(): void {
    const estado = this.turnos();
    if (estado.status === 'ready') {
      this.turnos.set(ready(estado.data.map((turno) => this.conEtiqueta(turno))));
    }
  }

  /* ---- destinos ----------------------------------------------------------- */

  protected rutaDeReserva(horario: HorarioVisible): string {
    return reservaDelPortalRoute(horario.id);
  }

  /**
   * La franja viaja con el enlace: la pantalla de reserva no puede leer un cupo
   * por id —no existe ese GET— y con esto lo reencuentra y revalida.
   */
  protected paramsDeReserva(horario: HorarioVisible): Record<string, string> {
    return {
      recurso: horario.resourceId,
      desde: horario.desde.toISOString(),
      hasta: horario.hasta.toISOString(),
    };
  }

  /* ---- mapeos ------------------------------------------------------------- */

  private aTurnoVisible(cita: Booking): TurnoVisible {
    const estado = this.presentacionDelEstado(cita.statusConceptId);
    const resourceId = cita.resourceId ?? '';
    return {
      id: cita.id,
      cuando: cita.startAt ?? null,
      hasta: cita.endAt ?? null,
      statusConceptId: cita.statusConceptId,
      codigo: this.codigoDelEstado(cita.statusConceptId),
      estado: estado.label,
      tono: estado.tone,
      resourceId,
      agenda: this.nombreDeLaAgenda(resourceId),
      motivo: cita.reasonText ?? '',
      avisoDelCambio: avisoDelCambio(cita),
      cambioCuando: cita.statusReason?.changedAt ?? null,
      avisoDeDemora: avisoDeDemora(cita),
      demoraCuando: cita.delayNotice?.announcedAt ?? null,
    };
  }

  private aEsperaVisible(entrada: WaitlistEntry): EsperaVisible {
    return {
      id: entrada.id,
      resourceId: entrada.resourceId ?? '',
      // El servidor ya resuelve el nombre de la agenda: acá no hace falta
      // cruzarlo con la lista de recursos, que además puede no incluirla.
      agenda: entrada.resourceLabel,
      desde: entrada.desiredFrom ?? null,
      hasta: entrada.desiredTo ?? null,
      anotadaEl: entrada.createdAt,
    };
  }

  /** Reetiqueta un turno con lo que el catálogo haya traído desde entonces. */
  private conEtiqueta(turno: TurnoVisible): TurnoVisible {
    const estado = this.presentacionDelEstado(turno.statusConceptId);
    return {
      ...turno,
      codigo: this.codigoDelEstado(turno.statusConceptId),
      estado: estado.label,
      tono: estado.tone,
      agenda: this.nombreDeLaAgenda(turno.resourceId),
    };
  }

  /** El código del estado, o `''` si el catálogo todavía no lo resolvió. */
  private codigoDelEstado(conceptId: string): string {
    return this.etiquetas().get(conceptId)?.code ?? '';
  }

  /**
   * Con quién es el turno.
   *
   * Sale de las agendas que la pantalla ya cargó para el selector, así que no
   * cuesta una petición más. Devuelve vacío mientras no se sepa —las dos
   * lecturas del arranque corren en paralelo y los turnos pueden llegar
   * primero—, y la plantilla omite la línea en vez de mostrar un hueco o, peor,
   * el identificador del recurso.
   */
  private nombreDeLaAgenda(resourceId: string): string {
    if (resourceId === '') {
      return '';
    }
    // Del catálogo acumulado y no de la lista ofrecida: un turno médico
    // conserva el nombre de su agenda aunque ahora se estén mirando
    // laboratorios.
    return this.catalogoDeRecursos().get(resourceId)?.name ?? '';
  }

  /**
   * Cómo se muestra el estado: la palabra y el tono.
   *
   * El catálogo resuelve el uuid a un **código**, y el código decide las dos
   * cosas. Ni el uuid ni el `display` en inglés del catálogo llegan a la
   * pantalla: el primero no le dice nada a nadie —es justo lo que la regla del
   * M34 pide evitar— y el segundo es una etiqueta de API en otro idioma.
   */
  private presentacionDelEstado(conceptId: string) {
    return toBookingStatusPresentation(this.etiquetas().get(conceptId));
  }

  private aHorarioVisible(cupo: AgendaSlot): HorarioVisible {
    return {
      id: cupo.id,
      desde: cupo.startAt,
      hasta: cupo.endAt,
      resourceId: cupo.resourceId,
      lugaresLibres: cupo.remainingCapacity,
    };
  }
}

/**
 * Cómo se le cuenta al paciente el último cambio de su turno (corrección #14).
 *
 * Quién lo hizo cambia la frase entera, y por eso no se resuelve en la
 * plantilla: «tu profesional canceló el turno» y «cancelaste el turno» son la
 * misma transición contada desde dos lados, y mostrar la segunda cuando pasó la
 * primera es peor que no mostrar nada.
 *
 * Devuelve `''` cuando no hay motivo registrado, que es lo corriente en un
 * turno que nadie tocó y en los anteriores a esta versión.
 */
function avisoDelCambio(cita: Booking): string {
  const cambio = cita.statusReason;
  if (cambio === undefined || cambio.reasonText.trim() === '') {
    return '';
  }
  const quien = cambio.actorKind === 'PATIENT' ? 'Indicaste' : 'El profesional indicó';
  return `${quien}: ${cambio.reasonText}`;
}

/**
 * Cómo se le cuenta al paciente la demora de su profesional (P8).
 *
 * Los minutos van siempre —son lo único que permite decidir si salir de casa— y
 * el mensaje del profesional sólo si lo escribió: dejar «Motivo:» colgando
 * cuando no hay motivo es peor que no decir nada.
 *
 * Devuelve `''` cuando nadie informó una demora, que es el caso corriente.
 */
function avisoDeDemora(cita: Booking): string {
  const demora = cita.delayNotice;
  if (demora === undefined || demora.delayMinutes <= 0) {
    return '';
  }
  const base = `El profesional avisó que se demora unos ${demora.delayMinutes} minutos`;
  const mensaje = demora.message?.trim() ?? '';
  return mensaje === '' ? `${base}.` : `${base}: ${mensaje}`;
}

/**
 * La etiqueta del selector «¿con quién te querés atender?».
 *
 * La respuesta honesta es la persona; el nombre del recurso queda de respaldo
 * para salas, equipos o perfiles que no resolvieron —que es exactamente lo que
 * la opción mostraba siempre—. Cuando el nombre interno de la agenda agrega
 * algo (sede, turno), va como aclaración detrás del nombre. Tolera `undefined`
 * además de `null` porque los dobles de prueba y las respuestas viejas de la
 * API no traen el campo.
 *
 * @param recurso - El recurso agendable tal como llegó de la API.
 */
/** Si dos fechas caen el mismo día del calendario. */
function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Texto comparable: sin mayúsculas ni tildes.
 *
 * Quien busca a «Muñoz» escribe «munoz», y quien busca a «Peña» escribe «pena».
 * Sin esto el buscador no encuentra a media guía por un acento.
 */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function etiquetaDeRecurso(recurso: {
  readonly name: string;
  readonly practitionerName?: string | null;
}): string {
  const persona = recurso.practitionerName ?? null;
  if (persona === null || persona === '') return recurso.name;
  if (persona === recurso.name) return persona;
  return `${persona} — ${recurso.name}`;
}
