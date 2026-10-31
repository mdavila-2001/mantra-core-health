import { HttpErrorResponse } from '@angular/common/http';

import { errorToViewState } from '../../../core/http/error-to-view-state';

/**
 * Los motivos que la API devuelve en `details.reason` (o `code`), en usted.
 * Los que no están acá caen al mensaje genérico de su estado.
 */
const REASONS: Readonly<Record<string, string>> = {
  SUPPORT_STAFF_NOT_FOUND:
    'No hay ninguna secretaria registrada con ese documento. Pídale que cree su cuenta de personal de apoyo y vuelva a intentarlo.',
  SUPPORT_LINK_DUPLICATE: 'Ya existe ese vínculo: está pendiente o activo.',
  SUPPORT_LINK_NOT_AWAITING_YOU: 'Este vínculo ya no espera su respuesta. Recargue la página.',
  SUPPORT_TARGET_NOT_FOUND: 'El doctor o el piso elegido ya no existe en la organización.',
  SUPPORT_TARGET_INVALID: 'Ese doctor o piso no es de la organización elegida.',
  SUPPORT_ORGANIZATION_NOT_FOUND: 'No encontramos la organización.',
  SUPPORT_ORGANIZATION_ADMIN_REQUIRED: 'Para esto tiene que administrar el hospital activo.',
  SUPPORT_PROFILE_REQUIRED: 'Su cuenta no es de personal de apoyo.',
  SUPPORT_SCOPE_DENIED: 'No trabaja con ese doctor.',
  NATIONAL_ID_ALREADY_REGISTERED: 'Ya existe una cuenta con ese documento. Inicie sesión.',
};

function reasonOf(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse) || typeof error.error !== 'object' || error.error === null) return null;
  const cuerpo = error.error as { code?: unknown; reason?: unknown; details?: { reason?: unknown } };
  // La API manda el motivo en `reason` (o en `details.reason`) y a veces como `code`.
  const candidatos = [cuerpo.reason, cuerpo.details?.reason, cuerpo.code];
  return (
    candidatos.find((c): c is string => typeof c === 'string' && Object.hasOwn(REASONS, c)) ?? null
  );
}

/** El mensaje, en usted, de una operación del personal de apoyo que falló. */
export function supportFailureMessage(error: unknown): string {
  const reason = reasonOf(error);
  if (reason !== null) return REASONS[reason]!;
  const state = errorToViewState<null>(error);
  switch (state.status) {
    case 'validation':
      return state.issues.map((issue) => issue.message).join(' ') || 'Revise los datos e intente de nuevo.';
    case 'forbidden':
      return state.message ?? 'No tiene permiso para hacer esto en esta organización.';
    case 'not-found':
      return 'No lo encontramos: puede que ya no exista.';
    case 'offline':
      return 'No pudimos conectarnos. Revise su conexión y reintente.';
    case 'error':
      return `${state.message || 'Ocurrió un error inesperado.'} (${state.requestId})`;
    default:
      return 'Ocurrió un error inesperado.';
  }
}
