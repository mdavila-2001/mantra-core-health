import { HttpErrorResponse } from '@angular/common/http';

import { readApiError, readFieldViolations, type ApiErrorBody, type ApiErrorCode } from './api-error';

/**
 * Lo que una pantalla necesita para contar un fallo de la API sin perderlo.
 *
 * ## El defecto que corrige
 *
 * Cientos de manejadores de escritura hacen `error: () => toast('No se pudo
 * guardar. Intente de nuevo.')`. Descartan el objeto de error, y con él tres
 * cosas que la API sí manda: el mensaje de negocio («ya existe una cita en ese
 * horario»), el campo que el DTO rechazó y el `correlationId` con el que se
 * encuentra la línea del log. La persona no sabe qué corregir y quien depura no
 * tiene por dónde empezar.
 *
 * Estas dos funciones son el reemplazo de una línea para esos manejadores:
 *
 * ```ts
 * error: (err: unknown) => {
 *   this.serverErrors.set(fieldErrorsOf(err));
 *   this.toasts.error(describeApiFailure(err, 'No se pudo guardar la cita.'));
 * },
 * ```
 */

/**
 * Códigos cuyo `message` está escrito para la persona y explica qué pasó.
 *
 * Los demás no: el de `VALIDATION_FAILED` es «Error de validación» (el detalle
 * va por campo), el de `NOT_FOUND` no se repite para no confirmar que el
 * recurso existe, y el de `INTERNAL` es siempre genérico.
 */
const MESSAGE_FOR_PEOPLE: ReadonlySet<ApiErrorCode> = new Set<ApiErrorCode>([
  'CONFLICT',
  'PRECONDITION_FAILED',
  'CONCURRENCY_CONFLICT',
  'FORBIDDEN',
  'IDENTITY_VERIFICATION_REQUIRED',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'DEPENDENCY_UNAVAILABLE',
]);

/** Texto de un fallo de red: la petición no llegó al servidor. */
export const OFFLINE_MESSAGE = 'No hay conexión con el servidor. Revise su conexión e intente de nuevo.';

/**
 * El mensaje para un toast o un aviso de formulario.
 *
 * - Si la API explicó el motivo con palabras para la persona, se usa eso.
 * - Si no, el texto de la pantalla (`fallback`), que es el que sabe qué se
 *   estaba haciendo.
 * - Siempre que haya `correlationId`, se agrega como código de soporte: es lo
 *   que permite encontrar el fallo en el servidor a partir de una captura.
 *
 * @param error - Lo que entregó el `error` del `subscribe` o el `catchError`.
 * @param fallback - Qué no se pudo hacer, dicho por la pantalla.
 */
export function describeApiFailure(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (error.status === 0) {
    return OFFLINE_MESSAGE;
  }

  const body = readApiError(error);
  const reason = body !== null && MESSAGE_FOR_PEOPLE.has(body.code) && body.message.trim() !== '' ? body.message : fallback;
  const supportCode = supportCodeOf(error, body);

  return supportCode === null ? reason : `${reason} (Código de soporte: ${supportCode})`;
}

/**
 * El primer mensaje de cada campo rechazado, indexado por la ruta que mandó la
 * API (`email`, `address.city`, `items.0.quantity`).
 *
 * Pensado para el `[errorMessage]` de `app-form-field`:
 * `[errorMessage]="serverErrors()['email'] ?? ''"`. Un objeto vacío significa
 * que el fallo no fue de un campo —y entonces el aviso general es el que
 * cuenta—.
 */
export function fieldErrorsOf(error: unknown): Readonly<Record<string, string>> {
  if (!(error instanceof HttpErrorResponse)) {
    return {};
  }
  const errors: Record<string, string> = {};
  for (const { field, messages } of readFieldViolations(readApiError(error))) {
    errors[field] ??= messages[0] ?? 'Valor no válido.';
  }
  return errors;
}

/** El identificador que conecta el reporte de la persona con el log del servidor. */
export function supportCodeOf(error: HttpErrorResponse, body: ApiErrorBody | null): string | null {
  return body?.correlationId ?? error.headers.get('x-request-id') ?? null;
}
