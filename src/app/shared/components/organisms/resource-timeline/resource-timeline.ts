import { ChangeDetectionStrategy, Component, computed, input, type TemplateRef, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ready } from '../../../../core/view-state/view-state';
import { DataTable } from '../data-table/data-table';
import type { ColumnDef } from '../data-table/data-table.types';
import type { TimelineRow, TimelineSegment } from './resource-timeline.types';

/** Un segmento ya ubicado en el eje, en % del ancho del día visible. */
interface PlacedSegment {
  readonly segment: TimelineSegment;
  readonly left: number;
  readonly width: number;
  /** Margen reservado, en % del propio segmento extendido. */
  readonly reservedLeft: number | null;
  readonly reservedWidth: number | null;
  readonly range: string;
}

/** Una fila de la lista alternativa (teléfono). */
interface ListEntry {
  readonly id: string;
  readonly resource: string;
  readonly what: string;
  readonly range: string;
  readonly route: string | null;
}

const HOUR_MS = 3_600_000;
const pad = (n: number): string => String(n).padStart(2, '0');
const hhmm = (d: Date): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * **Línea de tiempo por recurso** — filas = recursos, eje horario, segmentos.
 *
 * Primitiva nueva permitida por `CONTRATO-F2-F5.md` §F4.4 para la agenda de
 * quirófanos: no había en el sistema nada que pinte varias filas contra un
 * mismo eje horario. Se mantuvo genérica (no sabe de salas ni de casos).
 *
 * ## Accesibilidad
 *
 * Cada fila es una lista (`<ul>`) con su nombre; cada segmento lleva su
 * descripción completa como texto accesible (no sólo color ni posición), y los
 * que tienen `route` son enlaces alcanzables con el teclado.
 *
 * ## A 390 px
 *
 * Un eje de doce horas no entra en un teléfono: por debajo de 780 px (el corte
 * principal) se oculta y se muestra la misma información como `app-data-table`.
 * Las dos están en el DOM; sólo cambia cuál se ve.
 */
@Component({
  selector: 'app-resource-timeline',
  imports: [DataTable, RouterLink],
  templateUrl: './resource-timeline.html',
  styleUrl: './resource-timeline.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResourceTimeline {
  readonly rows = input.required<readonly TimelineRow[]>();
  readonly segments = input.required<readonly TimelineSegment[]>();
  /** Día visible, `yyyy-mm-dd`. */
  readonly day = input.required<string>();
  readonly startHour = input(7);
  readonly endHour = input(20);
  /** Nombre accesible del conjunto. */
  readonly label = input.required<string>();

  private readonly resourceCell = viewChild.required<TemplateRef<{ $implicit: ListEntry }>>('resourceCell');

  protected readonly hours = computed(() => {
    const out: { readonly label: string; readonly left: number }[] = [];
    const span = this.endHour() - this.startHour();
    for (let h = this.startHour(); h <= this.endHour(); h += 1) out.push({ label: `${pad(h)}:00`, left: ((h - this.startHour()) / span) * 100 });
    return out;
  });

  private readonly window = computed(() => {
    const start = new Date(`${this.day()}T00:00:00`).getTime() + this.startHour() * HOUR_MS;
    return { start, end: start + (this.endHour() - this.startHour()) * HOUR_MS };
  });

  protected readonly placed = computed(() => {
    const { start, end } = this.window();
    const span = end - start;
    const byRow = new Map<string, PlacedSegment[]>();
    for (const segment of this.segments()) {
      const outerStart = Date.parse(segment.reservedStart ?? segment.start);
      const outerEnd = Date.parse(segment.reservedEnd ?? segment.end);
      const s = Math.max(outerStart, start);
      const e = Math.min(outerEnd, end);
      if (e <= s) continue;
      const outer = outerEnd - outerStart;
      const hasReserve = segment.reservedStart !== undefined || segment.reservedEnd !== undefined;
      const placed: PlacedSegment = {
        segment,
        left: ((s - start) / span) * 100,
        width: ((e - s) / span) * 100,
        reservedLeft: hasReserve ? ((Date.parse(segment.start) - outerStart) / outer) * 100 : null,
        reservedWidth: hasReserve ? ((Date.parse(segment.end) - Date.parse(segment.start)) / outer) * 100 : null,
        range: `${hhmm(new Date(segment.start))}–${hhmm(new Date(segment.end))}`,
      };
      byRow.set(segment.rowId, [...(byRow.get(segment.rowId) ?? []), placed]);
    }
    // Las bandas primero: quedan detrás de los ítems en el orden del DOM.
    const order = { band: 0, released: 1, item: 2 } as const;
    for (const list of byRow.values()) list.sort((a, b) => order[a.segment.kind] - order[b.segment.kind] || a.left - b.left);
    return byRow;
  });

  protected readonly listState = computed(() => {
    const names = new Map(this.rows().map((r) => [r.id, r.label]));
    const entries: ListEntry[] = [...this.segments()]
      .sort((a, b) => a.rowId.localeCompare(b.rowId) || a.start.localeCompare(b.start))
      .map((s) => ({
        id: s.id,
        resource: names.get(s.rowId) ?? '—',
        what: s.detail,
        range: `${hhmm(new Date(s.start))}–${hhmm(new Date(s.end))}`,
        route: s.route ?? null,
      }));
    return ready(entries as readonly ListEntry[]);
  });

  protected readonly columns = computed<readonly ColumnDef<ListEntry>[]>(() => [
    { key: 'range', header: 'Horario', priority: 1 },
    { key: 'resource', header: 'Sala', priority: 1 },
    { key: 'what', header: 'Qué', priority: 1, cell: this.resourceCell() },
  ]);

  protected readonly byId = (row: { readonly id: string }): string => row.id;

  protected segmentsOf(rowId: string): readonly PlacedSegment[] {
    return this.placed().get(rowId) ?? [];
  }
}
