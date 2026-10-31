import { ChangeDetectionStrategy, Component, ElementRef, computed, input, output, viewChild } from '@angular/core';

import { AgendaEventButton, type DragRole } from './agenda-event';
import type { AgendaColumn } from './agenda-grouping';
import {
  colorOfDoctor,
  eventTooltip,
  dayKeyOf,
  hourlyHeat,
  layoutRow,
  nowOffset,
  occupancyOf,
  toDayKey,
  type AgendaDoctor,
  type AgendaEvent,
  type HourHeat,
  type Occupancy,
  type TimeWindow,
  type TimelineBar,
} from './agenda-model';

interface RowView {
  readonly key: string;
  readonly label: string;
  readonly sub?: string;
  readonly bars: readonly TimelineBar[];
  readonly height: number;
  readonly occupancy: Occupancy;
}

const ALTO_BARRA = 34;
const SEPARACION = 3;
const MARGEN = 4;

/**
 * La **línea de tiempo por recurso**, como la vista de recursos de un
 * programador de proyectos: una fila por consultorio, doctor o servicio, el
 * tiempo corre hacia la derecha y cada cita es una barra. A la izquierda de cada
 * fila se ve cuánto de ese recurso está ocupado; arriba, una franja de calor
 * dice qué horas están más cargadas.
 */
@Component({
  selector: 'app-agenda-timeline',
  imports: [AgendaEventButton],
  templateUrl: './agenda-timeline.html',
  styleUrl: './agenda-timeline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaTimeline {
  readonly groups = input.required<readonly AgendaColumn<AgendaEvent>[]>();
  readonly days = input.required<readonly Date[]>();
  readonly window = input.required<TimeWindow>();
  readonly now = input.required<Date>();
  readonly doctors = input.required<readonly AgendaDoctor[]>();
  readonly multiOrg = input(false);
  readonly selectedId = input<string | null>(null);
  readonly pxPerMinute = input(2.2);
  readonly ariaLabel = input.required<string>();
  readonly dragSourceId = input<string | null>(null);
  readonly dragOverId = input<string | null>(null);
  readonly dragOverOk = input(false);
  readonly dropTargets = input<ReadonlySet<string>>(new Set());
  /** Qué agrupa cada fila, para el encabezado de la columna de rótulos. */
  readonly rowKind = input.required<string>();

  readonly pick = output<AgendaEvent>();
  readonly eventPointerDown = output<{ readonly event: PointerEvent; readonly item: AgendaEvent }>();

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');

  protected readonly dayWidth = computed(() => (this.window().endMin - this.window().startMin) * this.pxPerMinute());
  protected readonly totalWidth = computed(() => this.dayWidth() * this.days().length);

  /** Los grupos, solo con lo que cae en los días a la vista: la ocupación se mide sobre lo que se ve. */
  private readonly inRange = computed(() => {
    const dias = new Set(this.days().map((d) => toDayKey(d)));
    return this.groups().map((g) => ({ ...g, items: g.items.filter((e) => dias.has(dayKeyOf(e.start))) }));
  });

  protected readonly rows = computed<readonly RowView[]>(() =>
    this.inRange().map((group) => {
      const { bars, lanes } = layoutRow(group.items, this.days(), this.window(), this.pxPerMinute());
      return {
        key: group.key,
        label: group.label,
        ...(group.sub === undefined ? {} : { sub: group.sub }),
        bars,
        height: MARGEN * 2 + lanes * ALTO_BARRA + (lanes - 1) * SEPARACION,
        occupancy: occupancyOf(group.items),
      };
    }),
  );

  protected readonly heat = computed<readonly HourHeat[]>(() =>
    hourlyHeat(
      this.inRange().flatMap((g) => g.items),
      this.days(),
      this.window(),
    ),
  );

  protected readonly allOccupancy = computed(() => occupancyOf(this.inRange().flatMap((g) => g.items)));

  protected readonly hours = computed(() => {
    const { startMin, endMin } = this.window();
    const horas: { readonly label: string; readonly left: number }[] = [];
    this.days().forEach((_, dayIndex) => {
      for (let m = startMin; m < endMin; m += 60) {
        horas.push({ label: `${String(Math.floor(m / 60)).padStart(2, '0')}`, left: dayIndex * this.dayWidth() + (m - startMin) * this.pxPerMinute() });
      }
    });
    return horas;
  });

  protected readonly dayHeads = computed(() =>
    this.days().map((day, index) => ({
      key: toDayKey(day),
      label: day.toLocaleDateString('es-BO', { weekday: 'short', day: 'numeric' }),
      left: index * this.dayWidth(),
      today: toDayKey(day) === toDayKey(this.now()),
    })),
  );

  protected readonly nowLeft = computed(() => {
    const indice = this.days().findIndex((d) => toDayKey(d) === toDayKey(this.now()));
    if (indice < 0) return null;
    const dentro = nowOffset(this.now(), this.days()[indice]!, this.window(), this.pxPerMinute());
    return dentro === null ? null : indice * this.dayWidth() + dentro;
  });

  /** Con una barra de 30 minutos más angosta que esto, el texto no cabe: queda la franja de color. */
  protected readonly tiny = computed(() => 30 * this.pxPerMinute() < 70);

  protected readonly tip = eventTooltip;

  protected color(item: AgendaEvent): { readonly bg: string; readonly border: string } {
    return colorOfDoctor(this.doctors(), item.practitionerRoleAssignmentId);
  }

  protected role(item: AgendaEvent): DragRole {
    if (this.dragSourceId() === null) return null;
    if (item.id === this.dragSourceId()) return 'source';
    if (item.id === this.dragOverId()) return this.dragOverOk() ? 'target-ok' : 'target-no';
    return this.dropTargets().has(item.id) ? 'possible' : null;
  }

  protected barTop(bar: TimelineBar): number {
    return MARGEN + bar.lane * (ALTO_BARRA + SEPARACION);
  }

  protected heatLeft(celda: HourHeat): number {
    return celda.dayIndex * this.dayWidth() + (celda.hour * 60 - this.window().startMin) * this.pxPerMinute();
  }

  protected heatLabel(celda: HourHeat): string {
    return celda.level === 0 ? 'sin horarios' : `${celda.percent} % ocupado`;
  }

  get element(): HTMLElement {
    return this.scroller().nativeElement;
  }
}
