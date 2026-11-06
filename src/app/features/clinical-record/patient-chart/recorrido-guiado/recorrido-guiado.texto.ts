/* ============================================================================
    Fechas y texto del recorrido guiado: el día en UTC (mismo criterio que
    `fechaClinica` de `account/medical-record/history-view-model.ts`, que no se
    exporta) y las barreras para que ningún identificador llegue a la narración.
    ========================================================================== */

/* -- Fechas ---------------------------------------------------------------- */

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** «3 feb 2026», leído en UTC (ver cabecera). */
export function fechaCorta(cuando: Date): string {
  return `${cuando.getUTCDate()} ${MESES[cuando.getUTCMonth()]} ${cuando.getUTCFullYear()}`;
}

/** `2026-02-03`: la clave del día UTC. */
export function diaUtc(cuando: Date): string {
  return cuando.toISOString().slice(0, 10);
}

export function fechaValida(valor: Date | string | null | undefined): Date | null {
  if (valor === null || valor === undefined) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/* -- Texto ----------------------------------------------------------------- */

export const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
export const PARECE_CODIGO = /^([A-Z][A-Z0-9]*(_[A-Z0-9]+)+|[a-z_]+:[A-Z0-9_]+)$/;

/** El texto si es legible; `undefined` si está vacío o es un identificador. */
export function legible(texto: string | null | undefined): string | undefined {
  const limpio = texto?.trim();
  if (limpio === undefined || limpio.length === 0) return undefined;
  if (PARECE_CODIGO.test(limpio)) return undefined;
  if (limpio.replace(UUID, '').trim().length === 0) return undefined;
  return limpio;
}

/** «Cefalea» → «cefalea», pero «VIH» sigue siendo «VIH». */
export function minusculaInicial(texto: string): string {
  const [primera, segunda] = texto;
  if (primera === undefined) return texto;
  if (segunda !== undefined && segunda === segunda.toUpperCase() && segunda !== segunda.toLowerCase()) {
    return texto;
  }
  return primera.toLowerCase() + texto.slice(1);
}

export function mayusculaInicial(texto: string): string {
  return texto.length === 0 ? texto : texto[0].toUpperCase() + texto.slice(1);
}

/** Texto libre del registro, sin el punto final (la plantilla pone el suyo). */
export function libre(texto: string | null | undefined): string | undefined {
  return legible(texto)?.replace(/[.\s]+$/, '');
}

/** «a», «a y b», «a, b y c». */
export function enumerar(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/** Última barrera: ningún uuid llega al texto, aunque venga dentro de un texto libre. */
export function sinIdentificadores(texto: string): string {
  return texto.replace(UUID, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
}
