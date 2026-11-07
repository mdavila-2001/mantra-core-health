/* ============================================================================
    Time helpers of the support alerts: days elapsed, «hace N días», priority
    by deadline and the short date. Apart from the rules so both stay small;
    `red-clinica-alertas.ts` re-exports the public ones.
    ========================================================================== */

/**
 * - `alta`: worth looking at today (critical value, deadline long past);
 * - `media`: the reference deadline passed;
 * - `baja`: open, but within what is expected, or a pattern to keep in mind.
 */
export type PrioridadDeAlerta = 'alta' | 'media' | 'baja';

import { DEFAULT_TIME_ZONE } from '../../../inpatient/inpatient-presentation';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Whole days between two instants (never negative). */
export function diasEntre(desde: Date, hasta: Date): number {
  return Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / DIA_MS));
}

/** No-break space: a count and its unit never split across lines («hace 14 / días»). */
const NBSP = '\u00a0';

/**
 * «hoy», «hace 1 día», «hace 12 días»; from 60 days, «hace 3 meses»: months
 * read fast. The exact days are not repeated beside them (`antiguedadExacta`
 * gives them for a `title`, or the date next to it says it).
 */
export function antiguedad(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias === 1) return `hace 1${NBSP}día`;
  if (dias < 60) return `hace ${dias}${NBSP}días`;
  return `hace ${Math.floor(dias / 30)}${NBSP}meses`;
}

/** «94 días» when `antiguedad` rounded to months; `null` when it already says the days. */
export function antiguedadExacta(dias: number): string | null {
  return dias < 60 ? null : `${dias}${NBSP}días`;
}

export function prioridadPorPlazo(dias: number, plazo: number): PrioridadDeAlerta {
  if (dias >= plazo * 3) return 'alta';
  if (dias >= plazo) return 'media';
  return 'baja';
}

const CORTA: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** Short date of a calendar day the person picked (a filter's bounds): no zone shift. */
export function fecha(d: Date): string {
  return d.toLocaleDateString('es-BO', CORTA);
}

/** Short date of an instant in the clinical day's zone, so an alert names the same day as its column. */
export function fechaClinica(d: Date): string {
  return d.toLocaleDateString('es-BO', { ...CORTA, timeZone: DEFAULT_TIME_ZONE });
}
