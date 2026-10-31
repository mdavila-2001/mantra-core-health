import { HttpErrorResponse } from '@angular/common/http';

/**
 * El `reason` y los `details` de un error del contrato (`DomainException`).
 *
 * `errorToViewState` ramifica por `code` (S4/S5/S6…); varias pantallas de
 * internación además necesitan saber **cuál** regla falló —por ejemplo, para
 * ofrecer «forzar con justificación» sólo ante `BED_COMPATIBILITY_OVERRIDE_REQUIRED`—.
 */
export interface ApiReason {
  readonly status: number;
  readonly reason: string | null;
  readonly details: Readonly<Record<string, unknown>>;
}

export function apiReason(error: unknown): ApiReason | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return { status: error.status, reason: null, details: {} };
  const b = body as { reason?: unknown; details?: unknown };
  return {
    status: error.status,
    reason: typeof b.reason === 'string' ? b.reason : null,
    details: typeof b.details === 'object' && b.details !== null ? (b.details as Record<string, unknown>) : {},
  };
}
