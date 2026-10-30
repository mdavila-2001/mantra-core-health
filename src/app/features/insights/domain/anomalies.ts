import { CAMPAIGNS, CAMPAIGN_BY_ID } from './campaigns.data';
import { addDays, daysBetween, PROTOTYPE_TODAY } from './dates';
import type { Channel, InsightsFilter, MetricId } from './insights.types';
import { CHANNELS } from './insights.types';
import { buildScope, computeKpi, selectFacts, timeSeries } from './kpi';
import { METRIC_CATALOG } from './metric-catalog';

/* ============================================================================
    Detección estadística de cambios.

    Compara una ventana reciente con una ventana base y exige DOS cosas antes
    de proponer una señal: que el cambio sea relevante en magnitud, y que sea
    improbable como ruido (puntuación z sobre la variabilidad diaria de la
    base). Un cambio grande en una serie muy ruidosa no se promociona a alerta.

    Este módulo detecta y mide. No decide la gravedad ni explica la causa: eso
    lo hace `alerts.ts`, que además etiqueta las causas como hipótesis.
    ========================================================================== */

export interface Shift {
  readonly campaignId: string;
  readonly channel: Channel | null;
  readonly metric: MetricId;
  readonly recent: number;
  readonly baseline: number;
  /** Cambio relativo (0.42 = +42 %). */
  readonly change: number;
  readonly z: number;
  readonly harmful: boolean;
  readonly recentDays: number;
  readonly baselineDays: number;
  readonly recentSeries: readonly number[];
}

export const RECENT_DAYS = 5;
export const BASELINE_DAYS = 14;

const WATCHED: readonly MetricId[] = ['cac', 'cpa', 'cpm', 'ctr', 'conversionRate', 'roas'];

function dailyValues(filter: InsightsFilter, metric: MetricId): number[] {
  return timeSeries({ ...filter, grain: 'day' }, metric)
    .map((p) => p.kpi.value)
    .filter((v): v is number => v !== null);
}

function stats(values: readonly number[]): { mean: number; sd: number } {
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const sd = values.length > 1 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)) : 0;
  return { mean, sd };
}

export function detectShift(
  campaignId: string,
  channel: Channel | null,
  metric: MetricId,
  endDate: string = PROTOTYPE_TODAY,
): Shift | null {
  const channels: readonly Channel[] = channel ? [channel] : CHANNELS;
  const recentRange = { from: addDays(endDate, -(RECENT_DAYS - 1)), to: endDate };
  const baseRange = { from: addDays(endDate, -(RECENT_DAYS + BASELINE_DAYS - 1)), to: addDays(endDate, -RECENT_DAYS) };
  const base: Omit<InsightsFilter, 'range'> = { campaignIds: [campaignId], grain: 'day', channels, metric };
  const recent = computeKpi({ ...base, range: recentRange }, metric);
  const baseline = computeKpi({ ...base, range: baseRange }, metric);
  if (recent.value === null || baseline.value === null || baseline.value === 0) return null;
  if (recent.sampleDays < RECENT_DAYS || baseline.sampleDays < 7) return null;

  const baseSeries = dailyValues({ ...base, range: baseRange }, metric);
  const recentSeries = dailyValues({ ...base, range: recentRange }, metric);
  if (baseSeries.length < 7 || recentSeries.length < RECENT_DAYS) return null;
  const { mean, sd } = stats(baseSeries);
  const recentMean = recentSeries.reduce((s, v) => s + v, 0) / recentSeries.length;
  const z = sd === 0 ? 0 : (recentMean - mean) / (sd / Math.sqrt(recentSeries.length));
  const change = (recent.value - baseline.value) / baseline.value;
  const goodWhen = METRIC_CATALOG[metric].goodWhen;
  const harmful = goodWhen === 'down' ? change > 0 : goodWhen === 'up' ? change < 0 : false;
  return {
    campaignId,
    channel,
    metric,
    recent: recent.value,
    baseline: baseline.value,
    change,
    z,
    harmful,
    recentDays: recent.sampleDays,
    baselineDays: baseline.sampleDays,
    recentSeries,
  };
}

/** Un cambio es señal si es grande Y improbable como ruido. */
export function isSignal(shift: Shift, minChange = 0.15, minZ = 2): boolean {
  return Math.abs(shift.change) >= minChange && Math.abs(shift.z) >= minZ;
}

/** Último día con dato de una campaña, o `null` si dejó de pautar hace más de una semana. */
export function lastActiveDay(campaignId: string, today: string = PROTOTYPE_TODAY): string | null {
  const campaign = CAMPAIGN_BY_ID.get(campaignId);
  if (!campaign) return null;
  const end = campaign.endDate < today ? campaign.endDate : today;
  return daysBetween(end, today) <= 7 ? end : null;
}

/** Todos los cambios relevantes de las campañas con actividad reciente. */
export function detectAllShifts(today: string = PROTOTYPE_TODAY): Shift[] {
  const out: Shift[] = [];
  for (const campaign of CAMPAIGNS) {
    const end = lastActiveDay(campaign.id, today);
    if (!end) continue;
    for (const metric of WATCHED) {
      const overall = detectShift(campaign.id, null, metric, end);
      if (overall && isSignal(overall)) out.push(overall);
    }
    for (const channel of CHANNELS) {
      for (const metric of ['ctr', 'cpm'] as const) {
        const shift = detectShift(campaign.id, channel, metric, end);
        if (shift && isSignal(shift, 0.25, 2.5)) out.push(shift);
      }
    }
  }
  return out;
}

export interface StageShift {
  readonly campaignId: string;
  /** Proporción de quienes se registraron y NO llegaron a activarse. */
  readonly abandonmentRecent: number;
  readonly abandonmentBaseline: number;
  readonly change: number;
  readonly registrations: number;
}

/** Abandono del onboarding = 1 − activaciones ÷ registros, ventana reciente de 10 días contra 14 previos. */
export function detectOnboardingShift(campaignId: string, endDate: string = PROTOTYPE_TODAY): StageShift | null {
  const recent = buildScope(
    selectFacts({ campaignIds: [campaignId], channels: CHANNELS, range: { from: addDays(endDate, -9), to: endDate } }),
  );
  const base = buildScope(
    selectFacts({ campaignIds: [campaignId], channels: CHANNELS, range: { from: addDays(endDate, -23), to: addDays(endDate, -10) } }),
  );
  if (recent.all.registrations < 100 || base.all.registrations < 100) return null;
  const a1 = 1 - recent.all.activations / recent.all.registrations;
  const a0 = 1 - base.all.activations / base.all.registrations;
  if (a0 <= 0) return null;
  return { campaignId, abandonmentRecent: a1, abandonmentBaseline: a0, change: (a1 - a0) / a0, registrations: recent.all.registrations };
}
