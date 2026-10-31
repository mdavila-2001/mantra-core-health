import { addDays, weekdayIndex } from '../../../core/data-access/insights/insights-dates';

export {
  addDays,
  daysBetween,
  eachDay,
  formatDate,
  parseDate,
  weekdayIndex,
} from '../../../core/data-access/insights/insights-dates';

/** Lunes de la semana que contiene la fecha. */
export function weekStart(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export const WEEKDAY_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;
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
export const PROTOTYPE_TODAY = '2026-10-29';
