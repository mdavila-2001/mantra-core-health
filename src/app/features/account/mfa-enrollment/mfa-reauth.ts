import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';

/**
 * Lógica pura de la **reautenticación** que la API exige para dar de alta o quitar un método de segundo paso
 * (`currentPassword` o `mfaCode`). Sin Angular, con su spec.
 */

/** Con qué se prueba quién es: la contraseña o el código de un método que ya está activo. */
export type ReauthMode = 'PASSWORD' | 'CODE';

/** Por qué falló la reautenticación, en una de pocas categorías que la pantalla sabe decir. */
export type MfaReauthFailure = 'REQUIRED' | 'FAILED' | 'TOO_MANY' | 'OFFLINE' | 'GONE' | 'OTHER';

/**
 * Lee el fallo de `POST /iam/me/mfa/totp` o `…/:id/revoke`. Se ramifica por `details.reason`
 * (`MFA_REAUTH_REQUIRED`, `MFA_REAUTH_FAILED`) y, si no se puede leer, por el estado HTTP.
 */
export function reauthFailureOf(error: unknown): MfaReauthFailure {
  if (!(error instanceof HttpErrorResponse)) return 'OTHER';
  if (error.status === 0) return 'OFFLINE';
  if (error.status === 429) return 'TOO_MANY';
  if (error.status === 404) return 'GONE';
  const motivo = readApiError(error)?.details?.['reason'];
  if (motivo === 'MFA_REAUTH_REQUIRED') return 'REQUIRED';
  if (motivo === 'MFA_REAUTH_FAILED') return 'FAILED';
  return 'OTHER';
}

export const REAUTH_FAILURE_TEXT: Readonly<Record<MfaReauthFailure, string>> = {
  REQUIRED: 'Para esto hace falta confirmar su identidad: escriba su contraseña actual o el código de su aplicación.',
  FAILED: 'La contraseña o el código no son correctos. Revíselos y vuelva a intentar.',
  TOO_MANY: 'Hizo demasiados intentos seguidos. Espere un minuto y vuelva a probar.',
  OFFLINE: 'No pudimos conectarnos. Revise su conexión y reintente.',
  GONE: 'Ese método ya no está activo. Recargue la pantalla para ver los que le quedan.',
  OTHER: 'No pudimos completar la operación. Vuelva a intentarlo.',
};
