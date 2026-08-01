/**
 * Lectura del JWT de acceso **sin verificar la firma**.
 *
 * Verificarla en el cliente no aportaría nada: la clave es del servidor y quien
 * pueda alterar el token también puede alterar el código que lo comprueba. La
 * autoridad sigue siendo la API, que valida en cada petición. Acá el token se
 * lee solo para saber a qué tenant apuntar y qué ofrecer en pantalla.
 *
 * Por eso no hay `/me`: el propio token trae `sub`, `roles[]` y `tenants[]`.
 */

/** Claims que emite `TokenService.signAccessToken` de la API. */
export interface AccessTokenClaims {
  /** Identificador del usuario. */
  readonly sub: string;
  /** Identificador de la sesión, para poder cerrarla del lado del servidor. */
  readonly sid: string;
  readonly roles: readonly string[];
  /** Tenants activos. Con más de uno hay que elegir cuál usar. */
  readonly tenants: readonly string[];
  /** Expiración en segundos desde epoch, si el token la declara. */
  readonly exp?: number;
}

/**
 * Decodifica el payload de un JWT.
 *
 * Devuelve `null` ante cualquier anomalía —formato inválido, base64 corrupta,
 * JSON ilegible, claims que no son del tipo esperado— en vez de lanzar: un
 * token ilegible es una sesión que no sirve, y eso lo resuelve quien llama
 * cerrando sesión, no un `try/catch` en cada punto de uso.
 */
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  const payload = readPayloadSegment(token);
  return payload === null ? null : toClaims(payload);
}

/**
 * Si el token ya venció, con un margen para no mandar en vuelo uno que expira
 * durante el viaje.
 *
 * Sin `exp` se considera vigente: no inventamos una expiración que el emisor no
 * declaró.
 */
export function isAccessTokenExpired(
  claims: AccessTokenClaims,
  now: Date = new Date(),
  skewSeconds = 10,
): boolean {
  if (claims.exp === undefined) {
    return false;
  }
  return claims.exp * 1000 <= now.getTime() + skewSeconds * 1000;
}

/** El segmento central del JWT, ya parseado. `null` si algo no cuadra. */
function readPayloadSegment(token: string): unknown {
  const segments = token.split('.');
  if (segments.length !== 3) {
    return null;
  }

  const payload = segments[1];
  if (payload === undefined || payload === '') {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payload));
  } catch {
    return null;
  }
}

/**
 * base64url → texto. El JWT usa el alfabeto seguro para URL (`-` y `_`) y sin
 * relleno, así que hay que restituir ambas cosas antes de decodificar.
 *
 * `atob` devuelve bytes crudos; se pasan por `TextDecoder` para que un nombre
 * con acentos no se rompa. Ambos existen en el navegador y en Node, así que
 * esto también funciona durante el render del servidor.
 */
function decodeBase64Url(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

/** Valida la forma antes de dar por buenos los claims. */
function toClaims(payload: unknown): AccessTokenClaims | null {
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }

  const source = payload as Record<string, unknown>;
  const sub = source['sub'];
  const sid = source['sid'];

  if (typeof sub !== 'string' || typeof sid !== 'string') {
    return null;
  }

  const exp = source['exp'];

  return {
    sub,
    sid,
    roles: toStringArray(source['roles']),
    tenants: toStringArray(source['tenants']),
    ...(typeof exp === 'number' ? { exp } : {}),
  };
}

/** Un claim de lista ausente equivale a lista vacía, no a error. */
function toStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
