import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { AuthService } from '@core/auth/auth.service';
import { SchedulingClient } from '@core/data-access/scheduling/scheduling.client';
import type { AgendaResource, Booking } from '@core/data-access/scheduling/scheduling.types';
import { TerminologyClient } from '@core/data-access/terminology/terminology.client';
import type { ValueSetOption } from '@core/data-access/terminology/terminology.types';
import { describeApiFailure } from '@core/http/api-failure';
import { errorToViewState } from '@core/http/error-to-view-state';
import { empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButton } from '@shared/components/atoms/button/button';
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { Alert } from '@shared/components/molecules/alert/alert';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { StatusSeal } from '@shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import {
  AGENDA_BOOKING_PARAM,
  AGENDA_CREATE_ROUTE,
  AGENDA_ROUTE,
  APPOINTMENT_NEW_ROUTE,
} from '../../agenda/agenda.routes';
import {
  sufijoDeCodigo,
  toBookingStatusPresentation,
  type BookingStatusPresentation,
} from '../../agenda/booking-status';
import { agendaResourcesMy } from '../../agenda/my-resource';

/**
 * Cuántas citas se enumeran debajo de la destacada.
 *
 * Es un **resumen**, no la agenda: cinco renglones entran sin desplazar el
 * panel y alcanzan para saber cómo viene el resto del día. Lo que sobra se
 * anuncia por su número y se resuelve en «Ver agenda completa», que es la
 * pantalla que existe para eso.
 */
const MAX_IN_LIST = 5;

/** Cada cuánto se recoloca «ahora». Un minuto: es la resolución que se muestra. */
const CLOCK_MS_REFRESH = 60_000;

/** Lo que la cinta necesita para no degenerar cuando el día tiene una sola cita. */
const WINDOW_MS_MIN = 60 * 60 * 1000;

/** Una consulta de hoy, ya resuelta para la pantalla. */
export interface TodayAppointment {
  readonly id: string;
  readonly desde: Date;
  readonly hasta: Date | null;
  /**
   * Quién viene.
   *
   * El servidor manda el nombre sólo a quien le corresponde verlo; ausente no
   * es «sin nombre», así que se dice eso y no un hueco.
   */
  readonly paciente: string;
  readonly motivo: string | null;
  /** Dónde se atiende. Sólo se pinta cuando la sesión tiene más de una agenda. */
  readonly sede: string | null;
  readonly estado: BookingStatusPresentation;
  /** Se atiende por videollamada: cambia dónde hay que estar a esa hora. */
  readonly porVideo: boolean;
  /** Ya terminó su horario. Se atenúa en la lista; sigue contando en la cinta. */
  readonly pasada: boolean;
}

/** Lo que se cuenta arriba, de un vistazo. */
export interface TodayFigures {
  readonly total: number;
  readonly atendidas: number;
  readonly enCurso: number;
  readonly enSala: number;
  readonly porVenir: number;
  readonly solicitudes: number;
}

/** Un tramo de la cinta de la jornada, en porcentaje del ancho. */
export interface WorkdayBracket {
  readonly id: string;
  readonly izquierda: number;
  readonly ancho: number;
  readonly tono: string;
  readonly titulo: string;
}

/** Las citas de hoy tal como llegaron, con la agenda de la que salieron. */
interface RawWorkday {
  readonly citas: readonly { readonly cita: Booking; readonly sede: string | null }[];
  /**
   * El día de hoy se reparte entre más de una sede.
   *
   * Se mide sobre **las citas de hoy** y no sobre cuántas agendas tiene la
   * sesión: quien atiende en dos sedes pero hoy sólo pisa una no necesita que
   * se lo recuerden en cada renglón. Una columna que repite siempre lo mismo
   * ocupa lugar y no informa de nada.
   */
  readonly variasSedes: boolean;
}

/**
 * **Lo que toca hoy** — la primera pantalla de quien atiende.
 *
 * ## Qué reemplaza y por qué
 *
 * El panel abría con cuatro bloques de sistema: los roles del token, el
 * conteo del directorio público, cuántas secciones habilita la cuenta y
 * cuántas organizaciones alcanza. Son datos de la aplicación hablando de sí
 * misma; ninguno contesta la pregunta con la que un médico abre el navegador a
 * las siete de la mañana, que es **quién viene hoy y a qué hora**.
 *
 * Esto lo contesta en tres movimientos, de arriba abajo:
 *
 * 1. **La cinta de la jornada** — el día entero en una tira: dónde hay
 *    consultas, dónde hay huecos y en qué punto está el reloj. La forma del
 *    día no se lee en una lista; hay que verla.
 * 2. **Ahora / A continuación** — la única cita que importa en este segundo,
 *    en tamaño de titular.
 * 3. **El resto del día** — cinco renglones y el número de lo que sobra.
 *
 * ## Por qué pide TODAS las agendas y no la primera
 *
 * Quien atiende en dos sedes tiene dos recursos, y con `miRecursoDeAgenda`
 * —que devuelve el primero— la tarde del hospital no existía. «Lo que toca
 * hoy» con la mitad del día es peor que no tenerlo: invita a confiar en algo
 * incompleto. Se piden todas y se ordenan juntas por hora; la sede se nombra
 * en cada renglón **sólo** cuando hay más de una, porque si no es una columna
 * que repite siempre lo mismo.
 *
 * ## Qué NO hace
 *
 * No opera: no acepta, no cancela, no inicia consultas. Todo eso vive en la
 * agenda y tiene sus confirmaciones, sus choques y sus avisos al paciente. Un
 * resumen que además ejecuta acciones destructivas a un clic de la pantalla de
 * inicio es un accidente esperando.
 *
 * Pero **cada cita lleva a sí misma**: la tarjeta «Ahora» y cada renglón abren
 * la agenda con `?booking=<id>`, y es la agenda la que ofrece «Iniciar
 * consulta» sobre esa cita. Antes el único camino era «Ver agenda completa» y
 * después buscar a la persona en el calendario: justo lo que el médico quería
 * hacer al tocar la cita que tenía delante.
 */
@Component({
  selector: 'app-today-agenda',
  imports: [
    Alert,
    AppButton,
    AppButtonLink,
    DatePipe,
    NavIcon,
    RouterLink,
    StatusSeal,
    ViewStateHost,
  ],
  templateUrl: './today-agenda.html',
  styleUrl: './today-agenda.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayAgenda {
  private readonly auth = inject(AuthService);
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);

  /** A dónde va «Ver agenda completa». De la tabla de rutas, no escrita a mano. */
  protected readonly agendaPath = AGENDA_ROUTE;

  /** Los parámetros que abren una cita concreta en la agenda. */
  protected appointmentParams(cita: TodayAppointment): Record<string, string> {
    return { [AGENDA_BOOKING_PARAM]: cita.id };
  }

  /** El nombre del enlace: a quién y a qué hora, para no oír sólo un nombre suelto. */
  protected linkName(cita: TodayAppointment): string {
    return `Abrir la consulta de ${cita.paciente}, a las ${shortTime(cita.desde)}`;
  }

  protected readonly status = signal<ViewState<RawWorkday>>(loading());

  /**
   * Las sedes cuya lectura falló, dichas para la persona (con código de
   * soporte cuando la API lo manda).
   *
   * Una sede caída no tumba el día —las demás se muestran—, pero tampoco puede
   * desaparecer en silencio: sus citas faltarían y el día se leería con menos
   * consultas de las que tiene.
   */
  protected readonly sitesWithoutLoad = signal<readonly string[]>([]);

  /**
   * El reloj, en su propia señal.
   *
   * De él dependen tres cosas que cambian solas mientras la pantalla está
   * abierta: qué cita es «ahora», cuáles ya pasaron y dónde cae la marca de la
   * cinta. Sin esto, el panel de un consultorio —que queda abierto toda la
   * mañana— seguiría anunciando como próxima una consulta de hace dos horas.
   */
  protected readonly now = signal(new Date());

  /** Las etiquetas de estado y de canal, por identificador de concepto. */
  private readonly concepts = signal<ReadonlyMap<string, ValueSetOption>>(new Map());

  constructor() {
    this.load();

    // Sólo en el navegador: un intervalo en el render del servidor no lo ve
    // nadie y deja el proceso vivo.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const reloj = setInterval(() => this.now.set(new Date()), CLOCK_MS_REFRESH);
      inject(DestroyRef).onDestroy(() => clearInterval(reloj));
    }
  }

  /** El día de hoy, escrito completo: es el título de la sección. */
  protected readonly today = computed(() => {
    const dia = this.now();
    return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
  });

  protected readonly appointments = computed<readonly TodayAppointment[]>(() => {
    const estado = this.status();
    if (estado.status !== 'ready' && estado.status !== 'stale') return [];

    const conceptos = this.concepts();
    const ahora = this.now().getTime();
    const variasSedes = estado.data.variasSedes;

    return estado.data.citas.map(({ cita, sede }) => {
      const desde = cita.startAt ?? new Date();
      const hasta = cita.endAt ?? null;
      const canal =
        cita.bookingChannelConceptId === undefined
          ? undefined
          : conceptos.get(cita.bookingChannelConceptId);

      return {
        id: cita.id,
        desde,
        hasta,
        paciente: cita.patientName ?? 'Paciente reservado',
        motivo: cita.reasonText ?? null,
        sede: variasSedes ? sede : null,
        estado: toBookingStatusPresentation(conceptos.get(cita.statusConceptId), 'Reservada'),
        porVideo: canal !== undefined && sufijoDeCodigo(canal.code).includes('TELECONSULTA'),
        pasada: (hasta ?? desde).getTime() < ahora,
      };
    });
  });

  protected readonly figures = computed<TodayFigures>(() => {
    const citas = this.appointments();
    const cuenta = (codigo: string): number =>
      citas.filter((c) => c.estado.code === codigo).length;

    return {
      total: citas.length,
      atendidas: cuenta('BOOKING_COMPLETED') + cuenta('EV_BOOKING_DONE'),
      enCurso: cuenta('BOOKING_IN_PROGRESS'),
      enSala: cuenta('BOOKING_CHECKED_IN'),
      porVenir: citas.filter((c) => !c.pasada && c.estado.code === 'BOOKING_CONFIRMED').length,
      solicitudes: cuenta('BOOKING_REQUESTED') + cuenta('BOOKING_PENDING_CONFIRMATION'),
    };
  });

  /**
   * La cita que manda ahora mismo.
   *
   * El orden de preferencia es el del consultorio y no el del reloj: lo que
   * está ocurriendo gana sobre quien acaba de llegar, y quien llegó gana sobre
   * la próxima del horario. Sólo cuando no hay nada de eso se mira la hora.
   */
  protected readonly highlighted = computed<TodayAppointment | null>(() => {
    const citas = this.appointments();
    const ahora = this.now().getTime();

    return (
      citas.find((c) => c.estado.code === 'BOOKING_IN_PROGRESS') ??
      citas.find((c) => c.estado.code === 'BOOKING_CHECKED_IN') ??
      citas.find((c) => (c.hasta ?? c.desde).getTime() >= ahora) ??
      null
    );
  });

  /** Si la destacada es la que está ocurriendo o la que viene. Cambia el rótulo. */
  protected readonly highlightedInCourse = computed(() => {
    const cita = this.highlighted();
    if (cita === null) return false;
    return cita.estado.code === 'BOOKING_IN_PROGRESS' || cita.estado.code === 'BOOKING_CHECKED_IN';
  });

  /** Lo que sigue después de la destacada, recortado. */
  protected readonly next = computed<readonly TodayAppointment[]>(() => {
    const citas = this.appointments();
    const destacada = this.highlighted();
    const desde = destacada === null ? 0 : citas.indexOf(destacada) + 1;
    return citas.slice(desde, desde + MAX_IN_LIST);
  });

  /** Cuántas quedaron fuera de la lista. Se dicen por número, no se esconden. */
  protected readonly remaining = computed(() => {
    const citas = this.appointments();
    const destacada = this.highlighted();
    const desde = destacada === null ? 0 : citas.indexOf(destacada) + 1;
    return Math.max(0, citas.length - desde - MAX_IN_LIST);
  });

  /**
   * La jornada terminó: hay citas, pero ninguna por delante.
   *
   * No es lo mismo que un día vacío —eso es S3— y merece otra frase: a las
   * ocho de la noche «no tenés consultas» sería falso.
   */
  protected readonly finishedWorkday = computed(
    () => this.appointments().length > 0 && this.highlighted() === null,
  );

  /* -- La cinta de la jornada ---------------------------------------------- */

  /** El principio y el fin de la tira: la primera hora en punto y la última. */
  private readonly window = computed<{ inicio: number; fin: number }>(() => {
    const citas = this.appointments();
    const ahora = this.now();
    if (citas.length === 0) {
      return { inicio: ahora.getTime(), fin: ahora.getTime() + WINDOW_MS_MIN };
    }

    const primera = citas[0]!.desde;
    const inicio = new Date(primera).setMinutes(0, 0, 0);
    const ultimo = citas.reduce(
      (maximo, c) => Math.max(maximo, (c.hasta ?? c.desde).getTime()),
      inicio,
    );
    return { inicio, fin: Math.max(towardNextTime(ultimo), inicio + WINDOW_MS_MIN) };
  });

  protected readonly fromHours = computed(() => new Date(this.window().inicio));
  protected readonly untilHours = computed(() => new Date(this.window().fin));

  protected readonly brackets = computed<readonly WorkdayBracket[]>(() => {
    const { inicio, fin } = this.window();
    const total = fin - inicio;

    return this.appointments().map((cita) => {
      const desde = cita.desde.getTime();
      const hasta = (cita.hasta ?? new Date(desde + WINDOW_MS_MIN / 4)).getTime();
      const izquierda = ((desde - inicio) / total) * 100;
      return {
        id: cita.id,
        izquierda,
        // Un mínimo visible: una consulta de diez minutos en una jornada de
        // nueve horas da un 1,8 % y desaparece. Se le da cuerpo sin dejar que
        // se salga de la tira.
        ancho: Math.min(100 - izquierda, Math.max(1.5, ((hasta - desde) / total) * 100)),
        tono: statusTone(cita.estado.code),
        titulo: `${shortTime(cita.desde)} · ${cita.paciente} · ${cita.estado.label}`,
      };
    });
  });

  /**
   * La cinta, dicha en palabras.
   *
   * Es el nombre accesible de la tira: para quien no la ve, una barra de
   * colores no significa nada. Se arma acá y no en la plantilla porque lleva
   * plural —«1 consultas» delata que nadie leyó la frase— y una concatenación
   * con condicionales dentro de un `[attr.aria-label]` no se puede probar.
   */
  protected readonly ribbonSummary = computed(() => {
    const total = this.figures().total;
    const consultas = total === 1 ? '1 consulta' : `${total} consultas`;
    return `Su jornada: ${consultas}, entre las ${shortTime(this.fromHours())} y las ${shortTime(this.untilHours())}.`;
  });

  /** Dónde cae el reloj en la cinta, o `null` si el día todavía no empezó o ya terminó. */
  protected readonly nowMark = computed<number | null>(() => {
    const { inicio, fin } = this.window();
    const ahora = this.now().getTime();
    if (ahora < inicio || ahora > fin) return null;
    return ((ahora - inicio) / (fin - inicio)) * 100;
  });

  /* -- Carga ---------------------------------------------------------------- */

  protected load(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();

    if (perfil === null || tenantId === null) {
      this.status.set(
        empty(
          { label: 'Ver la agenda', route: AGENDA_ROUTE },
          'Esta cuenta no atiende pacientes, así que no tiene una jornada propia.',
        ),
      );
      return;
    }

    this.status.set(loading());
    this.sitesWithoutLoad.set([]);

    const desde = this.today();
    const hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 1);

    agendaResourcesMy(this.scheduling, tenantId, perfil)
      .pipe(
        switchMap((recursos) => {
          if (recursos.length === 0) return of(null);

          // Una lectura por agenda: `GET /scheduling/bookings` filtra por UN
          // recurso, y sin filtro la API responde 422. Se piden en paralelo y
          // se juntan; si una sede falla, el día no se pierde entero — pero el
          // fallo viaja con ella para avisarlo.
          return forkJoin(
            recursos.map((recurso) =>
              this.scheduling
                .searchBookings({ resourceId: recurso.id, from: desde, to: hasta, limit: 100 })
                .pipe(
                  map((pagina): SiteReading => ({ recurso, citas: pagina.items, fallo: null })),
                  catchError((error: unknown) =>
                    of<SiteReading>({ recurso, citas: [], fallo: { error } }),
                  ),
                ),
            ),
          );
        }),
      )
      .subscribe({
        next: (porRecurso) => {
          if (porRecurso === null) {
            this.status.set(
              empty(
                { label: 'Publicar mi horario', route: AGENDA_CREATE_ROUTE },
                'Todavía no tiene una agenda publicada, así que nadie puede reservarle hora.',
              ),
            );
            return;
          }

          const fallidas = porRecurso.filter((lectura) => lectura.fallo !== null);
          // Si no se pudo leer ninguna, no hay «día parcial» que mostrar: es
          // el error de la pantalla, con su reintento.
          const primerFallo = fallidas[0]?.fallo;
          if (primerFallo != null && fallidas.length === porRecurso.length) {
            this.status.set(errorToViewState<RawWorkday>(primerFallo.error));
            return;
          }
          this.sitesWithoutLoad.set(
            fallidas.map(({ recurso, fallo }) =>
              describeApiFailure(
                fallo?.error,
                `No se pudieron cargar las citas de ${siteName(recurso) ?? 'una de sus agendas'}.`,
              ),
            ),
          );

          const citas = porRecurso
            .flatMap(({ recurso, citas: delRecurso }) =>
              delRecurso.map((cita) => ({ cita, sede: siteName(recurso) })),
            )
            .sort((a, b) => order(a.cita) - order(b.cita));

          if (citas.length === 0) {
            this.status.set(
              empty(
                // No es «Ver la agenda»: ése es el botón del encabezado, que
                // sigue ahí. Un día vacío tiene otra próxima acción — llenarlo.
                { label: 'Agendar una consulta', route: APPOINTMENT_NEW_ROUTE },
                // Con una sede sin leer, «ninguna» sería afirmar lo que no se sabe.
                fallidas.length > 0
                  ? 'No tiene consultas reservadas hoy en las agendas que se pudieron cargar.'
                  : 'Hoy no tiene ninguna consulta reservada.',
              ),
            );
            return;
          }

          const sedes = new Set(citas.map(({ sede }) => sede));
          this.status.set(ready({ citas, variasSedes: sedes.size > 1 }));
          this.translateConcepts(citas.map(({ cita }) => cita));
        },
        error: (error: unknown) => this.status.set(errorToViewState<RawWorkday>(error)),
      });
  }

  /**
   * Pide las palabras de los conceptos que aparecieron, y sólo de ésos.
   *
   * Estados y canal en la misma tanda: son dos preguntas al mismo catálogo y
   * partirlas en dos peticiones no compra nada. Si el catálogo no contesta, las
   * filas se muestran igual con su texto de reserva — perder la etiqueta no
   * justifica perder la jornada.
   */
  private translateConcepts(citas: readonly Booking[]): void {
    const ids = [
      ...new Set(
        citas.flatMap((cita) =>
          cita.bookingChannelConceptId === undefined
            ? [cita.statusConceptId]
            : [cita.statusConceptId, cita.bookingChannelConceptId],
        ),
      ),
    ];
    if (ids.length === 0) return;

    this.terminology.readConceptLabels(ids).subscribe({
      next: (etiquetas) => this.concepts.set(new Map(etiquetas)),
      error: () => undefined,
    });
  }
}

/** Para ordenar: una cita sin hora va al final, no al principio. */
function order(cita: Booking): number {
  return cita.startAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

/** Cómo se nombra la sede de una agenda; `null` cuando el recurso no declara ninguna. */
/** Lo que trajo la lectura de una agenda: sus citas, o el fallo que la dejó vacía. */
interface SiteReading {
  readonly recurso: AgendaResource;
  readonly citas: readonly Booking[];
  readonly fallo: { readonly error: unknown } | null;
}

function siteName(recurso: AgendaResource): string | null {
  return recurso.site?.name ?? null;
}

/**
 * La hora en punto que cierra un instante.
 *
 * `setMinutes(60, 0, 0)` a secas **suma una hora entera** cuando el instante ya
 * cae en punto: una jornada que termina a las 12:00 abría la cinta hasta las
 * 13:00 y regalaba un quinto del ancho a una hora en la que no pasa nada. La
 * marca de «ahora» se corría con ella, que es como se vio.
 */
function towardNextTime(instante: number): number {
  const fecha = new Date(instante);
  const enPunto = fecha.getMinutes() === 0 && fecha.getSeconds() === 0 && fecha.getMilliseconds() === 0;
  return enPunto ? instante : fecha.setMinutes(60, 0, 0);
}

function shortTime(fecha: Date): string {
  return fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' });
}

/**
 * El tono de un tramo de la cinta.
 *
 * Es la misma familia de estados que pinta el sello, pero la cinta responde
 * otra pregunta —«¿cuánto del día está hecho?»— y por eso lo hecho se apaga en
 * vez de celebrarse en verde: el color fuerte queda para lo que todavía exige
 * algo. El texto de cada estado lo sigue diciendo el sello de la lista, así
 * que acá el color no porta información solo.
 */
function statusTone(codigo: string): string {
  switch (codigo) {
    case 'BOOKING_COMPLETED':
    case 'EV_BOOKING_DONE':
      return 'hecha';
    case 'BOOKING_IN_PROGRESS':
      return 'curso';
    case 'BOOKING_CHECKED_IN':
      return 'sala';
    case 'BOOKING_REQUESTED':
    case 'BOOKING_PENDING_CONFIRMATION':
      return 'pedida';
    default:
      return 'firme';
  }
}
