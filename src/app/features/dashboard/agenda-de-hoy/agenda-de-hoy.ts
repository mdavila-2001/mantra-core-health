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
import { errorToViewState } from '@core/http/error-to-view-state';
import { empty, loading, ready } from '@core/view-state/view-state';
import type { ViewState } from '@core/view-state/view-state.types';
import { AppButtonLink } from '@shared/components/atoms/button/button-link';
import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import { StatusSeal } from '@shared/components/organisms/status-seal/status-seal';
import { ViewStateHost } from '@shared/components/organisms/view-state-host/view-state-host';

import { AGENDA_CREATE_ROUTE, AGENDA_ROUTE, APPOINTMENT_NEW_ROUTE } from '../../agenda/agenda.routes';
import {
  sufijoDeCodigo,
  toBookingStatusPresentation,
  type BookingStatusPresentation,
} from '../../agenda/booking-status';
import { misRecursosDeAgenda } from '../../agenda/mi-recurso';

/**
 * Cuántas citas se enumeran debajo de la destacada.
 *
 * Es un **resumen**, no la agenda: cinco renglones entran sin desplazar el
 * panel y alcanzan para saber cómo viene el resto del día. Lo que sobra se
 * anuncia por su número y se resuelve en «Ver agenda completa», que es la
 * pantalla que existe para eso.
 */
const MAXIMO_EN_LA_LISTA = 5;

/** Cada cuánto se recoloca «ahora». Un minuto: es la resolución que se muestra. */
const REFRESCO_DEL_RELOJ_MS = 60_000;

/** Lo que la cinta necesita para no degenerar cuando el día tiene una sola cita. */
const MINIMO_DE_LA_VENTANA_MS = 60 * 60 * 1000;

/** Una consulta de hoy, ya resuelta para la pantalla. */
export interface CitaDeHoy {
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
export interface CifrasDeHoy {
  readonly total: number;
  readonly atendidas: number;
  readonly enCurso: number;
  readonly enSala: number;
  readonly porVenir: number;
  readonly solicitudes: number;
}

/** Un tramo de la cinta de la jornada, en porcentaje del ancho. */
export interface TramoDeLaJornada {
  readonly id: string;
  readonly izquierda: number;
  readonly ancho: number;
  readonly tono: string;
  readonly titulo: string;
}

/** Las citas de hoy tal como llegaron, con la agenda de la que salieron. */
interface JornadaCruda {
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
 * inicio es un accidente esperando. El único camino hacia adelante es «Ver
 * agenda completa».
 */
@Component({
  selector: 'app-agenda-de-hoy',
  imports: [AppButtonLink, DatePipe, NavIcon, RouterLink, StatusSeal, ViewStateHost],
  templateUrl: './agenda-de-hoy.html',
  styleUrl: './agenda-de-hoy.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaDeHoy {
  private readonly auth = inject(AuthService);
  private readonly scheduling = inject(SchedulingClient);
  private readonly terminology = inject(TerminologyClient);

  /** A dónde va «Ver agenda completa». De la tabla de rutas, no escrita a mano. */
  protected readonly rutaDeLaAgenda = AGENDA_ROUTE;

  protected readonly estado = signal<ViewState<JornadaCruda>>(loading());

  /**
   * El reloj, en su propia señal.
   *
   * De él dependen tres cosas que cambian solas mientras la pantalla está
   * abierta: qué cita es «ahora», cuáles ya pasaron y dónde cae la marca de la
   * cinta. Sin esto, el panel de un consultorio —que queda abierto toda la
   * mañana— seguiría anunciando como próxima una consulta de hace dos horas.
   */
  protected readonly ahora = signal(new Date());

  /** Las etiquetas de estado y de canal, por identificador de concepto. */
  private readonly conceptos = signal<ReadonlyMap<string, ValueSetOption>>(new Map());

  constructor() {
    this.cargar();

    // Sólo en el navegador: un intervalo en el render del servidor no lo ve
    // nadie y deja el proceso vivo.
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      const reloj = setInterval(() => this.ahora.set(new Date()), REFRESCO_DEL_RELOJ_MS);
      inject(DestroyRef).onDestroy(() => clearInterval(reloj));
    }
  }

  /** El día de hoy, escrito completo: es el título de la sección. */
  protected readonly hoy = computed(() => {
    const dia = this.ahora();
    return new Date(dia.getFullYear(), dia.getMonth(), dia.getDate());
  });

  protected readonly citas = computed<readonly CitaDeHoy[]>(() => {
    const estado = this.estado();
    if (estado.status !== 'ready' && estado.status !== 'stale') return [];

    const conceptos = this.conceptos();
    const ahora = this.ahora().getTime();
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

  protected readonly cifras = computed<CifrasDeHoy>(() => {
    const citas = this.citas();
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
  protected readonly destacada = computed<CitaDeHoy | null>(() => {
    const citas = this.citas();
    const ahora = this.ahora().getTime();

    return (
      citas.find((c) => c.estado.code === 'BOOKING_IN_PROGRESS') ??
      citas.find((c) => c.estado.code === 'BOOKING_CHECKED_IN') ??
      citas.find((c) => (c.hasta ?? c.desde).getTime() >= ahora) ??
      null
    );
  });

  /** Si la destacada es la que está ocurriendo o la que viene. Cambia el rótulo. */
  protected readonly destacadaEnCurso = computed(() => {
    const cita = this.destacada();
    if (cita === null) return false;
    return cita.estado.code === 'BOOKING_IN_PROGRESS' || cita.estado.code === 'BOOKING_CHECKED_IN';
  });

  /** Lo que sigue después de la destacada, recortado. */
  protected readonly siguientes = computed<readonly CitaDeHoy[]>(() => {
    const citas = this.citas();
    const destacada = this.destacada();
    const desde = destacada === null ? 0 : citas.indexOf(destacada) + 1;
    return citas.slice(desde, desde + MAXIMO_EN_LA_LISTA);
  });

  /** Cuántas quedaron fuera de la lista. Se dicen por número, no se esconden. */
  protected readonly restantes = computed(() => {
    const citas = this.citas();
    const destacada = this.destacada();
    const desde = destacada === null ? 0 : citas.indexOf(destacada) + 1;
    return Math.max(0, citas.length - desde - MAXIMO_EN_LA_LISTA);
  });

  /**
   * La jornada terminó: hay citas, pero ninguna por delante.
   *
   * No es lo mismo que un día vacío —eso es S3— y merece otra frase: a las
   * ocho de la noche «no tenés consultas» sería falso.
   */
  protected readonly jornadaTerminada = computed(
    () => this.citas().length > 0 && this.destacada() === null,
  );

  /* -- La cinta de la jornada ---------------------------------------------- */

  /** El principio y el fin de la tira: la primera hora en punto y la última. */
  private readonly ventana = computed<{ inicio: number; fin: number }>(() => {
    const citas = this.citas();
    const ahora = this.ahora();
    if (citas.length === 0) {
      return { inicio: ahora.getTime(), fin: ahora.getTime() + MINIMO_DE_LA_VENTANA_MS };
    }

    const primera = citas[0]!.desde;
    const inicio = new Date(primera).setMinutes(0, 0, 0);
    const ultimo = citas.reduce(
      (maximo, c) => Math.max(maximo, (c.hasta ?? c.desde).getTime()),
      inicio,
    );
    return { inicio, fin: Math.max(haciaLaHoraSiguiente(ultimo), inicio + MINIMO_DE_LA_VENTANA_MS) };
  });

  protected readonly desdeLasHoras = computed(() => new Date(this.ventana().inicio));
  protected readonly hastaLasHoras = computed(() => new Date(this.ventana().fin));

  protected readonly tramos = computed<readonly TramoDeLaJornada[]>(() => {
    const { inicio, fin } = this.ventana();
    const total = fin - inicio;

    return this.citas().map((cita) => {
      const desde = cita.desde.getTime();
      const hasta = (cita.hasta ?? new Date(desde + MINIMO_DE_LA_VENTANA_MS / 4)).getTime();
      const izquierda = ((desde - inicio) / total) * 100;
      return {
        id: cita.id,
        izquierda,
        // Un mínimo visible: una consulta de diez minutos en una jornada de
        // nueve horas da un 1,8 % y desaparece. Se le da cuerpo sin dejar que
        // se salga de la tira.
        ancho: Math.min(100 - izquierda, Math.max(1.5, ((hasta - desde) / total) * 100)),
        tono: tonoDelEstado(cita.estado.code),
        titulo: `${horaCorta(cita.desde)} · ${cita.paciente} · ${cita.estado.label}`,
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
  protected readonly resumenDeLaCinta = computed(() => {
    const total = this.cifras().total;
    const consultas = total === 1 ? '1 consulta' : `${total} consultas`;
    return `Tu jornada: ${consultas}, entre las ${horaCorta(this.desdeLasHoras())} y las ${horaCorta(this.hastaLasHoras())}.`;
  });

  /** Dónde cae el reloj en la cinta, o `null` si el día todavía no empezó o ya terminó. */
  protected readonly marcaDeAhora = computed<number | null>(() => {
    const { inicio, fin } = this.ventana();
    const ahora = this.ahora().getTime();
    if (ahora < inicio || ahora > fin) return null;
    return ((ahora - inicio) / (fin - inicio)) * 100;
  });

  /* -- Carga ---------------------------------------------------------------- */

  protected cargar(): void {
    const perfil = this.auth.practitionerProfileId();
    const tenantId = this.auth.activeTenantId();

    if (perfil === null || tenantId === null) {
      this.estado.set(
        empty(
          { label: 'Ver la agenda', route: AGENDA_ROUTE },
          'Esta cuenta no atiende pacientes, así que no tiene una jornada propia.',
        ),
      );
      return;
    }

    this.estado.set(loading());

    const desde = this.hoy();
    const hasta = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate() + 1);

    misRecursosDeAgenda(this.scheduling, tenantId, perfil)
      .pipe(
        switchMap((recursos) => {
          if (recursos.length === 0) return of(null);

          // Una lectura por agenda: `GET /scheduling/bookings` filtra por UN
          // recurso, y sin filtro la API responde 422. Se piden en paralelo y
          // se juntan; si una sede falla, el día no se pierde entero.
          return forkJoin(
            recursos.map((recurso) =>
              this.scheduling
                .searchBookings({ resourceId: recurso.id, from: desde, to: hasta, limit: 100 })
                .pipe(
                  map((pagina) => ({ recurso, citas: pagina.items })),
                  catchError(() => of({ recurso, citas: [] as readonly Booking[] })),
                ),
            ),
          );
        }),
      )
      .subscribe({
        next: (porRecurso) => {
          if (porRecurso === null) {
            this.estado.set(
              empty(
                { label: 'Publicar mi horario', route: AGENDA_CREATE_ROUTE },
                'Todavía no tenés una agenda publicada, así que nadie puede reservarte hora.',
              ),
            );
            return;
          }

          const citas = porRecurso
            .flatMap(({ recurso, citas: delRecurso }) =>
              delRecurso.map((cita) => ({ cita, sede: nombreDeLaSede(recurso) })),
            )
            .sort((a, b) => orden(a.cita) - orden(b.cita));

          if (citas.length === 0) {
            this.estado.set(
              empty(
                // No es «Ver la agenda»: ése es el botón del encabezado, que
                // sigue ahí. Un día vacío tiene otra próxima acción — llenarlo.
                { label: 'Agendar una consulta', route: APPOINTMENT_NEW_ROUTE },
                'Hoy no tenés ninguna consulta reservada.',
              ),
            );
            return;
          }

          const sedes = new Set(citas.map(({ sede }) => sede));
          this.estado.set(ready({ citas, variasSedes: sedes.size > 1 }));
          this.traducirConceptos(citas.map(({ cita }) => cita));
        },
        error: (error: unknown) => this.estado.set(errorToViewState<JornadaCruda>(error)),
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
  private traducirConceptos(citas: readonly Booking[]): void {
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
      next: (etiquetas) => this.conceptos.set(new Map(etiquetas)),
      error: () => undefined,
    });
  }
}

/** Para ordenar: una cita sin hora va al final, no al principio. */
function orden(cita: Booking): number {
  return cita.startAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
}

/** Cómo se nombra la sede de una agenda; `null` cuando el recurso no declara ninguna. */
function nombreDeLaSede(recurso: AgendaResource): string | null {
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
function haciaLaHoraSiguiente(instante: number): number {
  const fecha = new Date(instante);
  const enPunto = fecha.getMinutes() === 0 && fecha.getSeconds() === 0 && fecha.getMilliseconds() === 0;
  return enPunto ? instante : fecha.setMinutes(60, 0, 0);
}

function horaCorta(fecha: Date): string {
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
function tonoDelEstado(codigo: string): string {
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
