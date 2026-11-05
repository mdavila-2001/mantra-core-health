import type { HttpRequest } from '@angular/common/http';

import { decodeAccessToken } from '../auth/access-token';
import { reply, type MockReply } from './mock-router';

/* ============================================================================
    Lo que la API hace cumplir con el token **antes** de llegar a cualquier ruta:

    - el **token de alcance limitado** (`mfaEnrollment: true`) solo llega a `/iam/me/mfa*`, al cierre de sesión, al
      refresco y a `GET /iam/me`; todo lo demás es 403 `MFA_ENROLLMENT_REQUIRED` (`MfaEnrollmentScopeGuard`);
    - una petición con `X-Tenant-Id` de una organización que **niega ahora** a la persona (`deniedTenants` del token)
      es 403 con el motivo en `reason` y en `details: { tenantId, reason }`. No cierra la sesión.
   ========================================================================== */

const RUTAS_DEL_TOKEN_LIMITADO: readonly { readonly method: string; readonly path: RegExp }[] = [
  { method: '*', path: /^\/iam\/me\/mfa(\/.*)?$/ },
  { method: 'POST', path: /^\/iam\/auth\/logout\/?$/ },
  { method: 'POST', path: /^\/iam\/auth\/(token\/)?refresh\/?$/ },
  { method: 'GET', path: /^\/iam\/me\/?$/ },
];

/** Las rutas públicas no llevan token: el login, el refresco y el registro no se miran. */
function bearerDe(request: HttpRequest<unknown>): string | null {
  const cabecera = request.headers.get('Authorization');
  return cabecera?.startsWith('Bearer ') === true ? cabecera.slice('Bearer '.length) : null;
}

export function bloqueoDelToken(request: HttpRequest<unknown>, method: string, path: string): MockReply | null {
  const token = bearerDe(request);
  const claims = token === null ? null : decodeAccessToken(token);
  if (claims === null) return null;

  if (claims.mfaEnrollment === true) {
    const permitida = RUTAS_DEL_TOKEN_LIMITADO.some((r) => (r.method === '*' || r.method === method) && r.path.test(path));
    if (!permitida) {
      return reply(403, {
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Debe dar de alta su segundo factor antes de usar la aplicación',
        error: 'Forbidden',
        reason: 'MFA_ENROLLMENT_REQUIRED',
        details: { reason: 'MFA_ENROLLMENT_REQUIRED' },
      });
    }
  }

  const tenantId = request.headers.get('X-Tenant-Id');
  const motivo = tenantId === null ? undefined : claims.deniedTenants?.[tenantId];
  if (tenantId !== null && motivo !== undefined) {
    return reply(403, {
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Su organización no le permite actuar ahora',
      error: 'Forbidden',
      reason: motivo,
      details: { tenantId, reason: motivo },
    });
  }
  return null;
}
