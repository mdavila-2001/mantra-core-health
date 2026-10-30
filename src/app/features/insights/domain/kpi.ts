import { allFacts } from './synthetic-facts';
import { CAMPAIGN_ECONOMICS } from './campaigns.data';
import { addDays, daysBetween, monthStart, weekStart } from './dates';
import type {
  AdditiveField,
  Channel,
  DailyFact,
  DateRange,
  GapReason,
  InsightsFilter,
  KpiValue,
  MetricId,
  TimeGrain,
} from './insights.types';
import { PAID_CHANNELS, VIDEO_CHANNELS } from './insights.types';
import { METRIC_CATALOG } from './metric-catalog';
import { retentionD30 } from './cohorts';

/* ============================================================================
    Cálculo de KPI.

    Reglas estadísticas que este archivo hace cumplir:
      · Una tasa se calcula desde SUMAS (Σ clics ÷ Σ impresiones), nunca como
        promedio de tasas diarias: el promedio de razones pesa igual a un día
        de 300 impresiones que a uno de 90.000.
      · El alcance NO se suma entre días. Se estima el alcance único con el
        modelo de solapamiento aleatorio  N·(1 − Π(1 − rᵢ/N)),  y la cifra queda
        marcada como estimada.
      · Sin denominador o con muestra por debajo del mínimo el valor es `null`
        con un motivo. Jamás se rellena con 0.
    ========================================================================== */

/** Audiencia direccionable sintética por canal (personas), para el alcance único. */
const AUDIENCE: Readonly<Record<Channel, number>> = {
  instagram: 900_000,
  facebook: 1_200_000,
  tiktok: 700_000,
  youtube: 500_000,
  google: 800_000,
  web: 150_000,
  app: 80_000,
  email: 40_000,
};
const TOTAL_AUDIENCE = 3_200_000;

/** Costo de producción creativa y comisiones por encima de la inversión de medios (CAC). */
export const OVERHEAD_RATE = 0.18;

type Sums = Readonly<Record<AdditiveField, number>>;

const FIELDS: readonly AdditiveField[] = [
  'impressions',
  'engagements',
  'clicks',
  'videoViews',
  'watchSeconds',
  'visits',
  'leads',
  'registrations',
  'activations',
  'firstUses',
  'conversions',
  'spendCents',
  'revenueCents',
];

function emptySums(): Record<AdditiveField, number> {
  return Object.fromEntries(FIELDS.map((f) => [f, 0])) as Record<AdditiveField, number>;
}

function sumFacts(facts: readonly DailyFact[]): Sums {
  const acc = emptySums();
  for (const fact of facts) for (const f of FIELDS) acc[f] += fact[f];
  return acc;
}

/** Alcance único estimado de un conjunto de hechos. */
export function estimateUniqueReach(facts: readonly DailyFact[]): number {
  const dailyByChannel = new Map<Channel, Map<string, number>>();
  for (const fact of facts) {
    const byDate = dailyByChannel.get(fact.channel) ?? new Map<string, number>();
    byDate.set(fact.date, (byDate.get(fact.date) ?? 0) + fact.reach);
    dailyByChannel.set(fact.channel, byDate);
  }
  let missAll = 1;
  for (const [channel, byDate] of dailyByChannel) {
    const n = AUDIENCE[channel];
    let miss = 1;
    for (const daily of byDate.values()) miss *= 1 - Math.min(daily, n) / n;
    const uniqueChannel = n * (1 - miss);
    missAll *= 1 - Math.min(uniqueChannel, TOTAL_AUDIENCE) / TOTAL_AUDIENCE;
  }
  return Math.round(TOTAL_AUDIENCE * (1 - missAll));
}

interface Scope {
  readonly facts: readonly DailyFact[];
  readonly all: Sums;
  readonly paid: Sums;
  readonly video: Sums;
  readonly uniqueReach: number;
  readonly paidUniqueReach: number;
  readonly days: number;
}

export function buildScope(facts: readonly DailyFact[]): Scope {
  const paidFacts = facts.filter((f) => PAID_CHANNELS.includes(f.channel));
  const videoFacts = facts.filter((f) => VIDEO_CHANNELS.includes(f.channel));
  return {
    facts,
    all: sumFacts(facts),
    paid: sumFacts(paidFacts),
    video: sumFacts(videoFacts),
    uniqueReach: estimateUniqueReach(facts),
    paidUniqueReach: estimateUniqueReach(paidFacts),
    days: new Set(facts.map((f) => f.date)).size,
  };
}

/** Hechos que cumplen el filtro (campañas, canales y rango). */
export function selectFacts(
  filter: Pick<InsightsFilter, 'campaignIds' | 'channels'> & { range: DateRange },
): DailyFact[] {
  const campaigns = new Set(filter.campaignIds);
  const channels = new Set<Channel>(filter.channels);
  return allFacts().filter(
    (f) =>
      campaigns.has(f.campaignId) &&
      channels.has(f.channel) &&
      f.date >= filter.range.from &&
      f.date <= filter.range.to,
  );
}

function gap(metric: MetricId, reason: GapReason, message: string, days: number): KpiValue {
  return { metric, value: null, numerator: null, denominator: null, gap: { reason, message }, sampleDays: days, estimated: false };
}

function ratio(
  metric: MetricId,
  numerator: number,
  denominator: number,
  scale: number,
  days: number,
  noDenominator: { reason: GapReason; message: string },
  estimated = false,
): KpiValue {
  const minSample = METRIC_CATALOG[metric].minSample;
  if (denominator <= 0) return gap(metric, noDenominator.reason, noDenominator.message, days);
  if (denominator < minSample) {
    return gap(
      metric,
      'insufficient-sample',
      `La base (${Math.round(denominator).toLocaleString('es-BO')}) es menor al mínimo de ${minSample.toLocaleString('es-BO')} para publicar esta cifra.`,
      days,
    );
  }
  return { metric, value: (numerator / denominator) * scale, numerator, denominator, gap: null, sampleDays: days, estimated };
}

/** Un conteo medido es un conteo: no necesita muestra mínima (cero también es una medición). */
function plain(metric: MetricId, value: number, days: number, estimated = false): KpiValue {
  return { metric, value, numerator: null, denominator: null, gap: null, sampleDays: days, estimated };
}

const NO_PAID = { reason: 'not-applicable' as const, message: 'Sin canales pagados en la selección: el costo no aplica.' };
const NO_VIDEO = { reason: 'not-applicable' as const, message: 'Sin canales de vídeo en la selección.' };
const NO_BASE = { reason: 'no-denominator' as const, message: 'Sin base de cálculo en el periodo.' };

/** Calcula una métrica sobre un ámbito ya construido. */
export function computeMetric(metric: MetricId, scope: Scope, campaignIds: readonly string[]): KpiValue {
  const d = scope.days;
  if (scope.facts.length === 0) return gap(metric, 'no-data', 'No hay datos para la selección y el periodo.', 0);
  const a = scope.all;
  const p = scope.paid;
  switch (metric) {
    case 'reach':
      return plain('reach', scope.uniqueReach, d, true);
    case 'impressions':
      return plain('impressions', a.impressions, d);
    case 'frequency':
      return p.impressions === 0
        ? gap('frequency', NO_PAID.reason, NO_PAID.message, d)
        : ratio('frequency', p.impressions, scope.paidUniqueReach, 1, d, NO_BASE, true);
    case 'cpm':
      return p.impressions === 0
        ? gap('cpm', NO_PAID.reason, NO_PAID.message, d)
        : ratio('cpm', p.spendCents, p.impressions, 1000, d, NO_BASE);
    case 'cpc':
      return p.clicks === 0
        ? gap('cpc', NO_PAID.reason, NO_PAID.message, d)
        : ratio('cpc', p.spendCents, p.clicks, 1, d, NO_BASE);
    case 'ctr':
      return ratio('ctr', a.clicks, a.impressions, 1, d, NO_BASE);
    case 'clicks':
      return plain('clicks', a.clicks, d);
    case 'engagement':
      return plain('engagement', a.engagements, d);
    case 'engagementRate':
      return ratio('engagementRate', a.engagements, a.impressions, 1, d, NO_BASE);
    case 'videoViews':
      return scope.video.impressions === 0
        ? gap('videoViews', NO_VIDEO.reason, NO_VIDEO.message, d)
        : plain('videoViews', scope.video.videoViews, d);
    case 'watchTime':
      return scope.video.videoViews === 0
        ? gap('watchTime', NO_VIDEO.reason, NO_VIDEO.message, d)
        : ratio('watchTime', scope.video.watchSeconds, scope.video.videoViews, 1, d, NO_BASE);
    case 'leads':
      return plain('leads', a.leads, d);
    case 'registrations':
      return plain('registrations', a.registrations, d);
    case 'conversions':
      return plain('conversions', a.conversions, d);
    case 'conversionRate':
      return ratio('conversionRate', a.conversions, a.visits, 1, d, NO_BASE);
    case 'cpa':
      return p.spendCents === 0
        ? gap('cpa', 'no-spend', 'Sin inversión de medios en el periodo.', d)
        : ratio('cpa', p.spendCents, p.conversions, 1, d, { reason: 'no-denominator', message: 'Hubo inversión pero ninguna conversión: el costo por resultado no está definido.' });
    case 'cac':
      return p.spendCents === 0
        ? gap('cac', 'no-spend', 'Sin inversión de medios en el periodo.', d)
        : ratio('cac', p.spendCents * (1 + OVERHEAD_RATE), p.activations, 1, d, NO_BASE);
    case 'retention': {
      const r = retentionD30(campaignIds, scope.facts);
      return r === null
        ? gap('retention', 'insufficient-sample', 'Aún no hay cohortes con 30 días de antigüedad en el periodo.', d)
        : { metric, value: r.rate, numerator: r.retained, denominator: r.cohortSize, gap: null, sampleDays: d, estimated: true };
    }
    case 'roas':
      return p.spendCents === 0
        ? gap('roas', 'no-spend', 'Sin inversión de medios en el periodo.', d)
        : ratio('roas', p.revenueCents, p.spendCents, 1, d, NO_BASE);
    case 'spend':
      return p.spendCents === 0 ? gap('spend', NO_PAID.reason, NO_PAID.message, d) : plain('spend', a.spendCents, d);
    case 'revenue':
      return plain('revenue', a.revenueCents, d);
  }
}

/** KPI de un filtro completo. */
export function computeKpi(filter: InsightsFilter, metric: MetricId = filter.metric): KpiValue {
  const facts = selectFacts(filter);
  return computeMetric(metric, buildScope(facts), filter.campaignIds);
}

/** Periodo inmediatamente anterior y de igual duración. */
export function previousRange(range: DateRange): DateRange {
  const length = daysBetween(range.from, range.to) + 1;
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

export interface SeriesPoint {
  readonly bucket: string;
  readonly kpi: KpiValue;
}

function bucketOf(date: string, grain: TimeGrain): string {
  return grain === 'day' ? date : grain === 'week' ? weekStart(date) : monthStart(date);
}

/** Serie temporal de una métrica: cada punto se calcula desde las sumas de su cubeta. */
export function timeSeries(filter: InsightsFilter, metric: MetricId = filter.metric): SeriesPoint[] {
  const facts = selectFacts(filter);
  const buckets = new Map<string, DailyFact[]>();
  for (const fact of facts) {
    const key = bucketOf(fact.date, filter.grain);
    const list = buckets.get(key) ?? [];
    list.push(fact);
    buckets.set(key, list);
  }
  return [...buckets.keys()]
    .sort()
    .map((bucket) => ({ bucket, kpi: computeMetric(metric, buildScope(buckets.get(bucket) ?? []), filter.campaignIds) }));
}

export interface BreakdownRow {
  readonly key: string;
  readonly kpi: KpiValue;
}

/** Una métrica por canal o por campaña. */
export function breakdown(
  filter: InsightsFilter,
  dimension: 'channel' | 'campaign',
  metric: MetricId = filter.metric,
): BreakdownRow[] {
  const facts = selectFacts(filter);
  const groups = new Map<string, DailyFact[]>();
  for (const fact of facts) {
    const key = dimension === 'channel' ? fact.channel : fact.campaignId;
    const list = groups.get(key) ?? [];
    list.push(fact);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([key, list]) => ({
    key,
    kpi: computeMetric(metric, buildScope(list), dimension === 'campaign' ? [key] : filter.campaignIds),
  }));
}

/** Ingresos por conversión de una campaña (para LTV). */
export function revenuePerConversion(campaignId: string): number {
  return CAMPAIGN_ECONOMICS[campaignId]?.revenuePerConversionCents ?? 0;
}
