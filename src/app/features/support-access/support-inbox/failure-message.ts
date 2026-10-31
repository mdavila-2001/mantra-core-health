import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';

/**
 * La frase con la que la API explicó un fallo («Mariela Soliz ya tiene esta
 * conversación»), o la de respaldo si no hubo explicación (sin red, un 502).
 *
 * La bandeja la usa para las **acciones** (tomar, derivar, enviar): ahí la
 * persona necesita saber qué pasó sin perder la pantalla, así que el motivo
 * va en una alerta junto al botón y no en un estado de página.
 */
export function failureMessage(failure: unknown, fallback = 'No pudimos completar la acción. Pruebe de nuevo.'): string {
  if (!(failure instanceof HttpErrorResponse)) return fallback;
  const cuerpo = readApiError(failure);
  const mensaje = cuerpo?.message.trim() ?? '';
  return mensaje === '' ? fallback : mensaje;
}
