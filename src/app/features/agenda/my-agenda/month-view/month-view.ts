import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DOCUMENT,
  ElementRef,
  inject,
  input,
  type OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import type {
  AgendaSlot,
  Booking,
} from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { nextControlId } from '@shared/forms/form-control.context';
import type { EstadoResuelto } from '../day-view/day-view';
import {
  toBookingStatusPresentation,
  type BookingStatusPresentation,
} from '../../booking-status';
import { pacienteDeLaCita } from '../detalle-de-la-cita';
import type { ValueSetOption } from '../../../../core/data-access/terminology/terminology.types';
import { StatusSeal } from '../../../../shared/components/organisms/status-seal/status-seal';
import {
  claveDelDia,
  DIAS_DE_LA_SEMANA,
  fechaLarga,
  fechasDeLaGrilla,
  medianoche,
} from '../../../../shared/date/calendario-mes';

/** Un bloqueo declarado por el profesional, ya resuelto para el calendario. */
export interface BloqueoDelMes {
  /** El id de la excepción, para poder quitarla desde el día. */
  readonly id?: string;
  readonly desde: Date;
  readonly hasta: Date;
  /** Por qué, si se declaró. Es lo que distingue «bloqueado» de «sin agenda». */
  readonly motivo: string | null;
}

/** El estado de un día, decidido una sola vez. */
export type EstadoDelDia = 'sin-agenda' | 'bloqueado' | 'libre' | 'con-reservas' | 'lleno';

/** Una celda del mes, lista para pintar. */
export interface CeldaDelMes {
  readonly fecha: Date;
  readonly numero: number;
  readonly delMes: boolean;
  readonly esHoy: boolean;
  readonly pasado: boolean;
  readonly estado: EstadoDelDia;
  /** Turnos tomados. */
  readonly reservados: number;
  /** Turnos publicados ese día. */
  readonly total: number;
  /** El motivo del bloqueo, cuando lo hay. */
  readonly motivo: string | null;
  /** Cómo se anuncia la celda entera a un lector de pantalla. */
  readonly etiqueta: string;
  /** El globo del día: a qué horas atiende y qué tiene bloqueado. */
  readonly resumen: DaySummary;
}

/** La cabecera del globo del día, en frases ya armadas. */
export interface DaySummary {
  /** «martes, 11 de agosto». */
  readonly title: string;
  /** «Atendés 08:00–12:00.» o «No atendés.» */
  readonly hours: string;
  /** Una frase por bloqueo que toca el día. */
  readonly blocks: readonly string[];
}

/**
 * Qué detalla el globo de cada día.
 *
 * - `bookings`: todas las citas del día, con hora, paciente y estado — la
 *   agenda de `/schedule`, donde la pregunta es «con quién».
 * - `availability`: los turnos que el profesional publicó y siguen libres — la
 *   solapa de horarios de atención, donde la pregunta es «qué ofrezco».
 */
export type DayDetail = 'bookings' | 'availability';

/** Una fila del globo del día. */
export interface DayDetailRow {
  readonly id: string;
  /** «08:00–08:30», o sólo «08:00» si la cita no trae fin. */
  readonly time: string;
  /** El paciente (citas) o cuántos lugares quedan (disponibles). */
  readonly primary: string;
  /** Una segunda línea, cuando la fila la tiene. Los cupos la usan. */
  readonly secondary: string | null;
  /**
   * El estado de la cita como CHIP — C-08 (2026-09-20).
   *
   * Antes este dato era `secondary: etiquetas.get(...).display`, o sea el
   * `display` del catálogo, **que viene en inglés**: el globo del mes anunciaba
   * «Booking in progress» sobre una cita en curso. `booking-status.ts` ya
   * resuelve las tres formas que la identidad exige —color, silueta y palabra
   * en castellano— y era el único lugar de la agenda que no lo usaba.
   *
   * `null` en las filas que no son citas: un cupo libre no tiene estado de
   * cita, y ponerle uno neutro sería inventar información.
   */
  readonly estado: BookingStatusPresentation | null;
}

/**
 * El mes del profesional — «¿cómo viene mi carga?».
 *
 * ## Qué muestra, y qué no
 *
 * **La celda, ocupación; el globo, el detalle.** La celda dice «6/8», no quién
 * viene: un mes con nombres es ilegible antes de la segunda semana. El detalle
 * aparece al pasar el puntero —o llegar con Tab— en un globo con scroll
 * (pedido del cliente, 18/09): en la agenda, **todas** las citas del día; en la
 * solapa de horarios, los turnos que siguen disponibles. Ver `DayDetail`.
 *
 * ## Por qué no reusa el calendario del paciente como componente
 *
 * Porque pinta otra cosa. Lo que sí comparten —y es lo que cuesta— es la
 * aritmética de la grilla, que vive en `shared/date/calendario-mes`. Meter las
 * dos formas en un componente con un `modo` habría sido una bandera que cambia
 * el comportamiento: dos componentes son más simples que uno con dos
 * personalidades.
 *
 * ## El color nunca solo
 *
 * Cada celda lleva su número visible y una etiqueta accesible completa
 * («martes 8: seis de ocho turnos reservados»). Un mes que sólo se entienda por
 * el tono no lo entiende nadie con baja visión — ni nadie mirando el teléfono
 * al sol.
 */
@Component({
  selector: 'app-month-view',
  imports: [AppButton, NgTemplateOutlet, StatusSeal],
  templateUrl: './month-view.html',
  styleUrl: './month-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonthView implements OnDestroy {
  private readonly document = inject(DOCUMENT);

  /** El mes que se está mirando; cualquier fecha de ese mes sirve. */
  readonly mes = input.required<Date>();

  /** Los cupos publicados del mes, tal como los devuelve la API. */
  readonly cupos = input.required<readonly AgendaSlot[]>();

  /** Los bloqueos del mes. */
  readonly bloqueos = input.required<readonly BloqueoDelMes[]>();

  /** Pidieron ver otro mes. */
  readonly mesElegido = output<Date>();

  /**
   * Si cada día se puede abrir. En «Cómo viene el mes» no (es un vistazo, con
   * el globo como único detalle); en la agenda de `/schedule`, sí: tocar un
   * día lleva a ese día.
   */
  readonly selectable = input(false);

  /** Tocaron un día, con `selectable` puesto. */
  readonly dayPicked = output<Date>();

  /** Qué lista el globo de cada día. Ver `DayDetail`. */
  readonly dayDetail = input<DayDetail>('availability');

  /** Las citas del mes, para el detalle `bookings`. */
  readonly citas = input<readonly Booking[]>([]);

  /** Las etiquetas de los estados de las citas, ya resueltas. */
  readonly etiquetas = input<ReadonlyMap<string, EstadoResuelto>>(new Map());

  /** Si la lectura de las citas falló: el globo no puede decir «sin citas». */
  readonly bookingsFailed = input(false);

  protected readonly encabezados = DIAS_DE_LA_SEMANA;

  protected readonly titulo = computed(() =>
    this.mes().toLocaleDateString('es-BO', { month: 'long', year: 'numeric' }),
  );

  /** Las seis semanas, con el estado de cada día ya resuelto. */
  protected readonly semanas = computed<readonly (readonly CeldaDelMes[])[]>(() => {
    const porDia = this.cuposPorDia();
    const hoy = claveDelDia(new Date());
    const desdeHoy = medianoche(new Date()).getTime();
    const mesActual = this.mes();

    return fechasDeLaGrilla(mesActual).map((semana) =>
      semana.map((fecha) => {
        const clave = claveDelDia(fecha);
        const cuenta = porDia.get(clave) ?? { total: 0, reservados: 0 };
        const bloqueos = this.bloqueosDe(fecha);
        const bloqueo = bloqueos[0] ?? null;

        const estado = decidirEstado(cuenta, bloqueo !== null);
        return {
          fecha,
          numero: fecha.getDate(),
          delMes: fecha.getMonth() === mesActual.getMonth(),
          esHoy: clave === hoy,
          pasado: fecha.getTime() < desdeHoy,
          estado,
          reservados: cuenta.reservados,
          total: cuenta.total,
          motivo: bloqueo?.motivo ?? null,
          etiqueta: etiquetaDeLaCelda(fecha, estado, cuenta, bloqueo?.motivo ?? null),
          resumen: resumenDelDia(fecha, this.franjasPorDia().get(clave) ?? [], bloqueos),
        };
      }),
    );
  });

  /**
   * Cupos agrupados por día, con lo tomado ya sumado.
   *
   * `reservados = capacity − remainingCapacity` sumado sobre los cupos del día:
   * es la única cuenta que la API no da hecha, y hacerla acá evita una llamada
   * por día.
   */
  private readonly cuposPorDia = computed(() => {
    const porDia = new Map<string, { total: number; reservados: number }>();
    for (const cupo of this.cupos()) {
      const clave = claveDelDia(cupo.startAt);
      const actual = porDia.get(clave) ?? { total: 0, reservados: 0 };
      porDia.set(clave, {
        total: actual.total + cupo.capacity,
        reservados: actual.reservados + (cupo.capacity - cupo.remainingCapacity),
      });
    }
    return porDia;
  });

  /**
   * Las horas de atención de cada día, sacadas de los cupos publicados.
   *
   * Los cupos y no la plantilla: la plantilla dice qué rige «los martes», los
   * cupos dicen qué se publicó ESTE martes —con la vigencia y los cambios ya
   * aplicados—. Cupos pegados se funden en una sola franja: «08:00–12:00», no
   * dieciséis turnos de quince minutos.
   */
  private readonly franjasPorDia = computed(() => {
    const porDia = new Map<string, Franja[]>();
    const ordenados = [...this.cupos()].sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    for (const cupo of ordenados) {
      const clave = claveDelDia(cupo.startAt);
      const franjas = porDia.get(clave) ?? [];
      const ultima = franjas.at(-1);
      if (ultima !== undefined && cupo.startAt.getTime() <= ultima.hasta.getTime()) {
        if (cupo.endAt.getTime() > ultima.hasta.getTime()) {
          franjas[franjas.length - 1] = { desde: ultima.desde, hasta: cupo.endAt };
        }
      } else {
        franjas.push({ desde: cupo.startAt, hasta: cupo.endAt });
      }
      porDia.set(clave, franjas);
    }
    return porDia;
  });

  /* -- El globo del día ------------------------------------------------------ */

  /** El día cuyo globo está abierto. */
  protected readonly openDay = signal<CeldaDelMes | null>(null);

  /** Dónde va el globo, en coordenadas de viewport. */
  protected readonly popoverPlacement = signal<PopoverPlacement | null>(null);

  protected readonly popoverId = nextControlId('month-day-detail');

  private readonly popover = viewChild<ElementRef<HTMLElement>>('dayPopover');
  private anchor: HTMLElement | null = null;
  private pendingOpen: ReturnType<typeof setTimeout> | null = null;
  private pendingClose: ReturnType<typeof setTimeout> | null = null;

  /** Referencias estables: `removeEventListener` necesita la MISMA función. */
  private readonly closeOnOutsideScroll = (event: Event): void => {
    const panel = this.popover()?.nativeElement;
    if (panel !== undefined && event.target instanceof Node && panel.contains(event.target)) return;
    this.close();
  };
  private readonly closeOnResize = (): void => this.close();

  /** Las filas del globo abierto: las citas o los turnos libres de ese día. */
  protected readonly openDayRows = computed<readonly DayDetailRow[]>(() => {
    const day = this.openDay();
    if (day === null) return [];
    return this.dayDetail() === 'bookings'
      ? this.bookingRowsOf(day.fecha)
      : this.availableRowsOf(day.fecha);
  });

  constructor() {
    // El globo va a la capa superior (Popover API): así no lo recorta el
    // `overflow` de ningún contenedor ni lo desplaza un `transform` de la
    // celda. Donde no existe —jsdom— queda en el flujo, visible igual.
    afterRenderEffect(() => {
      const panel = this.popover()?.nativeElement;
      if (panel === undefined || typeof panel.showPopover !== 'function') return;
      if (!panel.matches(':popover-open')) panel.showPopover();
    });
  }

  ngOnDestroy(): void {
    this.close();
  }

  /** Con el puntero se espera un poco; pasar de un día a otro con el globo abierto, no. */
  protected scheduleOpen(day: CeldaDelMes, event: Event): void {
    this.cancelClose();
    this.cancelOpen();
    const target = event.currentTarget as HTMLElement;
    if (this.openDay() !== null) {
      this.open(day, target);
      return;
    }
    this.pendingOpen = setTimeout(() => {
      this.pendingOpen = null;
      this.open(day, target);
    }, POPOVER_OPEN_DELAY_MS);
  }

  /** Con el teclado no se espera: llegar al día ya es la intención. */
  protected openNow(day: CeldaDelMes, event: Event): void {
    this.cancelClose();
    this.cancelOpen();
    this.open(day, event.currentTarget as HTMLElement);
  }

  /**
   * Se cierra con demora, para que el puntero alcance a cruzar del día al
   * globo: ahí adentro es donde se hace scroll.
   */
  protected scheduleClose(): void {
    this.cancelOpen();
    if (this.pendingClose !== null || this.openDay() === null) return;
    this.pendingClose = setTimeout(() => {
      this.pendingClose = null;
      this.close();
    }, POPOVER_CLOSE_DELAY_MS);
  }

  protected cancelClose(): void {
    if (this.pendingClose !== null) {
      clearTimeout(this.pendingClose);
      this.pendingClose = null;
    }
  }

  protected close(): void {
    this.cancelOpen();
    this.cancelClose();
    if (this.openDay() === null) return;
    const panel = this.popover()?.nativeElement;
    if (panel !== undefined && typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) {
      panel.hidePopover();
    }
    this.anchor?.removeAttribute('aria-describedby');
    this.anchor = null;
    this.listenToViewport(false);
    this.openDay.set(null);
    this.popoverPlacement.set(null);
  }

  private open(day: CeldaDelMes, target: HTMLElement): void {
    const view = this.document.defaultView;
    if (view === null) return;
    if (this.anchor !== null && this.anchor !== target) {
      this.anchor.removeAttribute('aria-describedby');
    }
    this.anchor = target;
    target.setAttribute('aria-describedby', this.popoverId);
    this.popoverPlacement.set(placePopover(target.getBoundingClientRect(), view));
    if (this.openDay() === null) this.listenToViewport(true);
    this.openDay.set(day);
  }

  private cancelOpen(): void {
    if (this.pendingOpen !== null) {
      clearTimeout(this.pendingOpen);
      this.pendingOpen = null;
    }
  }

  /**
   * Un globo `fixed` se quedaría atrás si la página se mueve: se cierra. El
   * scroll de adentro del globo no cuenta — es justo para lo que está.
   */
  private listenToViewport(listen: boolean): void {
    const view = this.document.defaultView;
    if (view === null) return;
    if (listen) {
      view.addEventListener('scroll', this.closeOnOutsideScroll, { passive: true, capture: true });
      view.addEventListener('resize', this.closeOnResize, { passive: true });
      return;
    }
    view.removeEventListener('scroll', this.closeOnOutsideScroll, { capture: true });
    view.removeEventListener('resize', this.closeOnResize);
  }

  /**
   * Todas las citas del día, en hora ascendente. Todas: el recorte a tres es
   * de la semana, donde no hay lugar; el globo tiene scroll.
   */
  private bookingRowsOf(fecha: Date): readonly DayDetailRow[] {
    const inicio = medianoche(fecha).getTime();
    const fin = inicio + UN_DIA_MS;
    return this.citas()
      .filter((cita) => {
        const desde = cita.startAt?.getTime();
        return desde !== undefined && desde >= inicio && desde < fin;
      })
      .sort((a, b) => (a.startAt as Date).getTime() - (b.startAt as Date).getTime())
      .map((cita) => ({
        id: cita.id,
        time:
          cita.endAt === undefined
            ? hora(cita.startAt as Date)
            : `${hora(cita.startAt as Date)}–${hora(cita.endAt)}`,
        // Mismas palabras que el día y la semana: sin nombre no se inventa uno.
        primary: pacienteDeLaCita(cita),
        secondary: null,
        // C-08 · el chip sale del mapa único de `booking-status.ts`, no de una
        // lista nueva y no del `display` inglés del catálogo.
        estado: toBookingStatusPresentation(
          this.conceptoDe(cita.statusConceptId),
          'Reservada',
        ),
      }));
  }

  /**
   * Los turnos publicados que todavía se pueden dar ese día: con lugar, por
   * venir y fuera de cualquier bloqueo. Uno bloqueado existe en la agenda
   * pero no se ofrece, y listarlo diría lo contrario.
   */
  private availableRowsOf(fecha: Date): readonly DayDetailRow[] {
    const inicio = medianoche(fecha).getTime();
    const fin = inicio + UN_DIA_MS;
    const ahora = Date.now();
    const bloqueos = this.bloqueosDe(fecha);
    return this.cupos()
      .filter((cupo) => {
        const desde = cupo.startAt.getTime();
        return (
          desde >= inicio &&
          desde < fin &&
          desde > ahora &&
          cupo.remainingCapacity > 0 &&
          !bloqueos.some(
            (b) => b.desde.getTime() < cupo.endAt.getTime() && b.hasta.getTime() > desde,
          )
        );
      })
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .map((cupo) => ({
        id: cupo.id,
        time: `${hora(cupo.startAt)}–${hora(cupo.endAt)}`,
        primary:
          cupo.capacity === 1
            ? 'Libre'
            : `${cupo.remainingCapacity} de ${cupo.capacity} lugares libres`,
        secondary: null,
        estado: null,
      }));
  }

  /**
   * El concepto de estado, con la forma que espera `booking-status.ts`.
   *
   * La agenda guarda los estados resueltos como `{code, display}` y el mapa de
   * presentación pide un `ValueSetOption`. Se adapta acá en vez de cambiar
   * cualquiera de los dos: el mapa lo comparten cuatro pantallas y `EstadoResuelto`
   * es lo mínimo que la agenda necesita del catálogo.
   */
  private conceptoDe(conceptId: string): ValueSetOption | undefined {
    const resuelto = this.etiquetas().get(conceptId);
    return resuelto === undefined
      ? undefined
      : {
          conceptId,
          code: resuelto.code,
          display: resuelto.display,
          // El catálogo no viaja hasta acá y el mapa no lo mira: sólo usa
          // `code`. Se declara vacío en vez de inventar un identificador.
          codeSystemVersionId: '',
        };
  }

  /** Los bloqueos que tocan esa fecha, en orden. */
  private bloqueosDe(fecha: Date): readonly BloqueoDelMes[] {
    const inicio = medianoche(fecha).getTime();
    const fin = inicio + UN_DIA_MS;
    return this.bloqueos()
      .filter((b) => b.desde.getTime() < fin && b.hasta.getTime() > inicio)
      .sort((a, b) => a.desde.getTime() - b.desde.getTime());
  }

  protected mesAnterior(): void {
    const m = this.mes();
    this.mesElegido.emit(new Date(m.getFullYear(), m.getMonth() - 1, 1));
  }

  protected mesSiguiente(): void {
    const m = this.mes();
    this.mesElegido.emit(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  }
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Espera del puntero antes de abrir: cruzar el mes no debe encender globos. */
const POPOVER_OPEN_DELAY_MS = 250;

/** Margen para cruzar del día al globo sin que se cierre en el camino. */
const POPOVER_CLOSE_DELAY_MS = 200;

/** Ancho del globo; en un teléfono, lo que entre con 16 px a cada lado. */
const POPOVER_WIDTH_PX = 320;
const POPOVER_GUTTER_PX = 16;
const POPOVER_GAP_PX = 4;

/** Alto máximo de la lista: más que esto se lee con scroll. */
const POPOVER_MAX_HEIGHT_PX = 360;

/** Por debajo de este alto libre, el globo va arriba del día si ahí hay más lugar. */
const POPOVER_MIN_ROOM_PX = 200;

/** Dónde se dibuja el globo. `top` o `bottom`, nunca los dos. */
export interface PopoverPlacement {
  readonly top: number | null;
  readonly bottom: number | null;
  readonly left: number;
  readonly width: number;
  readonly maxHeight: number;
}

/**
 * Al costado del día —a la derecha, o a la izquierda si no entra—, con el
 * borde de arriba a la altura del día. Debajo, centrado, tapaba la semana
 * siguiente: el globo del viernes 11 quedaba encima del viernes 18 y parecía
 * de ese día (propietario, 18/09). Sólo si no entra a ningún costado —un
 * teléfono— va debajo o arriba, el lado con más lugar.
 *
 * Nunca se mide el globo: el alto lo fija `maxHeight` y el resto es scroll,
 * así que la cuenta sale del día y del viewport solos.
 */
export function placePopover(
  cell: DOMRect,
  view: { innerWidth: number; innerHeight: number },
): PopoverPlacement {
  const width = Math.min(POPOVER_WIDTH_PX, view.innerWidth - 2 * POPOVER_GUTTER_PX);
  const beside = besideCell(cell, view, width);
  if (beside !== null) return beside;
  const centered = cell.left + cell.width / 2 - width / 2;
  const left = Math.max(
    POPOVER_GUTTER_PX,
    Math.min(centered, view.innerWidth - width - POPOVER_GUTTER_PX),
  );
  const below = view.innerHeight - cell.bottom - POPOVER_GAP_PX - POPOVER_GUTTER_PX;
  const above = cell.top - POPOVER_GAP_PX - POPOVER_GUTTER_PX;
  if (below >= POPOVER_MIN_ROOM_PX || below >= above) {
    return {
      top: cell.bottom + POPOVER_GAP_PX,
      bottom: null,
      left,
      width,
      maxHeight: Math.min(POPOVER_MAX_HEIGHT_PX, below),
    };
  }
  return {
    top: null,
    bottom: view.innerHeight - cell.top + POPOVER_GAP_PX,
    left,
    width,
    maxHeight: Math.min(POPOVER_MAX_HEIGHT_PX, above),
  };
}

/** Al costado del día, o `null` si a ningún lado entra entero. */
function besideCell(
  cell: DOMRect,
  view: { innerWidth: number; innerHeight: number },
  width: number,
): PopoverPlacement | null {
  const rightEdge = view.innerWidth - POPOVER_GUTTER_PX;
  let left: number;
  if (cell.right + POPOVER_GAP_PX + width <= rightEdge) {
    left = cell.right + POPOVER_GAP_PX;
  } else if (cell.left - POPOVER_GAP_PX - width >= POPOVER_GUTTER_PX) {
    left = cell.left - POPOVER_GAP_PX - width;
  } else {
    return null;
  }
  // Pegado arriba al día, salvo que abajo no quede lugar: entonces sube lo
  // justo para mostrar el alto mínimo.
  const bottomEdge = view.innerHeight - POPOVER_GUTTER_PX;
  const top = Math.max(POPOVER_GUTTER_PX, Math.min(cell.top, bottomEdge - POPOVER_MIN_ROOM_PX));
  return {
    top,
    bottom: null,
    left,
    width,
    maxHeight: Math.min(POPOVER_MAX_HEIGHT_PX, bottomEdge - top),
  };
}

/** Un rato continuo del día. */
interface Franja {
  readonly desde: Date;
  readonly hasta: Date;
}

/** «08:00». */
function hora(fecha: Date): string {
  return fecha.toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** «08:00–12:00 y 14:00–18:00». */
function listaDeFranjas(franjas: readonly Franja[]): string {
  const textos = franjas.map((f) => `${hora(f.desde)}–${hora(f.hasta)}`);
  if (textos.length <= 1) return textos.join('');
  return `${textos.slice(0, -1).join(', ')} y ${textos.at(-1)}`;
}

/**
 * El globo de un día del mes: el horario de atención y lo bloqueado.
 *
 * Un bloqueo se recorta al día que se mira: el de unas vacaciones de dos
 * semanas no dice «del 3 al 17» en cada celda, dice «todo el día». Y el que
 * cubre sólo una parte dice qué parte, que es justo lo que no se ve en la
 * celda.
 */
function resumenDelDia(
  fecha: Date,
  franjas: readonly Franja[],
  bloqueos: readonly BloqueoDelMes[],
): DaySummary {
  const inicio = medianoche(fecha).getTime();
  const fin = inicio + UN_DIA_MS;
  const blocks = bloqueos.map((bloqueo) => {
    const desde = Math.max(bloqueo.desde.getTime(), inicio);
    const hasta = Math.min(bloqueo.hasta.getTime(), fin);
    const cuando =
      desde === inicio && hasta === fin
        ? 'todo el día'
        : listaDeFranjas([{ desde: new Date(desde), hasta: new Date(hasta) }]);
    const motivo = bloqueo.motivo === null ? '' : ` (${bloqueo.motivo})`;
    return `Bloqueado ${cuando}${motivo}.`;
  });
  return {
    title: fechaLarga(fecha),
    hours: franjas.length === 0 ? 'No atendés.' : `Atendés ${listaDeFranjas(franjas)}.`,
    blocks,
  };
}

/**
 * Qué es este día.
 *
 * El orden importa: un día bloqueado se dice bloqueado aunque tenga cupos
 * publicados —el bloqueo es justamente lo que hay que ver—, y un día sin cupos
 * no es «libre» sino «sin agenda»: no es que nadie reservó, es que no atiende.
 */
function decidirEstado(
  cuenta: { total: number; reservados: number },
  bloqueado: boolean,
): EstadoDelDia {
  if (bloqueado) return 'bloqueado';
  if (cuenta.total === 0) return 'sin-agenda';
  if (cuenta.reservados === 0) return 'libre';
  if (cuenta.reservados >= cuenta.total) return 'lleno';
  return 'con-reservas';
}

/**
 * Cómo se anuncia una celda.
 *
 * Con el número solo, un lector de pantalla dice «12» y nada más. Acá dice el
 * día, y después qué pasa ese día, en palabras.
 */
function etiquetaDeLaCelda(
  fecha: Date,
  estado: EstadoDelDia,
  cuenta: { total: number; reservados: number },
  motivo: string | null,
): string {
  const cuando = fechaLarga(fecha);
  switch (estado) {
    case 'sin-agenda':
      return `${cuando}: no atendés`;
    case 'bloqueado':
      return motivo === null ? `${cuando}: bloqueado` : `${cuando}: bloqueado — ${motivo}`;
    case 'libre':
      return `${cuando}: ${cuenta.total} turnos publicados, ninguno reservado`;
    case 'lleno':
      return `${cuando}: completo, ${cuenta.total} de ${cuenta.total} turnos reservados`;
    case 'con-reservas':
      return `${cuando}: ${cuenta.reservados} de ${cuenta.total} turnos reservados`;
  }
}
