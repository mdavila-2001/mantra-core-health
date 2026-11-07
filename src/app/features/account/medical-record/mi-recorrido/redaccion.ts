/* ============================================================================
    Wording helpers of the patient's tour: dates in sentences and on the
    detail sheet, initial case and chronological order.
    ========================================================================== */

import { DEFAULT_TIME_ZONE } from '../../../inpatient/inpatient-presentation';
import type { RegistroConVinculos } from './registro-con-vinculos.types';

/*
 * Every date of the tour is printed in the clinical day's zone, not the
 * browser's: with the browser in UTC, a consultation at 23:30 in La Paz would
 * read as the next day.
 */

/** «3 de febrero de 2026». */
export const DIA_LARGO = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: DEFAULT_TIME_ZONE,
});

/** «El 3 de febrero de 2026 se confirmó…», or «Se confirmó…» without a date. */
export function conFecha(cuando: Date | null, resto: string): string {
  if (cuando === null || Number.isNaN(cuando.getTime())) return mayusculaInicial(resto);
  return `El ${DIA_LARGO.format(cuando)} ${resto}`;
}

export function mayusculaInicial(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
}

/**
 * «Dolor de cabeza» → «dolor de cabeza», so it fits in the sentence. An
 * acronym («HTA», «ECG») is left as is: the uppercase second letter gives it away.
 */
export function minusculaInicial(texto: string): string {
  const segunda = texto.charAt(1);
  if (segunda !== '' && segunda === segunda.toLocaleUpperCase('es') && segunda !== segunda.toLocaleLowerCase('es')) {
    return texto;
  }
  return texto.charAt(0).toLocaleLowerCase('es') + texto.slice(1);
}

/** Oldest first; without a date, last. */
export function porFecha(a: RegistroConVinculos, b: RegistroConVinculos): number {
  return compararInstantes(a.cuando, b.cuando);
}

export function compararInstantes(a: Date | null, b: Date | null): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return a.getTime() - b.getTime();
}

/* ---- dates ---------------------------------------------------------------- */

const DIA_CORTO = new Intl.DateTimeFormat('es-BO', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: DEFAULT_TIME_ZONE,
});

/** «3 feb 2026», or `null` so the sheet does not draw the row. */
export function fechaCorta(cuando: Date | undefined): string | null {
  return cuando === undefined || Number.isNaN(cuando.getTime()) ? null : DIA_CORTO.format(cuando);
}

export function fechaValida(iso: string): Date | null {
  const fecha = new Date(iso);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}
