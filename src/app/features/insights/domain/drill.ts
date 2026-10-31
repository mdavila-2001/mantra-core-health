import { campaignName, CAMPAIGN_BY_ID, MILESTONES } from './campaigns.data';
import { assess } from './benchmarks';
import { shortDate } from './dates';
import type { Channel, HealthStatus, InsightsFilter, MetricId } from './insights.types';
import { CHANNEL_LABELS, CHANNELS } from './insights.types';
import { computeKpi, selectFacts, timeSeries } from './kpi';

/* ============================================================================
    Drill-down de Campañas: General → Canal → Campaña → Evento.

    Cada paso filtra TODOS los gráficos y KPI de la pantalla (el contexto lo aplica a
    `filter`), y la tabla de detalle baja un nivel a la vez. El último nivel no son filas de
    una dimensión, son los días más atípicos de la métrica elegida con el hito que los
    acompaña, si lo hubo.

    «Creativo» y «Audiencia» del prototipo no son un nivel todavía: los hechos diarios no traen
    creativo ni audiencia (la tabla `insights_creatives` existe, pero los hechos se siembran
    por campaña y canal). Ver «Rendimiento por pieza» para el reparto sintético por pieza.
    ========================================================================== */

export type DrillLevel = 'ch' | 'camp';

export interface DrillStep {
  readonly level: DrillLevel;
  readonly id: string;
}

export const DRILL_LEVEL_LABELS: Readonly<Record<DrillLevel, string>> = { ch: 'Canal', camp: 'Campaña' };

/** El nivel de filas que se muestra con estos pasos. */
export type DrillView = 'ch' | 'camp' | 'ev';

export function viewFor(steps: readonly DrillStep[]): DrillView {
  return steps.length === 0 ? 'ch' : steps.length === 1 ? 'camp' : 'ev';
}

/** `ch.instagram,camp.c2` ⇄ pasos. Solo se aceptan en orden canal → campaña y con ids que existen. */
export function parseDrill(raw: unknown): DrillStep[] {
  if (typeof raw !== 'string' || raw === '') return [];
  const out: DrillStep[] = [];
  for (const part of raw.split(',')) {
    const [level, id] = part.split('.');
    if (level === 'ch' && out.length === 0 && (CHANNELS as readonly string[]).includes(id ?? '')) out.push({ level: 'ch', id: id! });
    else if (level === 'camp' && out.length === 1 && CAMPAIGN_BY_ID.has(id ?? '')) out.push({ level: 'camp', id: id! });
    else break;
  }
  return out;
}

export function encodeDrill(steps: readonly DrillStep[]): string | null {
  return steps.length === 0 ? null : steps.map((s) => `${s.level}.${s.id}`).join(',');
}

export function stepLabel(step: DrillStep): string {
  return step.level === 'ch' ? CHANNEL_LABELS[step.id as Channel] : campaignName(step.id);
}

/** El filtro con los pasos del drill ya aplicados. */
export function applyDrill(filter: InsightsFilter, steps: readonly DrillStep[]): InsightsFilter {
  let out = filter;
  for (const s of steps) {
    out = s.level === 'ch' ? { ...out, channels: [s.id as Channel] } : { ...out, campaignIds: [s.id] };
  }
  return out;
}

/* ------------------------------------------------------------------ filas */

export const DRILL_COLUMNS: readonly MetricId[] = ['spend', 'impressions', 'ctr', 'registrations', 'cpa', 'conversions', 'cac', 'roas'];

export interface DrillRow {
  readonly id: string;
  readonly name: string;
  readonly values: Readonly<Partial<Record<MetricId, number | null>>>;
  /** Estado de la métrica activa en esta fila, contra su objetivo o benchmark. */
  readonly status: HealthStatus;
}

function rowOf(id: string, name: string, f: InsightsFilter, metric: MetricId): DrillRow {
  const values: Partial<Record<MetricId, number | null>> = {};
  for (const m of DRILL_COLUMNS) values[m] = computeKpi(f, m).value;
  return { id, name, values, status: assess(f, metric).status };
}

/** Filas del nivel actual, ordenadas por la métrica activa (de menor a mayor si «mejor» es bajar). */
export function drillRows(filter: InsightsFilter, view: 'ch' | 'camp'): DrillRow[] {
  const facts = selectFacts(filter);
  const metric = filter.metric;
  const rows: DrillRow[] =
    view === 'ch'
      ? [...new Set(facts.map((f) => f.channel))].map((c) => rowOf(c, CHANNEL_LABELS[c], { ...filter, channels: [c] }, metric))
      : [...new Set(facts.map((f) => f.campaignId))].map((id) => rowOf(id, campaignName(id), { ...filter, campaignIds: [id] }, metric));
  const down = metric === 'cpa' || metric === 'cac' || metric === 'cpm' || metric === 'cpc';
  return rows.sort((a, b) => {
    const av = a.values[metric] ?? null;
    const bv = b.values[metric] ?? null;
    if (av === null) return 1;
    if (bv === null) return -1;
    return down ? av - bv : bv - av;
  });
}

export interface EventRow {
  readonly date: string;
  readonly label: string;
  readonly value: number;
  /** Desvío frente al promedio del periodo, en desviaciones estándar (con signo). */
  readonly z: number;
  /** Hito del calendario que cae ese día, si lo hay. */
  readonly milestone: string | null;
}

/** Los días más atípicos de la métrica activa (hasta 8), con su hito si lo hubo. */
export function eventRows(filter: InsightsFilter, limit = 8): EventRow[] {
  const points = timeSeries({ ...filter, grain: 'day' }, filter.metric).flatMap((p) => (p.kpi.value === null ? [] : [{ date: p.bucket, value: p.kpi.value }]));
  if (points.length < 5) return [];
  const mean = points.reduce((s, p) => s + p.value, 0) / points.length;
  const sd = Math.sqrt(points.reduce((s, p) => s + (p.value - mean) ** 2, 0) / points.length);
  if (sd === 0) return [];
  return points
    .map((p) => ({ ...p, z: (p.value - mean) / sd }))
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))
    .slice(0, limit)
    .map((p) => ({
      date: p.date,
      label: shortDate(p.date),
      value: p.value,
      z: p.z,
      milestone: MILESTONES.find((m) => m.date === p.date && filter.campaignIds.includes(m.campaignId))?.label ?? null,
    }));
}
