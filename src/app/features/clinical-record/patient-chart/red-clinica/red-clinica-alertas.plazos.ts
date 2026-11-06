/* ============================================================================
    Time helpers of the support alerts: days elapsed, «hace N días», priority
    by deadline and the short date. Apart from the rules so both stay small;
    `red-clinica-alertas.ts` re-exports the public ones.
    ========================================================================== */

/**
 * - `alta`: conviene mirarlo hoy (valor crítico, plazo muy vencido);
 * - `media`: pasó el plazo de referencia;
 * - `baja`: abierto, pero dentro de lo esperable, o un patrón para tener presente.
 */
export type PrioridadDeAlerta = 'alta' | 'media' | 'baja';

const DIA_MS = 24 * 60 * 60 * 1000;

/** Días completos entre dos instantes (nunca negativo). */
export function diasEntre(desde: Date, hasta: Date): number {
  return Math.max(0, Math.floor((hasta.getTime() - desde.getTime()) / DIA_MS));
}

/**
 * «hoy», «hace 1 día», «hace 12 días»; desde 60 días, «hace 3 meses (94 días)»:
 * los meses se leen rápido y los días son el dato que se compara con un plazo.
 */
export function antiguedad(dias: number): string {
  if (dias === 0) return 'hoy';
  if (dias === 1) return 'hace 1 día';
  if (dias < 60) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30);
  return `hace ${meses} meses (${dias} días)`;
}

export function prioridadPorPlazo(dias: number, plazo: number): PrioridadDeAlerta {
  if (dias >= plazo * 3) return 'alta';
  if (dias >= plazo) return 'media';
  return 'baja';
}

export function fecha(d: Date): string {
  return d.toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}
