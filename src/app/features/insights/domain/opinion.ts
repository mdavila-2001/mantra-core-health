import { addDays, daysBetween, eachDay, longDate, weekStart } from './dates';
import { formatPercent } from './format';
import type { Confidence, DateRange, Insight } from './insights.types';
import { noise } from './prng';
import { DEPARTMENTS, allMentions, SOURCES, TOPICS, type Mention, type MentionSource, type Sentiment } from './opinion.data';
import { confidenceFor } from './campaign-insights';

/* ============================================================================
    Opinión pública: qué se dice de AloVida, cómo se siente y qué conviene hacer.

    Reglas de honestidad de este módulo:
    · el sentimiento neto solo se calcula con una muestra mínima (MIN_SENTIMENT);
    · una cifra por departamento declara su NIVEL DE REPRESENTATIVIDAD: las redes
      no son una encuesta, y un departamento con pocas menciones no habla por su
      población;
    · un tema «emergente» exige crecimiento y volumen mínimos, no solo un salto
      porcentual sobre una base pequeña;
    · el sentimiento clasificado por una herramienta es una estimación, y se dice.
    ========================================================================== */

export const MIN_SENTIMENT = 30;
export const MIN_EMERGING_VOLUME = 40;

export interface OpinionFilter {
  readonly range: DateRange;
  readonly sources: readonly MentionSource[];
}

export function select(filter: OpinionFilter): Mention[] {
  return allMentions().filter((m) => m.date >= filter.range.from && m.date <= filter.range.to && filter.sources.includes(m.source));
}

export interface SentimentSummary {
  readonly n: number;
  readonly positive: number;
  readonly neutral: number;
  readonly negative: number;
  /** Positivas menos negativas, sobre el total. `null` si la muestra no alcanza. */
  readonly net: number | null;
}

export function summarize(mentions: readonly Mention[]): SentimentSummary {
  const n = mentions.length;
  const count = (s: Sentiment) => mentions.filter((m) => m.sentiment === s).length;
  const [p, u, g] = [count('positive'), count('neutral'), count('negative')];
  return { n, positive: p, neutral: u, negative: g, net: n >= MIN_SENTIMENT ? (p - g) / n : null };
}

/** Sentimiento neto en puntos: «+12», «−35». */
export function formatNet(net: number | null): string {
  if (net === null) return '—';
  const pts = Math.round(net * 100);
  return `${pts > 0 ? '+' : pts < 0 ? '−' : ''}${Math.abs(pts)}`;
}

export function previousRange(range: DateRange): DateRange {
  const days = daysBetween(range.from, range.to) + 1;
  return { from: addDays(range.from, -days), to: addDays(range.from, -1) };
}

/* ---------------------------------------------------------- sentimiento */

export interface SentimentPoint {
  readonly label: string;
  readonly positive: number | null;
  readonly neutral: number | null;
  readonly negative: number | null;
  readonly n: number;
}

/** Composición del sentimiento por día o por semana (100 %). Sin muestra → `null`, no 0. */
export function sentimentSeries(filter: OpinionFilter, weekly: boolean): SentimentPoint[] {
  const mentions = select(filter);
  const keyOf = (date: string) => (weekly ? weekStart(date) : date);
  const keys = [...new Set(eachDay(filter.range.from, filter.range.to).map(keyOf))];
  const minimum = weekly ? MIN_SENTIMENT : 20;
  return keys.map((key) => {
    const group = mentions.filter((m) => keyOf(m.date) === key);
    const s = summarize(group);
    const ok = s.n >= minimum;
    return { label: key, positive: ok ? s.positive / s.n : null, neutral: ok ? s.neutral / s.n : null, negative: ok ? s.negative / s.n : null, n: s.n };
  });
}

export function mentionsSeries(filter: OpinionFilter): { labels: string[]; values: number[] } {
  const days = eachDay(filter.range.from, filter.range.to);
  const counts = new Map<string, number>();
  for (const m of select(filter)) counts.set(m.date, (counts.get(m.date) ?? 0) + 1);
  return { labels: days, values: days.map((d) => counts.get(d) ?? 0) };
}

/* ----------------------------------------------------------------- temas */

export interface TopicRow {
  readonly id: string;
  readonly label: string;
  readonly volume: number;
  readonly previous: number;
  readonly growth: number | null;
  readonly summary: SentimentSummary;
  readonly previousNet: number | null;
  readonly emerging: boolean;
  readonly reach: number;
}

export function topicTable(filter: OpinionFilter): TopicRow[] {
  const now = select(filter);
  const before = select({ ...filter, range: previousRange(filter.range) });
  return TOPICS.map((t) => {
    const a = now.filter((m) => m.topic === t.id);
    const b = before.filter((m) => m.topic === t.id);
    const growth = b.length >= 15 ? (a.length - b.length) / b.length : null;
    return {
      id: t.id,
      label: t.label,
      volume: a.length,
      previous: b.length,
      growth,
      summary: summarize(a),
      previousNet: summarize(b).net,
      emerging: a.length >= MIN_EMERGING_VOLUME && growth !== null && growth >= 0.5,
      reach: a.reduce((s, m) => s + m.reach, 0),
    };
  }).sort((x, y) => y.volume - x.volume);
}

/* ----------------------------------------------- señales de búsqueda */

export interface SearchSignal {
  readonly id: 'interest' | 'opinion' | 'intent';
  readonly label: string;
  readonly meaning: string;
  readonly index: number;
  readonly change: number | null;
  readonly values: number[];
}

/**
 * Interés, opinión e intención se separan a propósito: buscar «telemedicina» es
 * interés, buscar «AloVida opiniones» es opinión y buscar «agendar consulta
 * telemedicina» es intención. Mezclarlas infla el interés con ruido.
 * Índice relativo 0–100 (prototipo), no volumen absoluto.
 */
export function searchSignals(range: DateRange): SearchSignal[] {
  const days = eachDay(range.from, range.to);
  const defs = [
    { id: 'interest', label: 'Interés', meaning: 'Búsquedas sobre el tema: «telemedicina», «médico especialista».', base: 54, slope: 0.12 },
    { id: 'opinion', label: 'Opinión', meaning: 'Búsquedas para evaluar la marca: «AloVida opiniones».', base: 31, slope: 0.07 },
    { id: 'intent', label: 'Intención', meaning: 'Búsquedas para actuar: «agendar consulta online».', base: 22, slope: 0.18 },
  ] as const;
  const prev = previousRange(range);
  return defs.map((d) => {
    const at = (date: string) => Math.max(0, d.base + d.slope * daysBetween('2026-08-01', date) + (noise(`${d.id}|${date}`, 0.18) - 1) * d.base);
    const values = days.map(at);
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
    const before = eachDay(prev.from, prev.to).map(at);
    const index = mean(values);
    return { id: d.id, label: d.label, meaning: d.meaning, index, change: before.length && mean(before) > 0 ? (index - mean(before)) / mean(before) : null, values };
  });
}

/* ----------------------------------------------------- departamentos */

export type Representativity = 'high' | 'medium' | 'low';
export const REPRESENTATIVITY_LABELS: Readonly<Record<Representativity, string>> = { high: 'Alta', medium: 'Media', low: 'Baja' };

export interface DepartmentRow {
  readonly id: string;
  readonly label: string;
  readonly mentions: number;
  readonly summary: SentimentSummary;
  readonly representativity: Representativity;
  readonly topTopic: string | null;
}

export function departmentTable(filter: OpinionFilter): DepartmentRow[] {
  const mentions = select(filter);
  return DEPARTMENTS.map((d): DepartmentRow => {
    const group = mentions.filter((m) => m.department === d.id);
    const counts = new Map<string, number>();
    for (const m of group) counts.set(m.topic, (counts.get(m.topic) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      id: d.id,
      label: d.label,
      mentions: group.length,
      summary: summarize(group),
      representativity: group.length >= 600 ? 'high' : group.length >= 150 ? 'medium' : 'low',
      topTopic: top ? (TOPICS.find((t) => t.id === top[0])?.label ?? null) : null,
    };
  }).sort((a, b) => b.mentions - a.mentions);
}

/* ------------------------------------------------ cuota de voz */

export interface VoiceRow {
  readonly name: string;
  readonly own: boolean;
  readonly mentions: number;
  readonly share: number;
  readonly positiveShare: number;
  readonly negativeShare: number;
}

/**
 * Cuota de voz: cuánto de la conversación del sector es de AloVida, y cuánto de
 * la conversación POSITIVA y NEGATIVA. Los competidores son genéricos (datos de
 * demostración): un nombre real sin fuente sería inventar un hecho.
 */
export function shareOfVoice(filter: OpinionFilter): VoiceRow[] {
  const own = summarize(select(filter));
  const rivals = [
    { name: 'Competidor A', k: 1.4, pos: 0.4, neg: 0.18 },
    { name: 'Competidor B', k: 0.9, pos: 0.32, neg: 0.27 },
    { name: 'Competidor C', k: 0.55, pos: 0.29, neg: 0.22 },
  ];
  const rows = [
    { name: 'AloVida', own: true, mentions: own.n, pos: own.positive, neg: own.negative },
    ...rivals.map((r) => {
      const n = Math.round(own.n * r.k * noise(`sov|${r.name}|${filter.range.from}`, 0.05));
      return { name: r.name, own: false, mentions: n, pos: Math.round(n * r.pos), neg: Math.round(n * r.neg) };
    }),
  ];
  const total = rows.reduce((s, r) => s + r.mentions, 0) || 1;
  const posTotal = rows.reduce((s, r) => s + r.pos, 0) || 1;
  const negTotal = rows.reduce((s, r) => s + r.neg, 0) || 1;
  return rows.map((r) => ({ name: r.name, own: r.own, mentions: r.mentions, share: r.mentions / total, positiveShare: r.pos / posTotal, negativeShare: r.neg / negTotal }));
}

/* ------------------------------------------------- cola de respuesta */

export function responseQueue(filter: OpinionFilter, limit = 12): Mention[] {
  const score = (m: Mention) => (m.sentiment === 'negative' ? 2 : 1) * m.reach;
  return select(filter).filter((m) => m.needsResponse && !m.responded).sort((a, b) => score(b) - score(a) || b.date.localeCompare(a.date)).slice(0, limit);
}

export function responseStats(filter: OpinionFilter): { needing: number; pending: number; rate: number | null } {
  const needing = select(filter).filter((m) => m.needsResponse);
  const pending = needing.filter((m) => !m.responded).length;
  return { needing: needing.length, pending, rate: needing.length >= MIN_SENTIMENT ? 1 - pending / needing.length : null };
}

export function sourceBreakdown(filter: OpinionFilter): { source: MentionSource; mentions: number; net: number | null }[] {
  const mentions = select(filter);
  return SOURCES.map((s) => {
    const group = mentions.filter((m) => m.source === s);
    return { source: s, mentions: group.length, net: summarize(group).net };
  }).sort((a, b) => b.mentions - a.mentions);
}

/* --------------------------------------------------------- medios */

export interface MediaItem {
  readonly id: string;
  readonly date: string;
  readonly outlet: string;
  readonly title: string;
  readonly tone: Sentiment;
  readonly reach: number;
}

/** Notas de prensa de demostración: titulares genéricos de medios ficticios. */
export function mediaMentions(filter: OpinionFilter): MediaItem[] {
  const base: Omit<MediaItem, 'date'>[] = [
    { id: 'p1', outlet: 'Medio digital A', title: 'La telemedicina gana terreno entre los pacientes de las capitales', tone: 'positive', reach: 18_000 },
    { id: 'p2', outlet: 'Medio digital B', title: 'Plataformas de salud enfrentan dudas sobre la verificación de profesionales', tone: 'negative', reach: 12_500 },
    { id: 'p3', outlet: 'Diario regional C', title: 'Consultas por videollamada: qué debe saber el paciente', tone: 'neutral', reach: 6_400 },
    { id: 'p4', outlet: 'Medio digital A', title: 'Receta digital: cuántas farmacias ya la aceptan', tone: 'neutral', reach: 9_100 },
    { id: 'p5', outlet: 'Radio en línea D', title: 'Salud en provincias: la brecha de conexión limita la atención remota', tone: 'negative', reach: 7_800 },
  ];
  const dates = ['2026-10-26', '2026-10-23', '2026-10-17', '2026-10-09', '2026-10-03'];
  return base.map((b, i) => ({ ...b, date: dates[i]! })).filter((i) => i.date >= filter.range.from && i.date <= filter.range.to);
}

/* ----------------------------------------------- cambios recientes */

export interface TopicShift {
  readonly id: string;
  readonly label: string;
  /** Sentimiento neto de la última semana y de las tres anteriores. */
  readonly recentNet: number;
  readonly baselineNet: number;
  readonly delta: number;
  readonly recentVolume: number;
  readonly baselineDailyVolume: number;
  readonly recentDailyVolume: number;
  readonly since: string;
}

/**
 * Cambio reciente de sentimiento por tema: últimos 7 días del periodo contra los
 * 21 anteriores. Un promedio de todo el periodo diluye un empeoramiento de una
 * semana; esta ventana corta lo encuentra. Exige muestra en ambas ventanas.
 */
export function topicShifts(filter: OpinionFilter): TopicShift[] {
  const end = filter.range.to;
  const recentFrom = addDays(end, -6);
  const baseFrom = addDays(recentFrom, -21);
  const all = select({ ...filter, range: { from: baseFrom, to: end } });
  return TOPICS.flatMap((t) => {
    const recent = summarize(all.filter((m) => m.topic === t.id && m.date >= recentFrom));
    const base = summarize(all.filter((m) => m.topic === t.id && m.date < recentFrom));
    if (recent.n < 25 || base.n < MIN_SENTIMENT || recent.net === null || base.net === null) return [];
    return [{ id: t.id, label: t.label, recentNet: recent.net, baselineNet: base.net, delta: recent.net - base.net, recentVolume: recent.n, baselineDailyVolume: base.n / 21, recentDailyVolume: recent.n / 7, since: recentFrom }];
  }).sort((a, b) => a.delta - b.delta);
}

/* -------------------------------------------------------- hallazgos */

export function opinionInsights(filter: OpinionFilter): Insight[] {
  const out: Insight[] = [];
  const mentions = select(filter);
  if (mentions.length < MIN_SENTIMENT) return out;
  const conf = confidenceFor(mentions.length * 6, daysBetween(filter.range.from, filter.range.to) + 1);
  const confidence: Confidence = conf.level === 'high' ? 'medium' : conf.level; // sentimiento clasificado: nunca «alta»
  const base = { module: 'opinion' as const, confidence, confidenceFactors: [...conf.factors, 'sentimiento estimado por clasificación automática'] };
  const trace = (method: string) => ({
    period: `${longDate(filter.range.from)} — ${longDate(filter.range.to)}`,
    sources: [{ label: 'Menciones analizadas', count: mentions.length, unit: 'menciones' }],
    method,
  });
  const topics = topicTable(filter);

  const worsening = topicShifts(filter).find((t) => t.delta <= -0.2);
  if (worsening) {
    out.push({
      ...base,
      id: `worse-${worsening.id}`,
      title: `El sentimiento sobre «${worsening.label}» empeoró ${(Math.abs(worsening.delta) * 100).toFixed(0)} puntos en la última semana`,
      statements: [
        { level: 'observed', text: `El sentimiento neto pasó de ${formatNet(worsening.baselineNet)} a ${formatNet(worsening.recentNet)} puntos (últimos 7 días frente a las 3 semanas previas), con ${worsening.recentVolume.toLocaleString('es-BO')} menciones recientes.` },
        { level: 'interpretation', text: 'La conversación sobre este tema se volvió más crítica y concentra quejas recientes.' },
        { level: 'hypothesis', text: 'Puede deberse a un cambio reciente en el producto o a un hecho ajeno (una nota de prensa, un caso viral). Revise el calendario de cambios antes de atribuirlo.' },
      ],
      trace: trace('Sentimiento neto = (positivas − negativas) ÷ menciones, por tema: últimos 7 días contra los 21 anteriores.'),
      action: { label: 'Ver la cola de respuesta', module: 'opinion', query: {} },
    });
  }

  const emerging = topics.filter((t) => t.emerging).sort((a, b) => (b.growth ?? 0) - (a.growth ?? 0))[0];
  if (emerging && emerging.id !== worsening?.id) {
    out.push({
      ...base,
      id: `emerging-${emerging.id}`,
      title: `«${emerging.label}» crece ${formatPercent(emerging.growth ?? 0, 0)} en la conversación`,
      statements: [
        { level: 'observed', text: `${emerging.volume.toLocaleString('es-BO')} menciones frente a ${emerging.previous.toLocaleString('es-BO')} en el periodo anterior.` },
        { level: 'interpretation', text: 'Es un tema emergente: crece con volumen suficiente para no ser ruido de una base pequeña.' },
        { level: 'hypothesis', text: 'Puede ser una necesidad sin cobertura. Compruebe si hay una campaña o una función que la atienda antes de decidir una inversión.' },
      ],
      trace: trace('Tema emergente = crecimiento ≥ 50 % y al menos 40 menciones.'),
      action: { label: 'Explorar temas', module: 'opinion', query: {} },
    });
  }

  const queue = responseStats(filter);
  if (queue.pending >= 10) {
    out.push({
      ...base,
      id: 'response-backlog',
      title: `${queue.pending.toLocaleString('es-BO')} menciones que piden respuesta siguen sin atender`,
      statements: [
        { level: 'observed', text: `De ${queue.needing.toLocaleString('es-BO')} menciones con una pregunta o queja, ${queue.pending.toLocaleString('es-BO')} no tienen respuesta registrada.` },
        { level: 'interpretation', text: 'Una queja sin respuesta pública amplifica el sentimiento negativo y deja sin resolver una necesidad real.' },
        { level: 'hypothesis', text: 'Es probable que el volumen reciente supere la capacidad del equipo de comunidad; lo confirmará el tiempo medio de primera respuesta.' },
      ],
      trace: trace('Cola = menciones negativas o preguntas sin respuesta registrada, ordenadas por alcance.'),
      action: { label: 'Atender la cola', module: 'opinion', query: {} },
    });
  }
  return out;
}
