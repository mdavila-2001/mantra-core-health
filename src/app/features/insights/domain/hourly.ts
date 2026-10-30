import { weekdayIndex } from './dates';
import type { AdditiveField, Channel, DailyFact, InsightsFilter, KpiValue, MetricId } from './insights.types';
import { buildScope, computeMetric, selectFacts } from './kpi';

/* ============================================================================
    Rendimiento por día de la semana y hora.

    Los datos de origen son diarios. Para repartirlos por hora se usan perfiles
    de actividad por canal y se garantiza que la suma de las 24 horas es
    EXACTAMENTE el total del día (método del mayor residuo: el redondeo nunca
    pierde ni inventa una impresión). En producción este módulo se alimenta de
    eventos con marca de hora y esta función desaparece.
    ========================================================================== */

type ShareKind = 'exposure' | 'click' | 'outcome';

/** Perfil base de actividad por hora (0–23) según el canal. */
function baseProfile(channel: Channel, hour: number): number {
  const gauss = (center: number, width: number): number => Math.exp(-((hour - center) ** 2) / (2 * width ** 2));
  switch (channel) {
    case 'tiktok':
      return 0.05 + 0.5 * gauss(13, 2.5) + 1.0 * gauss(21.5, 2.2);
    case 'google':
      return 0.04 + 1.0 * gauss(10, 2.8) + 0.55 * gauss(16, 2.5);
    case 'email':
      return 0.02 + 1.0 * gauss(8.5, 1.5) + 0.35 * gauss(18, 2);
    case 'app':
      return 0.05 + 0.6 * gauss(8, 2) + 0.9 * gauss(20, 2.5);
    default:
      return 0.05 + 0.55 * gauss(12.5, 2.2) + 1.0 * gauss(19.5, 2.4);
  }
}

/** Qué tan bien rinde una hora en cada etapa: la noche trae más volumen que intención. */
function stageMultiplier(kind: ShareKind, hour: number): number {
  if (kind === 'exposure') return 1;
  const intention = 0.75 + 0.55 * Math.exp(-((hour - 19) ** 2) / (2 * 3 ** 2)) + 0.25 * Math.exp(-((hour - 11) ** 2) / (2 * 2 ** 2));
  return kind === 'click' ? intention : intention * (0.85 + 0.3 * Math.exp(-((hour - 20) ** 2) / (2 * 2.5 ** 2)));
}

const DAY_FACTOR = [1, 1.04, 1.04, 1, 0.97, 0.88, 0.8];

const shareCache = new Map<string, number[]>();

function shares(channel: Channel, weekday: number, kind: ShareKind): number[] {
  const key = `${channel}|${weekday}|${kind}`;
  const hit = shareCache.get(key);
  if (hit) return hit;
  const raw = Array.from({ length: 24 }, (_, h) => baseProfile(channel, h) * stageMultiplier(kind, h) * (DAY_FACTOR[weekday] ?? 1));
  const total = raw.reduce((s, v) => s + v, 0);
  const normalized = raw.map((v) => v / total);
  shareCache.set(key, normalized);
  return normalized;
}

/** Reparte un entero entre 24 horas conservando la suma exacta. */
export function distribute(total: number, weights: readonly number[]): number[] {
  const raw = weights.map((w) => w * total);
  const floors = raw.map(Math.floor);
  let remainder = total - floors.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => ({ i, frac: v - Math.floor(v) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    remainder -= 1;
  }
  return floors;
}

const FIELD_KIND: Readonly<Record<AdditiveField, ShareKind>> = {
  impressions: 'exposure',
  engagements: 'exposure',
  videoViews: 'exposure',
  watchSeconds: 'exposure',
  spendCents: 'exposure',
  clicks: 'click',
  visits: 'click',
  leads: 'outcome',
  registrations: 'outcome',
  activations: 'outcome',
  firstUses: 'outcome',
  conversions: 'outcome',
  revenueCents: 'outcome',
};

const FIELDS = Object.keys(FIELD_KIND) as AdditiveField[];

export interface HourCell {
  readonly weekday: number;
  readonly hour: number;
  readonly kpi: KpiValue;
}

export interface HourlyResult {
  readonly cells: readonly HourCell[];
  readonly byHour: readonly KpiValue[];
  readonly byWeekday: readonly KpiValue[];
  readonly best: { weekday: number; hour: number; value: number } | null;
}

function blankFact(source: DailyFact): Record<AdditiveField, number> & { channel: Channel } {
  const base = { channel: source.channel } as Record<AdditiveField, number> & { channel: Channel };
  for (const f of FIELDS) base[f] = 0;
  return base;
}

/** Cubetas [día][hora] → hechos sintéticos por canal. */
function gridFacts(facts: readonly DailyFact[]): Map<string, Map<Channel, ReturnType<typeof blankFact>>> {
  const cells = new Map<string, Map<Channel, ReturnType<typeof blankFact>>>();
  for (const fact of facts) {
    const weekday = weekdayIndex(fact.date);
    for (const field of FIELDS) {
      const parts = distribute(fact[field], shares(fact.channel, weekday, FIELD_KIND[field]));
      parts.forEach((value, hour) => {
        const key = `${weekday}|${hour}`;
        const byChannel = cells.get(key) ?? new Map<Channel, ReturnType<typeof blankFact>>();
        const row = byChannel.get(fact.channel) ?? blankFact(fact);
        row[field] += value;
        byChannel.set(fact.channel, row);
        cells.set(key, byChannel);
      });
    }
  }
  return cells;
}

function toFacts(rows: Iterable<ReturnType<typeof blankFact>>): DailyFact[] {
  return [...rows].map((row, i) => ({ ...row, date: `h-${i}`, campaignId: 'grid', reach: 0 }));
}

export function hourlyGrid(filter: InsightsFilter, metric: MetricId = filter.metric): HourlyResult {
  const facts = selectFacts(filter);
  const grid = gridFacts(facts);
  const cells: HourCell[] = [];
  const hourAcc = Array.from({ length: 24 }, () => [] as ReturnType<typeof blankFact>[]);
  const dayAcc = Array.from({ length: 7 }, () => [] as ReturnType<typeof blankFact>[]);
  let best: HourlyResult['best'] = null;
  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let hour = 0; hour < 24; hour += 1) {
      const rows = [...(grid.get(`${weekday}|${hour}`)?.values() ?? [])];
      const kpi = computeMetric(metric, buildScope(toFacts(rows)), filter.campaignIds);
      cells.push({ weekday, hour, kpi });
      hourAcc[hour]?.push(...rows);
      dayAcc[weekday]?.push(...rows);
      if (kpi.value !== null && (best === null || kpi.value > best.value)) best = { weekday, hour, value: kpi.value };
    }
  }
  const reduce = (rows: ReturnType<typeof blankFact>[]): KpiValue =>
    computeMetric(metric, buildScope(toFacts(rows)), filter.campaignIds);
  return { cells, byHour: hourAcc.map(reduce), byWeekday: dayAcc.map(reduce), best };
}

/** Franja del día a la que pertenece una hora. */
export function dayPart(hour: number): 'madrugada' | 'mañana' | 'tarde' | 'noche' {
  if (hour < 6) return 'madrugada';
  if (hour < 12) return 'mañana';
  if (hour < 18) return 'tarde';
  return 'noche';
}
