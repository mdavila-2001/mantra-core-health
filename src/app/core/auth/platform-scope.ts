import type { AccessTokenClaims } from './access-token';

/**
 * Roles que dan **alcance de plataforma**: quien los tiene como roles
 * **globales** opera sin una organización fijada y no pasa por
 * `/auth/organization`.
 *
 * Es la misma regla que aplica la API (`common/tenant/platform-scope.ts`), sin
 * claim nuevo en el token. No incluye `SECURITY_ADMIN` (lo llevan
 * administradores de una sola organización) ni roles de negocio.
 *
 * **No autoriza nada**: decide qué puerta se ofrece primero. La autoridad es la
 * API, que valida rol y tenant en cada petición.
 */
export const PLATFORM_SCOPE_ROLES: readonly string[] = [
  'SUPERADMIN',
  'PLATFORM_ADMIN',
  'DATA_PLATFORM_ADMIN',
  'GOVERNANCE_ADMIN',
];

/**
 * Si la sesión tiene un rol de plataforma **global**: presente en `roles` y
 * ausente de `scopedRoles`. Un rol concedido con ámbito de organización no
 * cuenta (la API lo trata como de ese tenant).
 */
export function hasPlatformScope(claims: AccessTokenClaims | null): boolean {
  if (claims === null) {
    return false;
  }
  const scoped = Object.values(claims.scopedRoles ?? {});
  return claims.roles.some(
    (role) => PLATFORM_SCOPE_ROLES.includes(role) && !scoped.some((granted) => granted.includes(role)),
  );
}
