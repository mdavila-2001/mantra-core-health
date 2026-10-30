import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { Select } from '../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../shared/components/atoms/select/select.types';
import { SegmentedControl } from '../../../shared/components/molecules/segmented-control/segmented-control';
import { CAMPAIGNS, CAMPAIGN_CHANNELS } from '../domain/campaigns.data';
import { longDate } from '../domain/dates';
import type { Channel, MetricId } from '../domain/insights.types';
import { CHANNEL_LABELS, CHANNELS } from '../domain/insights.types';
import { ALL_METRICS, METRIC_CATALOG } from '../domain/metric-catalog';
import { InsightsContext, PERIOD_LABELS, type PeriodPreset } from '../insights-context';
import { MultiSelect, type MultiOption } from './multi-select';

export type FilterControl = 'campaign' | 'period' | 'channel' | 'metric' | 'grain';

/**
 * Barra de filtros GLOBALES: lo que se elige aquí aplica a toda la pantalla.
 * Los controles que solo afectan a un gráfico viven dentro de ese gráfico, con
 * su propio rótulo, para que nadie dude de qué está filtrando. Cada módulo
 * pide solo los controles que le sirven.
 */
@Component({
  selector: 'ins-filter-bar',
  imports: [Select, SegmentedControl, MultiSelect],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBar {
  protected readonly ctx = inject(InsightsContext);
  readonly controls = input<readonly FilterControl[]>(['campaign', 'period', 'channel', 'metric']);
  /** Métricas ofrecidas; por omisión todo el catálogo. */
  readonly metrics = input<readonly MetricId[] | null>(null);

  protected has(control: FilterControl): boolean {
    return this.controls().includes(control);
  }

  protected readonly campaignOptions: readonly MultiOption[] = CAMPAIGNS.map((c) => ({ value: c.id, label: c.name }));

  protected readonly channelOptions = computed<readonly MultiOption[]>(() => {
    const available = new Set(this.ctx.state().campaignIds.flatMap((id) => CAMPAIGN_CHANNELS[id] ?? []));
    return CHANNELS.filter((c) => available.has(c)).map((c) => ({ value: c, label: CHANNEL_LABELS[c] }));
  });

  protected readonly periodOptions: readonly SelectOption<PeriodPreset>[] = (Object.keys(PERIOD_LABELS) as PeriodPreset[]).map((p) => ({ value: p, label: PERIOD_LABELS[p] }));

  protected readonly metricOptions = computed<readonly SelectOption<MetricId>[]>(() => {
    const only = this.metrics();
    return ALL_METRICS.filter((m) => !only || only.includes(m.id)).map((m) => ({ value: m.id, label: m.label, description: m.decision }));
  });

  protected readonly grainOptions = [
    { value: 'auto', label: 'Auto' },
    { value: 'day', label: 'Día' },
    { value: 'week', label: 'Semana' },
    { value: 'month', label: 'Mes' },
  ] as const;

  protected readonly rangeText = computed(() => `${longDate(this.ctx.range().from)} — ${longDate(this.ctx.range().to)}`);
  protected readonly metricHelp = computed(() => METRIC_CATALOG[this.ctx.state().metric].decision);

  protected setCampaigns(ids: readonly string[]): void {
    this.ctx.update({ c: ids.join(','), ch: null });
  }
  protected setChannels(ids: readonly string[]): void {
    const all = this.channelOptions().length;
    this.ctx.update({ ch: ids.length === all ? null : ids.join(',') });
  }
  protected setPeriod(p: PeriodPreset | null): void {
    if (p) this.ctx.update({ p });
  }
  protected setMetric(m: MetricId | null): void {
    if (m) this.ctx.update({ m });
  }
  protected setGrain(g: string): void {
    this.ctx.update({ g: g === 'auto' ? null : g });
  }
  protected setCustom(edge: 'from' | 'to', event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) this.ctx.update({ [edge]: value });
  }
  protected selectedChannels(): readonly Channel[] {
    return this.ctx.channels();
  }
}
