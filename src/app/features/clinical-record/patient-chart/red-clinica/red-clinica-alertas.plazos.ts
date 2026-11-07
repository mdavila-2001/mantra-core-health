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

const DIA_MS = 24 * 60 * 60 * 1000;

/** Whole days between two instants (never negative). */
export function diasEntre(desde: Date, hasta: Date): number {
  return Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / DIA_MS));
}

/**
 * «hoy», «hace 1 día», «hace 12 días»; from 60 days, «hace 3 meses (94 días)»:
 * months read fast and days are the figure compared with a deadline.
 */
export function antiguedad(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'hace 1 día';
  if (dias < 60) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  // No-break space: the count and its unit never split across lines.
  return `hace ${meses} meses (${dias}\u00a0días)`;
}

export function prioridadPorPlazo(dias: number, plazo: number): PrioridadDeAlerta {
  if (dias >= plazo * 3) return 'alta';
  if (dias >= plazo) return 'media';
  return 'baja';
}

export function fecha(d: Date): string {
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}
