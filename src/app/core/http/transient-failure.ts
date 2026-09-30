import { HttpErrorResponse } from '@angular/common/http';

/**
 * El fallo de una petición es **transitorio** —sin red, límite de tasa, servidor
 * caído— y por lo tanto no dice nada de la sesión (TX-30): no se cierra ni se
 * borra nada, se reintenta.
 */
export function isTransientFailure(error: unknown): boolean {
  return (
    error instanceof HttpErrorResponse &&
    (error.status === 0 || error.status === 429 || error.status >= 500)
  );
}
