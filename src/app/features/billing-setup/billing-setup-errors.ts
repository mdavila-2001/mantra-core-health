import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../core/http/api-error';

/**
 * El texto que manda la API cuando rechaza algo (403, 409, 422): es el que sabe
 * **qué** rechazó. Sin texto, el de respaldo de quien llama.
 */
export function apiMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = readApiError(error);
    if (body !== null && body.message !== '') return body.message;
  }
  return fallback;
}

/** ¿Es el 404 de «esta práctica todavía no tiene ejercicio fiscal»? Por código, no por texto. */
export function isMissingFiscalYear(error: unknown): boolean {
  return error instanceof HttpErrorResponse && readApiError(error)?.code === 'NOT_FOUND';
}

/** `2026-01-31` → `31/01/2026`, sin pasar por `Date`. */
export function dayMonthYear(isoDate: string): string {
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : isoDate;
}
