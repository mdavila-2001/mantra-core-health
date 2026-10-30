import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { formatAxis, formatPercent, formatValue } from '../domain/format';
import type { MetricUnit } from '../domain/insights.types';
import { linear, niceTicks } from './chart-math';
import { seriesVar, trackWidth, type StackRow, type StackSegment } from './chart.types';

/**
 * Pregunta que responde: «¿cómo está compuesto el resultado?».
 *
 * Barras apiladas en volumen absoluto o al 100 % cuando interesa la proporción.
 * Sustituye al gráfico circular: las partes se comparan por longitud, no por
 * ángulo, y cada segmento se rotula con su cifra cuando cabe.
 */
@Component({
  selector: 'ins-stacked-chart',
  templateUrl: './stacked-chart.html',
  styleUrl: './stacked-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ins-chart' },
})
export class StackedChart {
  readonly rows = input.required<readonly StackRow[]>();
  readonly segments = input.required<readonly StackSegment[]>();
  readonly unit = input.required<MetricUnit>();
  readonly proportion = input(false);
  readonly height = input(280);
  readonly ariaLabel = input.required<string>();

  protected readonly width = trackWidth();
  protected readonly sv = seriesVar;
  protected readonly hover = signal<string | null>(null);
  protected readonly m = { top: 14, right: 12, bottom: 34, left: 52 } as const;

  protected readonly totals = computed(() => this.rows().map((r) => this.segments().reduce((s, seg) => s + (r.values[seg.id] ?? 0), 0)));
  protected readonly max = computed(() => (this.proportion() ? 1 : Math.max(...this.totals(), 1)));
  protected readonly ticks = computed(() => niceTicks(0, this.max(), 5));
  protected readonly y = computed(() => linear(0, this.ticks()[this.ticks().length - 1] ?? 1, this.height() - this.m.bottom, this.m.top));

  /** Cada cuántas columnas se rotula el eje: ~64 px por etiqueta, para que no se pisen. */
  protected readonly labelStep = computed(() => Math.max(1, Math.ceil(this.rows().length / Math.max(1, Math.floor((this.width() - this.m.left - this.m.right) / 64)))));

  protected readonly cols = computed(() => {
    const rows = this.rows();
    const slot = (this.width() - this.m.left - this.m.right) / Math.max(1, rows.length);
    const barW = Math.min(56, slot * 0.66);
    return rows.map((row, i) => {
      const total = this.totals()[i] ?? 0;
      let acc = 0;
      const cx = this.m.left + slot * i + slot / 2;
      const parts = this.segments().map((seg) => {
        const raw = row.values[seg.id] ?? 0;
        const share = this.proportion() ? (total > 0 ? raw / total : 0) : raw;
        const y1 = this.y()(acc + share);
        const y0 = this.y()(acc);
        acc += share;
        return {
          seg,
          raw,
          x: cx - barW / 2,
          y: y1,
          w: barW,
          h: Math.max(0, y0 - y1),
          label: this.proportion() ? formatPercent(total > 0 ? raw / total : 0, 0) : formatValue(raw, this.unit(), true),
          tip: `${row.label} · ${seg.label}: ${formatValue(raw, this.unit())} (${formatPercent(total > 0 ? raw / total : 0)})`,
        };
      });
      return { row, cx, parts, total };
    });
  });

  protected axis(v: number): string {
    return this.proportion() ? formatPercent(v, 0) : formatAxis(v, this.unit());
  }

  protected readonly tableRows = computed(() => this.rows().map((r) => [r.label, ...this.segments().map((s) => formatValue(r.values[s.id] ?? 0, this.unit()))]));
}
