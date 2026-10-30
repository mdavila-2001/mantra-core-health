import { HttpErrorResponse } from '@angular/common/http';

/**
 * Códigos de error estables de la API.
 *
 * Copiados de `src/common/errors/error-codes.ts` del backend, que los declara
 * parte del contrato: **se ramifica por `code`, nunca por `message`**, porque el
 * mensaje está pensado para humanos y puede cambiar de redacción o de idioma.
 */
export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  /**
   * 403 por identidad sin verificar, **distinto** del `FORBIDDEN` por rol.
   *
   * Para la persona son estados opuestos: rol insuficiente es un muro sin
   * salida, e identidad sin verificar es una puerta —hay algo que puede hacer y
   * hay que ofrecérselo—.
   */
  'IDENTITY_VERIFICATION_REQUIRED',
  'NOT_FOUND',
  'CONFLICT',
  'PRECONDITION_FAILED',
  'CONCURRENCY_CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'DEPENDENCY_UNAVAILABLE',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

/** Cuerpo de error de la API, tal como lo documenta `docs/api/error-model.md`. */
export interface ApiErrorBody {
  readonly code: ApiErrorCode;
  /** Para mostrar, no para ramificar. */
  readonly message: string;
  /** Presente cuando el servidor asignó un identificador de petición. */
  readonly correlationId?: string;
  /** Contexto específico del error — por ejemplo `reason` o el campo inválido. */
  readonly details?: Record<string, unknown>;
  readonly timestamp: string;
  readonly path: string;
}

/**
 * Lee el cuerpo de error de la API de una respuesta fallida.
 *
 * Devuelve `null` cuando la respuesta no tiene esa forma —un proxy que devuelve
 * HTML, un fallo de red, un 502 de infraestructura—, que es exactamente cuando
 * no hay que confiar en lo que venga.
 */
export function readApiError(error: HttpErrorResponse): ApiErrorBody | null {
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) {
    return null;
  }

  const candidate = body as Record<string, unknown>;
  const code = candidate['code'];

  if (typeof code !== 'string' || !isApiErrorCode(code)) {
    return null;
  }

  return {
    code,
    message: typeof candidate['message'] === 'string' ? candidate['message'] : '',
    timestamp: typeof candidate['timestamp'] === 'string' ? candidate['timestamp'] : '',
    path: typeof candidate['path'] === 'string' ? candidate['path'] : '',
    ...(candidate['correlationId'] === undefined
      ? {}
      : { correlationId: String(candidate['correlationId']) }),
    ...(isRecord(candidate['details']) ? { details: candidate['details'] } : {}),
  };
}

/**
 * Un campo del cuerpo que el DTO rechazó, tal como lo manda la API en
 * `details.fields` (`createGlobalValidationPipe`, desde el 2026-10-08).
 */
export interface ApiFieldViolation {
  /** Ruta en el cuerpo enviado: `email`, `address.city`, `items.0.quantity`. */
  readonly field: string;
  /**
   * Restricciones incumplidas. `whitelistValidation` es una propiedad que el
   * DTO no declara: el front mandó algo que la API no espera.
   */
  readonly constraints: readonly string[];
  readonly messages: readonly string[];
}

/** Restricción con la que la API marca una propiedad que su DTO no declara. */
export const UNKNOWN_PROPERTY_CONSTRAINT = 'whitelistValidation';

/**
 * Los campos rechazados de un error de la API, o una lista vacía si el cuerpo
 * no los trae (validación de dominio, otro código, otra API).
 */
export function readFieldViolations(body: ApiErrorBody | null): readonly ApiFieldViolation[] {
  const fields = body?.details?.['fields'];
  if (!Array.isArray(fields)) {
    return [];
  }
  return fields.filter(isRecord).flatMap((item) => {
    const field = item['field'];
    if (typeof field !== 'string' || field === '') {
      return [];
    }
    return [{ field, constraints: stringsOf(item['constraints']), messages: stringsOf(item['messages']) }];
  });
}

function stringsOf(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function isApiErrorCode(value: string): value is ApiErrorCode {
  return (API_ERROR_CODES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
