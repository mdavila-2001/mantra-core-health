import { HttpErrorResponse } from '@angular/common/http';

import {
  forbidden,
  notFound,
  offline,
  unexpectedError,
  validation,
} from '../view-state/view-state';
import type { ViewState, ViewStateIssue } from '../view-state/view-state.types';
import { readApiError, type ApiErrorBody } from './api-error';

/**
 * A dónde lleva la puerta cuando falta verificar la identidad.
 *
 * Es una ruta **del router**, y esa precisión es la corrección de un defecto
 * real: antes valía `'/identity/me'`, que es la ruta de la **API**. Ninguna
 * ruta de Angular coincidía, así que la acción de S5 mandaba al comodín — un
 * muro con cartel de puerta, que es peor que un muro.
 *
 * La pantalla que la atiende es `features/identity-verification/`, que encadena
 * `FilesClient.upload` con `IdentityClient.requestPatientIdentityVerification`.
 */
export const IDENTITY_VERIFICATION_ROUTE = '/identidad/verificar';

/**
 * Traduce un fallo de la API a uno de los 9 estados de UX del M34.
 *
 * El mapeo se apoya en `error.code`, no en el estado HTTP ni en el mensaje: el
 * backend declara los códigos como parte del contrato y los mensajes como texto
 * humano que puede cambiar de redacción. Dos códigos distintos comparten el 403
 * y hay que separarlos, así que el estado HTTP no alcanza.
 *
 * Referencia: `docs/api/error-model.md` del backend.
 */
export function errorToViewState<T>(error: unknown): ViewState<T> {
  if (!(error instanceof HttpErrorResponse)) {
    return unexpectedError('sin-id', 'Ocurrió un error inesperado.');
  }

  // Estado 0 es «la petición no llegó»: sin conexión, DNS caído o CORS. Nunca
  // trae cuerpo de la API, así que se resuelve antes de intentar leerlo.
  if (error.status === 0) {
    return offline();
  }

  const body = readApiError(error);
  if (body === null) {
    // Respuesta sin la forma del contrato: un proxy, un balanceador, un 502.
    return unexpectedError(correlationOf(error, null), 'No pudimos completar la operación.');
  }

  switch (body.code) {
    // --- S4 · validación o conflicto ---------------------------------------
    case 'VALIDATION_FAILED':
      return validation(issuesOf(body));

    case 'CONFLICT':
      return validation([{ message: body.message, code: body.code }]);

    /**
     * Escritura concurrente: para la persona es «alguien cambió esto mientras
     * lo editabas», que se resuelve releyendo. Es el mismo S4, pero conviene que
     * el mensaje lo diga.
     */
    case 'CONCURRENCY_CONFLICT':
      return validation([
        {
          message: body.message || 'Otra persona modificó este dato mientras lo editabas.',
          code: body.code,
        },
      ]);

    case 'PRECONDITION_FAILED':
      return validation([{ message: body.message, code: body.code }]);

    case 'PAYLOAD_TOO_LARGE':
      return validation([
        { message: body.message || 'El archivo es demasiado grande.', code: body.code },
      ]);

    case 'RATE_LIMITED':
      return validation([{ message: body.message, code: body.code }], retryAfterOf(error));

    // --- S5 · prohibido ----------------------------------------------------
    /**
     * El muro: no hay nada que la persona pueda hacer desde la interfaz, así que
     * **no se le ofrece una acción**. Inventar una sería mandarla a un lugar
     * donde tampoco va a poder.
     */
    case 'FORBIDDEN':
      return forbidden({ message: body.message });

    /**
     * La puerta. Mismo 403, estado opuesto: hay algo que la persona puede hacer,
     * y por eso este estado **sí** lleva acción.
     */
    case 'IDENTITY_VERIFICATION_REQUIRED':
      return forbidden({
        message: body.message || 'Necesitás verificar tu identidad para continuar.',
        nextAction: { label: 'Verificar identidad', route: IDENTITY_VERIFICATION_ROUTE },
      });

    // --- S6 · no encontrado, sin filtrar existencia -------------------------
    /**
     * Se descarta `message` y `details` a propósito. El backend puede incluir el
     * identificador buscado, y repetirlo en pantalla confirmaría que la persona
     * consultó por algo concreto. El estado S6 del M34 existe justamente para no
     * revelar si el recurso existe.
     */
    case 'NOT_FOUND':
      return notFound();

    // --- S9 · error inesperado ---------------------------------------------
    case 'DEPENDENCY_UNAVAILABLE':
      return unexpectedError(
        correlationOf(error, body),
        'Un servicio no está disponible en este momento. Reintentá en unos minutos.',
      );

    /**
     * `UNAUTHENTICATED` llega acá sólo si el interceptor de autenticación ya
     * agotó su intento de refresco: cuando eso pasa, la sesión ya se cerró y se
     * navegó al login, así que no hay nada que mostrar en la pantalla anterior.
     */
    case 'UNAUTHENTICATED':
    case 'INTERNAL':
    default:
      return unexpectedError(correlationOf(error, body), body.message);
  }
}

/**
 * Convierte los detalles de validación en problemas por campo.
 *
 * El backend manda la lista en `details.messages` cuando el fallo viene del
 * `ValidationPipe`. Si no está, el mensaje general es lo único que hay.
 */
function issuesOf(body: ApiErrorBody): readonly ViewStateIssue[] {
  const messages = body.details?.['messages'];

  if (Array.isArray(messages) && messages.length > 0) {
    return messages
      .filter((item): item is string => typeof item === 'string')
      .map((message) => ({ ...fieldOf(message), message, code: body.code }));
  }

  // El `ValidationPipe` no fue: `details` puede traer el campo por su cuenta.
  const field = typeof body.details?.['field'] === 'string' ? body.details['field'] : undefined;

  return [
    {
      ...(field === undefined ? {} : { field }),
      message: body.message,
      code: body.code,
    },
  ];
}

/**
 * Deduce a qué campo se refiere un mensaje del `ValidationPipe`.
 *
 * `class-validator` compone sus mensajes empezando por el nombre de la
 * propiedad: `"nationalId must be longer than or equal to 4 characters"`,
 * `"email must be an email"`. Es una convención del backend, no un contrato, y
 * por eso el reconocimiento es **conservador**: solo se acepta si la primera
 * palabra es un identificador en `camelCase` y va seguida de otra.
 *
 * ## Por qué vale la pena aun siendo una heurística
 *
 * `ViewStateIssue` admite `field` y `ViewStateHost` lo pinta en negrita delante
 * del mensaje, pero **nada lo rellenaba**: los errores del servidor se mostraban
 * como una lista suelta arriba del formulario en vez de junto al campo que los
 * causó. Para quien usa lector de pantalla la diferencia es grande.
 *
 * Y el modo de fallo es benigno: si no reconoce el campo, el mensaje se muestra
 * igual, sin anclar — exactamente como antes. Nunca inventa un campo.
 */
function fieldOf(message: string): { field?: string } {
  const match = /^([a-z][A-Za-z0-9]*)\s+\S/.exec(message);
  if (match === null) {
    return {};
  }

  const candidato = match[1];

  // Palabras corrientes que abren una frase en inglés y no son un campo. Sin
  // esto, «each value must be…» anclaría al campo «each».
  const PALABRAS_COMUNES = new Set([
    'each', 'all', 'the', 'this', 'that', 'value', 'property', 'nested',
    'must', 'should', 'cannot', 'unexpected', 'invalid',
  ]);

  return PALABRAS_COMUNES.has(candidato.toLowerCase()) ? {} : { field: candidato };
}

/** El identificador que conecta el reporte de la persona con los registros. */
function correlationOf(error: HttpErrorResponse, body: ApiErrorBody | null): string {
  return body?.correlationId ?? error.headers.get('x-request-id') ?? 'sin-id';
}

/** Segundos hasta poder reintentar, si el servidor los declara. */
function retryAfterOf(error: HttpErrorResponse): number | undefined {
  const header = error.headers.get('retry-after');
  if (header === null) {
    return undefined;
  }

  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : undefined;
}
