/* ============================================================================
    Fechas del dominio: siempre cadenas `YYYY-MM-DD` en UTC. Sin zonas horarias
    ni `Date` local: dos máquinas en husos distintos deben ver el mismo día.
    ========================================================================== */

const DAY_MS = 86_400_000;

export function parseDate(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${d.getUTCFullYear()}-${mm}-${dd}`;
}

export function addDays(iso: string, days: number): string {
  return formatDate(parseDate(iso) + days * DAY_MS);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to) - parseDate(from)) / DAY_MS);
}

/** Lista inclusiva de días entre dos fechas. */
export function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let ms = parseDate(from); ms <= parseDate(to); ms += DAY_MS) out.push(formatDate(ms));
  return out;
}

/** 0 = lunes … 6 = domingo. */
export function weekdayIndex(iso: string): number {
  return (new Date(parseDate(iso)).getUTCDay() + 6) % 7;
}

/** Lunes de la semana que contiene la fecha. */
export function weekStart(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export const WEEKDAY_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] as const;
const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** «18 oct». */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS_SHORT[(m ?? 1) - 1]}`;
}

/** «18 oct 2026». */
export function longDate(iso: string): string {
  return `${shortDate(iso)} ${iso.slice(0, 4)}`;
}

/** Día «de hoy» del prototipo. Fijo para que los datos y las pruebas no dependan del reloj. */
export const PROTOTYPE_TODAY = '2026-10-30';
