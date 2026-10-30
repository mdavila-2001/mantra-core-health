import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatAxis, formatValue } from '../domain/format';
import type { MetricUnit } from '../domain/insights.types';
import { boxStats, histogramBins, linear, niceTicks, quantile } from './chart-math';
import { trackWidth } from './chart.types';

export interface Group {
  readonly id: string;
  readonly label: string;
  readonly values: readonly number[];
}

/**
 * Preguntas que responde: «¿cómo se distribuyen los datos?» (histograma) y
 * «¿qué tan variable es y hay valores atípicos?» (caja por grupo).
 *
 * Un promedio esconde la dispersión; aquí se ve. La caja marca mediana, cuartiles
 * y bigotes a 1,5 × RIC; lo que cae fuera se dibuja como punto atípico.
 */
@Component({
  selector: 'ins-distribution-chart',
  templateUrl: './distribution-chart.html',
  styleUrl: './distribution-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'ins-chart' },
})
export class DistributionChart {
  readonly groups = input.required<readonly Group[]>();
  readonly unit = input.required<MetricUnit>();
  readonly mode = input<'histogram' | 'boxplot'>('histogram');
  readonly ariaLabel = input.required<string>();
  readonly height = input(260);

  protected readonly Math = Math;
  protected readonly width = trackWidth();
  protected readonly m = { top: 14, right: 16, bottom: 34, left: 56 } as const;

  private readonly all = computed(() => this.groups().flatMap((g) => g.values));
  protected readonly stats = computed(() => {
    const sorted = [...this.all()].sort((a, b) => a - b);
    return sorted.length ? { mean: sorted.reduce((s, v) => s + v, 0) / sorted.length, median: quantile(sorted, 0.5), n: sorted.length } : null;
  });

  // —— histograma ——
  protected readonly bins = computed(() => histogramBins(this.all()));
  protected readonly hx = computed(() => {
    const bins = this.bins();
    return linear(bins[0]?.from ?? 0, bins[bins.length - 1]?.to ?? 1, this.m.left, this.width() - this.m.right);
  });
  protected readonly hyTicks = computed(() => niceTicks(0, Math.max(1, ...this.bins().map((b) => b.count)), 5));
  protected readonly hy = computed(() => linear(0, this.hyTicks()[this.hyTicks().length - 1] ?? 1, this.height() - this.m.bottom, this.m.top));
  protected readonly hxTicks = computed(() => {
    const bins = this.bins();
    return niceTicks(bins[0]?.from ?? 0, bins[bins.length - 1]?.to ?? 1, Math.max(3, Math.floor(this.width() / 110)));
  });

  // —— cajas ——
  protected readonly boxes = computed(() => this.groups().map((g) => ({ group: g, box: boxStats(g.values) })));
  protected readonly bxTicks = computed(() => {
    const values = this.all();
    return niceTicks(Math.min(...values, 0) >= 0 ? 0 : Math.min(...values), Math.max(...values, 1), 5);
  });
  protected readonly bx = computed(() => linear(this.bxTicks()[0] ?? 0, this.bxTicks()[this.bxTicks().length - 1] ?? 1, 96, this.width() - this.m.right));
  protected readonly rowH = computed(() => Math.max(34, Math.min(54, (this.height() - 40) / Math.max(1, this.groups().length))));
  protected readonly boxHeight = computed(() => Math.max(this.height(), this.groups().length * this.rowH() + 44));

  protected axis(v: number): string { return formatAxis(v, this.unit()); }
  protected fmt(v: number): string { return formatValue(v, this.unit()); }
  protected binTip(from: number, to: number, count: number): string { return `${this.fmt(from)} a ${this.fmt(to)}: ${count} días`; }
}
