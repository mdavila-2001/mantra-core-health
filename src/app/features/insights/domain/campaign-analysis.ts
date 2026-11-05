import type { Band, BarDatum, ChartMilestone, LineSeries, RefLine, StackRow, StackSegment } from '../charts/chart.types';
import type { ScatterPoint } from '../charts/scatter-chart';
import { resolveBenchmarks } from './benchmarks';
import { CAMPAIGN_BY_ID, MILESTONES } from './campaigns.data';
import { addDays, daysBetween, shortDate } from './dates';
import type { Channel, InsightsFilter, KpiValue, MetricId, TimeGrain } from './insights.types';
import { CHANNEL_LABELS, CHANNELS, PAID_CHANNELS } from './insights.types';
import { breakdown, buildScope, computeKpi, previousRange, selectFacts, timeSeries } from './kpi';
import { METRIC_CATALOG } from './metric-catalog';

/* ============================================================================
    Modelos de datos del módulo «Resumen de campañas». Cada función devuelve
    exactamente lo que un gráfico necesita, ya medido: los componentes de
    gráfico no calculan negocio.
    ========================================================================== */

export function bucketLabel(bucket: string, grain: TimeGrain): string {
  if (grain === 'day') return shortDate(bucket);
  if (grain === 'week') return `Sem. ${shortDate(bucket)}`;
  return `${shortDate(bucket).split(' ')[1]} ${bucket.slice(0, 4)}`;
}

export interface MainChartModel {
  readonly labels: string[];
  readonly series: LineSeries[];
  readonly refs: RefLine[];
  readonly band: Band | null;
  readonly compare: (number | null)[] | null;
  /** Hitos de las campañas elegidas que caen dentro del periodo, ubicados en su cubeta. */
  readonly milestones: ChartMilestone[];
  readonly points: number;
}

/** Líneas de referencia de una métrica: benchmark, objetivo y umbrales de alerta. */
export function referenceLines(filter: InsightsFilter, metric: MetricId): RefLine[] {
  const set = resolveBenchmarks(filter, metric);
  const def = METRIC_CATALOG[metric];
  const refs: RefLine[] = [];
  if (def.kind === 'volume' || def.kind === 'duration') return refs;
  const target = set.campaign ?? set.strategic;
  if (set.historical) refs.push({ id: 'bm', label: 'Benchmark', value: set.historical.value, kind: 'benchmark' });
  if (target) {
    refs.push({ id: 'tg', label: 'Objetivo', value: target.value, kind: 'target' });
    if (def.goodWhen === 'down') {
      refs.push({ id: 'al', label: 'Alerta', value: target.value * 1.15, kind: 'alert' });
      refs.push({ id: 'cr', label: 'Crítico', value: target.value * 1.3, kind: 'critical' });
    } else if (def.goodWhen === 'up') {
      refs.push({ id: 'al', label: 'Alerta', value: target.value * 0.9, kind: 'alert' });
      refs.push({ id: 'cr', label: 'Crítico', value: target.value * 0.75, kind: 'critical' });
    }
  }
  return refs;
}

/**
 * Ubica cada hito de las campañas elegidas en la cubeta del gráfico que lo contiene
 * (la última cubeta que empieza en o antes de su fecha). Los hitos fuera del periodo no se marcan.
 */
export function milestonesOn(buckets: readonly string[], filter: InsightsFilter): ChartMilestone[] {
  if (buckets.length === 0) return [];
  const out: ChartMilestone[] = [];
  for (const m of MILESTONES) {
    if (!filter.campaignIds.includes(m.campaignId)) continue;
    if (m.date < filter.range.from || m.date > filter.range.to) continue;
    let index = -1;
    buckets.forEach((b, i) => {
      if (b <= m.date) index = i;
    });
    if (index >= 0) out.push({ index, label: m.label });
  }
  return out;
}

export function mainChartModel(
  filter: InsightsFilter,
  metric: MetricId,
  options: { split: 'none' | 'channel'; compare: boolean; band: boolean },
): MainChartModel {
  const base = timeSeries(filter, metric);
  const labels = base.map((p) => bucketLabel(p.bucket, filter.grain));
  const valueOf = (k: KpiValue): number | null => k.value;

  let series: LineSeries[];
  if (options.split === 'channel') {
    const channels = filter.channels.filter((c) => (METRIC_CATALOG[metric].channels ?? CHANNELS).includes(c));
    const ranked = channels
      .map((c) => ({ c, v: computeKpi({ ...filter, channels: [c] }, 'impressions').value ?? 0 }))
      .sort((a, b) => b.v - a.v)
      .slice(0, 5)
      .map((x) => x.c);
    const byBucket = new Map(base.map((p, i) => [p.bucket, i]));
    series = ranked.map((channel, k) => {
      const values: (number | null)[] = base.map(() => null);
      for (const p of timeSeries({ ...filter, channels: [channel] }, metric)) {
        const i = byBucket.get(p.bucket);
        if (i !== undefined) values[i] = valueOf(p.kpi);
      }
      return { id: channel, label: CHANNEL_LABELS[channel], values, color: k + 1 };
    });
  } else {
    series = [{ id: metric, label: METRIC_CATALOG[metric].label, values: base.map((p) => valueOf(p.kpi)), color: 1 }];
  }

  let compare: (number | null)[] | null = null;
  if (options.compare && options.split === 'none') {
    const prev = timeSeries({ ...filter, range: previousRange(filter.range) }, metric);
    if (prev.some((p) => p.kpi.value !== null)) {
      compare = base.map((_, i) => prev[i]?.kpi.value ?? null);
    }
  }

  let band: Band | null = null;
  if (options.band && filter.grain === 'day') {
    const stat = resolveBenchmarks(filter, metric).statistical;
    if (stat) band = { low: stat.low, high: stat.high, label: 'Rango normal' };
  }
  return {
    labels,
    series,
    refs: referenceLines(filter, metric),
    band,
    compare,
    milestones: milestonesOn(base.map((p) => p.bucket), filter),
    points: base.length,
  };
}

/** Una métrica por canal, lista para barras. */
export function channelBars(filter: InsightsFilter, metric: MetricId): { data: BarDatum[]; ref: RefLine | null } {
  const rows = breakdown({ ...filter, channels: filter.channels }, 'channel', metric);
  const applicable = METRIC_CATALOG[metric].channels;
  const present = new Set(rows.map((r) => r.key));
  const data: BarDatum[] = rows.map((r) => ({
    id: r.key,
    label: CHANNEL_LABELS[r.key as Channel],
    value: r.kpi.value,
    note: r.kpi.gap?.message,
  }));
  for (const channel of filter.channels) {
    if (!present.has(channel) && applicable && !applicable.includes(channel)) {
      data.push({ id: channel, label: CHANNEL_LABELS[channel], value: null, note: 'La métrica no aplica a este canal.' });
    }
  }
  const refs = referenceLines(filter, metric);
  return { data, ref: refs.find((r) => r.kind === 'target') ?? refs.find((r) => r.kind === 'benchmark') ?? null };
}

export interface ComparisonRow {
  readonly campaignId: string;
  readonly name: string;
  readonly values: Readonly<Record<string, KpiValue>>;
}

/** Campañas lado a lado en el mismo periodo (el de cada campaña recortado a sus fechas). */
export function compareCampaigns(ids: readonly string[], channels: readonly Channel[], metrics: readonly MetricId[]): ComparisonRow[] {
  return ids.flatMap((id) => {
    const c = CAMPAIGN_BY_ID.get(id);
    if (!c) return [];
    const filter: InsightsFilter = {
      campaignIds: [id],
      range: { from: c.startDate, to: c.endDate },
      grain: 'day',
      channels,
      metric: metrics[0] ?? 'ctr',
    };
    return [{ campaignId: id, name: c.name, values: Object.fromEntries(metrics.map((m) => [m, computeKpi(filter, m)])) }];
  });
}

export type RelationId = 'ctr-cvr' | 'spend-conv';

export const RELATIONS: Readonly<Record<RelationId, { label: string; x: MetricId; y: MetricId; xLabel: string; yLabel: string }>> = {
  'ctr-cvr': { label: 'CTR frente a tasa de conversión', x: 'ctr', y: 'conversionRate', xLabel: 'CTR', yLabel: 'Tasa de conversión' },
  'spend-conv': { label: 'Inversión frente a conversiones', x: 'spend', y: 'conversions', xLabel: 'Inversión diaria', yLabel: 'Conversiones diarias' },
};

export function relationPoints(filter: InsightsFilter, relation: RelationId): ScatterPoint[] {
  const rel = RELATIONS[relation];
  if (relation === 'spend-conv') {
    const paid = filter.channels.filter((c) => PAID_CHANNELS.includes(c));
    const xs = timeSeries({ ...filter, channels: paid, grain: 'day' }, 'spend');
    const ys = timeSeries({ ...filter, channels: paid, grain: 'day' }, 'conversions');
    const yBy = new Map(ys.map((p) => [p.bucket, p.kpi.value]));
    return xs.flatMap((p) => {
      const y = yBy.get(p.bucket);
      return p.kpi.value !== null && y !== null && y !== undefined ? [{ id: p.bucket, label: shortDate(p.bucket), x: p.kpi.value, y }] : [];
    });
  }
  const out: ScatterPoint[] = [];
  filter.channels.forEach((channel, k) => {
    const f = { ...filter, channels: [channel], grain: 'week' as const };
    const xs = timeSeries(f, rel.x);
    const yBy = new Map(timeSeries(f, rel.y).map((p) => [p.bucket, p.kpi.value]));
    for (const p of xs) {
      const y = yBy.get(p.bucket);
      if (p.kpi.value !== null && y !== null && y !== undefined) {
        out.push({ id: `${channel}-${p.bucket}`, label: `${CHANNEL_LABELS[channel]} · ${bucketLabel(p.bucket, 'week')}`, x: p.kpi.value, y, color: (k % 6) + 1 });
      }
    }
  });
  return out;
}

/** Valores diarios de una métrica, para histograma y caja. */
export function dailyValues(filter: InsightsFilter, metric: MetricId, channel?: Channel): number[] {
  return timeSeries({ ...filter, channels: channel ? [channel] : filter.channels, grain: 'day' }, metric)
    .map((p) => p.kpi.value)
    .filter((v): v is number => v !== null);
}

/** Composición por canal a lo largo del tiempo (solo métricas sumables). */
export function compositionByChannel(filter: InsightsFilter, metric: MetricId): { rows: StackRow[]; segments: StackSegment[] } {
  const facts = selectFacts(filter);
  const totals = new Map<Channel, number>();
  for (const f of facts) totals.set(f.channel, (totals.get(f.channel) ?? 0) + f.impressions);
  const top = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
  const grain: TimeGrain = filter.grain === 'day' ? 'week' : filter.grain;
  const rowsMap = new Map<string, Record<string, number>>();
  for (const channel of top) {
    for (const p of timeSeries({ ...filter, channels: [channel], grain }, metric)) {
      const row = rowsMap.get(p.bucket) ?? {};
      row[channel] = p.kpi.value ?? 0;
      rowsMap.set(p.bucket, row);
    }
  }
  const rows = [...rowsMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([bucket, values]) => ({ id: bucket, label: bucketLabel(bucket, grain), values }));
  const segments = top.map((channel, k) => ({ id: channel, label: CHANNEL_LABELS[channel], color: k + 1 }));
  return { rows, segments };
}

/** Días de la campaña transcurridos y totales, para el ritmo de inversión. */
export function pacing(campaignId: string, filter: InsightsFilter): { spentPct: number; elapsedPct: number } | null {
  const c = CAMPAIGN_BY_ID.get(campaignId);
  if (!c) return null;
  const spent = buildScope(selectFacts({ ...filter, campaignIds: [campaignId], range: { from: c.startDate, to: addDays(c.endDate, 0) } })).all.spendCents;
  const total = daysBetween(c.startDate, c.endDate) + 1;
  const elapsed = Math.min(total, Math.max(0, daysBetween(c.startDate, filter.range.to) + 1));
  return { spentPct: spent / c.budgetCents, elapsedPct: elapsed / total };
}
