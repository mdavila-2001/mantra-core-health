import { CAMPAIGNS } from './campaigns.data';
import { addDays, PROTOTYPE_TODAY } from './dates';
import { acquisitionFunnel } from './funnel';
import { featureAdoption, summarize as summarizeUsage } from './app-usage';
import { buildAlerts } from './alerts';
import { assess } from './benchmarks';
import { campaignInsights } from './campaign-insights';
import { formatInt, formatPercent, formatValue } from './format';
import { METRIC_CATALOG } from './metric-catalog';
import type { DateRange, Insight, InsightsFilter, KpiAssessment, MarketingAlert, MetricId } from './insights.types';
import { CHANNELS } from './insights.types';
import { timeSeries } from './kpi';
import { OBSERVATORY } from './observatory';
import { SOURCES } from './opinion.data';
import { opinionInsights, previousRange, select, summarize, topicTable } from './opinion';
import { socialKpi } from './social';
import type { InsightModuleId } from './insights.types';

/* ============================================================================
    Panel general: la lectura de un vistazo de los ocho módulos.

    Cada cifra sale del mismo dominio que su módulo (ninguna se escribe a mano
    aquí) y cada una lleva a su módulo con el contexto ya aplicado. Una cifra que
    no se puede calcular es `null` con motivo, nunca 0.
    ========================================================================== */

/** Ventana fija del panel: la última semana frente a la anterior. */
export const HOME_DAYS = 7;
/** Ventana de la conversación pública para el índice de reputación. */
export const REPUTATION_DAYS = 28;

export function homeRange(days = HOME_DAYS): DateRange {
  return { from: addDays(PROTOTYPE_TODAY, -(days - 1)), to: PROTOTYPE_TODAY };
}

/** Todas las campañas y todos los canales, en la ventana del panel. */
export function homeFilter(metric: MetricId = 'ctr', days = HOME_DAYS): InsightsFilter {
  return {
    campaignIds: CAMPAIGNS.map((c) => c.id),
    range: homeRange(days),
    grain: 'day',
    channels: CHANNELS,
    metric,
  };
}

/* -------------------------------------------------------------- reputación */

export interface Reputation {
  /** 0–100; `null` si no hay muestra suficiente de menciones. */
  readonly index: number | null;
  /** Diferencia en puntos contra los 28 días anteriores; `null` si falta alguno de los dos. */
  readonly delta: number | null;
  readonly mentions: number;
  readonly positiveShare: number | null;
  /** El tema que más crece, si hay uno con volumen suficiente. */
  readonly rising: { readonly label: string; readonly growth: number } | null;
}

/** Índice = 50 + 50 × sentimiento neto (positivas − negativas ÷ menciones). Una estimación, y se dice. */
export function reputationIndex(net: number | null): number | null {
  return net === null ? null : Math.round(50 + 50 * net);
}

export function reputation(): Reputation {
  const range = homeRange(REPUTATION_DAYS);
  const now = summarize(select({ range, sources: SOURCES }));
  const before = summarize(select({ range: previousRange(range), sources: SOURCES }));
  const index = reputationIndex(now.net);
  const prev = reputationIndex(before.net);
  const rising = topicTable({ range, sources: SOURCES })
    .filter((t) => t.emerging && t.growth !== null)
    .sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
  return {
    index,
    delta: index !== null && prev !== null ? index - prev : null,
    mentions: now.n,
    positiveShare: now.n > 0 ? now.positive / now.n : null,
    rising: rising ? { label: rising.label, growth: rising.growth ?? 0 } : null,
  };
}

/* ------------------------------------------------------------ indicadores */

export const HOME_KPIS: readonly MetricId[] = ['ctr', 'cpa', 'cac', 'roas'];

export interface HomeKpi {
  readonly assessment: KpiAssessment;
  readonly series: readonly (number | null)[];
}

export function homeKpis(): HomeKpi[] {
  return HOME_KPIS.map((metric) => {
    const filter = homeFilter(metric);
    return { assessment: assess(filter, metric), series: timeSeries(filter, metric).map((p) => p.kpi.value) };
  });
}

/** Inversión y registros de la semana frente a la anterior. */
export function homeSideKpis(): { spend: KpiAssessment; registrations: KpiAssessment } {
  return {
    spend: assess(homeFilter('spend'), 'spend'),
    registrations: assess(homeFilter('registrations'), 'registrations'),
  };
}

/** Usuarios activos del mes (MAU) y su variación contra hace una semana. */
export function homeMau(): { value: number; change: number | null } | null {
  const now = summarizeUsage(homeRange(), 'all');
  if (!now) return null;
  const before = summarizeUsage({ from: addDays(PROTOTYPE_TODAY, -13), to: addDays(PROTOTYPE_TODAY, -7) }, 'all');
  return { value: now.mau, change: before && before.mau > 0 ? now.mau / before.mau - 1 : null };
}

/* ------------------------------------------------------------------ alertas */

/** Las alertas abiertas más importantes: orden de severidad y fecha ya viene de `buildAlerts`. */
export function topAlerts(handled: Readonly<Record<string, 'seen' | 'resolved'>> = {}, limit = 4): MarketingAlert[] {
  return buildAlerts()
    .filter((a) => (handled[a.id] ?? a.status) !== 'resolved')
    .slice(0, limit);
}

export function openAlertCounts(handled: Readonly<Record<string, 'seen' | 'resolved'>> = {}): { open: number; critical: number } {
  const open = buildAlerts().filter((a) => (handled[a.id] ?? a.status) !== 'resolved');
  return { open: open.length, critical: open.filter((a) => a.severity === 'critical').length };
}

/* ---------------------------------------------------------------- lecturas */

/** Hasta tres lecturas: una de campañas, una de opinión y la siguiente que haya, sin repetir. */
export function homeInsights(): Insight[] {
  const campaigns = campaignInsights(homeFilter('ctr', 30));
  const opinion = opinionInsights({ range: homeRange(REPUTATION_DAYS), sources: SOURCES });
  const pool = [campaigns[0], opinion[0], campaigns[1], opinion[1], campaigns[2]];
  return pool.filter((i): i is Insight => i !== undefined).slice(0, 3);
}

/* ------------------------------------------------------------------- fichas */

export interface ModuleTile {
  readonly id: InsightModuleId;
  readonly big: string;
  readonly small: string;
}

/** Una cifra por módulo: la que mejor dice si hay que entrar ya. */
export function moduleTiles(): ModuleTile[] {
  const week = homeFilter('cac');
  const cac = assess(week, 'cac').kpi.value;
  const roas = assess({ ...week, metric: 'roas' }, 'roas').kpi.value;
  const shown = (value: number | null, metric: MetricId): string => formatValue(value, METRIC_CATALOG[metric].unit, true);
  const active = CAMPAIGNS.filter((c) => c.startDate <= PROTOTYPE_TODAY && c.endDate >= PROTOTYPE_TODAY).length;
  const worst = acquisitionFunnel(homeFilter('registrations', 30)).worst;
  const top = featureAdoption(homeRange(), 'all')[0];
  const followers = socialKpi('tiktok', 'followers', homeRange()).value;
  const rep = reputation();
  const risks = OBSERVATORY.filter((o) => o.impact === 'risk').length;
  const alerts = openAlertCounts();
  return [
    { id: 'campaigns', big: `${active} activas`, small: `CAC ${shown(cac, 'cac')} · ROAS ${shown(roas, 'roas')}` },
    { id: 'funnel', big: worst ? `${formatPercent(Math.abs(worst.gap), 0)} bajo lo habitual` : 'Sin pérdida atípica', small: worst ? `En ${worst.label}` : 'El embudo no muestra un paso débil' },
    { id: 'app', big: top ? `${formatPercent(top.adoption, 0)} usa «${top.label}»` : 'Sin dato', small: 'Función más usada' },
    { id: 'social', big: followers === null ? 'Sin dato' : formatInt(followers), small: 'Seguidores en TikTok' },
    { id: 'opinion', big: rep.index === null ? 'Sin evidencia' : `${rep.index} / 100`, small: 'Índice de reputación' },
    { id: 'observatory', big: `${risks} riesgos`, small: 'En el entorno de salud' },
    { id: 'alerts', big: `${alerts.open} abiertas`, small: `${alerts.critical} críticas` },
    { id: 'reports', big: '3 tipos', small: 'Mensual, ejecutivo y de campaña' },
  ];
}
