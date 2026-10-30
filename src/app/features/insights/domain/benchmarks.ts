import { CAMPAIGN_BY_ID } from './campaigns.data';
import { addDays, daysBetween, PROTOTYPE_TODAY } from './dates';
import type {
  Benchmark,
  DateRange,
  HealthStatus,
  InsightsFilter,
  KpiAssessment,
  KpiValue,
  MetricId,
} from './insights.types';
import { computeKpi, previousRange, timeSeries } from './kpi';
import { METRIC_CATALOG } from './metric-catalog';

/* ============================================================================
    Benchmarks y estados.

    Un benchmark no se inventa: declara de dónde sale. Cinco fuentes, y cada una
    dice qué tan firme es:

      historical   — cómo se comportó AloVida en los 60 días previos (calculado)
      campaign     — el objetivo que esa campaña se fijó (dato de la campaña)
      strategic    — lo que AloVida necesita alcanzar (meta de la dirección)
      sector       — organizaciones comparables. EN EL PROTOTIPO NO HAY FUENTE
                     VERIFICADA: se rotula como referencia de prototipo y
                     `verified` es false. Nunca se presenta como dato de mercado.
      statistical  — banda normal: media ± 2 desviaciones de los 28 días previos
    ========================================================================== */

const STRATEGIC: Readonly<Partial<Record<MetricId, number>>> = {
  ctr: 0.022,
  cpa: 7000,
  cac: 3000,
  roas: 2.5,
  conversionRate: 0.018,
  retention: 0.5,
  engagementRate: 0.035,
};

const SECTOR_REFERENCE: Readonly<Partial<Record<MetricId, number>>> = {
  ctr: 0.0185,
  cpm: 2000,
  cpc: 110,
  engagementRate: 0.032,
  conversionRate: 0.015,
  retention: 0.35,
  frequency: 2.5,
};

export interface BenchmarkSet {
  readonly historical: Benchmark | null;
  readonly campaign: Benchmark | null;
  readonly strategic: Benchmark | null;
  readonly sector: Benchmark | null;
  readonly statistical: (Benchmark & { readonly low: number; readonly high: number }) | null;
}

const HISTORY_DAYS = 60;
const BAND_DAYS = 28;

function priorRange(range: DateRange, days: number): DateRange {
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}

export function resolveBenchmarks(filter: InsightsFilter, metric: MetricId): BenchmarkSet {
  const historyFilter: InsightsFilter = {
    ...filter,
    range: priorRange(filter.range, HISTORY_DAYS),
    campaignIds: allCampaignIds(),
  };
  const history = computeKpi(historyFilter, metric);
  // Un volumen (alcance, clics, leads…) depende del presupuesto y de cuántos días dura
  // la ventana: compararlo con el volumen de otras campañas no dice nada. Los volúmenes
  // se juzgan contra su objetivo o contra el periodo anterior de la MISMA selección.
  const isVolume = METRIC_CATALOG[metric].kind === 'volume' || METRIC_CATALOG[metric].kind === 'duration';
  const historical: Benchmark | null =
    isVolume || history.value === null
      ? null
      : {
          source: 'historical',
          value: history.value,
          note: `Promedio de los ${HISTORY_DAYS} días anteriores (${history.sampleDays} días con dato).`,
          verified: true,
        };

  const only = filter.campaignIds.length === 1 ? CAMPAIGN_BY_ID.get(filter.campaignIds[0] ?? '') : undefined;
  const targetValue = only?.targets[metric];
  const campaign: Benchmark | null =
    targetValue === undefined ? null : { source: 'campaign', value: targetValue, note: `Objetivo de «${only?.name}».`, verified: true };

  const strategicValue = STRATEGIC[metric];
  const strategic: Benchmark | null =
    strategicValue === undefined
      ? null
      : { source: 'strategic', value: strategicValue, note: 'Meta de la dirección de marketing (propuesta, pendiente de ratificar).', verified: false };

  const sectorValue = SECTOR_REFERENCE[metric];
  const sector: Benchmark | null =
    sectorValue === undefined
      ? null
      : { source: 'sector', value: sectorValue, note: 'Referencia de prototipo. Sin fuente verificada: no usar como dato de mercado.', verified: false };

  const bandFilter: InsightsFilter = { ...filter, range: priorRange(filter.range, BAND_DAYS), grain: 'day', campaignIds: allCampaignIds() };
  const values = timeSeries(bandFilter, metric)
    .map((p) => p.kpi.value)
    .filter((v): v is number => v !== null);
  let statistical: BenchmarkSet['statistical'] = null;
  if (values.length >= 7) {
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const sd = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
    statistical = {
      source: 'statistical',
      value: mean,
      low: Math.max(0, mean - 2 * sd),
      high: mean + 2 * sd,
      note: `Media ± 2 desviaciones de ${values.length} días previos.`,
      verified: true,
    };
  }
  return { historical, campaign, strategic, sector, statistical };
}

function allCampaignIds(): readonly string[] {
  return [...CAMPAIGN_BY_ID.keys()];
}

/** Punto de comparación principal: objetivo de campaña > estratégico > histórico > sectorial. */
export function primaryReference(set: BenchmarkSet): { benchmark: Benchmark | null; target: Benchmark | null } {
  return {
    target: set.campaign ?? set.strategic,
    benchmark: set.historical ?? set.sector,
  };
}

function relativeChange(value: number, reference: number): number | null {
  return reference === 0 ? null : (value - reference) / reference;
}

function statusFromRatio(ratio: number): HealthStatus {
  if (ratio >= 1) return 'optimal';
  if (ratio >= 0.9) return 'acceptable';
  if (ratio >= 0.75) return 'alert';
  return 'critical';
}

/** Evalúa una cifra contra su objetivo (o su benchmark) respetando el sentido bueno/malo. */
export function judge(
  kpi: KpiValue,
  target: Benchmark | null,
  benchmark: Benchmark | null,
  filter: InsightsFilter,
  previous: number | null = null,
): { status: HealthStatus; reason: string } {
  const def = METRIC_CATALOG[kpi.metric];
  if (kpi.value === null) return { status: 'insufficient', reason: kpi.gap?.message ?? 'Sin dato.' };
  if (kpi.sampleDays < 3) return { status: 'insufficient', reason: 'Menos de 3 días con dato: no alcanza para juzgar.' };

  if (kpi.metric === 'frequency') {
    const v = kpi.value;
    if (v <= 3) return { status: 'optimal', reason: 'Frecuencia dentro del rango sano (hasta 3).' };
    if (v <= 4) return { status: 'acceptable', reason: 'Frecuencia en el límite alto (3 a 4).' };
    if (v <= 5) return { status: 'alert', reason: 'Riesgo de fatiga: más de 4 impresiones por persona.' };
    return { status: 'critical', reason: 'Saturación: más de 5 impresiones por persona.' };
  }
  if (kpi.metric === 'spend') return judgePacing(kpi, filter);

  if ((def.kind === 'volume') && !target) {
    if (previous === null || previous === 0) {
      return { status: 'insufficient', reason: 'Sin objetivo ni periodo anterior comparable: un volumen no se juzga solo.' };
    }
    const ratio = kpi.value / previous;
    return {
      status: statusFromRatio(def.goodWhen === 'down' ? 1 / ratio : ratio),
      reason: `${(ratio * 100).toFixed(0)} % del periodo anterior.`,
    };
  }
  const reference = target ?? benchmark;
  if (!reference || def.goodWhen === 'none') {
    return { status: 'insufficient', reason: 'No hay objetivo ni benchmark contra el cual juzgar.' };
  }
  const ratio = def.goodWhen === 'up' ? kpi.value / reference.value : reference.value / kpi.value;
  const status = statusFromRatio(ratio);
  const where = target ? 'el objetivo' : 'el benchmark';
  return { status, reason: `${(ratio * 100).toFixed(0)} % de ${where} (${reference.note})` };
}

function judgePacing(kpi: KpiValue, filter: InsightsFilter): { status: HealthStatus; reason: string } {
  const only = filter.campaignIds.length === 1 ? CAMPAIGN_BY_ID.get(filter.campaignIds[0] ?? '') : undefined;
  if (!only || kpi.value === null) {
    return { status: 'insufficient', reason: 'El ritmo de inversión se juzga contra el presupuesto de una sola campaña.' };
  }
  const total = daysBetween(only.startDate, only.endDate) + 1;
  const end = filter.range.to < PROTOTYPE_TODAY ? filter.range.to : PROTOTYPE_TODAY;
  const elapsed = Math.min(total, Math.max(1, daysBetween(only.startDate, end) + 1));
  const pacing = kpi.value / only.budgetCents / (elapsed / total);
  const text = `Ritmo de ${(pacing * 100).toFixed(0)} % frente al calendario del presupuesto.`;
  if (filter.range.from > only.startDate) {
    return { status: 'insufficient', reason: 'El ritmo se mide desde el inicio de la campaña.' };
  }
  if (pacing >= 0.9 && pacing <= 1.1) return { status: 'optimal', reason: text };
  if (pacing >= 0.8 && pacing <= 1.2) return { status: 'acceptable', reason: text };
  if (pacing >= 0.65 && pacing <= 1.35) return { status: 'alert', reason: text };
  return { status: 'critical', reason: text };
}

/** Evaluación completa de una métrica: cifra, comparaciones y estado. */
export function assess(filter: InsightsFilter, metric: MetricId = filter.metric): KpiAssessment {
  const kpi = computeKpi(filter, metric);
  const set = resolveBenchmarks(filter, metric);
  const { benchmark, target } = primaryReference(set);
  const prev = computeKpi({ ...filter, range: previousRange(filter.range) }, metric);
  const { status, reason } = judge(kpi, target, benchmark, filter, prev.value);
  return {
    kpi,
    benchmark,
    target,
    previous: prev.value,
    changeVsPrevious: kpi.value !== null && prev.value !== null ? relativeChange(kpi.value, prev.value) : null,
    changeVsBenchmark: kpi.value !== null && benchmark ? relativeChange(kpi.value, benchmark.value) : null,
    status,
    statusReason: reason,
  };
}
