import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, input, output, viewChild } from '@angular/core';

import { AgendaEventButton, type DragRole } from './agenda-event';
import {
  colorOfDoctor,
  eventTooltip,
  layoutColumn,
  nowOffset,
  type AgendaDoctor,
  type AgendaEvent,
  type PlacedEvent,
  type TimeWindow,
} from './agenda-model';

/** Una columna de la grilla: un doctor, un consultorio, un servicio o un día. */
export interface GridColumn {
  readonly key: string;
  readonly label: string;
  /** Una línea más bajo el rótulo (la especialidad, el edificio o el número del día). */
  readonly sub?: string;
  readonly day: Date | null;
  readonly today: boolean;
  readonly events: readonly AgendaEvent[];
}

interface PlacedColumn {
  readonly column: GridColumn;
  readonly placed: readonly PlacedEvent[];
  readonly nowTop: number | null;
}

/**
 * La grilla de **día** y de **semana**: el tiempo corre hacia abajo y cada
 * columna es un doctor, un consultorio, un servicio o un día. Los eventos que se
 * pisan quedan lado a lado, como en Google Calendar.
 *
 * Es solo dibujo: no sabe de permisos ni de red. Avisa con `pick` qué evento se
 * tocó y con `eventPointerDown` cuándo empieza un posible arrastre.
 */
@Component({
  selector: 'app-agenda-grid',
  imports: [AgendaEventButton],
  templateUrl: './agenda-grid.html',
  styleUrl: './agenda-grid.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgendaGrid {
  readonly columns = input.required<readonly GridColumn[]>();
  readonly window = input.required<TimeWindow>();
  readonly now = input.required<Date>();
  readonly doctors = input.required<readonly AgendaDoctor[]>();
  readonly multiOrg = input(false);
  /** Cómo se agrupan las columnas: decide qué dice la segunda línea de cada evento. */
  readonly subline = input<'DOCTOR_SPACE' | 'SPACE' | 'DOCTOR'>('DOCTOR_SPACE');
  readonly selectedId = input<string | null>(null);
  readonly pxPerMinute = input(1.4);
  /** En el celular: una columna por pantalla, que se desliza. */
  readonly snap = input(false);
  /** Semana: eventos más apretados. */
  readonly dense = input(false);
  readonly ariaLabel = input.required<string>();
  readonly dragSourceId = input<string | null>(null);
  readonly dragOverId = input<string | null>(null);
  readonly dragOverOk = input(false);
  readonly dropTargets = input<ReadonlySet<string>>(new Set());
  /** La columna a la que hay que llevar la vista (celular). */
  readonly focusColumn = input<string | null>(null);

  readonly pick = output<AgendaEvent>();
  readonly eventPointerDown = output<{ readonly event: PointerEvent; readonly item: AgendaEvent }>();
  /** Cuál columna quedó a la vista al deslizar (celular). */
  readonly columnSeen = output<string>();

  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private lastSeen = '';
  private lastDays = '';

  protected readonly placedColumns = computed<readonly PlacedColumn[]>(() =>
    this.columns().map((column) => ({
      column,
      placed: layoutColumn(column.events, this.window(), this.pxPerMinute()),
      nowTop: column.day === null ? null : nowOffset(this.now(), column.day, this.window(), this.pxPerMinute()),
    })),
  );

  protected readonly bodyHeight = computed(() => (this.window().endMin - this.window().startMin) * this.pxPerMinute());

  protected readonly hours = computed(() => {
    const { startMin, endMin } = this.window();
    const horas: { readonly label: string; readonly top: number }[] = [];
    for (let m = startMin; m < endMin; m += 60) {
      horas.push({ label: `${String(Math.floor(m / 60)).padStart(2, '0')}:00`, top: (m - startMin) * this.pxPerMinute() });
    }
    return horas;
  });

  protected readonly template = computed(() =>
    this.snap()
      ? `repeat(${this.columns().length}, calc(100vw - var(--eje) - var(--sp-8)))`
      : `repeat(${this.columns().length}, minmax(var(--col-min, 9rem), 1fr))`,
  );

  constructor() {
    // Al cambiar de día o de semana, la vista se lleva sola a la hora actual si hoy está a la vista.
    // Solo cuando cambian los **días**: una recarga tras una acción no debe mover lo que se estaba mirando.
    effect(() => {
      const columnas = this.placedColumns();
      const dias = [...new Set(columnas.map((c) => c.column.day?.toDateString() ?? ''))].join('|');
      if (dias === this.lastDays) return;
      this.lastDays = dias;
      const conAhora = columnas.find((c) => c.nowTop !== null);
      queueMicrotask(() => {
        this.scroller().nativeElement.scrollTop = conAhora?.nowTop === null || conAhora === undefined ? 0 : Math.max(0, conAhora.nowTop - 120);
      });
    });
    // Celular: llevar a la columna elegida en las pestañas.
    effect(() => {
      const clave = this.focusColumn();
      if (clave === null || !this.snap()) return;
      const elemento = this.scroller().nativeElement;
      const indice = this.columns().findIndex((c) => c.key === clave);
      if (indice < 0) return;
      queueMicrotask(() => {
        const destino = elemento.querySelector<HTMLElement>(`[data-col="${CSS.escape(clave)}"]`);
        if (destino !== null) elemento.scrollTo({ left: destino.offsetLeft - this.axisWidth(elemento), behavior: 'smooth' });
      });
    });
  }

  private axisWidth(elemento: HTMLElement): number {
    return elemento.querySelector<HTMLElement>('.grid__eje')?.offsetWidth ?? 0;
  }

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

  protected compact(p: PlacedEvent): boolean {
    return p.lanes >= 3 || p.height < 38;
  }

  protected alDeslizar(): void {
    if (!this.snap()) return;
    const elemento = this.scroller().nativeElement;
    const columnas = Array.from(elemento.querySelectorAll<HTMLElement>('[data-col]'));
    if (columnas.length === 0) return;
    const ancho = columnas[0]!.offsetWidth || 1;
    const indice = Math.min(columnas.length - 1, Math.max(0, Math.round(elemento.scrollLeft / ancho)));
    const clave = columnas[indice]!.dataset['col'] ?? '';
    if (clave !== '' && clave !== this.lastSeen) {
      this.lastSeen = clave;
      this.columnSeen.emit(clave);
    }
  }

  /** Para que el contenedor pueda desplazar la grilla mientras se arrastra. */
  get element(): HTMLElement {
    return this.scroller().nativeElement;
  }
}
