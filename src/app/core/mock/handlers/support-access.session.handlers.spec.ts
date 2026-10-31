import { HttpHeaders } from '@angular/common/http';

import { decodeAccessToken } from '../../auth/access-token';
import { crearRouterSimulado } from './index';
import { redesDeLaOrganizacion } from './iam-security.handlers';
import { CODIGO_DE_DISPOSITIVO } from './support-access.session.handlers';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_CESPEDES, TENANT_HOSPITAL_PILOTO, type MockUser } from '../mock-session';
import { reiniciarLaBandejaDeApoyo } from '../fixtures/support-hospital-inbox';
import { reiniciarElGobiernoDeAccesos, reiniciarLaSesionDelSimulador } from './mock-reset';

/**
 * La política de sesión por **organización** en el simulador, con lo que hace la API: la que niega ahora sale de la sesión y
 * se declara en `deniedTenants` (la persona entra a las demás); el token de alcance limitado cuando todas niegan por falta
 * del segundo factor; los rechazos 422 al guardar; y la confirmación de un dispositivo con código del correo.
 * El estado vive en colecciones del módulo y las pruebas se leen en orden.
 */
let router: MockRouter;
const org = buscarUsuario('hospital_piloto')!;
const ana = buscarUsuario('ana')!;
const elena = buscarUsuario('elena')!;
const mariela = buscarUsuario('mariela')!;
const lucia = buscarUsuario('lucia')!;
const marcos = buscarUsuario('marcos')!;

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

interface Sesion {
  accessToken: string;
  refreshToken: string;
  deniedTenants?: { tenantId: string; reason: string }[];
  mfaEnrollmentRequired?: boolean;
  newDevice?: { deviceId: string };
}

const entrar = (user: MockUser, mfaCode?: string): Respuesta<Sesion> =>
  llamar<Sesion>(null, 'POST', '/iam/auth/login', { body: { email: user.email, password: 'cualquiera', ...(mfaCode === undefined ? {} : { mfaCode }) } });
const refrescar = (refreshToken: string): Respuesta<Sesion> => llamar<Sesion>(null, 'POST', '/iam/auth/token/refresh', { body: { refreshToken } });
const motivoDe = (r: Respuesta): unknown => (r.body as { details?: { reason?: string } }).details?.reason;

interface Franja { from: string; to: string; days?: number[]; timeZone?: string }
const base = { idleTimeoutMinutes: 15, newDeviceAlert: true, enforceIpRules: false, requireMfa: false };
const guardar = (policies: unknown[]): Respuesta => llamar(org, 'PUT', '/org/session-policies', { tenant: TENANT_HOSPITAL_PILOTO, body: { policies } });
const POLITICAS_DE_PARTIDA = [
  { scope: 'ALL_ACCOUNTS', ...base },
  { scope: 'ORG_STAFF', ...base, idleTimeoutMinutes: 10 },
];

/** Una franja de cinco horas que empieza dentro de dos: ahora queda **afuera**. */
function franjaQueNoIncluyeAhora(): Franja {
  const laPaz = new Date(Date.now() - 4 * 3_600_000);
  const minutos = laPaz.getUTCHours() * 60 + laPaz.getUTCMinutes();
  const hhmm = (m: number): string => `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const desde = minutos + 120;
  return { from: hhmm(desde), to: hhmm(desde + 300), timeZone: 'America/La_Paz' };
}

beforeAll(() => {
  reiniciarLaSesionDelSimulador();
  // Las reglas alcanzan a Ana, Elena y Mariela como **personal** solo con su vínculo vivo (`audienciaDe`). El corredor no aísla
  // los módulos entre archivos (`isolate: false`) y otro archivo del mismo worker pudo terminarle el vínculo a Ana (el caso 12
  // de support-access.handlers.spec.ts): entonces la regla del personal no la alcanzaba y entraba sin código. Se parte de los
  // vínculos de fábrica, con Mariela, que la suma la bandeja al cargarse y el reinicio se lleva (sin ella entraba con 200).
  reiniciarElGobiernoDeAccesos();
  reiniciarLaBandejaDeApoyo();
  router = crearRouterSimulado();
});

afterAll(() => {
  reiniciarLaSesionDelSimulador();
});

describe('organizaciones que niegan ahora', () => {
  it('Elena entra al consultorio aunque el hospital la niegue por horario: deniedTenants en el claim y en la respuesta', () => {
    expect(guardar([{ scope: 'ALL_ACCOUNTS', ...base }, { scope: 'ORG_STAFF', ...base, allowedHours: franjaQueNoIncluyeAhora() }]).status).toBe(200);
    const r = entrar(elena);
    expect(r.status).toBe(200);
    expect(r.body.deniedTenants).toEqual([{ tenantId: TENANT_HOSPITAL_PILOTO, reason: 'OUTSIDE_ALLOWED_HOURS' }]);
    const claims = decodeAccessToken(r.body.accessToken)!;
    // La que niega NO está en `tenants` ni en los nombres: la API los arma solo con las que dejan entrar.
    expect(claims.tenants).toEqual([TENANT_CESPEDES]);
    expect(claims.tenantNames).toEqual({ [TENANT_CESPEDES]: 'Consultorio Dra. Paola Céspedes' });
    expect(claims.deniedTenants).toEqual({ [TENANT_HOSPITAL_PILOTO]: 'OUTSIDE_ALLOWED_HOURS' });
    expect(claims.mfaEnrollment).toBeUndefined();
    // El refresco conserva lo mismo.
    expect(decodeAccessToken(refrescar(r.body.refreshToken).body.accessToken)!.deniedTenants).toEqual({ [TENANT_HOSPITAL_PILOTO]: 'OUTSIDE_ALLOWED_HOURS' });
  });

  it('quien solo tiene la organización que niega no entra: 401 con el motivo (el login se rechaza si ninguna deja entrar)', () => {
    const r = entrar(mariela);
    expect(r.status).toBe(401);
    expect(motivoDe(r)).toBe('OUTSIDE_ALLOWED_HOURS');
  });

  it('con un token de una organización que niega, pedir con X-Tenant-Id de ella sería 403 con el motivo (lo hace mock-token-guard)', () => {
    // La cabecera la mira `bloqueoDelToken`, que corre antes de cualquier ruta: ver mock-token-guard.spec.ts.
    expect(decodeAccessToken(entrar(elena).body.accessToken)!.deniedTenants).toHaveProperty(TENANT_HOSPITAL_PILOTO);
  });

  it('sin la restricción, Elena vuelve a entrar a las dos', () => {
    guardar(POLITICAS_DE_PARTIDA);
    const r = entrar(elena);
    expect(r.body.deniedTenants).toBeUndefined();
    expect(decodeAccessToken(r.body.accessToken)!.tenants).toEqual([TENANT_HOSPITAL_PILOTO, TENANT_CESPEDES]);
  });
});

describe('segundo factor exigido', () => {
  beforeAll(() => {
    guardar([{ scope: 'ALL_ACCOUNTS', ...base }, { scope: 'ORG_STAFF', ...base, requireMfa: true }]);
  });

  it('con un factor y sin código: 401 MFA_REQUIRED; con uno malo, 401 MFA_INVALID; con el bueno entra', () => {
    expect(motivoDe(entrar(ana))).toBe('MFA_REQUIRED');
    expect(motivoDe(entrar(ana, '000000'))).toBe('MFA_INVALID');
    expect(entrar(ana, '123456').status).toBe(200);
  });

  it('sin factor y con todas las organizaciones exigiéndolo, ENTRA con el token de alcance limitado y lo avisa', () => {
    const r = entrar(mariela);
    expect(r.status).toBe(200);
    expect(r.body.mfaEnrollmentRequired).toBe(true);
    expect(r.body.deniedTenants).toEqual([{ tenantId: TENANT_HOSPITAL_PILOTO, reason: 'MFA_ENROLLMENT_REQUIRED' }]);
    const claims = decodeAccessToken(r.body.accessToken)!;
    expect(claims).toMatchObject({ roles: [], tenants: [], mfaEnrollment: true });
  });

  it('sin factor pero con otra organización que lo deja entrar: token completo, la exigente en deniedTenants y el aviso', () => {
    const r = entrar(elena);
    expect(r.status).toBe(200);
    expect(r.body.mfaEnrollmentRequired).toBe(true);
    const claims = decodeAccessToken(r.body.accessToken)!;
    expect(claims.mfaEnrollment).toBeUndefined();
    expect(claims.tenants).toEqual([TENANT_CESPEDES]);
    expect(claims.deniedTenants).toEqual({ [TENANT_HOSPITAL_PILOTO]: 'MFA_ENROLLMENT_REQUIRED' });
  });

  it('el refresco con el token limitado lo conserva mientras falte el factor, y lo reemite completo al confirmarlo', () => {
    const limitado = entrar(mariela).body;
    expect(decodeAccessToken(refrescar(limitado.refreshToken).body.accessToken)!.mfaEnrollment).toBe(true);
    // Da de alta y confirma el factor (con la reautenticación que exige la API).
    const alta = llamar<{ id: string }>(mariela, 'POST', '/iam/me/mfa/totp', { body: { currentPassword: 'mi-clave' } });
    expect(llamar(mariela, 'POST', `/iam/me/mfa/totp/${alta.body.id}/confirm`, { body: { code: '123456' } }).status).toBe(200);
    const completo = decodeAccessToken(refrescar(limitado.refreshToken).body.accessToken)!;
    expect(completo.mfaEnrollment).toBeUndefined();
    expect(completo.tenants).toEqual([TENANT_HOSPITAL_PILOTO]);
  });

  afterAll(() => {
    reiniciarLaSesionDelSimulador();
  });
});

describe('guardar los controles de sesión: rechazos 422', () => {
  const con = (allowedHours: Franja): unknown[] => [{ scope: 'ALL_ACCOUNTS', ...base }, { scope: 'ORG_STAFF', ...base, allowedHours }];

  it('desde igual a hasta: 422 SESSION_POLICY_HOURS_EMPTY', () => {
    const r = guardar(con({ from: '09:00', to: '09:00' }));
    expect(r.status).toBe(422);
    expect(motivoDe(r)).toBe('SESSION_POLICY_HOURS_EMPTY');
  });

  it('menos de 4 horas: 422 SESSION_POLICY_HOURS_TOO_SHORT con el mínimo; 4 horas justas se guardan', () => {
    const r = guardar(con({ from: '09:00', to: '12:59' }));
    expect(r.status).toBe(422);
    expect(motivoDe(r)).toBe('SESSION_POLICY_HOURS_TOO_SHORT');
    expect((r.body as { details: { minimumMinutes: number } }).details.minimumMinutes).toBe(240);
    expect(guardar(con({ from: '09:00', to: '13:00' })).status).toBe(200);
  });

  it('una franja que cruza la medianoche suma los dos tramos: 22:00 a 03:00 son 5 horas y sirve', () => {
    expect(guardar(con({ from: '22:00', to: '03:00' })).status).toBe(200);
    expect(motivoDe(guardar(con({ from: '23:00', to: '01:00' })))).toBe('SESSION_POLICY_HOURS_TOO_SHORT');
  });

  it('un horario que deja fuera la hora en que trabaja quien guarda: 422 SESSION_POLICY_WOULD_LOCK_OUT_ACTOR', () => {
    const r = guardar([{ scope: 'ALL_ACCOUNTS', ...base, allowedHours: franjaQueNoIncluyeAhora() }]);
    expect(r.status).toBe(422);
    expect(motivoDe(r)).toBe('SESSION_POLICY_WOULD_LOCK_OUT_ACTOR');
  });

  it('exigir la red cuando las redes guardadas dejan fuera a quien guarda: 422 IP_RULES_WOULD_LOCK_OUT_ACTOR', () => {
    redesDeLaOrganizacion.agregar({ id: 'red-de-prueba', tenantId: TENANT_HOSPITAL_PILOTO, type: 'ALLOW', cidr: '10.0.0.0/8' });
    try {
      const r = guardar([{ scope: 'ALL_ACCOUNTS', ...base, enforceIpRules: true }]);
      expect(r.status).toBe(422);
      expect(motivoDe(r)).toBe('IP_RULES_WOULD_LOCK_OUT_ACTOR');
    } finally {
      redesDeLaOrganizacion.borrar('red-de-prueba');
    }
  });

  it('nada de lo rechazado cambió lo guardado', () => {
    guardar(POLITICAS_DE_PARTIDA);
    guardar(con({ from: '09:00', to: '09:00' }));
    const guardadas = llamar<{ policies: { scope: string; allowedHours?: unknown }[] }>(org, 'GET', '/org/session-policies', { tenant: TENANT_HOSPITAL_PILOTO }).body.policies;
    expect(guardadas.every((p) => p.allowedHours === undefined)).toBe(true);
  });
});

describe('«Fui yo» con código del correo', () => {
  it('Lucía entra desde un dispositivo nuevo; confirmar sin código es 422 DEVICE_CONFIRM_CODE_REQUIRED con canRequestCode', () => {
    guardar(POLITICAS_DE_PARTIDA);
    const aviso = entrar(lucia).body.newDevice!;
    const r = llamar(lucia, 'POST', `/iam/me/devices/${aviso.deviceId}/confirm`, { body: {} });
    expect(r.status).toBe(422);
    expect(motivoDe(r)).toBe('DEVICE_CONFIRM_CODE_REQUIRED');
    expect((r.body as { details: { canRequestCode: boolean } }).details.canRequestCode).toBe(true);
  });

  it('un código sin haberlo pedido, o equivocado: 422 DEVICE_CONFIRM_CODE_INVALID', () => {
    const { deviceId } = entrar(lucia).body.newDevice!;
    expect(motivoDe(llamar(lucia, 'POST', `/iam/me/devices/${deviceId}/confirm`, { body: { code: CODIGO_DE_DISPOSITIVO } }))).toBe('DEVICE_CONFIRM_CODE_INVALID');
    llamar(lucia, 'POST', `/iam/me/devices/${deviceId}/confirm-code`);
    expect(motivoDe(llamar(lucia, 'POST', `/iam/me/devices/${deviceId}/confirm`, { body: { code: '00000000' } }))).toBe('DEVICE_CONFIRM_CODE_INVALID');
    expect(llamar(lucia, 'POST', `/iam/me/devices/${deviceId}/confirm`, { body: { code: '123' } }).status).toBe(400);
  });

  it('confirm-code responde { sent, sentTo } con la dirección enmascarada, y con el código del correo se confirma', () => {
    const { deviceId } = entrar(lucia).body.newDevice!;
    const enviado = llamar<{ sent: boolean; sentTo: string }>(lucia, 'POST', `/iam/me/devices/${deviceId}/confirm-code`);
    expect(enviado.body).toEqual({ sent: true, sentTo: 'l***@alovida.mock' });
    expect(enviado.body.sentTo).not.toContain('lucia');
    const r = llamar<{ confirmed: boolean; deviceId: string }>(lucia, 'POST', `/iam/me/devices/${deviceId}/confirm`, { body: { code: CODIGO_DE_DISPOSITIVO } });
    expect(r.body).toEqual({ confirmed: true, deviceId });
    // Ya es de confianza: el aviso no vuelve y pedir otro código no manda nada.
    expect(entrar(lucia).body.newDevice).toBeUndefined();
    expect(llamar<{ sent: boolean }>(lucia, 'POST', `/iam/me/devices/${deviceId}/confirm-code`).body.sent).toBe(false);
  });

  it('sin correo verificado no hay canal: 422 DEVICE_CONFIRM_NO_VERIFIED_EMAIL', () => {
    const { deviceId } = entrar(marcos).body.newDevice!;
    const r = llamar(marcos, 'POST', `/iam/me/devices/${deviceId}/confirm-code`);
    expect(r.status).toBe(422);
    expect(motivoDe(r)).toBe('DEVICE_CONFIRM_NO_VERIFIED_EMAIL');
  });

  it('el dispositivo de otra persona es 404', () => {
    const { deviceId } = entrar(marcos).body.newDevice!;
    expect(llamar(lucia, 'POST', `/iam/me/devices/${deviceId}/confirm`, { body: { code: CODIGO_DE_DISPOSITIVO } }).status).toBe(404);
    expect(llamar(lucia, 'POST', `/iam/me/devices/${deviceId}/confirm-code`).status).toBe(404);
  });
});
