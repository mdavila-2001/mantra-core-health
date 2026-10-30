import { addDays, daysBetween, eachDay, PROTOTYPE_TODAY, weekdayIndex } from './dates';
import type { Benchmark, DateRange, HealthStatus, MetricUnit } from './insights.types';
import { noise } from './prng';
import { allFacts } from './facts-source';

/* ============================================================================
    Métricas de redes sociales — datos objetivos de las cuentas propias.

    Este módulo NO interpreta opiniones: mide. Las cuentas propias reciben un
    «efecto halo» de la pauta pagada (más impresiones de campaña ese día, más
    visitas al perfil), por eso las series se mueven junto con las campañas.
    Todos los datos son sintéticos.
    ========================================================================== */

export type Platform = 'instagram' | 'tiktok' | 'facebook' | 'youtube';
export const PLATFORMS: readonly Platform[] = ['instagram', 'tiktok', 'facebook', 'youtube'];
export const PLATFORM_NAMES: Readonly<Record<Platform, string>> = { instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', youtube: 'YouTube' };

interface Raw {
  followers: number;
  newFollowers: number;
  reach: number;
  impressions: number;
  engagements: number;
  saves: number;
  shares: number;
  comments: number;
  clicks: number;
  views: number;
  watchSeconds: number;
  completions: number;
  viewedPct: number;
}

type RawKey = keyof Raw;

interface Base {
  followers0: number;
  gain: number;
  reachRate: number;
  impPerReach: number;
  er: number;
  saveShare: number;
  shareShare: number;
  commentShare: number;
  ctr: number;
  viewRate: number;
  avgWatch: number;
  completion: number;
  avgPct: number;
}

const BASE: Readonly<Record<Platform, Base>> = {
  instagram: { followers0: 21_400, gain: 38, reachRate: 0.34, impPerReach: 1.45, er: 0.047, saveShare: 0.16, shareShare: 0.1, commentShare: 0.06, ctr: 0.012, viewRate: 0.4, avgWatch: 7.2, completion: 0.31, avgPct: 0.36 },
  tiktok: { followers0: 12_800, gain: 55, reachRate: 0.62, impPerReach: 1.22, er: 0.068, saveShare: 0.05, shareShare: 0.14, commentShare: 0.07, ctr: 0.009, viewRate: 0.92, avgWatch: 9.4, completion: 0.42, avgPct: 0.41 },
  facebook: { followers0: 31_200, gain: 12, reachRate: 0.17, impPerReach: 1.6, er: 0.019, saveShare: 0.04, shareShare: 0.12, commentShare: 0.08, ctr: 0.014, viewRate: 0.3, avgWatch: 6.1, completion: 0.24, avgPct: 0.3 },
  youtube: { followers0: 6_900, gain: 9, reachRate: 0.21, impPerReach: 1.3, er: 0.031, saveShare: 0.03, shareShare: 0.05, commentShare: 0.04, ctr: 0.047, viewRate: 0.56, avgWatch: 38, completion: 0.28, avgPct: 0.44 },
};

const paidImpressions = (() => {
  const map = new Map<string, number>();
  for (const f of allFacts()) map.set(`${f.channel}|${f.date}`, (map.get(`${f.channel}|${f.date}`) ?? 0) + f.impressions);
  return map;
})();

const HISTORY_START = '2026-08-01';

const cache = new Map<Platform, Map<string, Raw>>();

function seriesOf(platform: Platform): Map<string, Raw> {
  const hit = cache.get(platform);
  if (hit) return hit;
  const b = BASE[platform];
  const days = new Map<string, Raw>();
  let followers = b.followers0;
  for (const date of eachDay(HISTORY_START, PROTOTYPE_TODAY)) {
    const halo = 1 + (paidImpressions.get(`${platform}|${date}`) ?? 0) / 90_000;
    const weekend = weekdayIndex(date) >= 5 ? 0.86 : 1;
    const key = `${platform}|${date}`;
    const newFollowers = Math.round(b.gain * halo * weekend * noise(`${key}|nf`, 0.2));
    followers += newFollowers;
    const reach = Math.round(followers * b.reachRate * halo * weekend * noise(`${key}|r`, 0.06) * (platform === 'tiktok' ? 1.6 : 1));
    const impressions = Math.round(reach * b.impPerReach * noise(`${key}|i`, 0.04));
    const engagements = Math.round(impressions * b.er * noise(`${key}|e`, 0.07));
    const views = Math.round(impressions * b.viewRate * noise(`${key}|v`, 0.05));
    days.set(date, {
      followers,
      newFollowers,
      reach,
      impressions,
      engagements,
      saves: Math.round(engagements * b.saveShare * noise(`${key}|s`, 0.1)),
      shares: Math.round(engagements * b.shareShare * noise(`${key}|sh`, 0.1)),
      comments: Math.round(engagements * b.commentShare * noise(`${key}|c`, 0.1)),
      clicks: Math.round(impressions * b.ctr * noise(`${key}|k`, 0.08)),
      views,
      watchSeconds: Math.round(views * b.avgWatch * noise(`${key}|w`, 0.05)),
      completions: Math.round(views * b.completion * noise(`${key}|co`, 0.05)),
      viewedPct: views * b.avgPct * noise(`${key}|p`, 0.04),
    });
  }
  cache.set(platform, days);
  return days;
}

/* ------------------------------------------------------------------ métricas */

export interface SocialMetric {
  readonly id: string;
  readonly label: string;
  readonly unit: MetricUnit;
  readonly goodWhen: 'up' | 'none';
  readonly definition: string;
  /** Mínimo de denominador para publicar una tasa. */
  readonly minDen: number;
}

type Sum = Readonly<Record<RawKey, number>> & { days: number; firstFollowers: number; lastFollowers: number };

export const SOCIAL_METRICS: Readonly<Record<string, SocialMetric & { calc: (s: Sum) => { value: number; num: number | null; den: number | null } | null }>> = {
  followers: { id: 'followers', label: 'Seguidores', unit: 'count', goodWhen: 'up', definition: 'Seguidores al cierre del periodo.', minDen: 0, calc: (s) => ({ value: s.lastFollowers, num: null, den: null }) },
  growth: { id: 'growth', label: 'Crecimiento de seguidores', unit: 'percent', goodWhen: 'up', definition: 'Seguidores nuevos ÷ seguidores al inicio.', minDen: 1000, calc: (s) => (s.firstFollowers > 0 ? { value: s.newFollowers / s.firstFollowers, num: s.newFollowers, den: s.firstFollowers } : null) },
  reach: { id: 'reach', label: 'Alcance medio diario', unit: 'count', goodWhen: 'up', definition: 'Personas distintas alcanzadas por día, promediadas. No se suman entre días.', minDen: 0, calc: (s) => (s.days ? { value: s.reach / s.days, num: s.reach, den: s.days } : null) },
  impressions: { id: 'impressions', label: 'Impresiones', unit: 'count', goodWhen: 'up', definition: 'Veces que se mostró el contenido.', minDen: 0, calc: (s) => ({ value: s.impressions, num: null, den: null }) },
  engagement: { id: 'engagement', label: 'Interacciones', unit: 'count', goodWhen: 'up', definition: 'Reacciones, comentarios, guardados y compartidos.', minDen: 0, calc: (s) => ({ value: s.engagements, num: null, den: null }) },
  er: { id: 'er', label: 'Tasa de interacción', unit: 'percent', goodWhen: 'up', definition: 'Interacciones ÷ impresiones.', minDen: 5000, calc: (s) => (s.impressions > 0 ? { value: s.engagements / s.impressions, num: s.engagements, den: s.impressions } : null) },
  saves: { id: 'saves', label: 'Guardados', unit: 'count', goodWhen: 'up', definition: 'Veces que se guardó el contenido.', minDen: 0, calc: (s) => ({ value: s.saves, num: null, den: null }) },
  shares: { id: 'shares', label: 'Compartidos', unit: 'count', goodWhen: 'up', definition: 'Veces que se compartió el contenido.', minDen: 0, calc: (s) => ({ value: s.shares, num: null, den: null }) },
  comments: { id: 'comments', label: 'Comentarios', unit: 'count', goodWhen: 'up', definition: 'Comentarios recibidos.', minDen: 0, calc: (s) => ({ value: s.comments, num: null, den: null }) },
  clicks: { id: 'clicks', label: 'Clics', unit: 'count', goodWhen: 'up', definition: 'Clics hacia AloVida.', minDen: 0, calc: (s) => ({ value: s.clicks, num: null, den: null }) },
  ctr: { id: 'ctr', label: 'CTR', unit: 'percent', goodWhen: 'up', definition: 'Clics ÷ impresiones.', minDen: 5000, calc: (s) => (s.impressions > 0 ? { value: s.clicks / s.impressions, num: s.clicks, den: s.impressions } : null) },
  views: { id: 'views', label: 'Reproducciones', unit: 'count', goodWhen: 'up', definition: 'Reproducciones de vídeo.', minDen: 0, calc: (s) => ({ value: s.views, num: null, den: null }) },
  watch: { id: 'watch', label: 'Tiempo medio de visualización', unit: 'seconds', goodWhen: 'up', definition: 'Segundos vistos ÷ reproducciones.', minDen: 100, calc: (s) => (s.views > 0 ? { value: s.watchSeconds / s.views, num: s.watchSeconds, den: s.views } : null) },
  completion: { id: 'completion', label: 'Tasa de finalización', unit: 'percent', goodWhen: 'up', definition: 'Reproducciones completas ÷ reproducciones.', minDen: 100, calc: (s) => (s.views > 0 ? { value: s.completions / s.views, num: s.completions, den: s.views } : null) },
  retention: { id: 'retention', label: 'Retención media', unit: 'percent', goodWhen: 'up', definition: 'Porcentaje medio del vídeo que se ve.', minDen: 100, calc: (s) => (s.views > 0 ? { value: s.viewedPct / s.views, num: null, den: s.views } : null) },
  subs: { id: 'subs', label: 'Suscriptores nuevos', unit: 'count', goodWhen: 'up', definition: 'Suscriptores ganados en el periodo.', minDen: 0, calc: (s) => ({ value: s.newFollowers, num: null, den: null }) },
};

export const PLATFORM_METRICS: Readonly<Record<Platform, readonly string[]>> = {
  instagram: ['followers', 'growth', 'reach', 'impressions', 'engagement', 'er', 'saves', 'shares', 'comments', 'clicks', 'ctr'],
  tiktok: ['views', 'watch', 'completion', 'engagement', 'er', 'shares', 'followers', 'growth'],
  facebook: ['reach', 'impressions', 'engagement', 'er', 'followers', 'clicks', 'ctr'],
  youtube: ['views', 'watch', 'retention', 'subs', 'ctr', 'followers'],
};

/** Metas propuestas por la dirección de marketing (pendientes de ratificar). */
const TARGETS: Readonly<Partial<Record<string, Partial<Record<Platform, number>>>>> = {
  er: { instagram: 0.045, tiktok: 0.06, facebook: 0.02, youtube: 0.03 },
  ctr: { instagram: 0.012, facebook: 0.014, youtube: 0.045 },
  completion: { tiktok: 0.4 },
  growth: { instagram: 0.05, tiktok: 0.08, facebook: 0.015 },
};

/** Referencia de prototipo: sin fuente verificada. */
const SECTOR: Readonly<Partial<Record<string, Partial<Record<Platform, number>>>>> = {
  er: { instagram: 0.035, tiktok: 0.05, facebook: 0.015, youtube: 0.025 },
  ctr: { instagram: 0.009, facebook: 0.011, youtube: 0.04 },
  completion: { tiktok: 0.32 },
};

function sumOver(platform: Platform, range: DateRange): Sum | null {
  const series = seriesOf(platform);
  const dates = eachDay(range.from, range.to).filter((d) => series.has(d));
  if (dates.length === 0) return null;
  const acc = { days: dates.length, followers: 0, newFollowers: 0, reach: 0, impressions: 0, engagements: 0, saves: 0, shares: 0, comments: 0, clicks: 0, views: 0, watchSeconds: 0, completions: 0, viewedPct: 0 } as Record<RawKey, number> & { days: number };
  for (const d of dates) {
    const r = series.get(d)!;
    for (const k of Object.keys(r) as RawKey[]) if (k !== 'followers') acc[k] += r[k];
  }
  const first = series.get(dates[0]!)!;
  const last = series.get(dates[dates.length - 1]!)!;
  return { ...acc, firstFollowers: first.followers - first.newFollowers, lastFollowers: last.followers };
}

export interface SocialKpi {
  readonly metric: string;
  readonly label: string;
  readonly unit: MetricUnit;
  readonly value: number | null;
  readonly numerator: number | null;
  readonly denominator: number | null;
  readonly gap: string | null;
  readonly previous: number | null;
  readonly changeVsPrevious: number | null;
  readonly benchmark: Benchmark | null;
  readonly target: Benchmark | null;
  readonly changeVsBenchmark: number | null;
  readonly status: HealthStatus;
  readonly statusReason: string;
}

function valueOf(platform: Platform, metric: string, range: DateRange): { value: number; num: number | null; den: number | null } | { gap: string } {
  const def = SOCIAL_METRICS[metric];
  const sum = sumOver(platform, range);
  if (!def || !sum) return { gap: 'No hay datos de la cuenta en este periodo.' };
  const result = def.calc(sum);
  if (!result) return { gap: 'Sin base de cálculo en el periodo.' };
  if (def.minDen > 0 && (result.den ?? 0) < def.minDen) return { gap: `La base (${Math.round(result.den ?? 0).toLocaleString('es-BO')}) es menor al mínimo de ${def.minDen.toLocaleString('es-BO')}.` };
  return result;
}

export function socialKpi(platform: Platform, metric: string, range: DateRange): SocialKpi {
  const def = SOCIAL_METRICS[metric]!;
  const now = valueOf(platform, metric, range);
  const days = daysBetween(range.from, range.to) + 1;
  const prevRange = { from: addDays(range.from, -days), to: addDays(range.from, -1) };
  const prev = valueOf(platform, metric, prevRange);
  const histRange = { from: addDays(range.from, -60), to: addDays(range.from, -1) };
  const hist = valueOf(platform, metric, histRange);
  const value = 'gap' in now ? null : now.value;
  const previous = 'gap' in prev ? null : prev.value;

  const isRatio = def.unit === 'percent' || def.unit === 'seconds';
  const histValue = 'gap' in hist ? null : isRatio ? hist.value : (hist.value / (daysBetween(histRange.from, histRange.to) + 1)) * days;
  const benchmark: Benchmark | null = histValue === null || metric === 'followers' ? null : { source: 'historical', value: histValue, note: 'Promedio de los 60 días anteriores en esta cuenta.', verified: true };
  const targetValue = TARGETS[metric]?.[platform];
  const target: Benchmark | null = targetValue === undefined ? null : { source: 'strategic', value: targetValue, note: 'Meta propuesta por marketing, pendiente de ratificar.', verified: false };
  const sectorValue = SECTOR[metric]?.[platform];

  let status: HealthStatus = 'insufficient';
  let reason = 'gap' in now ? now.gap : 'No hay objetivo ni benchmark para juzgar.';
  const ref = target ?? benchmark;
  if (value !== null && ref && def.goodWhen === 'up') {
    const ratio = value / ref.value;
    status = ratio >= 1 ? 'optimal' : ratio >= 0.9 ? 'acceptable' : ratio >= 0.75 ? 'alert' : 'critical';
    reason = `${(ratio * 100).toFixed(0)} % ${target ? 'de la meta' : 'del promedio de los 60 días anteriores'}${sectorValue ? ` · referencia de prototipo (no verificada): ${sectorValue}` : ''}`;
  }
  return {
    metric,
    label: def.label,
    unit: def.unit,
    value,
    numerator: 'gap' in now ? null : now.num,
    denominator: 'gap' in now ? null : now.den,
    gap: 'gap' in now ? now.gap : null,
    previous,
    changeVsPrevious: value !== null && previous ? (value - previous) / previous : null,
    benchmark,
    target,
    changeVsBenchmark: value !== null && benchmark ? (value - benchmark.value) / benchmark.value : null,
    status,
    statusReason: reason,
  };
}

/** Serie diaria (o semanal) de una métrica para el gráfico de evolución. */
export function socialSeries(platform: Platform, metric: string, range: DateRange, weekly: boolean): { labels: string[]; values: (number | null)[] } {
  const dates = eachDay(range.from, range.to);
  const buckets: DateRange[] = [];
  if (weekly) {
    for (let i = 0; i < dates.length; i += 7) buckets.push({ from: dates[i]!, to: dates[Math.min(dates.length - 1, i + 6)]! });
  } else {
    for (const d of dates) buckets.push({ from: d, to: d });
  }
  const values = buckets.map((b) => {
    const v = valueOf(platform, metric, b);
    if ('gap' in v) return null;
    const span = daysBetween(b.from, b.to) + 1;
    const def = SOCIAL_METRICS[metric]!;
    return def.unit === 'count' && metric !== 'followers' && span > 1 ? v.value / span : v.value;
  });
  return { labels: buckets.map((b) => b.from), values };
}

/** Seguidores indexados a 100 al inicio: la única forma justa de comparar crecimiento entre cuentas de distinto tamaño. */
export function followersIndex(range: DateRange): Record<Platform, (number | null)[]> {
  const out = {} as Record<Platform, (number | null)[]>;
  for (const p of PLATFORMS) {
    const series = seriesOf(p);
    const dates = eachDay(range.from, range.to).filter((d) => series.has(d));
    const first = dates.length ? series.get(dates[0]!)!.followers : 0;
    out[p] = dates.map((d) => (first > 0 ? (series.get(d)!.followers / first) * 100 : null));
  }
  return out;
}

export interface Post {
  readonly id: string;
  readonly platform: Platform;
  readonly title: string;
  readonly format: string;
  readonly date: string;
  readonly reach: number;
  readonly er: number;
}

const POST_TITLES: Readonly<Record<Platform, readonly [string, string][]>> = {
  instagram: [['Un día en el consultorio de la Dra. R.', 'Reel'], ['Cómo verificar su título en 24 horas', 'Carrusel'], ['Tres preguntas sobre telemedicina', 'Carrusel'], ['Conozca los perfiles verificados', 'Imagen'], ['Testimonio: primera consulta por videollamada', 'Reel']],
  tiktok: [['Lo que nadie le cuenta del primer día de consulta', 'Vídeo'], ['Busque un especialista en 20 segundos', 'Vídeo'], ['Mitos de la telemedicina', 'Vídeo'], ['Detrás de cámaras del equipo', 'Vídeo']],
  facebook: [['Jornada de salud: fechas y sedes', 'Evento'], ['Preguntas frecuentes sobre reservas', 'Texto'], ['Nuevos médicos en Santa Cruz', 'Imagen'], ['Telemedicina para zonas alejadas', 'Vídeo']],
  youtube: [['AloVida en 3 minutos', 'Vídeo'], ['Tutorial: cree su perfil profesional', 'Vídeo'], ['Entrevista con un especialista', 'Vídeo']],
};

export function topPosts(range: DateRange): Post[] {
  const out: Post[] = [];
  for (const p of PLATFORMS) {
    POST_TITLES[p].forEach(([title, format], i) => {
      const date = addDays(range.to, -(3 + i * 6));
      if (date < range.from) return;
      const key = `${p}|${title}`;
      out.push({ id: key, platform: p, title, format, date, reach: Math.round(BASE[p].followers0 * BASE[p].reachRate * noise(`${key}|r`, 0.6) * 1.4), er: BASE[p].er * noise(`${key}|e`, 0.45) });
    });
  }
  return out;
}
