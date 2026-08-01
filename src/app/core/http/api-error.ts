import { HttpErrorResponse } from '@angular/common/http';

import {
  forbidden,
  notFound,
  offline,
  unexpectedError,
  validation,
} from '../view-state/view-state';
import type { ViewState, ViewStateIssue } from '../view-state/view-state.types';

/**
 * Traducción de los errores de la API a los estados de UX del M34.
 *
 * ## Por qué se puede escribir esto ahora
 *
 * La tarjeta 17 figuraba bloqueada esperando «el catálogo de formas reales de error». El catálogo
 * existe y es explícito: `src/common/errors/error-codes.ts` en el repo de la API declara un enum
 * de **doce códigos estables**, y `AllExceptionsFilter` garantiza que *toda* respuesta de error
 * —de dominio, de Nest o no controlada— sale con la misma envoltura. Su propio comentario lo
 * declara contrato:
 *
 * > «Son parte del contrato de la API: el cliente puede ramificar sobre `error.code` sin parsear
 * > mensajes, que están pensados para humanos y pueden cambiar de redacción o idioma.»
 *
 * Verificado además contra la API viva, no solo leyendo el código:
 *
 * ```text
 * POST /iam/auth/login  {}                    -> 400 VALIDATION_FAILED + details.violations[]
 * POST /iam/auth/login  {credenciales malas}  -> 401 UNAUTHENTICATED
 * ```
 *
 * Así que acá no se inventa ningún contrato: se ramifica sobre `code`, nunca sobre `message`.
 *
 * ## Los dos 403 ya se distinguen por código
 *
 * Durante un tiempo ambos salían con `code: 'FORBIDDEN'` y lo único que los separaba era el texto
 * del mensaje — justo lo que el catálogo declara inestable—, así que acá vivía una heurística sobre
 * frases. **Ya no.** `VerifiedIdentityGuard` emite su propio código,
 * `IDENTITY_VERIFICATION_REQUIRED`, más un `details.reason` con el subcaso.
 *
 * La distinción no es cosmética: el M34 la marca como la diferencia entre **un muro y una puerta**.
 * Rol insuficiente no tiene salida; identidad sin verificar sí la tiene, y hay que ofrecerla.
 */

/** Los doce códigos que la API declara estables (`ErrorCode` en el repo de la API). */
export const API_ERROR_CODES = [
  'VALIDATION_FAILED',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  // 403 de identidad sin verificar. Es un código aparte de `FORBIDDEN` justamente porque para la
  // persona es un estado distinto: hay algo que puede hacer al respecto.
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

/**
 * Un error de la API ya normalizado.
 *
 * `code` es `string` y no `ApiErrorCode` a propósito: si la API agrega un código nuevo, esto tiene
 * que seguir funcionando y mostrarlo, no romper el estrechamiento. {@link isKnownApiErrorCode}
 * está para cuando hace falta saber si es uno de los conocidos.
 */
export interface ApiError {
  readonly status: number;
  readonly code: string;
  readonly message: string;
  /**
   * Identificador con el que soporte encuentra la línea de log del servidor. La API lo manda como
   * número en algunas rutas y como texto en otras; acá siempre es texto.
   */
  readonly correlationId: string | null;
  /** Violaciones de validación campo por campo, ya desanidadas de `details`. */
  readonly violations: readonly string[];
  /**
   * `details` crudo, para lo que no cabe en un campo propio — hoy, el `reason` que distingue los
   * tres subcasos del 403 de identidad. Ver {@link identityReasonOf}.
   */
  readonly details: Record<string, unknown> | null;
  /** Segundos que la API pidió esperar (429), si los declaró. */
  readonly retryAfterSeconds: number | null;
  /**
   * `true` cuando la petición nunca llegó a destino: sin conexión, DNS caído o CORS. Angular lo
   * señala con `status === 0`. Es la diferencia entre S8 y S9: acá reintentar sirve.
   */
  readonly isNetworkFailure: boolean;
}

export function isKnownApiErrorCode(code: string): code is ApiErrorCode {
  return (API_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * Subcaso del 403 de identidad, tal como lo declara `details.reason` en la API.
 *
 * Los tres significan «no podés pasar hasta verificarte», pero no son la misma situación:
 * `no-person-linked` es una cuenta a la que todavía no se le asoció una persona, y ahí el trámite
 * de verificación no es lo que corresponde. Se conserva el dato aunque hoy las tres lleven al mismo
 * lugar, porque perderlo en la traducción impediría distinguirlas más adelante.
 */
export type IdentityVerificationReason =
  | 'identity-not-verified'
  | 'no-person-linked'
  | 'no-authenticated-user';

/** Ruta del flujo de verificación de identidad, que es la salida del 403 «puerta». */
export const IDENTITY_VERIFICATION_ROUTE = '/verificacion-de-identidad';

/**
 * Normaliza cualquier fallo de `HttpClient` a {@link ApiError}.
 *
 * Nunca lanza y nunca devuelve `null`: un error que no se puede leer sigue siendo un error que hay
 * que mostrar. Lo que no venga se rellena con el equivalente honesto —`INTERNAL`, sin
 * `correlationId`— en vez de con un valor inventado.
 */
export function parseApiError(error: unknown): ApiError {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      status: 0,
      code: 'INTERNAL',
      message: messageOf(error),
      correlationId: null,
      violations: [],
      details: null,
      retryAfterSeconds: null,
      isNetworkFailure: false,
    };
  }

  // `status === 0` es la señal de Angular para «la respuesta nunca llegó». No hay cuerpo que leer.
  if (error.status === 0) {
    return {
      status: 0,
      code: 'OFFLINE',
      message: 'No se pudo contactar al servidor.',
      correlationId: null,
      violations: [],
      details: null,
      retryAfterSeconds: null,
      isNetworkFailure: true,
    };
  }

  const body = asRecord(error.error);

  return {
    status: error.status,
    code: readString(body, 'code') ?? 'INTERNAL',
    message: readString(body, 'message') ?? error.message,
    correlationId: readCorrelationId(body),
    violations: readViolations(body),
    details: asRecord(body?.['details']),
    retryAfterSeconds: readRetryAfter(error),
    isNetworkFailure: false,
  };
}

/**
 * Del error de la API al estado de pantalla.
 *
 * Ramifica sobre `code` y usa el status solo como red cuando el código no es conocido: es el orden
 * que el contrato de la API permite sostener.
 *
 * El 401 tiene un solo lugar donde llega a verse: **el propio formulario de login**. En cualquier
 * otra pantalla lo atrapa `authInterceptor`, que renueva la sesión o manda al login sin que ningún
 * estado se dibuje. Por eso se traduce a S4 y no a un error: para quien está escribiendo su
 * contraseña, «credenciales inválidas» es exactamente un problema de lo que acaba de tipear.
 */
export function viewStateFromApiError<T>(error: ApiError): ViewState<T> {
  if (error.isNetworkFailure) {
    return offline(new Date());
  }

  switch (error.code) {
    // S4 — los tres se resuelven igual: decir qué pasó y ofrecer corregir o reintentar.
    case 'VALIDATION_FAILED':
    case 'PRECONDITION_FAILED':
    case 'PAYLOAD_TOO_LARGE':
      return validation(issuesOf(error));

    case 'CONFLICT':
    case 'CONCURRENCY_CONFLICT':
      return validation(issuesOf(error));

    // Ver la nota de arriba: solo el login lo ve, y ahí es un problema de lo escrito.
    case 'UNAUTHENTICATED':
      return validation(issuesOf(error));

    case 'RATE_LIMITED':
      return validation(
        issuesOf(error),
        error.retryAfterSeconds === null ? undefined : error.retryAfterSeconds,
      );

    // S5 «muro»: no hay nada que la persona pueda hacer.
    case 'FORBIDDEN':
      return forbidden({ message: error.message });

    // S5 «puerta»: hay un trámite, y hay que ofrecerlo.
    case 'IDENTITY_VERIFICATION_REQUIRED':
      return identityRequiredState(error);

    // S6 — sin ningún dato del recurso: ver `NotFoundViewState`.
    case 'NOT_FOUND':
      return notFound();

    // Una dependencia caída es del servidor, no de la red de la persona: reintentar no depende de
    // ella, así que corresponde S9 con su identificador y no S8.
    case 'DEPENDENCY_UNAVAILABLE':
    case 'INTERNAL':
      return unexpectedError(requestIdOf(error), error.message);

    default:
      return byStatus(error);
  }
}

/** Atajo para el caso normal: del `HttpErrorResponse` crudo al estado, en un paso. */
export function viewStateFromHttpError<T>(error: unknown): ViewState<T> {
  return viewStateFromApiError<T>(parseApiError(error));
}

/**
 * El 403 de identidad, con su salida.
 *
 * `no-person-linked` **no ofrece el trámite**: verificar la identidad de una persona que todavía no
 * está asociada a la cuenta no es algo que quien mira pueda hacer por su cuenta. Mandarla igual a
 * ese flujo sería un callejón con cartel de salida.
 */
function identityRequiredState(error: ApiError) {
  if (identityReasonOf(error) === 'no-person-linked') {
    return forbidden({ message: error.message });
  }

  return forbidden({
    message: error.message,
    nextAction: { label: 'Verificar mi identidad', route: IDENTITY_VERIFICATION_ROUTE },
  });
}

/** El subcaso que la API declara en `details.reason`, o `null` si no vino. */
export function identityReasonOf(error: ApiError): IdentityVerificationReason | null {
  const reason = error.details?.['reason'];
  return reason === 'identity-not-verified' ||
    reason === 'no-person-linked' ||
    reason === 'no-authenticated-user'
    ? reason
    : null;
}

/** Red de seguridad para un código que la API todavía no declaraba cuando se escribió esto. */
function byStatus<T>(error: ApiError): ViewState<T> {
  if (error.status === 403) {
    // Sin código conocido se trata como muro. Es el lado seguro: ofrecer «verificá tu identidad» a
    // quien en realidad no tiene el rol lo manda a un trámite que no le sirve de nada.
    return forbidden({ message: error.message });
  }
  if (error.status === 404) {
    return notFound();
  }
  if (error.status >= 400 && error.status < 500) {
    return validation(issuesOf(error));
  }
  return unexpectedError(requestIdOf(error), error.message);
}

/**
 * Las violaciones de validación como problemas de la vista. Cuando la API no manda ninguna, el
 * mensaje general vale como problema único: un S4 sin nada escrito no le dice nada a nadie.
 */
function issuesOf(error: ApiError): readonly ViewStateIssue[] {
  if (error.violations.length === 0) {
    return [{ message: error.message, code: error.code }];
  }

  return error.violations.map((violation) => ({
    ...fieldOf(violation),
    message: violation,
    code: error.code,
  }));
}

/**
 * `class-validator` escribe «email must be an email»: la primera palabra es la propiedad. Se
 * extrae para poder anclar el mensaje al campo, y se omite si el texto no tiene esa forma —un
 * `field` inventado apuntaría a un control que no existe.
 */
function fieldOf(violation: string): { field?: string } {
  const first = violation.split(' ')[0];
  return first !== undefined && /^[a-zA-Z][a-zA-Z0-9_.]*$/.test(first) ? { field: first } : {};
}

/**
 * S9 exige identificador de petición. Si la respuesta no trae `correlationId` —un 502 de un proxy
 * delante de la API, por ejemplo— se compone uno legible con lo que sí se sabe, porque el tipo lo
 * exige y porque «sin identificador» es peor que un identificador aproximado.
 */
function requestIdOf(error: ApiError): string {
  return error.correlationId ?? `sin-correlacion:${error.status}:${error.code}`;
}

function readCorrelationId(body: Record<string, unknown> | null): string | null {
  const value = body?.['correlationId'];
  if (typeof value === 'string' && value !== '') {
    return value;
  }
  // El contrato lo declara `string` y desde el arreglo del filtro de la API sale así de verdad
  // —antes `pino-http` numeraba las peticiones y salía como número—. Se sigue aceptando el número
  // igual: es una respuesta ajena, y un despliegue viejo detrás de un proxy no debería costarnos
  // el identificador con el que soporte encuentra el log.
  return typeof value === 'number' ? String(value) : null;
}

/** `AllExceptionsFilter` anida las violaciones en `details.violations`. */
function readViolations(body: Record<string, unknown> | null): readonly string[] {
  const details = asRecord(body?.['details']);
  const violations = details?.['violations'];

  return Array.isArray(violations)
    ? violations.filter((item): item is string => typeof item === 'string')
    : [];
}

/**
 * `Retry-After` viaja como cabecera, no en el cuerpo. Se acepta solo la forma en segundos: la
 * variante con fecha HTTP existe en el estándar, pero la API no la usa y aceptarla obligaría a
 * confiar en el reloj del navegador.
 */
function readRetryAfter(error: HttpErrorResponse): number | null {
  const header = error.headers.get('Retry-After');
  if (header === null) {
    return null;
  }
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(body: Record<string, unknown> | null, key: string): string | null {
  const value = body?.[key];
  return typeof value === 'string' && value !== '' ? value : null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocurrió un error inesperado.';
}
