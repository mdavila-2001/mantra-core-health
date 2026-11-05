import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';

/**
 * Lógica pura del alta de la verificación en dos pasos: qué se le muestra a la
 * persona y cómo se leen los fallos de la API. Sin Angular, con su spec.
 */

/** La API acepta de 6 a 8 caracteres (`ConfirmMyTotpDto.code`); un TOTP son dígitos. */
const FORMA_DEL_CODIGO = /^\d{6,8}$/;

/** Quita los espacios y guiones que la persona suele dejar al copiar el código de la aplicación («123 456»). */
export function cleanCode(texto: string): string {
  return texto.replace(/[\s-]+/g, '');
}

/** ¿Tiene la forma de un código de la aplicación? La API es la que dice si es el correcto. */
export function isCodeShape(texto: string): boolean {
  return FORMA_DEL_CODIGO.test(cleanCode(texto));
}

/**
 * El secreto en grupos de cuatro, para escribirlo a mano sin perderse:
 * `JBSWY3DPEHPK3PXP` → `JBSW Y3DP EHPK 3PXP`. Se quitan los espacios antes de
 * volver a agrupar, así que es idempotente.
 */
export function groupSecret(secreto: string): string {
  const limpio = secreto.replace(/\s+/g, '');
  return limpio.replace(/(.{4})/g, '$1 ').trim();
}

/** Por qué falló la confirmación, en una de pocas categorías que la pantalla sabe decir. */
export type MfaConfirmFailure = 'WRONG_CODE' | 'FACTOR_GONE' | 'TOO_MANY' | 'OFFLINE' | 'OTHER';

/**
 * Lee el fallo de `POST /iam/me/mfa/totp/:id/confirm`. Un código inválido es
 * `422` con `details.reason: MFA_CODE_INVALID`; se ramifica por el código y, si
 * la respuesta no se puede leer, por el estado HTTP.
 */
export function confirmFailureOf(error: unknown): MfaConfirmFailure {
  if (!(error instanceof HttpErrorResponse)) return 'OTHER';
  if (error.status === 0) return 'OFFLINE';
  if (error.status === 429) return 'TOO_MANY';
  if (error.status === 404) return 'FACTOR_GONE';
  const motivo = readApiError(error)?.details?.['reason'];
  if (motivo === 'MFA_CODE_INVALID' || error.status === 422) return 'WRONG_CODE';
  return 'OTHER';
}

export const CONFIRM_FAILURE_TEXT: Readonly<Record<MfaConfirmFailure, string>> = {
  WRONG_CODE:
    'El código no es correcto o ya venció. Los códigos cambian cada 30 segundos: espere el siguiente en su aplicación y escríbalo de nuevo.',
  FACTOR_GONE: 'Este código QR ya no sirve porque se empezó otra configuración. Empiece de nuevo para generar uno nuevo.',
  TOO_MANY: 'Hizo demasiados intentos seguidos. Espere un minuto y vuelva a probar.',
  OFFLINE: 'No pudimos conectarnos. Revise su conexión y reintente.',
  OTHER: 'No pudimos confirmar el código. Vuelva a intentarlo.',
};

/** Una dirección interna a la que volver después del alta (evita la redirección abierta). */
export function safeReturnUrl(pedido: string | null): string | null {
  if (pedido === null || pedido === '') return null;
  const externo = !pedido.startsWith('/') || /^\/[/\\]/.test(pedido);
  return externo ? null : pedido;
}
