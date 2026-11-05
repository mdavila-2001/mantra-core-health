import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';

/**
 * Lógica pura del **código de confirmación** de «Fui yo»: qué se acepta como código y cómo se leen los fallos de
 * `POST /iam/me/devices/:id/confirm` y `…/confirm-code`. Sin Angular, con su spec.
 */

/** La API pide exactamente 8 caracteres (`ConfirmDeviceDto.code`); el código que manda por correo son dígitos. */
const FORMA_DEL_CODIGO = /^\d{8}$/;

/** Quita los espacios y guiones que la persona deja al copiar el código del correo («1234 5678»). */
export function cleanDeviceCode(texto: string): string {
  return texto.replace(/[\s-]+/g, '');
}

export function isDeviceCodeShape(texto: string): boolean {
  return FORMA_DEL_CODIGO.test(cleanDeviceCode(texto));
}

/** Por qué no se pudo confirmar o pedir el código, en pocas categorías que la pantalla sabe decir. */
export type DeviceConfirmFailure =
  | 'CODE_REQUIRED'
  | 'CODE_INVALID'
  | 'NO_VERIFIED_EMAIL'
  | 'TOO_MANY'
  | 'DEVICE_GONE'
  | 'OFFLINE'
  | 'OTHER';

/** Se ramifica por `details.reason` y, si no se puede leer, por el estado HTTP. */
export function deviceConfirmFailureOf(error: unknown): DeviceConfirmFailure {
  if (!(error instanceof HttpErrorResponse)) return 'OTHER';
  if (error.status === 0) return 'OFFLINE';
  if (error.status === 429) return 'TOO_MANY';
  const motivo = readApiError(error)?.details?.['reason'];
  if (motivo === 'DEVICE_CONFIRM_CODE_REQUIRED') return 'CODE_REQUIRED';
  if (motivo === 'DEVICE_CONFIRM_CODE_INVALID') return 'CODE_INVALID';
  if (motivo === 'DEVICE_CONFIRM_NO_VERIFIED_EMAIL') return 'NO_VERIFIED_EMAIL';
  if (error.status === 404) return 'DEVICE_GONE';
  return 'OTHER';
}

export const DEVICE_CONFIRM_FAILURE_TEXT: Readonly<Record<DeviceConfirmFailure, string>> = {
  CODE_REQUIRED: 'Para confirmar este dispositivo hace falta el código que le enviamos al correo.',
  CODE_INVALID: 'El código no es correcto, es de otro dispositivo o ya se usó. Pida uno nuevo y escríbalo de nuevo.',
  NO_VERIFIED_EMAIL:
    'Su cuenta no tiene un correo verificado al que mandar el código. Confirme este dispositivo desde otra sesión abierta en un dispositivo de confianza, o elija «No fui yo» si no lo reconoce.',
  TOO_MANY: 'Hizo demasiados intentos seguidos. Espere un minuto y vuelva a probar.',
  DEVICE_GONE: 'Ese dispositivo ya no figura en su cuenta.',
  OFFLINE: 'No pudimos conectarnos. Revise su conexión y reintente.',
  OTHER: 'No pudimos guardar su respuesta. Vuelva a intentarlo.',
};
