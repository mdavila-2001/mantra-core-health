import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { describeChange, formatChange, formatValue } from '../domain/format';
import { BENCHMARK_SOURCE_LABELS, type KpiAssessment, type MetricUnit } from '../domain/insights.types';
import { METRIC_CATALOG } from '../domain/metric-catalog';
import { Sparkline } from './sparkline';
import { StatusPill } from './status-pill';

/**
 * Tarjeta de KPI en tres densidades:
 *  · compact  — rejillas densas: valor y variación.
 *  · standard — panel principal: valor, variación, benchmark, objetivo y estado.
 *  · expanded — métrica estratégica: añade tendencia y la lectura de gerencia
 *               (qué decisión permite, qué significa si sube o baja).
 * Un KPI sin cifra no dice «0»: dice por qué no hay cifra.
 */
@Component({
  selector: 'ins-kpi',
  imports: [StatusPill, Sparkline],
  templateUrl: './kpi-card.html',
  styleUrl: './kpi-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': '"kpi kpi--" + density()', '[class.kpi--selected]': 'selected()' },
})
export class KpiCard {
  readonly assessment = input.required<KpiAssessment>();
  readonly density = input<'compact' | 'standard' | 'expanded'>('standard');
  readonly series = input<readonly (number | null)[] | null>(null);
  readonly selected = input(false);
  readonly versus = input('el periodo anterior');
  readonly opened = output<void>();

  protected readonly def = computed(() => METRIC_CATALOG[this.assessment().kpi.metric]);
  protected readonly unit = computed<MetricUnit>(() => this.def().unit);
  protected readonly shown = computed(() => formatValue(this.assessment().kpi.value, this.unit(), this.density() === 'compact'));
  protected readonly change = computed(() => this.assessment().changeVsPrevious);
  protected readonly changeText = computed(() => (this.change() === null ? '' : formatChange(this.change()!)));
  protected readonly changeGood = computed(() => {
    const c = this.change();
    const good = this.def().goodWhen;
    if (c === null || good === 'none' || Math.abs(c) < 0.005) return null;
    return good === 'up' ? c > 0 : c < 0;
  });
  protected readonly changeAria = computed(() => describeChange(this.change(), this.versus()));
  protected readonly benchmarkText = computed(() => {
    const b = this.assessment().benchmark;
    return b ? formatValue(b.value, this.unit(), true) : null;
  });
  protected readonly targetText = computed(() => {
    const t = this.assessment().target;
    return t ? formatValue(t.value, this.unit(), true) : null;
  });
  protected readonly benchmarkTitle = computed(() => {
    const b = this.assessment().benchmark;
    return b ? `${BENCHMARK_SOURCE_LABELS[b.source]}. ${b.note}` : '';
  });
  protected readonly targetTitle = computed(() => {
    const t = this.assessment().target;
    return t ? `${BENCHMARK_SOURCE_LABELS[t.source]}. ${t.note}` : '';
  });
  protected readonly vsBenchmark = computed(() => {
    const c = this.assessment().changeVsBenchmark;
    return c === null ? null : formatChange(c);
  });
}
