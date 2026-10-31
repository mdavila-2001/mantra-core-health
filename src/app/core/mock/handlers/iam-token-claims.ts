/* ============================================================================
    Los claims del token del simulador. En la API real los firma el servidor; acá
    el token es de mentira y se reescribe su carga útil.
   ========================================================================== */

type Claims = Record<string, unknown>;

function base64url(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (const byte of bytes) binario += String.fromCharCode(byte);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function desdeBase64url(segmento: string): string {
  const normal = segmento.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(normal.padEnd(Math.ceil(normal.length / 4) * 4, '='));
  return new TextDecoder().decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}

/** Reescribe los claims de un token. Un token ilegible se devuelve tal cual. */
export function reescribirToken(token: string, mutar: (claims: Claims) => Claims): string {
  const [header, payload, firma] = token.split('.');
  if (header === undefined || payload === undefined || firma === undefined) return token;
  try {
    const claims = JSON.parse(desdeBase64url(payload)) as Claims;
    return `${header}.${base64url(JSON.stringify(mutar(claims)))}.${firma}`;
  } catch {
    return token;
  }
}

/** Agrega `idleTimeoutMinutes` al token. */
export function conPlazoDeInactividad(token: string, minutos: number): string {
  return reescribirToken(token, (claims) => ({ ...claims, idleTimeoutMinutes: minutos }));
}

function soloLlaves<T>(mapa: unknown, llaves: readonly string[]): Record<string, T> | undefined {
  if (typeof mapa !== 'object' || mapa === null) return undefined;
  const filas = Object.entries(mapa as Record<string, T>).filter(([llave]) => llaves.includes(llave));
  return filas.length === 0 ? undefined : Object.fromEntries(filas);
}

/**
 * El token de una persona a la que algunas organizaciones **no dejan actuar ahora**: esas salen de `tenants`, de
 * `tenantNames`, de `tenantTypes` y de `scopedRoles` (la API arma esos mapas solo con las que sí dejan entrar) y se
 * declaran en `deniedTenants` con su motivo.
 */
export function conOrganizacionesNegadas(token: string, permitidas: readonly string[], negadas: Readonly<Record<string, string>>): string {
  return reescribirToken(token, (claims) => {
    const { tenantNames, tenantTypes, scopedRoles, ...resto } = claims;
    const nombres = soloLlaves<string>(tenantNames, permitidas);
    const tipos = soloLlaves<string>(tenantTypes, permitidas);
    const roles = soloLlaves<string[]>(scopedRoles, permitidas);
    return {
      ...resto,
      tenants: permitidas,
      ...(nombres === undefined ? {} : { tenantNames: nombres }),
      ...(tipos === undefined ? {} : { tenantTypes: tipos }),
      ...(roles === undefined ? {} : { scopedRoles: roles }),
      ...(Object.keys(negadas).length === 0 ? {} : { deniedTenants: negadas }),
    };
  });
}

/**
 * El token de **alcance limitado**: la persona debe dar de alta su segundo factor antes de usar la API. Sale sin roles ni
 * organizaciones y con `mfaEnrollment: true`; las organizaciones que lo exigen van en `deniedTenants`.
 */
export function conAlcanceLimitado(token: string, negadas: Readonly<Record<string, string>>): string {
  return reescribirToken(token, (claims) => {
    const { tenantNames: _n, tenantTypes: _t, scopedRoles: _s, pid: _p, hpid: _h, ...resto } = claims;
    return { ...resto, roles: [], tenants: [], deniedTenants: negadas, mfaEnrollment: true };
  });
}
