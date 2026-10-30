import { HttpErrorResponse } from '@angular/common/http';

import {
  INTEGRATION_ERROR_REASONS,
  type IntegrationErrorReason,
} from '../../../core/data-access/pharmacy/pharmacy-integration.types';
import { pharmacyErrorMessage } from '../pharmacy-error-message';

/**
 * Lo que la pestaña dice ante cada `reason` de la integración. Se ramifica por
 * `reason`, que es contrato, y no por el `message`, que es para humanos: el
 * texto es el de la API con lo que le sigue a la persona.
 */
export const INTEGRATION_ERROR_TEXT: Readonly<Record<IntegrationErrorReason, string>> = {
  PHARMACY_INTEGRATION_NOT_CONFIGURED:
    'La conexión con el sistema de la farmacia no está configurada. Mientras tanto, lleve las existencias en «Inventario».',
  PHARMACY_INTEGRATION_CONNECTION_INACTIVE:
    'La conexión no está activa o no permite consultar stock, así que no se puede sincronizar.',
  PHARMACY_INTEGRATION_UNAVAILABLE:
    'No pudimos hablar con el sistema de la farmacia. No se cambió ninguna existencia; pruebe de nuevo en unos minutos.',
};

/**
 * El `reason` de la integración que trae un error de la API, o `null`.
 *
 * La API lo manda en la raíz del cuerpo y, por compatibilidad, también en
 * `details.reason`; se lee de cualquiera de los dos.
 */
export function integrationReasonOf(error: unknown): IntegrationErrorReason | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const details = record['details'];
  const candidates = [
    record['reason'],
    typeof details === 'object' && details !== null ? (details as Record<string, unknown>)['reason'] : undefined,
  ];
  const found = candidates.find((value): value is IntegrationErrorReason =>
    (INTEGRATION_ERROR_REASONS as readonly unknown[]).includes(value),
  );
  return found ?? null;
}

/**
 * El texto de un error de la integración, para la persona: el de su `reason`
 * si lo trae (con el identificador de la petición en un 5xx, para soporte), y
 * si no, el mismo que el resto del portal de la farmacia.
 */
export function integrationErrorMessage(error: unknown, fallback: string): string {
  const reason = integrationReasonOf(error);
  if (reason === null) {
    return pharmacyErrorMessage(error, fallback);
  }
  const text = INTEGRATION_ERROR_TEXT[reason];
  const requestId = requestIdOf(error);
  return error instanceof HttpErrorResponse && error.status >= 500 && requestId !== null
    ? `${text} (petición ${requestId})`
    : text;
}

function requestIdOf(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body = error.error as Record<string, unknown> | null;
  const fromBody = typeof body === 'object' && body !== null ? body['correlationId'] : undefined;
  if (typeof fromBody === 'string' && fromBody !== '') {
    return fromBody;
  }
  return error.headers.get('x-request-id');
}
