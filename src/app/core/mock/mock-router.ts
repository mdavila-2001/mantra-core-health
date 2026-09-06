import type { HttpHeaders } from '@angular/common/http';

import type { MockUser } from './mock-session';

/* ============================================================================
    El enrutador del backend simulado.

    Una tabla de `(método, patrón)` → manejador. El patrón es una ruta con
    segmentos literales y parámetros `:nombre`; `*` al final absorbe el resto.
    Se elige la coincidencia más específica (más segmentos literales), así que
    `/scheduling/bookings/:id/cancel` gana sobre `/scheduling/bookings/:id/*`.
    ========================================================================== */

export type MockMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** Lo que un manejador recibe: la petición ya desarmada. */
export interface MockRequest {
  readonly method: MockMethod;
  readonly path: string;
  readonly params: Readonly<Record<string, string>>;
  readonly query: URLSearchParams;
  readonly body: unknown;
  readonly headers: HttpHeaders;
  /** Quién pide, según el token que viaja en `Authorization`; `null` sin sesión. */
  readonly user: MockUser | null;
}

/** Una respuesta con estado explícito. Devolver cualquier otra cosa es un 200. */
export interface MockReply {
  readonly status: number;
  readonly body: unknown;
  readonly headers?: Readonly<Record<string, string>>;
}

export type MockHandler = (request: MockRequest) => MockReply | unknown;

export function reply(status: number, body: unknown = null): MockReply {
  return { status, body };
}

export function notFound(message = 'No encontrado'): MockReply {
  return reply(404, { statusCode: 404, message, error: 'Not Found' });
}

export function conflict(message: string, details: unknown = {}): MockReply {
  return reply(409, { statusCode: 409, message, error: 'Conflict', details });
}

export function preconditionFailed(message: string, details: unknown = {}): MockReply {
  return reply(412, { statusCode: 412, message, error: 'Precondition Failed', details });
}

export function forbidden(message = 'No tenés permiso para esta operación'): MockReply {
  return reply(403, { statusCode: 403, message, error: 'Forbidden' });
}

export function unauthorized(message = 'Credenciales inválidas'): MockReply {
  return reply(401, { statusCode: 401, message, error: 'Unauthorized' });
}

export function validation(message: string, issues: readonly unknown[] = []): MockReply {
  return reply(422, { statusCode: 422, message, error: 'Unprocessable Entity', issues });
}

export function noContent(): MockReply {
  return reply(204, null);
}

export function isMockReply(value: unknown): value is MockReply {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof (value as { status: unknown }).status === 'number' &&
    'body' in value &&
    Object.keys(value).every((clave) => clave === 'status' || clave === 'body' || clave === 'headers')
  );
}

interface Route {
  readonly method: MockMethod;
  readonly segments: readonly string[];
  readonly handler: MockHandler;
  readonly literalCount: number;
}

export interface RouteMatch {
  readonly handler: MockHandler;
  readonly params: Readonly<Record<string, string>>;
}

export class MockRouter {
  private readonly routes: Route[] = [];

  on(method: MockMethod, pattern: string, handler: MockHandler): this {
    const segments = split(pattern);
    this.routes.push({
      method,
      segments,
      handler,
      literalCount: segments.filter((s) => !s.startsWith(':') && s !== '*').length,
    });
    return this;
  }

  get(pattern: string, handler: MockHandler): this {
    return this.on('GET', pattern, handler);
  }

  post(pattern: string, handler: MockHandler): this {
    return this.on('POST', pattern, handler);
  }

  put(pattern: string, handler: MockHandler): this {
    return this.on('PUT', pattern, handler);
  }

  patch(pattern: string, handler: MockHandler): this {
    return this.on('PATCH', pattern, handler);
  }

  delete(pattern: string, handler: MockHandler): this {
    return this.on('DELETE', pattern, handler);
  }

  /** Todo lo registrado, para los barridos de prueba: método y patrón. */
  rutas(): readonly { method: MockMethod; pattern: string }[] {
    return this.routes.map((r) => ({ method: r.method, pattern: `/${r.segments.join('/')}` }));
  }

  match(method: MockMethod, path: string): RouteMatch | null {
    const segments = split(path);
    let mejor: { route: Route; params: Record<string, string> } | null = null;
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const params = matchSegments(route.segments, segments);
      if (params === null) continue;
      if (mejor === null || route.literalCount > mejor.route.literalCount) {
        mejor = { route, params };
      }
    }
    return mejor === null ? null : { handler: mejor.route.handler, params: mejor.params };
  }
}

function split(path: string): readonly string[] {
  return path
    .split('?')[0]!
    .split('/')
    .filter((segment) => segment !== '');
}

function matchSegments(
  pattern: readonly string[],
  actual: readonly string[],
): Record<string, string> | null {
  const params: Record<string, string> = {};
  for (let i = 0; i < pattern.length; i++) {
    const esperado = pattern[i]!;
    if (esperado === '*') {
      return params;
    }
    const recibido = actual[i];
    if (recibido === undefined) {
      return null;
    }
    if (esperado.startsWith(':')) {
      params[esperado.slice(1)] = decodeURIComponent(recibido);
    } else if (esperado !== recibido) {
      return null;
    }
  }
  return pattern.length === actual.length ? params : null;
}
