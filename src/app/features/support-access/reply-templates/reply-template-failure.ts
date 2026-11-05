import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';

/** Por qué no se guardó una respuesta preparada. */
export interface ReplyTemplateFailure {
  readonly kind: 'STALE' | 'FORBIDDEN' | 'NOT_FOUND' | 'INVALID' | 'OFFLINE' | 'OTHER';
  readonly message: string;
  /** Con `STALE`: la versión que hoy tiene la API. */
  readonly currentVersion?: number;
}

/**
 * Lee el fallo de `POST|PATCH /org/reply-templates`. El que importa es el `409
 * REPLY_TEMPLATE_STALE`: otra persona cambió la respuesta mientras se editaba y la API
 * **no la pisa**; `details.currentVersion` dice cómo va hoy.
 */
export function replyTemplateFailureOf(error: unknown): ReplyTemplateFailure {
  if (!(error instanceof HttpErrorResponse)) return { kind: 'OTHER', message: 'No pudimos guardar la respuesta. Vuelva a intentarlo.' };
  if (error.status === 0) return { kind: 'OFFLINE', message: 'No pudimos conectarnos. Revise su conexión y reintente: no se guardó nada.' };
  const cuerpo = readApiError(error);
  if (error.status === 409 && cuerpo?.details?.['reason'] === 'REPLY_TEMPLATE_STALE') {
    const version = cuerpo.details['currentVersion'];
    return {
      kind: 'STALE',
      message: 'Otra persona cambió esta respuesta mientras usted la editaba, así que no se guardó su cambio para no pisar el de ella.',
      ...(typeof version === 'number' ? { currentVersion: version } : {}),
    };
  }
  if (error.status === 400) return { kind: 'INVALID', message: 'Revise la respuesta: el título va de 1 a 120 caracteres y el texto, de 1 a 2000.' };
  if (error.status === 403) return { kind: 'FORBIDDEN', message: 'Solo quien administra la seguridad de la organización puede cambiar sus respuestas preparadas.' };
  if (error.status === 404) return { kind: 'NOT_FOUND', message: 'Esa respuesta ya no existe. Vuelva a leer la lista.' };
  return { kind: 'OTHER', message: 'No pudimos guardar la respuesta. Vuelva a intentarlo.' };
}
