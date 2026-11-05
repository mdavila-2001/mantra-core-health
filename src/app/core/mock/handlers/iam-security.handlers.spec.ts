import { HttpHeaders } from '@angular/common/http';

import type { IpAccessRules } from '../../data-access/support-access/support-access.types';
import { crearRouterSimulado } from './index';
import { fijarSaltosDeProxy, ORIGEN_SIMULADO } from './iam-security.handlers';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_HOSPITAL_PILOTO, type MockUser } from '../mock-session';
import { vinculos } from '../fixtures/support-hospital';
import { reiniciarLaSesionDelSimulador } from './mock-reset';

/**
 * La seguridad de la propia cuenta y las redes de la organización en el simulador, con
 * los códigos de la API: `GET|POST /iam/me/mfa…` y `GET|PUT /org/ip-access-rules`.
 * Como en las otras suites del hospital, el estado vive en colecciones del módulo y
 * las pruebas se leen en orden.
 */
let router: MockRouter;
const org = buscarUsuario('hospital_piloto')!;
const ana = buscarUsuario('ana')!;
const marcos = buscarUsuario('marcos')!;
const medica = buscarUsuario('medica')!;

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}

function llamar<T = unknown>(user: MockUser | null, method: MockMethod, path: string, opciones: { body?: unknown; tenant?: string } = {}): Respuesta<T> {
  const match = router.match(method, path);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({
    method,
    path,
    params: match.params,
    query: new URLSearchParams(),
    body: opciones.body ?? null,
    headers: new HttpHeaders(opciones.tenant === undefined ? {} : { 'X-Tenant-Id': opciones.tenant }),
    user,
  });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}

interface Estado {
  required: boolean;
  enrolled: boolean;
  enrollmentRequired: boolean;
  factors: { id: string; type: string; state: string; label: string; createdAt: string; verifiedAt?: string }[];
}

beforeAll(() => {
  reiniciarLaSesionDelSimulador();
  router = crearRouterSimulado();
});

afterAll(() => {
  reiniciarLaSesionDelSimulador();
});

describe('verificación en dos pasos de la propia cuenta', () => {
  it('Ana ya la tiene; Marcos no, y sin una regla que la exija no «se exige» nada', () => {
    const delaAna = llamar<Estado>(ana, 'GET', '/iam/me/mfa').body;
    expect(delaAna.enrolled).toBe(true);
    expect(delaAna.factors[0]).toMatchObject({ type: 'TOTP', state: 'VERIFIED' });
    expect(delaAna.factors[0]).not.toHaveProperty('secret');
    const delMarcos = llamar<Estado>(marcos, 'GET', '/iam/me/mfa').body;
    expect(delMarcos).toMatchObject({ required: false, enrolled: false, enrollmentRequired: false, factors: [] });
  });

  it('con una regla que la exige, quien no tiene un factor ve enrollmentRequired', () => {
    // La regla es del personal de la organización: Ana lo es mientras su vínculo esté vivo (otros archivos pueden haberlo movido).
    for (const v of vinculos.filtrar((x) => x.userId === ana.id)) vinculos.actualizar(v.id, { status: 'ACTIVE' });
    const politicas = llamar<{ policies: unknown[] }>(org, 'GET', '/org/session-policies', { tenant: TENANT_HOSPITAL_PILOTO }).body.policies;
    llamar(org, 'PUT', '/org/session-policies', {
      tenant: TENANT_HOSPITAL_PILOTO,
      body: { policies: [{ scope: 'ALL_ACCOUNTS', idleTimeoutMinutes: 15, newDeviceAlert: true, enforceIpRules: false, requireMfa: false }, { scope: 'ORG_STAFF', idleTimeoutMinutes: 10, newDeviceAlert: true, enforceIpRules: false, requireMfa: true }] },
    });
    expect(llamar<Estado>(marcos, 'GET', '/iam/me/mfa').body).toMatchObject({ required: true, enrolled: false, enrollmentRequired: true });
    expect(llamar<Estado>(ana, 'GET', '/iam/me/mfa').body).toMatchObject({ required: true, enrolled: true, enrollmentRequired: false });
    llamar(org, 'PUT', '/org/session-policies', { tenant: TENANT_HOSPITAL_PILOTO, body: { policies: politicas } });
  });

  it('sin sesión: 401', () => {
    expect(llamar(null, 'GET', '/iam/me/mfa').status).toBe(401);
    expect(llamar(null, 'POST', '/iam/me/mfa/totp').status).toBe(401);
  });

  describe('el alta de la app autenticadora', () => {
    let factorId = '';

    it('POST /iam/me/mfa/totp devuelve 201 con el secreto y el URI del QR, una sola vez', () => {
      const r = llamar<{ id: string; userId: string; secret: string; otpauthUri: string }>(marcos, 'POST', '/iam/me/mfa/totp', { body: { currentPassword: 'mi-clave' } });
      expect(r.status).toBe(201);
      factorId = r.body.id;
      expect(r.body.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(r.body.otpauthUri).toMatch(/^otpauth:\/\/totp\/.+\?secret=.+&issuer=Alovida/);
      expect(r.body.otpauthUri).toContain(r.body.secret);
      // Pendiente no cuenta como activa, y el secreto no vuelve a salir al leer.
      const estado = llamar<Estado>(marcos, 'GET', '/iam/me/mfa').body;
      expect(estado.enrolled).toBe(false);
      expect(JSON.stringify(estado)).not.toContain(r.body.secret);
    });

    it('empezar de nuevo retira el intento anterior sin confirmar', () => {
      const anterior = factorId;
      const nuevo = llamar<{ id: string }>(marcos, 'POST', '/iam/me/mfa/totp', { body: { label: 'Teléfono nuevo', currentPassword: 'mi-clave' } });
      factorId = nuevo.body.id;
      expect(factorId).not.toBe(anterior);
      expect(llamar(marcos, 'POST', `/iam/me/mfa/totp/${anterior}/confirm`, { body: { code: '123456' } }).status).toBe(404);
    });

    it('el código tiene de 6 a 8 caracteres: otra cosa es 400', () => {
      expect(llamar(marcos, 'POST', `/iam/me/mfa/totp/${factorId}/confirm`, { body: { code: '123' } }).status).toBe(400);
      expect(llamar(marcos, 'POST', `/iam/me/mfa/totp/${factorId}/confirm`, { body: { code: '123456789' } }).status).toBe(400);
      expect(llamar(marcos, 'POST', `/iam/me/mfa/totp/${factorId}/confirm`, { body: {} }).status).toBe(400);
    });

    it('un código malo es 422 MFA_CODE_INVALID, y el factor sigue pendiente', () => {
      const r = llamar<{ code: string; reason: string; details: { reason: string } }>(marcos, 'POST', `/iam/me/mfa/totp/${factorId}/confirm`, { body: { code: '000000' } });
      expect(r.status).toBe(422);
      expect(r.body.code).toBe('PRECONDITION_FAILED');
      expect(r.body.details.reason).toBe('MFA_CODE_INVALID');
      expect(llamar<Estado>(marcos, 'GET', '/iam/me/mfa').body.enrolled).toBe(false);
    });

    it('nadie confirma el factor de otra persona', () => {
      expect(llamar(ana, 'POST', `/iam/me/mfa/totp/${factorId}/confirm`, { body: { code: '123456' } }).status).toBe(404);
    });

    it('con el código bueno el factor queda verificado y la cuenta con el segundo paso activo', () => {
      const r = llamar<{ verified: boolean; factorId: string; verifiedAt: string }>(marcos, 'POST', `/iam/me/mfa/totp/${factorId}/confirm`, { body: { code: '123456' } });
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ verified: true, factorId });
      expect(typeof r.body.verifiedAt).toBe('string');
      expect(llamar<Estado>(marcos, 'GET', '/iam/me/mfa').body).toMatchObject({ enrolled: true, enrollmentRequired: false });
    });

    it('confirmarlo otra vez ya no es un factor pendiente: 404', () => {
      expect(llamar(marcos, 'POST', `/iam/me/mfa/totp/${factorId}/confirm`, { body: { code: '123456' } }).status).toBe(404);
    });
  });

  describe('reautenticación para dar de alta y quitar un método', () => {
    const motivoDe = (r: Respuesta): unknown => (r.body as { details?: { reason?: string } }).details?.reason;

    it('sin contraseña ni código: 422 MFA_REAUTH_REQUIRED y no se crea ningún factor', () => {
      const antes = llamar<Estado>(marcos, 'GET', '/iam/me/mfa').body.factors.length;
      const r = llamar(marcos, 'POST', '/iam/me/mfa/totp', { body: {} });
      expect(r.status).toBe(422);
      expect(motivoDe(r)).toBe('MFA_REAUTH_REQUIRED');
      expect(llamar<Estado>(marcos, 'GET', '/iam/me/mfa').body.factors.length).toBe(antes);
    });

    it('una contraseña o un código que no valen: 422 MFA_REAUTH_FAILED', () => {
      expect(motivoDe(llamar(marcos, 'POST', '/iam/me/mfa/totp', { body: { currentPassword: 'incorrecta' } }))).toBe('MFA_REAUTH_FAILED');
      expect(motivoDe(llamar(marcos, 'POST', '/iam/me/mfa/totp', { body: { mfaCode: '000000' } }))).toBe('MFA_REAUTH_FAILED');
    });

    it('el código de un factor ya verificado también reautentica (123456, y solo si la cuenta tiene uno)', () => {
      expect(llamar(marcos, 'POST', '/iam/me/mfa/totp', { body: { mfaCode: '123456' } }).status).toBe(201);
      expect(llamar(medica, 'POST', '/iam/me/mfa/totp', { body: { mfaCode: '123456' } }).status).toBe(422);
    });

    it('quitar exige lo mismo y responde { revoked, remainingVerified }', () => {
      const verificado = llamar<Estado>(marcos, 'GET', '/iam/me/mfa').body.factors.find((f) => f.state === 'VERIFIED')!;
      expect(motivoDe(llamar(marcos, 'POST', `/iam/me/mfa/${verificado.id}/revoke`, { body: {} }))).toBe('MFA_REAUTH_REQUIRED');
      expect(motivoDe(llamar(marcos, 'POST', `/iam/me/mfa/${verificado.id}/revoke`, { body: { currentPassword: 'incorrecta' } }))).toBe('MFA_REAUTH_FAILED');
      const r = llamar<{ revoked: boolean; remainingVerified: number }>(marcos, 'POST', `/iam/me/mfa/${verificado.id}/revoke`, { body: { currentPassword: 'mi-clave' } });
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ revoked: true, remainingVerified: 0 });
      expect(llamar<Estado>(marcos, 'GET', '/iam/me/mfa').body.enrolled).toBe(false);
    });

    it('quitar un factor que no existe o ya está retirado: 404', () => {
      const r = llamar(marcos, 'POST', '/iam/me/mfa/00000000-0000-4000-8000-000000000000/revoke', { body: { currentPassword: 'mi-clave' } });
      expect(r.status).toBe(404);
    });

    it('nadie quita el método de otra persona', () => {
      const deAna = llamar<Estado>(ana, 'GET', '/iam/me/mfa').body.factors[0]!;
      expect(llamar(marcos, 'POST', `/iam/me/mfa/${deAna.id}/revoke`, { body: { currentPassword: 'mi-clave' } }).status).toBe(404);
    });
  });

  it('GET /iam/me/network dice con qué dirección ve la API la conexión, su familia y los saltos de proxy', () => {
    const r = llamar<{ ip: string; family: string; trustProxyHops: number }>(marcos, 'GET', '/iam/me/network');
    expect(r.body).toEqual({ ip: ORIGEN_SIMULADO, family: 'ipv4', trustProxyHops: 1 });
    fijarSaltosDeProxy(0);
    expect(llamar<{ trustProxyHops: number }>(marcos, 'GET', '/iam/me/network').body.trustProxyHops).toBe(0);
    fijarSaltosDeProxy(1);
    expect(llamar(null, 'GET', '/iam/me/network').status).toBe(401);
  });
});

describe('reglas de red de la organización', () => {
  const comoOrg = <T = unknown>(method: MockMethod, body?: unknown) =>
    llamar<T>(org, method, '/org/ip-access-rules', { ...(body === undefined ? {} : { body }), tenant: TENANT_HOSPITAL_PILOTO });
  const guardar = (rules: unknown) => comoOrg<IpAccessRules & { reason?: string; details?: { reason: string; cidr?: string } }>('PUT', { rules });
  const MIA: { type: 'ALLOW'; cidr: string } = { type: 'ALLOW', cidr: '190.129.0.0/16' };

  it('arranca sin reglas', () => {
    expect(comoOrg<IpAccessRules>('GET').body).toEqual({ rules: [] });
  });

  it('solo la cuenta de la organización las lee y las cambia', () => {
    expect(llamar(ana, 'GET', '/org/ip-access-rules', { tenant: TENANT_HOSPITAL_PILOTO }).status).toBe(403);
    expect(llamar(medica, 'PUT', '/org/ip-access-rules', { body: { rules: [] }, tenant: TENANT_HOSPITAL_PILOTO }).status).toBe(403);
    expect(llamar(null, 'GET', '/org/ip-access-rules').status).toBe(401);
  });

  it('PUT reemplaza el conjunto y devuelve las reglas con su id, en el orden en que se guardaron', () => {
    const r = guardar([MIA, { type: 'DENY', cidr: '190.129.99.0/24', description: 'Sala de espera' }]);
    expect(r.status).toBe(200);
    expect(r.body.rules.map((x) => [x.type, x.cidr, x.description])).toEqual([
      ['ALLOW', '190.129.0.0/16', undefined],
      ['DENY', '190.129.99.0/24', 'Sala de espera'],
    ]);
    expect(r.body.rules.every((x) => typeof x.id === 'string' && x.id !== '')).toBe(true);
    expect(comoOrg<IpAccessRules>('GET').body.rules).toHaveLength(2);
    // Reemplazar es reemplazar: lo anterior no queda.
    expect(guardar([MIA]).body.rules).toHaveLength(1);
  });

  it('un rango que no es CIDR: 422 IP_RULE_CIDR_INVALID con el rango, y no cambia nada', () => {
    for (const malo of ['190.129.0.0', '190.129.0.0/40', 'sede']) {
      const r = guardar([MIA, { type: 'DENY', cidr: malo }]);
      expect(r.status, malo).toBe(422);
      expect(r.body.reason).toBe('IP_RULE_CIDR_INVALID');
      expect(r.body.details).toMatchObject({ reason: 'IP_RULE_CIDR_INVALID', cidr: malo });
    }
    expect(comoOrg<IpAccessRules>('GET').body.rules).toHaveLength(1);
  });

  it('una vigencia que termina antes de empezar: 422 IP_RULE_VALIDITY_INVALID', () => {
    const r = guardar([{ ...MIA, validFrom: '2026-12-01T00:00:00Z', validTo: '2026-11-01T00:00:00Z' }]);
    expect(r.status).toBe(422);
    expect(r.body.reason).toBe('IP_RULE_VALIDITY_INVALID');
  });

  it('un conjunto que deja fuera a quien lo guarda: 422 IP_RULES_WOULD_LOCK_OUT_ACTOR y no se guarda', () => {
    for (const encierra of [[{ type: 'ALLOW', cidr: '203.0.113.0/24' }], [{ type: 'DENY', cidr: `${ORIGEN_SIMULADO}/32` }], [MIA, { type: 'DENY', cidr: '190.129.10.0/24' }]]) {
      const r = guardar(encierra);
      expect(r.status, JSON.stringify(encierra)).toBe(422);
      expect(r.body.reason).toBe('IP_RULES_WOULD_LOCK_OUT_ACTOR');
      expect(r.body.details?.reason).toBe('IP_RULES_WOULD_LOCK_OUT_ACTOR');
    }
    expect(comoOrg<IpAccessRules>('GET').body.rules.map((x) => x.cidr)).toEqual(['190.129.0.0/16']);
  });

  it('una regla que todavía no rige no cuenta para el cierre: se puede guardar una permitida futura', () => {
    const futura = guardar([{ type: 'ALLOW', cidr: '203.0.113.0/24', validFrom: new Date(Date.now() + 10 * 86_400_000).toISOString() }]);
    expect(futura.status).toBe(200);
  });

  it('sin reglas no hay restricción: vaciar el conjunto se puede siempre', () => {
    expect(guardar([]).status).toBe(200);
    expect(comoOrg<IpAccessRules>('GET').body.rules).toEqual([]);
  });

  it('más de 50 reglas, o una forma que no es la del DTO, es 400', () => {
    expect(guardar(Array.from({ length: 51 }, (_, i) => ({ type: 'ALLOW', cidr: `190.129.${i}.0/24` }))).status).toBe(400);
    expect(guardar('no es una lista').status).toBe(400);
    expect(guardar([{ type: 'TAL_VEZ', cidr: '190.129.0.0/16' }]).status).toBe(400);
    expect(guardar([{ type: 'ALLOW', cidr: '190.129.0.0/16', validFrom: 'mañana' }]).status).toBe(400);
  });
});
