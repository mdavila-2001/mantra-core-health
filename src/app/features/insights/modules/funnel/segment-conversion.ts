import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { Panel } from '../../components/panel';
import { HeatmapChart, type HeatCell } from '../../charts/heatmap-chart';
import { formatInt, formatPercent } from '../../domain/format';
import type { InsightsFilter } from '../../domain/insights.types';
import { MIN_REGISTRATIONS, MIN_VISITS, recommendedTest, SEGMENT_LABELS, SEGMENT_RATES, segmentConversion, type SegmentDimension } from '../../domain/funnel-test';

/** Prueba recomendada del embudo y conversión por segmento (canal, campaña, audiencia, formato). */
@Component({
  selector: 'app-ins-segment-conversion',
  imports: [Panel, HeatmapChart],
  templateUrl: './segment-conversion.html',
  styleUrl: './segment-conversion.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SegmentConversion {
  readonly filter = input.required<InsightsFilter>();
  protected readonly dimension = signal<SegmentDimension>('channel');
  protected readonly dimensions = Object.keys(SEGMENT_LABELS) as SegmentDimension[];
  protected readonly labels = SEGMENT_LABELS;
  protected readonly rates = SEGMENT_RATES;
  protected readonly minVisits = MIN_VISITS;
  protected readonly minRegs = MIN_REGISTRATIONS;

  protected readonly test = computed(() => recommendedTest(this.filter()));
  protected readonly rows = computed(() => segmentConversion(this.filter(), this.dimension()));
  protected readonly top = computed(() => this.rows().slice(0, 9));
  protected readonly bars = computed(() => this.rows().filter((r) => r.rates.clickToConv !== null).slice(0, 10));
  protected readonly maxRate = computed(() => Math.max(...this.bars().map((r) => r.rates.clickToConv ?? 0), 0.0001));
  protected readonly heat = computed(() => ({
    rows: this.top().map((r) => r.label),
    cols: SEGMENT_RATES.map((c) => c.label),
    cells: this.top().map((r) => SEGMENT_RATES.map((c): HeatCell => ({ value: r.rates[c.id], note: r.rates[c.id] === null ? 'Sin base suficiente o no medido en este corte.' : undefined }))),
  }));

  protected readonly pct = (v: number | null): string => (v === null ? '—' : formatPercent(v));
  protected readonly int = formatInt;
  protected pick(d: SegmentDimension): void { this.dimension.set(d); }
  protected index(v: number | null): string { return v === null ? '—' : v.toFixed(2).replace('.', ','); }
}
