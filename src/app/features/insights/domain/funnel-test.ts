import { campaignName } from './campaigns.data';
import { breakdownByDimension } from './dimensions';
import { acquisitionFunnel } from './funnel';
import type { Channel, InsightsFilter } from './insights.types';
import { CHANNEL_LABELS } from './insights.types';
import { buildScope, selectFacts } from './kpi';
import { daysBetween } from './dates';

/* ============================================================================
    Prueba recomendada y conversión por segmento del embudo.

    La prueba es una PROPUESTA, no un resultado: dice qué paso empeoró más frente al
    periodo anterior y cuántas personas haría falta mirar para notar una mejora de
    5 puntos. Ninguna conversión se publica con una base menor al mínimo declarado.
    ========================================================================== */

export const TEST_MARGIN = 0.05;
export const MIN_VISITS = 300;
export const MIN_REGISTRATIONS = 20;

export interface RecommendedTest {
  readonly step: string;
  readonly rate: number;
  readonly change: number;
  /** Personas por variante: n = ⌈16·p(1−p)/0,05²⌉. */
  readonly perVariant: number;
  /** Días para juntarlas con el ritmo de registros actual, o null si no hay ritmo. */
  readonly days: number | null;
}

export function sampleSize(p: number): number {
  return Math.ceil((16 * p * (1 - p)) / (TEST_MARGIN * TEST_MARGIN));
}

/** El paso que más empeoró frente al periodo anterior, con el tamaño de prueba que pide. */
export function recommendedTest(filter: InsightsFilter): RecommendedTest | null {
  const model = acquisitionFunnel(filter);
  let worst: { index: number; change: number } | null = null;
  model.stages.forEach((s, i) => {
    if (i < 2 || s.id === 'retention' || s.changeVsPrevious == null) return;
    if (s.changeVsPrevious < 0 && (worst === null || s.changeVsPrevious < worst.change)) worst = { index: i, change: s.changeVsPrevious };
  });
  if (!worst) return null;
  const { index, change } = worst as { index: number; change: number };
  const stage = model.stages[index]!;
  const before = model.stages[index - 1]!;
  if (before.value === 0) return null;
  const rate = stage.value / before.value;
  const perVariant = sampleSize(rate);
  const registrations = model.stages.find((s) => s.id === 'registrations')?.value ?? 0;
  const days = Math.max(1, daysBetween(filter.range.from, filter.range.to) + 1);
  const perDay = registrations / days;
  return { step: stage.label, rate, change, perVariant, days: perDay > 0 ? Math.ceil((2 * perVariant) / perDay) : null };
}

export type SegmentDimension = 'channel' | 'campaign' | 'audience' | 'format';
export const SEGMENT_LABELS: Readonly<Record<SegmentDimension, string>> = { channel: 'Canal', campaign: 'Campaña', audience: 'Audiencia', format: 'Formato' };
export const SEGMENT_RATES = [
  { id: 'ctr', label: 'Clic sobre impresión' },
  { id: 'visitToReg', label: 'Visita a registro' },
  { id: 'regToAct', label: 'Registro a activación' },
  { id: 'clickToConv', label: 'Clic a conversión' },
  { id: 'visitToConv', label: 'Visita a conversión' },
] as const;
export type SegmentRateId = (typeof SEGMENT_RATES)[number]['id'];

export interface SegmentRow {
  readonly id: string;
  readonly label: string;
  readonly impressions: number;
  readonly clicks: number;
  readonly visits: number | null;
  readonly registrations: number | null;
  readonly conversions: number;
  readonly rates: Readonly<Record<SegmentRateId, number | null>>;
  /** Visitas ≥ 300 y registros ≥ 20 (o clics ≥ 300 y conversiones ≥ 20 donde no se miden visitas). */
  readonly enough: boolean;
  /** Índice contra el promedio de la selección (1 = igual); null si no hay base. */
  readonly index: number | null;
}

const div = (a: number | null, b: number | null): number | null => (a === null || b === null || b <= 0 ? null : a / b);

export function segmentConversion(filter: InsightsFilter, dimension: SegmentDimension): SegmentRow[] {
  let raw: { id: string; label: string; impressions: number; clicks: number; visits: number | null; registrations: number | null; activations: number | null; conversions: number }[];
  if (dimension === 'channel' || dimension === 'campaign') {
    const facts = selectFacts(filter);
    const keys = [...new Set(facts.map((f) => (dimension === 'channel' ? f.channel : f.campaignId)))];
    raw = keys.map((k) => {
      const s = buildScope(facts.filter((f) => (dimension === 'channel' ? f.channel : f.campaignId) === k)).all;
      return { id: k, label: dimension === 'channel' ? CHANNEL_LABELS[k as Channel] : campaignName(k), impressions: s.impressions, clicks: s.clicks, visits: s.visits, registrations: s.registrations, activations: s.activations, conversions: s.conversions };
    });
  } else {
    raw = breakdownByDimension(filter, dimension).map((r) => ({ id: r.id, label: r.label, impressions: r.impressions, clicks: r.clicks, visits: null, registrations: null, activations: null, conversions: r.conversions }));
  }
  const rows = raw.map((r) => {
    const enough = r.visits !== null && r.registrations !== null ? r.visits >= MIN_VISITS && r.registrations >= MIN_REGISTRATIONS : r.clicks >= MIN_VISITS && r.conversions >= MIN_REGISTRATIONS;
    const rates: Record<SegmentRateId, number | null> = {
      ctr: r.impressions >= 5000 ? div(r.clicks, r.impressions) : null,
      visitToReg: div(r.registrations, r.visits),
      regToAct: div(r.activations, r.registrations),
      clickToConv: div(r.conversions, r.clicks),
      visitToConv: div(r.conversions, r.visits),
    };
    return { ...r, rates: enough ? rates : { ctr: rates.ctr, visitToReg: null, regToAct: null, clickToConv: null, visitToConv: null }, enough };
  });
  const total = rows.reduce((a, r) => ({ c: a.c + r.clicks, v: a.v + r.conversions }), { c: 0, v: 0 });
  const avg = total.c > 0 ? total.v / total.c : null;
  return rows
    .map((r) => ({ id: r.id, label: r.label, impressions: r.impressions, clicks: r.clicks, visits: r.visits, registrations: r.registrations, conversions: r.conversions, rates: r.rates, enough: r.enough, index: avg && r.enough && r.rates.clickToConv !== null ? r.rates.clickToConv / avg : null }))
    .sort((a, b) => (b.rates.clickToConv ?? -1) - (a.rates.clickToConv ?? -1));
}
