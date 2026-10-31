import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';
import { failureMessage } from './agenda-errors';

/**
 * El motivo de negocio que la API pone en `details.reason` (el mismo sub-código también
 * viaja arriba; se lee de `details`, que es lo que conserva `readApiError`).
 */
function reasonOf(failure: unknown): { readonly reason: string | null; readonly details: Readonly<Record<string, unknown>> } {
  if (!(failure instanceof HttpErrorResponse)) return { reason: null, details: {} };
  const body = readApiError(failure);
  const details = body?.details ?? {};
  const reason = details['reason'];
  return { reason: typeof reason === 'string' ? reason : null, details };
}

/**
 * Lo que se le dice a quien busca o registra pacientes cuando la API lo rechaza.
 *
 * - **429 `SUPPORT_PATIENT_SEARCH_THROTTLED`** trae `details.limit` (`PER_MINUTE` o `PER_DAY`)
 *   y `details.scope` (`PERSON` o `IP`). El tope **por IP** no es culpa de esta persona:
 *   es de la conexión (la misma red para varias cuentas), y se le dice distinto.
 * - **409 `SUPPORT_PATIENT_DOCUMENT_REGISTERED`** vale también para las variantes del mismo
 *   documento («01.234-567» y «1234567»): se le dice que lo busque, no que lo escriba otra vez.
 * - **400** con `details.field = 'document'`: el documento no tiene contenido (menos de 4
 *   caracteres una vez quitados puntos, guiones y espacios).
 *
 * Todo lo demás cae en el texto con que la API lo explicó (`failureMessage`).
 */
export function patientFailureMessage(failure: unknown, fallback: string): string {
  const { reason, details } = reasonOf(failure);
  if (reason === 'SUPPORT_PATIENT_SEARCH_THROTTLED') return throttledMessage(details['limit'], details['scope']);
  if (reason === 'SUPPORT_PATIENT_DOCUMENT_REGISTERED') {
    return 'Ese documento ya está registrado, aunque esté escrito de otra forma (con puntos, guiones o ceros de más). Búsquelo por documento en lugar de registrarlo de nuevo.';
  }
  if (failure instanceof HttpErrorResponse && failure.status === 400 && details['field'] === 'document') {
    return 'El documento de identidad no es válido: escríbalo completo, con al menos 4 letras o dígitos además de puntos, guiones o espacios.';
  }
  return failureMessage(failure, fallback);
}

function throttledMessage(limit: unknown, scope: unknown): string {
  const porDia = limit === 'PER_DAY';
  if (scope === 'IP') {
    return porDia
      ? 'Desde esta conexión ya se hicieron demasiadas consultas de pacientes hoy. No es un problema de su cuenta: la red que usa comparte el tope con otras personas. Vuelva a intentar mañana o use otra conexión.'
      : 'Desde esta conexión se están haciendo demasiadas consultas de pacientes. No es un problema de su cuenta: la red que usa comparte el tope con otras personas. Espere un minuto y vuelva a intentar.';
  }
  return porDia
    ? 'Alcanzó el máximo de consultas de pacientes de hoy. Podrá seguir mañana; si necesita buscar a alguien ahora, pida ayuda a su organización.'
    : 'Hizo demasiadas consultas de pacientes en poco tiempo. Espere un minuto y vuelva a intentar.';
}
