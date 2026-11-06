/* ============================================================================
    The guided tour's dates and text: the clinical day (`dia-clinico.ts`, the
    same the network uses) and the barriers so no identifier reaches the
    narration.
    ========================================================================== */

import { diaClinico, partesDelDia } from '../recorrido-clinico/dia-clinico';

export { diaClinico };

/* -- Fechas ---------------------------------------------------------------- */

export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** «3 feb 2026», on the clinical day (see `dia-clinico.ts`). */
export function fechaCorta(cuando: Date): string {
  const { anio, mes, dia } = partesDelDia(cuando);
  return `${dia} ${MESES[mes - 1]} ${anio}`;
}

export function fechaValida(valor: Date | string | null | undefined): Date | null {
  if (valor === null || valor === undefined) return null;
  const fecha = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/* -- Texto ----------------------------------------------------------------- */

export const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
export const PARECE_CODIGO = /^([A-Z][A-Z0-9]*(_[A-Z0-9]+)+|[a-z_]+:[A-Z0-9_]+)$/;

/** The text if readable; `undefined` if empty or an identifier. */
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

/** The record's free text, without the final period (the template adds its own). */
export function libre(texto: string | null | undefined): string | undefined {
  return legible(texto)?.replace(/[.\s]+$/, '');
}

/** «a», «a y b», «a, b y c». */
export function enumerar(partes: readonly string[]): string {
  if (partes.length <= 1) return partes[0] ?? '';
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
}

/** Last barrier: no uuid reaches the text, even inside a free text. */
export function sinIdentificadores(texto: string): string {
  return texto.replace(UUID, '').replace(/\s{2,}/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
}
