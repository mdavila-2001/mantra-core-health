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

/**
 * Claims que emite `TokenService.signAccessToken` de la API.
 *
 * Solo `sub` es obligatorio. `sid` y `tenants` están declarados opcionales en
 * `jwt-payload.interface.ts` del backend y, aunque hoy la firma siempre los
 * emite, **exigirlos acá sería ser más estricto que el contrato**: un token sin
 * `sid` se leería como ilegible y sacaría al login a alguien con sesión válida,
 * sin explicación.
 */
export interface AccessTokenClaims {
  /** Identificador del usuario. */
  readonly sub: string;
  /** Identificador de la sesión, para poder cerrarla del lado del servidor. */
  readonly sid?: string;
  readonly roles: readonly string[];
  /** Tenants activos. Con más de uno hay que elegir cuál usar. */
  readonly tenants: readonly string[];
  /** Nombre para mostrar, si el token lo trae. */
  readonly name?: string;
  /** Nombre de cada tenant por su identificador, para no mostrar uuid crudos. */
  readonly tenantNames?: Readonly<Record<string, string>>;
  /**
   * Código de tipo de cada tenant por su identificador (`'PAYER'`,
   * `'PROVIDER'`, `'PHARMACY'`…), tal como lo declara `TenantTypeCode` de
   * `core/data-access/directory/directory.types`.
   *
   * Es dato de presentación, igual que `tenantNames`: no participa de ninguna
   * decisión de autorización. Existe para que el registro de navegación pueda
   * ocultarle a una organización una sección que no es suya —p. ej. el
   * autoservicio del paciente, a una aseguradora— sin que la API tenga que
   * exponer una ruta `/me`. Ausente = tipo desconocido para ese tenant: no
   * oculta nada.
   */
  readonly tenantTypes?: Readonly<Record<string, string>>;
  /**
   * Perfil de paciente del titular, si la cuenta es la de un paciente.
   *
   * Es lo que el autoservicio necesita para reservar un turno: `confirm` exige
   * `patientProfileId`, y la lectura que lo devolvía
   * (`GET /profiles/patients/me/summary`) está detrás de la verificación de
   * identidad, que es un trámite posterior. Sin este claim, pedir un turno
   * dependía de haber sido verificado antes.
   */
  readonly pid?: string;
  /**
   * Perfil profesional del titular, si la cuenta es la de quien atiende.
   *
   * El simétrico de `pid` del otro lado del mostrador. Es lo que permite saber
   * **cuál de las agendas de la organización es la suya**: los recursos de
   * `scheduling` declaran a qué perfil profesional pertenecen
   * (`resourceRefType: 'practitioner_profiles'`), pero sin este dato la sesión
   * no conocía el propio y la agenda caía en el primer recurso de la lista —que
   * con varios consultorios es el de otra persona—.
   *
   * No hay lectura que lo devuelva: el controlador de profesionales sólo expone
   * `POST`, y no existe un `me` como el de paciente.
   */
  readonly hpid?: string;
  /**
   * Roles con ámbito de organización, indexados por el tenant en el que se
   * concedieron (`scopedRoles` de `jwt-payload.interface.ts` de la API).
   *
   * Es dato para **mostrar**: la regla es la de `RolesGuard` —un código que
   * aparece acá sólo vale en esos tenants; uno que no aparece es global— y la
   * autoridad sigue siendo la API. Ver `SessionStore.roles`.
   */
  readonly scopedRoles?: Readonly<Record<string, readonly string[]>>;
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

  // `sub` es lo único sin lo cual el token no identifica a nadie.
  if (typeof sub !== 'string' || sub === '') {
    return null;
  }

  const sid = source['sid'];
  const name = source['name'];
  const pid = source['pid'];
  const hpid = source['hpid'];
  const exp = source['exp'];

  return {
    sub,
    roles: toStringArray(source['roles']),
    tenants: toStringArray(source['tenants']),
    ...(typeof sid === 'string' ? { sid } : {}),
    ...(typeof name === 'string' ? { name } : {}),
    ...(typeof pid === 'string' && pid !== '' ? { pid } : {}),
    ...(typeof hpid === 'string' && hpid !== '' ? { hpid } : {}),
    ...(typeof exp === 'number' ? { exp } : {}),
    ...(toStringMapClaim('tenantNames', source['tenantNames']) ?? {}),
    ...(toStringMapClaim('tenantTypes', source['tenantTypes']) ?? {}),
    ...(toScopedRolesClaim(source['scopedRoles']) ?? {}),
  };
}

/**
 * Lee un claim que es un mapa de texto a texto (`tenantNames`, `tenantTypes`).
 *
 * Se descarta entero si no es un mapa, o si queda vacío tras filtrar las
 * entradas que no son texto: un claim vacío es lo mismo que ausente, y así lo
 * trata quien lo consuma después.
 */
function toStringMapClaim<K extends string>(
  key: K,
  value: unknown,
): Record<K, Record<string, string>> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  );

  return entries.length === 0 ? null : ({ [key]: Object.fromEntries(entries) } as Record<K, Record<string, string>>);
}

/**
 * Lee `scopedRoles`: un mapa de tenant a lista de códigos. Se descartan las
 * entradas que no son lista y las listas vacías; sin entradas, el claim es
 * ausente (todos los roles son globales).
 */
function toScopedRolesClaim(
  value: unknown,
): { scopedRoles: Record<string, readonly string[]> } | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value as Record<string, unknown>).flatMap(([tenantId, codes]) => {
    const list = toStringArray(codes);
    return list.length === 0 ? [] : [[tenantId, list] as const];
  });

  return entries.length === 0 ? null : { scopedRoles: Object.fromEntries(entries) };
}

/** Un claim de lista ausente equivale a lista vacía, no a error. */
function toStringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}
