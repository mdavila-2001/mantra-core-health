import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { Select } from '../../../../shared/components/atoms/select/select';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { SegmentedControl } from '../../../../shared/components/molecules/segmented-control/segmented-control';
import { BarChart } from '../../charts/bar-chart';
import type { BarDatum } from '../../charts/chart.types';
import { DistributionChart } from '../../charts/distribution-chart';
import { HeatmapChart, type HeatCell } from '../../charts/heatmap-chart';
import { LineChart } from '../../charts/line-chart';
import { ScatterChart } from '../../charts/scatter-chart';
import { StackedChart } from '../../charts/stacked-chart';
import { ChartPicker } from '../../components/chart-picker';
import { Panel } from '../../components/panel';
import { compositionByChannel, channelBars, dailyValues, mainChartModel, relationPoints, RELATIONS, type RelationId } from '../../domain/campaign-analysis';
import { buildCohorts, COHORT_WEEKS } from '../../domain/cohorts';
import { shortDate, WEEKDAY_SHORT } from '../../domain/dates';
import { formatValue } from '../../domain/format';
import { dayPart, hourlyGrid } from '../../domain/hourly';
import type { ChartType, InsightsFilter, MetricId } from '../../domain/insights.types';
import { CHANNEL_LABELS, CHART_QUESTIONS } from '../../domain/insights.types';
import { selectFacts } from '../../domain/kpi';
import { METRIC_CATALOG } from '../../domain/metric-catalog';
import { chartOptionsFor, recommendVisualization } from '../../domain/viz-recommender';

type TimeView = 'dayhour' | 'hour' | 'daypart' | 'weekday';

const PART_ORDER = ['madrugada', 'mañana', 'tarde', 'noche'] as const;

/**
 * El análisis principal del módulo: una métrica, la visualización que mejor
 * responde a su naturaleza (recomendada y con razón) y la posibilidad de
 * cambiarla. Los controles de este panel son CONTEXTUALES: solo afectan al
 * gráfico de abajo.
 */
@Component({
  selector: 'ins-main-analysis',
  imports: [NgTemplateOutlet, Panel, ChartPicker, LineChart, BarChart, StackedChart, HeatmapChart, ScatterChart, DistributionChart, SegmentedControl, Select],
  templateUrl: './main-analysis.html',
  styleUrl: './main-analysis.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainAnalysis {
  readonly filter = input.required<InsightsFilter>();
  readonly channelPicked = output<string>();

  protected readonly metric = computed<MetricId>(() => this.filter().metric);
  protected readonly def = computed(() => METRIC_CATALOG[this.metric()]);

  private readonly override = signal<{ metric: MetricId; chart: ChartType } | null>(null);
  protected readonly compare = signal(true);
  protected readonly band = signal(false);
  protected readonly split = signal(false);
  protected readonly timeView = signal<TimeView>('dayhour');
  protected readonly relation = signal<RelationId | null>(null);

  protected readonly recommendation = computed(() =>
    recommendVisualization(this.metric(), {
      points: this.pointCount(),
      categories: this.filter().channels.length,
      grain: this.filter().grain,
      rangeDays: this.rangeDays(),
    }),
  );
  protected readonly options = computed(() => chartOptionsFor(this.metric(), { categories: this.filter().channels.length }));
  protected readonly chart = computed<ChartType>(() => {
    const o = this.override();
    return o && o.metric === this.metric() ? o.chart : this.recommendation().recommended;
  });
  protected readonly question = computed(() => CHART_QUESTIONS[this.chart()]);

  private readonly rangeDays = computed(() => Math.round((Date.parse(this.filter().range.to) - Date.parse(this.filter().range.from)) / 86_400_000) + 1);
  private readonly pointCount = computed(() => {
    const days = this.rangeDays();
    const g = this.filter().grain;
    return g === 'day' ? days : g === 'week' ? Math.ceil(days / 7) : Math.ceil(days / 30);
  });

  protected pick(chart: ChartType): void {
    this.override.set({ metric: this.metric(), chart });
  }

  // —— línea / área ——
  protected readonly lineModel = computed(() =>
    mainChartModel(this.filter(), this.metric(), { split: this.split() ? 'channel' : 'none', compare: this.compare(), band: this.band() }),
  );
  protected readonly lineAria = computed(() => `${this.def().label} por ${this.filter().grain === 'day' ? 'día' : this.filter().grain === 'week' ? 'semana' : 'mes'}, ${this.lineModel().points} puntos.`);

  // —— barras ——
  protected readonly bars = computed(() => channelBars(this.filter(), this.metric()));

  // —— apiladas ——
  protected readonly stack = computed(() => compositionByChannel(this.filter(), this.metric()));

  // —— horario ——
  protected readonly timeViewOptions = [
    { value: 'dayhour', label: 'Día × hora' },
    { value: 'hour', label: 'Por hora' },
    { value: 'daypart', label: 'Franja' },
    { value: 'weekday', label: 'Día de la semana' },
  ] as const;
  protected readonly grid = computed(() => hourlyGrid(this.filter(), this.metric()));
  protected readonly heat = computed(() => {
    const grid = this.grid();
    const rows = WEEKDAY_SHORT.map((d) => d as string);
    const cols = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
    const cells: HeatCell[][] = rows.map((_, d) => cols.map((_, h) => ({ value: grid.cells[d * 24 + h]?.kpi.value ?? null, note: grid.cells[d * 24 + h]?.kpi.gap?.message })));
    const best = grid.best ? ([grid.best.weekday, grid.best.hour] as const) : null;
    return { rows, cols, cells, best };
  });
  protected readonly hourBars = computed<BarDatum[]>(() => this.grid().byHour.map((k, h) => ({ id: `h${h}`, label: `${String(h).padStart(2, '0')}h`, value: k.value, note: k.gap?.message })));
  protected readonly weekdayBars = computed<BarDatum[]>(() => this.grid().byWeekday.map((k, d) => ({ id: `d${d}`, label: WEEKDAY_SHORT[d] ?? '', value: k.value, note: k.gap?.message })));
  protected readonly partBars = computed<BarDatum[]>(() => {
    const cells = this.grid().cells;
    return PART_ORDER.map((part) => {
      const values = cells.filter((c) => dayPart(c.hour) === part && c.kpi.value !== null);
      const mean = values.length ? values.reduce((s, c) => s + (c.kpi.value ?? 0), 0) / values.length : null;
      return { id: part, label: part[0]!.toUpperCase() + part.slice(1), value: mean, note: 'Promedio simple de sus horas.' };
    });
  });
  protected readonly bestText = computed(() => {
    const b = this.grid().best;
    return b ? `Mejor franja: ${WEEKDAY_SHORT[b.weekday]} ${String(b.hour).padStart(2, '0')}:00 (${formatValue(b.value, this.def().unit)}).` : 'No hay una franja con muestra suficiente.';
  });

  // —— dispersión ——
  protected readonly relationOptions: readonly SelectOption<RelationId>[] = (Object.keys(RELATIONS) as RelationId[]).map((id) => ({ value: id, label: RELATIONS[id].label }));
  protected readonly relationId = computed<RelationId>(() => this.relation() ?? (this.metric() === 'ctr' || this.metric() === 'conversionRate' ? 'ctr-cvr' : 'spend-conv'));
  protected readonly relationDef = computed(() => RELATIONS[this.relationId()]);
  protected readonly scatter = computed(() => relationPoints(this.filter(), this.relationId()));
  protected readonly xUnit = computed(() => METRIC_CATALOG[this.relationDef().x].unit);
  protected readonly yUnit = computed(() => METRIC_CATALOG[this.relationDef().y].unit);

  // —— distribución ——
  protected readonly histogramGroups = computed(() => [{ id: 'all', label: this.def().label, values: dailyValues(this.filter(), this.metric()) }]);
  protected readonly boxGroups = computed(() =>
    this.filter().channels.map((c) => ({ id: c, label: CHANNEL_LABELS[c], values: dailyValues(this.filter(), this.metric(), c) })).filter((g) => g.values.length > 0),
  );

  // —— cohortes ——
  protected readonly cohort = computed(() => {
    const cohorts = buildCohorts(selectFacts(this.filter()));
    return {
      rows: cohorts.map((c) => `Sem. ${shortDate(c.weekStart)}`),
      meta: cohorts.map((c) => c.size.toLocaleString('es-BO')),
      cols: Array.from({ length: COHORT_WEEKS }, (_, k) => `S${k}`),
      cells: cohorts.map((c) => c.retention.map((v): HeatCell => ({ value: v, note: v === null ? 'Esa semana aún no termina.' : undefined }))),
    };
  });

  protected readonly hasControls = computed(() => ['line', 'area', 'heatmap', 'scatter'].includes(this.chart()));
  protected setTimeView(v: string): void { this.timeView.set(v as TimeView); }
  protected toggle(signalRef: { set(v: boolean): void }, event: Event): void { signalRef.set((event.target as HTMLInputElement).checked); }
  protected setRelation(r: RelationId | null): void { this.relation.set(r); }
}
