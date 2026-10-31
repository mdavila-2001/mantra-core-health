import { HttpHeaders, HttpRequest } from '@angular/common/http';

import { bloqueoDelToken } from './mock-token-guard';

function token(claims: Record<string, unknown>): string {
  const codificar = (valor: object): string => btoa(JSON.stringify(valor)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${codificar({ alg: 'none' })}.${codificar({ sub: 'u-1', roles: [], tenants: [], ...claims })}.firma`;
}

const pedir = (jwt: string | null, metodo: string, ruta: string, tenant?: string): ReturnType<typeof bloqueoDelToken> => {
  const cabeceras: Record<string, string> = { ...(jwt === null ? {} : { Authorization: `Bearer ${jwt}` }), ...(tenant === undefined ? {} : { 'X-Tenant-Id': tenant }) };
  return bloqueoDelToken(new HttpRequest(metodo, ruta, null, { headers: new HttpHeaders(cabeceras) }), metodo, ruta);
};

describe('lo que la API hace cumplir con el token antes de cualquier ruta', () => {
  const LIMITADO = token({ mfaEnrollment: true });

  it('el token de alcance limitado solo llega al alta del factor, al cierre de sesión, al refresco y a GET /iam/me', () => {
    for (const [metodo, ruta] of [
      ['GET', '/iam/me/mfa'],
      ['POST', '/iam/me/mfa/totp'],
      ['POST', '/iam/me/mfa/totp/f-1/confirm'],
      ['POST', '/iam/me/mfa/f-1/revoke'],
      ['POST', '/iam/auth/logout'],
      ['POST', '/iam/auth/token/refresh'],
      ['GET', '/iam/me'],
    ] as const) {
      expect(pedir(LIMITADO, metodo, ruta), `${metodo} ${ruta}`).toBeNull();
    }
  });

  it('todo lo demás es 403 MFA_ENROLLMENT_REQUIRED, con el motivo arriba y en details', () => {
    for (const [metodo, ruta] of [['GET', '/me/support-agenda'], ['GET', '/tenants/me'], ['POST', '/iam/me/devices/d-1/confirm'], ['GET', '/iam/me/network']] as const) {
      const r = pedir(LIMITADO, metodo, ruta)!;
      expect(r.status, ruta).toBe(403);
      expect(r.body).toMatchObject({ code: 'FORBIDDEN', reason: 'MFA_ENROLLMENT_REQUIRED', details: { reason: 'MFA_ENROLLMENT_REQUIRED' } });
    }
  });

  it('un token completo no se restringe', () => {
    expect(pedir(token({ tenants: ['t-1'] }), 'GET', '/me/support-agenda')).toBeNull();
  });

  it('una petición con X-Tenant-Id de una organización denegada es 403 con reason y details { tenantId, reason }', () => {
    const jwt = token({ tenants: ['t-1'], deniedTenants: { 't-2': 'OUTSIDE_ALLOWED_NETWORK' } });
    const r = pedir(jwt, 'GET', '/me/support-agenda', 't-2')!;
    expect(r.status).toBe(403);
    expect(r.body).toMatchObject({ reason: 'OUTSIDE_ALLOWED_NETWORK', details: { tenantId: 't-2', reason: 'OUTSIDE_ALLOWED_NETWORK' } });
    // La que sí deja entrar, y la ausencia de cabecera, pasan.
    expect(pedir(jwt, 'GET', '/me/support-agenda', 't-1')).toBeNull();
    expect(pedir(jwt, 'GET', '/me/support-agenda')).toBeNull();
  });

  it('sin token no decide nada', () => {
    expect(pedir(null, 'POST', '/iam/auth/login')).toBeNull();
  });
});
