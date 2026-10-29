import { HttpErrorResponse } from '@angular/common/http';

import { etiquetaDeRol } from '@core/auth/role-labels';

/* ============================================================================
    Lee un fallo de `/admissions` y lo vuelve algo que la pantalla sabe decir.

    No pasa por `readApiError`: esa función descarta todo cuerpo cuyo `code` no
    esté en su lista cerrada, y los motivos de una admisión (`ADMISSION_STALE`,
    `ADMISSION_REASON_REQUIRED`…) llegan o como `code` o en `details.reason`.
    Se ramifica por el estado HTTP y por ese motivo, nunca por el texto.
    ========================================================================== */

export type AdmissionErrorKind =
  | 'stale'
  | 'evidence-changed'
  | 'self-access'
  | 'role'
  | 'four-eyes'
  | 'not-assigned'
  | 'precondition'
  | 'not-found'
  | 'offline'
  | 'other';

export interface AdmissionError {
  readonly kind: AdmissionErrorKind;
  readonly status: number;
  /** Motivo estable (`ADMISSION_STALE`…), si la API lo dio. */
  readonly reason: string | null;
  /** Qué decirle a la persona, en usted. */
  readonly message: string;
  readonly requiredRole: string | null;
  readonly requestId: string | null;
}

function record(valor: unknown): Record<string, unknown> | null {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() !== '' ? valor : null;
}

/** El rol que la acción exige, dicho como lo ve la persona. */
export function roleSentence(role: string): string {
  return `«${etiquetaDeRol(role) ?? role}»`;
}

/**
 * @param fallbackRole - El rol que la acción exige, para decirlo si la API no
 *   lo nombra en un 403.
 */
export function readAdmissionError(error: unknown, fallbackRole: string | null = null): AdmissionError {
  if (!(error instanceof HttpErrorResponse)) {
    return { kind: 'other', status: 0, reason: null, message: 'Ocurrió un error inesperado.', requiredRole: null, requestId: null };
  }
  const body = record(error.error);
  const details = record(body?.['details']);
  const code = texto(body?.['code']);
  const reason = texto(details?.['reason']) ?? (code?.startsWith('ADMISSION_') ? code : null);
  const apiMessage = texto(body?.['message']);
  const requestId = texto(body?.['correlationId']);
  const base = { status: error.status, reason, requestId };

  if (error.status === 0) {
    return { ...base, kind: 'offline', message: 'No hay conexión con el servidor. Revise su red e intente de nuevo.', requiredRole: null };
  }
  if (reason === 'ADMISSION_EVIDENCE_CHANGED') {
    return {
      ...base,
      kind: 'evidence-changed',
      requiredRole: null,
      message: 'El profesional cambió este documento; revíselo de nuevo.',
    };
  }
  if (reason === 'ADMISSION_SELF_ACCESS') {
    return {
      ...base,
      kind: 'self-access',
      requiredRole: null,
      message: 'No puede revisar su propia solicitud. Pídale a otra persona del equipo que la revise.',
    };
  }
  if (error.status === 409 || reason === 'ADMISSION_STALE') {
    return {
      ...base,
      kind: 'stale',
      requiredRole: null,
      message: 'Otra persona modificó esta admisión mientras usted la revisaba. Cargamos la versión actual: revísela y vuelva a intentar.',
    };
  }
  if (error.status === 403) {
    if (reason === 'ADMISSION_FOUR_EYES') {
      return { ...base, kind: 'four-eyes', requiredRole: null, message: apiMessage ?? 'Quien tomó la revisión no puede tomar la decisión final: la resuelve otra persona.' };
    }
    if (reason === 'ADMISSION_NOT_ASSIGNED') {
      return { ...base, kind: 'not-assigned', requiredRole: null, message: apiMessage ?? 'Solo quien tomó la revisión puede verificar sus requisitos.' };
    }
    const requiredRole = texto(details?.['requiredRole']) ?? fallbackRole;
    return {
      ...base,
      kind: 'role',
      requiredRole,
      message:
        requiredRole === null
          ? 'Su cuenta no tiene permiso para esta acción.'
          : `Su cuenta no tiene el rol ${roleSentence(requiredRole)}. Pídalo a quien administra la seguridad de la plataforma.`,
    };
  }
  if (error.status === 404) {
    return { ...base, kind: 'not-found', requiredRole: null, message: 'No encontramos esta admisión. Puede que ya no exista o que no tenga acceso a ella.' };
  }
  if (error.status === 412 || error.status === 422) {
    return { ...base, kind: 'precondition', requiredRole: null, message: apiMessage ?? 'La acción no se puede realizar en el estado actual.' };
  }
  return { ...base, kind: 'other', requiredRole: null, message: apiMessage ?? 'No pudimos completar la operación.' };
}
