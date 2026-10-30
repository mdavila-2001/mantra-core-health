import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { BarChart } from '../../charts/bar-chart';
import type { BarDatum } from '../../charts/chart.types';
import { MultiSelect } from '../../components/multi-select';
import { Panel } from '../../components/panel';
import { compareCampaigns } from '../../domain/campaign-analysis';
import { CAMPAIGNS } from '../../domain/campaigns.data';
import { formatValue } from '../../domain/format';
import type { Channel, KpiValue, MetricId } from '../../domain/insights.types';
import { METRIC_CATALOG } from '../../domain/metric-catalog';

const COLUMNS: readonly MetricId[] = ['impressions', 'ctr', 'cpc', 'conversions', 'conversionRate', 'cpa', 'cac', 'roas', 'retention'];

/**
 * Compara campañas lado a lado. Cada una se mide en SUS fechas: comparar una
 * campaña de 29 días con una de 47 por volumen sería engañoso, así que el
 * gráfico de barras usa la métrica elegida y la tabla marca el mejor valor de
 * cada columna con texto, no solo con color.
 */
@Component({
  selector: 'app-ins-comparison-panel',
  imports: [Panel, MultiSelect, Select, BarChart],
  templateUrl: './comparison-panel.html',
  styleUrl: './comparison-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComparisonPanel {
  readonly channels = input.required<readonly Channel[]>();
  readonly initial = input<readonly string[]>([]);

  private readonly picked = signal<readonly string[] | null>(null);
  protected readonly ids = computed(() => this.picked() ?? (this.initial().length >= 2 ? this.initial() : CAMPAIGNS.slice(0, 3).map((c) => c.id)));
  protected readonly metric = signal<MetricId>('roas');

  protected readonly campaignOptions = CAMPAIGNS.map((c) => ({ value: c.id, label: c.name }));
  protected readonly metricOptions: readonly SelectOption<MetricId>[] = COLUMNS.map((m) => ({ value: m, label: METRIC_CATALOG[m].label }));
  protected readonly columns = COLUMNS.map((m) => METRIC_CATALOG[m]);

  protected readonly rows = computed(() => compareCampaigns(this.ids(), this.channels(), COLUMNS));

  protected readonly best = computed(() => {
    const out = new Map<MetricId, string>();
    for (const m of COLUMNS) {
      const def = METRIC_CATALOG[m];
      if (def.goodWhen === 'none') continue;
      const candidates = this.rows().filter((r) => r.values[m]?.value !== null && r.values[m]?.value !== undefined);
      if (candidates.length < 2) continue;
      const sorted = [...candidates].sort((a, b) => ((a.values[m]?.value ?? 0) - (b.values[m]?.value ?? 0)) * (def.goodWhen === 'up' ? -1 : 1));
      out.set(m, sorted[0]!.campaignId);
    }
    return out;
  });

  protected readonly bars = computed<BarDatum[]>(() =>
    this.rows().map((r) => ({ id: r.campaignId, label: r.name.split(' — ')[0] ?? r.name, value: r.values[this.metric()]?.value ?? null, note: r.values[this.metric()]?.gap?.message })),
  );
  protected readonly metricDef = computed(() => METRIC_CATALOG[this.metric()]);

  protected show(r: { values: Readonly<Record<string, KpiValue>> }, m: MetricId): string {
    const k = r.values[m];
    return k?.value === null || k === undefined ? '—' : formatValue(k.value, METRIC_CATALOG[m].unit, true);
  }
  protected gapOf(r: { values: Readonly<Record<string, KpiValue>> }, m: MetricId): string {
    return r.values[m]?.gap?.message ?? '';
  }
  protected setIds(ids: readonly string[]): void { this.picked.set(ids); }
  protected setMetric(m: MetricId | null): void { if (m) this.metric.set(m); }
}
