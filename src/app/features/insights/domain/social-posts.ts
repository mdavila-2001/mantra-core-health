import { addDays, daysBetween, eachDay } from './dates';
import type { DateRange } from './insights.types';
import { hashSeed, noise } from './prng';
import { PLATFORMS, type Platform } from './social';

/* ============================================================================
    Publicaciones de redes con formato, tema y hora: lo que permite contestar
    «qué formato, qué tema y qué horario conviene repetir».

    Datos SINTÉTICOS y deterministas, con un patrón plantado a propósito para que
    el análisis tenga algo real que encontrar (el vídeo corto rinde más, las
    historias de pacientes mejor que las promociones, la noche mejor que la
    mañana). Los análisis no conocen esos multiplicadores: solo ven publicaciones.
    ========================================================================== */

export const TOPICS = [
  'Salud preventiva',
  'Historias de pacientes',
  'Médicos y especialistas',
  'Farmacias y ahorro',
  'Tecnología y app',
  'Eventos y comunidad',
  'Educación en salud',
  'Promociones',
] as const;
export type SocialTopic = (typeof TOPICS)[number];

/** Horas del día en que se publica. */
export const POST_HOURS = [8, 12, 13, 18, 19, 20, 21, 22] as const;

export interface SocialPost {
  readonly id: string;
  readonly platform: Platform;
  readonly date: string;
  readonly hour: number;
  readonly format: string;
  readonly topic: SocialTopic;
  readonly impressions: number;
  readonly reach: number;
  readonly engagements: number;
  readonly er: number;
  readonly views: number;
  readonly shares: number;
  readonly saves: number;
  readonly comments: number;
  readonly clicks: number;
}

const FORMATS: Readonly<Record<Platform, readonly string[]>> = {
  instagram: ['Reel', 'Carrusel', 'Imagen', 'Historia'],
  tiktok: ['Video corto', 'Video corto', 'Duo'],
  facebook: ['Video', 'Imagen', 'Evento', 'Texto'],
  youtube: ['Video largo', 'Short'],
};

const FORMAT_FACTOR: Readonly<Record<string, number>> = { Reel: 1.35, 'Video corto': 1.4, Short: 1.3, Video: 1.2, 'Video largo': 1.05, Carrusel: 1.15, Duo: 1.1, Imagen: 0.9, Historia: 0.85, Evento: 0.85, Texto: 0.7 };
const TOPIC_FACTOR: Readonly<Record<SocialTopic, number>> = {
  'Salud preventiva': 1.05, 'Historias de pacientes': 1.3, 'Médicos y especialistas': 1.1, 'Farmacias y ahorro': 1.0,
  'Tecnología y app': 0.95, 'Eventos y comunidad': 0.9, 'Educación en salud': 1.08, Promociones: 0.8,
};
const HOUR_FACTOR: Readonly<Record<number, number>> = { 8: 0.85, 12: 1.0, 13: 1.0, 18: 1.1, 19: 1.2, 20: 1.2, 21: 1.15, 22: 0.95 };
const BASE: Readonly<Record<Platform, { impressions: number; er: number; count: number }>> = {
  instagram: { impressions: 24_000, er: 0.036, count: 46 },
  tiktok: { impressions: 61_000, er: 0.062, count: 40 },
  facebook: { impressions: 15_000, er: 0.02, count: 36 },
  youtube: { impressions: 9_000, er: 0.012, count: 18 },
};
const SERIES_START = '2026-09-01';
const SERIES_END = '2026-10-29';

let cache: readonly SocialPost[] | null = null;

export function allPosts(): readonly SocialPost[] {
  if (cache) return cache;
  const out: SocialPost[] = [];
  const span = daysBetween(SERIES_START, SERIES_END);
  for (const platform of PLATFORMS) {
    const base = BASE[platform];
    for (let i = 0; i < base.count; i += 1) {
      const key = `post|${platform}|${i}`;
      const date = addDays(SERIES_START, Math.floor((i * span) / Math.max(1, base.count - 1)));
      const hour = POST_HOURS[hashSeed(`${key}|h`) % POST_HOURS.length]!;
      const formats = FORMATS[platform];
      const format = formats[hashSeed(`${key}|f`) % formats.length]!;
      const topic = TOPICS[hashSeed(`${key}|t`) % TOPICS.length]!;
      const impressions = Math.round(base.impressions * noise(`${key}|i`, 0.5) * (FORMAT_FACTOR[format] ?? 1) ** 0.5);
      const er = base.er * (FORMAT_FACTOR[format] ?? 1) * TOPIC_FACTOR[topic] * HOUR_FACTOR[hour]! * noise(`${key}|e`, 0.12);
      const engagements = Math.round(impressions * er);
      out.push({
        id: key, platform, date, hour, format, topic, impressions,
        reach: Math.round(impressions * 0.72 * noise(`${key}|r`, 0.05)),
        engagements, er: engagements / impressions,
        views: ['Reel', 'Video corto', 'Short', 'Video', 'Video largo', 'Duo'].includes(format) ? Math.round(impressions * 0.55) : 0,
        shares: Math.round(engagements * 0.14 * noise(`${key}|s`, 0.3)),
        saves: Math.round(engagements * 0.1 * noise(`${key}|v`, 0.3)),
        comments: Math.round(engagements * 0.08 * noise(`${key}|c`, 0.3)),
        clicks: Math.round(impressions * 0.011 * noise(`${key}|k`, 0.3)),
      });
    }
  }
  cache = out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  return cache;
}

/** Mínimo de publicaciones para un análisis; con menos se amplía a 30 días y se avisa. */
export const MIN_POSTS = 8;
/** Mínimo de publicaciones en una hora para fiarse de su rendimiento. */
export const MIN_POSTS_PER_HOUR = 3;

export interface PostSelection {
  readonly posts: readonly SocialPost[];
  /** `true` si el periodo pedido tenía pocas publicaciones y se usaron los últimos 30 días. */
  readonly widened: boolean;
  readonly range: DateRange;
}

export function selectPosts(range: DateRange, platforms: readonly Platform[]): PostSelection {
  const within = (r: DateRange) => allPosts().filter((p) => platforms.includes(p.platform) && p.date >= r.from && p.date <= r.to);
  const first = within(range);
  if (first.length >= MIN_POSTS) return { posts: first, widened: false, range };
  const wide = { from: addDays(range.to, -29), to: range.to };
  return { posts: within(wide), widened: true, range: wide };
}

export interface PerformanceRow {
  readonly label: string;
  readonly n: number;
  /** Interacciones ÷ impresiones del grupo (no el promedio de tasas). */
  readonly er: number;
}

const erOf = (posts: readonly SocialPost[]): number => {
  const imp = posts.reduce((s, p) => s + p.impressions, 0);
  return imp > 0 ? posts.reduce((s, p) => s + p.engagements, 0) / imp : 0;
};

export function topByEngagement(posts: readonly SocialPost[], limit = 6): SocialPost[] {
  return [...posts].sort((a, b) => b.er - a.er).slice(0, limit);
}

/** Rendimiento por formato o por tema, de mejor a peor. */
export function performanceBy(posts: readonly SocialPost[], by: 'format' | 'topic'): PerformanceRow[] {
  const groups = new Map<string, SocialPost[]>();
  for (const p of posts) groups.set(p[by], [...(groups.get(p[by]) ?? []), p]);
  return [...groups.entries()].map(([label, g]) => ({ label, n: g.length, er: erOf(g) })).sort((a, b) => b.er - a.er);
}

export interface HourRow {
  readonly hour: number;
  readonly n: number;
  readonly er: number | null;
  /** Pocas publicaciones en esa hora: la cifra es frágil. */
  readonly fragile: boolean;
}

export function performanceByHour(posts: readonly SocialPost[]): { rows: HourRow[]; average: number | null; best: number | null } {
  const rows = [...new Set(posts.map((p) => p.hour))].sort((a, b) => a - b).map((hour): HourRow => {
    const g = posts.filter((p) => p.hour === hour);
    return { hour, n: g.length, er: g.length > 0 ? erOf(g) : null, fragile: g.length < MIN_POSTS_PER_HOUR };
  });
  const solid = rows.filter((r) => !r.fragile && r.er !== null);
  const best = [...solid].sort((a, b) => (b.er ?? 0) - (a.er ?? 0))[0]?.hour ?? null;
  return { rows, average: posts.length ? erOf(posts) : null, best };
}

export function daysCovered(): number {
  return eachDay(SERIES_START, SERIES_END).length;
}
