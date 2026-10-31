import { addDays, eachDay, PROTOTYPE_TODAY, weekdayIndex } from './dates';
import type { DateRange } from './insights.types';
import { noise } from './prng';
import { allFacts } from './facts-source';

/* ============================================================================
    Uso de la app (producto).

    Los usuarios activos se derivan de las activaciones del embudo (módulo 02):
    quien se activa hoy entra mañana en la base de usuarios mensuales. Así, una
    campaña que activa más gente mueve el MAU, y el número de aquí es coherente
    con el de allá. Los eventos, pantallas y zonas de toque son de demostración.
    ========================================================================== */

export type Platform = 'all' | 'android' | 'ios' | 'web';

export const PLATFORM_LABELS: Readonly<Record<Platform, string>> = { all: 'Todas las plataformas', android: 'Android', ios: 'iOS', web: 'Web' };
const PLATFORM_SHARE: Readonly<Record<Platform, number>> = { all: 1, android: 0.61, ios: 0.31, web: 0.08 };

const activationsByDay = (() => {
  const map = new Map<string, number>();
  for (const f of allFacts()) map.set(f.date, (map.get(f.date) ?? 0) + f.activations);
  return map;
})();

const BASE_MAU = 14_200;

function trailingActivations(date: string, days: number): number {
  let sum = 0;
  for (let i = 0; i < days; i += 1) sum += activationsByDay.get(addDays(date, -i)) ?? 0;
  return sum;
}

export interface UsageDay {
  readonly date: string;
  readonly dau: number;
  readonly wau: number;
  readonly mau: number;
  readonly sessions: number;
  readonly avgSeconds: number;
}

export function usageDay(date: string, platform: Platform): UsageDay {
  const share = PLATFORM_SHARE[platform];
  const mau = (BASE_MAU + 0.55 * trailingActivations(date, 45)) * share * noise(`mau|${date}`, 0.004);
  const weekday = weekdayIndex(date);
  const stick = (0.215 + (weekday < 5 ? 0.018 : -0.03)) * noise(`dau|${platform}|${date}`, 0.04);
  const dau = mau * stick;
  const wau = Math.min(mau, dau * 2.7 * noise(`wau|${date}`, 0.01));
  return {
    date,
    dau: Math.round(dau),
    wau: Math.round(wau),
    mau: Math.round(mau),
    sessions: Math.round(dau * 1.9 * noise(`ses|${platform}|${date}`, 0.03)),
    avgSeconds: Math.round(212 * noise(`dur|${platform}|${date}`, 0.04) * (platform === 'web' ? 1.25 : 1)),
  };
}

export function usageSeries(range: DateRange, platform: Platform): UsageDay[] {
  return eachDay(range.from, range.to > PROTOTYPE_TODAY ? PROTOTYPE_TODAY : range.to).map((d) => usageDay(d, platform));
}

export interface UsageSummary {
  readonly dau: number;
  readonly wau: number;
  readonly mau: number;
  readonly stickiness: number;
  readonly sessionsPerUser: number;
  readonly avgMinutes: number;
  readonly newUsers: number;
  readonly returningShare: number;
}

export function summarize(range: DateRange, platform: Platform): UsageSummary | null {
  const days = usageSeries(range, platform);
  if (days.length === 0) return null;
  const last = days[days.length - 1]!;
  const dau = days.reduce((s, d) => s + d.dau, 0) / days.length;
  const sessions = days.reduce((s, d) => s + d.sessions, 0);
  const users = days.reduce((s, d) => s + d.dau, 0);
  const newUsers = Math.round(eachDay(range.from, range.to).reduce((s, d) => s + (activationsByDay.get(d) ?? 0), 0) * PLATFORM_SHARE[platform]);
  return {
    dau: Math.round(dau),
    wau: last.wau,
    mau: last.mau,
    stickiness: dau / last.mau,
    sessionsPerUser: users > 0 ? sessions / users : 0,
    avgMinutes: days.reduce((s, d) => s + d.avgSeconds, 0) / days.length / 60,
    newUsers,
    returningShare: Math.max(0, 1 - newUsers / Math.max(1, last.mau)),
  };
}

/* -------------------------------------------------------------- funciones */

export interface FeatureUsage {
  readonly id: string;
  readonly label: string;
  readonly users: number;
  readonly adoption: number;
  readonly completion: number | null;
  readonly change: number;
  readonly note: string;
}

const FEATURES: readonly { id: string; label: string; adoption: number; completion: number | null; note: string }[] = [
  { id: 'search', label: 'Buscar médico', adoption: 0.72, completion: null, note: 'Función de entrada: casi todos la usan.' },
  { id: 'book', label: 'Agendar consulta', adoption: 0.34, completion: 0.68, note: 'El 32 % de quienes empiezan no termina.' },
  { id: 'tele', label: 'Telemedicina', adoption: 0.19, completion: 0.81, note: 'Poco uso pero buena finalización.' },
  { id: 'history', label: 'Historia clínica', adoption: 0.41, completion: null, note: 'Consulta recurrente.' },
  { id: 'posts', label: 'Publicaciones', adoption: 0.52, completion: null, note: 'Contenido de la comunidad.' },
  { id: 'messages', label: 'Mensajes', adoption: 0.27, completion: null, note: 'Uso moderado.' },
  { id: 'pharmacy', label: 'Farmacia', adoption: 0.14, completion: 0.59, note: 'Cuatro de cada diez no completan el pedido.' },
  { id: 'lab', label: 'Laboratorio', adoption: 0.11, completion: 0.74, note: 'Uso bajo.' },
  { id: 'events', label: 'Eventos', adoption: 0.24, completion: null, note: 'Uso estable.' },
  { id: 'research', label: 'Investigación', adoption: 0.08, completion: null, note: 'Casi nadie la usa: evalúe si aporta valor.' },
];

export function featureAdoption(range: DateRange, platform: Platform): FeatureUsage[] {
  const s = summarize(range, platform);
  if (!s) return [];
  return FEATURES.map((f) => {
    const adoption = Math.min(0.95, f.adoption * noise(`ad|${f.id}|${platform}|${range.from}`, 0.04));
    return {
      id: f.id,
      label: f.label,
      users: Math.round(s.mau * adoption),
      adoption,
      completion: f.completion === null ? null : f.completion * noise(`co|${f.id}|${range.from}`, 0.03),
      change: (noise(`ch|${f.id}|${range.to}`, 0.12) - 1) * 0.8,
      note: f.note,
    };
  }).sort((a, b) => b.adoption - a.adoption);
}

/* -------------------------------------------------------------- pantallas */

export interface ScreenRow {
  readonly id: string;
  readonly label: string;
  readonly views: number;
  readonly avgSeconds: number;
  readonly exitRate: number;
  readonly rageTaps: number;
}

const SCREENS: readonly { id: string; label: string; share: number; sec: number; exit: number; rage: number }[] = [
  { id: 'home', label: 'Inicio', share: 1, sec: 38, exit: 0.14, rage: 0.004 },
  { id: 'search', label: 'Buscar médico', share: 0.62, sec: 96, exit: 0.21, rage: 0.011 },
  { id: 'profile', label: 'Perfil de médico', share: 0.44, sec: 74, exit: 0.33, rage: 0.009 },
  { id: 'book', label: 'Agendar consulta', share: 0.26, sec: 121, exit: 0.38, rage: 0.034 },
  { id: 'history', label: 'Historia clínica', share: 0.31, sec: 143, exit: 0.17, rage: 0.006 },
  { id: 'tele', label: 'Telemedicina', share: 0.13, sec: 610, exit: 0.12, rage: 0.015 },
  { id: 'pharmacy', label: 'Farmacia', share: 0.1, sec: 88, exit: 0.44, rage: 0.028 },
  { id: 'events', label: 'Eventos', share: 0.17, sec: 52, exit: 0.29, rage: 0.003 },
];

export function screenTable(range: DateRange, platform: Platform): ScreenRow[] {
  const days = usageSeries(range, platform);
  const sessions = days.reduce((s, d) => s + d.sessions, 0);
  return SCREENS.map((s) => ({
    id: s.id,
    label: s.label,
    views: Math.round(sessions * s.share * 1.6 * noise(`v|${s.id}|${range.from}`, 0.03)),
    avgSeconds: Math.round(s.sec * noise(`t|${s.id}`, 0.04)),
    exitRate: Math.min(0.9, s.exit * noise(`e|${s.id}|${range.to}`, 0.05)),
    rageTaps: s.rage * noise(`r|${s.id}`, 0.08),
  }));
}

/* ---------------------------------------------------------- mapa de toques */

export interface HeatZone {
  readonly id: string;
  readonly label: string;
  /** Posición y tamaño en porcentaje de la pantalla. */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** Porcentaje de todos los toques de la pantalla. */
  readonly taps: number;
}

export interface ScreenHeat {
  readonly id: string;
  readonly label: string;
  readonly zones: readonly HeatZone[];
  /** Porcentaje de sesiones que llega a cada 10 % de profundidad de desplazamiento. */
  readonly scroll: readonly number[];
}

export const SCREEN_HEAT: readonly ScreenHeat[] = [
  {
    id: 'search',
    label: 'Buscar médico',
    scroll: [100, 96, 88, 74, 58, 43, 31, 20, 12, 8],
    zones: [
      { id: 'q', label: 'Barra de búsqueda', x: 5, y: 6, w: 90, h: 8, taps: 27.4 },
      { id: 'f', label: 'Filtros', x: 5, y: 15.5, w: 90, h: 6, taps: 9.1 },
      { id: 'map', label: 'Ver en mapa', x: 62, y: 23, w: 33, h: 5, taps: 1.2 },
      { id: 'r1', label: 'Primer resultado', x: 5, y: 30, w: 90, h: 17, taps: 24.8 },
      { id: 'r2', label: 'Segundo resultado', x: 5, y: 49, w: 90, h: 17, taps: 13.6 },
      { id: 'r3', label: 'Tercer resultado', x: 5, y: 68, w: 90, h: 17, taps: 7.3 },
      { id: 'nav', label: 'Menú inferior', x: 0, y: 91, w: 100, h: 9, taps: 15.2 },
      { id: 'fav', label: 'Guardar favorito', x: 78, y: 31, w: 15, h: 6, taps: 1.4 },
    ],
  },
  {
    id: 'profile',
    label: 'Perfil de médico',
    scroll: [100, 91, 77, 59, 44, 33, 25, 16, 9, 5],
    zones: [
      { id: 'photo', label: 'Fotografía y nombre', x: 5, y: 5, w: 90, h: 16, taps: 6.2 },
      { id: 'verify', label: 'Sello de verificación', x: 60, y: 8, w: 32, h: 6, taps: 3.1 },
      { id: 'about', label: 'Descripción', x: 5, y: 23, w: 90, h: 14, taps: 5.5 },
      { id: 'prices', label: 'Precios', x: 5, y: 39, w: 90, h: 10, taps: 11.7 },
      { id: 'slots', label: 'Horarios disponibles', x: 5, y: 51, w: 90, h: 16, taps: 31.9 },
      { id: 'reviews', label: 'Opiniones', x: 5, y: 69, w: 90, h: 14, taps: 4.7 },
      { id: 'book', label: 'Botón Agendar', x: 8, y: 87, w: 84, h: 8, taps: 36 },
      { id: 'share', label: 'Compartir', x: 80, y: 3, w: 15, h: 4, taps: 0.9 },
    ],
  },
];

export const IGNORED_SHARE = 2;

/** Eventos más frecuentes del producto, con su variación frente al periodo anterior. */
export interface EventRow {
  readonly name: string;
  readonly label: string;
  readonly count: number;
  readonly users: number;
  readonly perUser: number;
  readonly change: number;
}

const EVENTS: readonly { name: string; label: string; perSession: number; reach: number }[] = [
  { name: 'app_open', label: 'Apertura de la app', perSession: 1, reach: 1 },
  { name: 'search_submit', label: 'Búsqueda enviada', perSession: 0.9, reach: 0.74 },
  { name: 'profile_view', label: 'Perfil visto', perSession: 1.4, reach: 0.52 },
  { name: 'slot_select', label: 'Horario elegido', perSession: 0.32, reach: 0.31 },
  { name: 'booking_confirm', label: 'Reserva confirmada', perSession: 0.19, reach: 0.18 },
  { name: 'booking_abandon', label: 'Reserva abandonada', perSession: 0.1, reach: 0.1 },
  { name: 'history_open', label: 'Historia clínica abierta', perSession: 0.45, reach: 0.31 },
  { name: 'tele_start', label: 'Telemedicina iniciada', perSession: 0.09, reach: 0.09 },
  { name: 'message_send', label: 'Mensaje enviado', perSession: 0.34, reach: 0.22 },
  { name: 'post_like', label: 'Publicación valorada', perSession: 0.5, reach: 0.25 },
  { name: 'pharmacy_order', label: 'Pedido de farmacia', perSession: 0.05, reach: 0.04 },
  { name: 'error_shown', label: 'Error mostrado al usuario', perSession: 0.03, reach: 0.06 },
];

export function eventTable(range: DateRange, platform: Platform): EventRow[] {
  const days = usageSeries(range, platform);
  const sessions = days.reduce((s, d) => s + d.sessions, 0);
  const users = days.length ? days[days.length - 1]!.mau : 0;
  return EVENTS.map((e) => {
    const count = Math.round(sessions * e.perSession * noise(`ev|${e.name}|${range.from}`, 0.03));
    const u = Math.round(users * e.reach);
    return { name: e.name, label: e.label, count, users: u, perUser: u > 0 ? count / u : 0, change: (noise(`evc|${e.name}|${range.to}`, 0.15) - 1) * 0.9 };
  });
}
