import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { HeatmapChart, type HeatCell } from '../../charts/heatmap-chart';
import { Panel } from '../../components/panel';
import { WEEKDAY_SHORT } from '../../domain/dates';
import { formatValue } from '../../domain/format';
import { hourlyGrid } from '../../domain/hourly';
import type { InsightsFilter, MetricId } from '../../domain/insights.types';
import { METRIC_CATALOG } from '../../domain/metric-catalog';

const METRICS: readonly MetricId[] = ['ctr', 'conversionRate', 'clicks', 'cpc', 'conversions'];

/**
 * «¿En qué horarios obtenemos mejores resultados?» Cruza día de la semana y hora
 * con la intensidad de una métrica. El reparto por hora de los datos diarios es
 * modelado en el prototipo y así se declara.
 */
@Component({
  selector: 'app-ins-timing-panel',
  imports: [Panel, HeatmapChart, Select],
  template: `
    <app-ins-panel title="Mejor momento para pautar" question="¿En qué día y hora rinde mejor la campaña?">
      <div panel-tools class="tp__metric">
        <app-select ariaLabel="Métrica del mapa de horario" [value]="metric()" [options]="options" (valueChange)="set($event)" />
      </div>
      <app-ins-heatmap-chart [rows]="rows" [cols]="cols" [cells]="cells()" [unit]="def().unit" [valueName]="def().label" [best]="best()" [colLabelEvery]="2" [minCell]="30" [showValues]="false" [ariaLabel]="def().label + ' por día de la semana y hora'" />
      <p class="tp__note">{{ summary() }} Reparto horario modelado a partir de datos diarios (prototipo).</p>
    </app-ins-panel>
  `,
  styles: `
    :host { display: block; }
    .tp__metric { min-inline-size: 220px; }
    .tp__note { margin: var(--sp-2) 0 0; font-size: var(--fs-caption); color: var(--text-secondary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimingPanel {
  readonly filter = input.required<InsightsFilter>();
  protected readonly metric = signal<MetricId>('ctr');
  protected readonly def = computed(() => METRIC_CATALOG[this.metric()]);
  protected readonly options: readonly SelectOption<MetricId>[] = METRICS.map((m) => ({ value: m, label: METRIC_CATALOG[m].label }));
  protected readonly rows = WEEKDAY_SHORT.map((d) => d as string);
  protected readonly cols = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
  private readonly grid = computed(() => hourlyGrid(this.filter(), this.metric()));
  protected readonly cells = computed<HeatCell[][]>(() => this.rows.map((_, d) => this.cols.map((_, h) => ({ value: this.grid().cells[d * 24 + h]?.kpi.value ?? null, note: this.grid().cells[d * 24 + h]?.kpi.gap?.message }))));
  protected readonly best = computed(() => {
    const b = this.grid().best;
    return b ? ([b.weekday, b.hour] as const) : null;
  });
  protected readonly summary = computed(() => {
    const b = this.grid().best;
    if (!b) return 'No hay una franja con muestra suficiente para recomendar un horario.';
    return `Mejor franja: ${WEEKDAY_SHORT[b.weekday]} ${String(b.hour).padStart(2, '0')}:00 (${formatValue(b.value, this.def().unit)}).`;
  });
  protected set(m: MetricId | null): void { if (m) this.metric.set(m); }
}
