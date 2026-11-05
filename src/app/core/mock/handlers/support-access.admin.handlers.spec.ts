import { HttpHeaders } from '@angular/common/http';

import type { SessionPolicies, SessionPolicy, SupportActivityPage, SupportEngagement } from '../../data-access/support-access/support-access.types';
import { weekdayAndMinutes } from '../../data-access/support-access/session-policy';
import { VINCULO_ANA, vinculos } from '../fixtures/support-hospital';
import { VINCULOS_PARA_REVISION } from '../fixtures/support-hospital-review';
import { reiniciarLaSesionDelSimulador } from './mock-reset';
import { crearRouterSimulado } from './index';
import { CODIGO_DE_DISPOSITIVO } from './support-access.session.handlers';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_HOSPITAL_PILOTO, TENANT_FARMACIA, type MockUser } from '../mock-session';

/**
 * Lo que la ronda de **administración y seguridad** agrega al simulador: controles
 * de sesión que sí se aplican al entrar, aviso de dispositivo nuevo, recertificación
 * (de la persona y de la organización), suspensión por vencimiento y la bitácora con
 * filtros. Como en la otra suite del hospital, el estado vive en colecciones del
 * módulo: las pruebas **se leen en orden** y cada una limpia lo que cambió.
 */
let router: MockRouter;

const org = buscarUsuario('hospital_piloto')!;
const ana = buscarUsuario('ana')!;
const lucia = buscarUsuario('lucia')!;
const perez = buscarUsuario('perez')!;
const farmacia = buscarUsuario('farmacia')!;

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}

function llamar<T = unknown>(user: MockUser | null, method: MockMethod, path: string, opciones: { body?: unknown; query?: Record<string, string>; tenant?: string } = {}): Respuesta<T> {
  const query = new URLSearchParams(opciones.query ?? {});
  const match = router.match(method, path);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({
    method,
    path,
    params: match.params,
    query,
    body: opciones.body ?? null,
    headers: new HttpHeaders(opciones.tenant === undefined ? {} : { 'X-Tenant-Id': opciones.tenant }),
    user,
  });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}

const comoOrg = <T = unknown>(method: MockMethod, path: string, body?: unknown) =>
  llamar<T>(org, method, path, { ...(body === undefined ? {} : { body }), tenant: TENANT_HOSPITAL_PILOTO });

const entrar = (clave: string, extra: Record<string, unknown> = {}) => llamar<{ accessToken: string; newDevice?: { deviceId: string; label: string } } & { details?: { reason: string }; code?: string }>(null, 'POST', '/iam/auth/login', { body: { email: `${clave}@alovida.mock`, password: 'x', ...extra } });

function reclamos(token: string): Record<string, unknown> {
  const payload = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(payload.padEnd(Math.ceil(payload.length / 4) * 4, '='))) as Record<string, unknown>;
}

const politicas = (): readonly SessionPolicy[] => comoOrg<SessionPolicies>('GET', '/org/session-policies').body.policies;
const guardar = (policies: readonly SessionPolicy[]) => comoOrg<SessionPolicies>('PUT', '/org/session-policies', { policies });
const BASE: readonly SessionPolicy[] = [
  { scope: 'ALL_ACCOUNTS', idleTimeoutMinutes: 15, newDeviceAlert: true, enforceIpRules: false, requireMfa: false },
  { scope: 'ORG_STAFF', idleTimeoutMinutes: 10, newDeviceAlert: true, enforceIpRules: false, requireMfa: false },
];

describe('administración y seguridad en el simulador', () => {
  beforeAll(() => {
    // El corredor no aísla los módulos entre archivos de un mismo worker: Ana y la sesión parten de los datos de fábrica.
    reiniciarLaSesionDelSimulador();
    vinculos.agregar(VINCULO_ANA);
    router = crearRouterSimulado();
  });

  afterEach(() => {
    guardar(BASE);
  });

  afterAll(() => {
    // Este archivo reactiva a Silvia y renueva a Ana: se las deja a los demás como las trae el simulador.
    vinculos.agregar(VINCULO_ANA);
    for (const v of VINCULOS_PARA_REVISION) vinculos.agregar(v);
  });

  describe('controles de sesión', () => {
    it('la organización lee sus reglas; una persona, no', () => {
      expect(politicas().map((p) => p.scope)).toEqual(['ALL_ACCOUNTS', 'ORG_STAFF']);
      expect(llamar(ana, 'GET', '/org/session-policies', { tenant: TENANT_HOSPITAL_PILOTO }).status).toBe(403);
    });

    it('como la API, además de ser la cuenta de la organización exige SECURITY_ADMIN', () => {
      const sinRol: MockUser = { ...org, roles: ['USER'] };
      expect(llamar(sinRol, 'GET', '/org/session-policies', { tenant: TENANT_HOSPITAL_PILOTO }).status).toBe(403);
      expect(llamar(sinRol, 'GET', '/org/support-engagements', { tenant: TENANT_HOSPITAL_PILOTO }).status).toBe(403);
    });

    it('cualquier cuenta de organización con ese rol las tiene, la farmacia también; sin el rol, no', () => {
      expect(llamar(farmacia, 'GET', '/org/session-policies', { tenant: TENANT_FARMACIA }).status).toBe(403);
      const conRol: MockUser = { ...farmacia, roles: ['USER', 'SECURITY_ADMIN'] };
      const r = llamar<SessionPolicies>(conRol, 'GET', '/org/session-policies', { tenant: TENANT_FARMACIA });
      expect(r.status).toBe(200);
      // Sin nada guardado, rige la regla por omisión para todas las cuentas.
      expect(r.body.policies.map((p) => p.scope)).toEqual(['ALL_ACCOUNTS']);
    });

    it('guarda y lo guardado se lee igual (con el horario y todo)', () => {
      const nuevas: SessionPolicy[] = [
        ...BASE,
        { scope: 'ROLE', roleCode: 'PRACTITIONER', idleTimeoutMinutes: 20, newDeviceAlert: false, enforceIpRules: true, requireMfa: false, allowedHours: { days: [1, 2, 3, 4, 5], from: '07:00', to: '20:00', timeZone: 'America/La_Paz' } },
      ];
      expect(guardar(nuevas).status).toBe(200);
      const leidas = politicas();
      expect(leidas.map((p) => p.scope)).toEqual(['ALL_ACCOUNTS', 'ORG_STAFF', 'ROLE']);
      expect(leidas[2]).toMatchObject({ roleCode: 'PRACTITIONER', enforceIpRules: true, allowedHours: { from: '07:00', to: '20:00', days: [1, 2, 3, 4, 5] } });
      // Quitar una regla la quita de verdad.
      expect(guardar(BASE).status).toBe(200);
      expect(politicas()).toHaveLength(2);
    });

    it('rechaza lo que la API rechaza: inactividad fuera de rango, hora mal escrita, rol sin código, días repetidos', () => {
      expect(guardar([{ ...BASE[0]!, idleTimeoutMinutes: 3 }]).status).toBe(400);
      expect(guardar([{ ...BASE[0]!, allowedHours: { from: '8:00', to: '18:00' } }]).status).toBe(400);
      expect(guardar([{ ...BASE[0]!, allowedHours: { days: [1, 1], from: '08:00', to: '18:00' } }]).status).toBe(400);
      expect(guardar([{ ...BASE[0]!, allowedHours: { days: [7], from: '08:00', to: '18:00' } }]).status).toBe(400);
      expect(guardar([{ scope: 'ROLE', idleTimeoutMinutes: 10, newDeviceAlert: true, enforceIpRules: false, requireMfa: false }]).status).toBe(400);
      expect(guardar([BASE[0]!, BASE[0]!]).status).toBe(400);
      expect(politicas()).toHaveLength(2);
    });
  });

  describe('lo que la política hace al iniciar sesión', () => {
    it('el token trae el plazo de inactividad más estricto que alcanza a la persona', () => {
      expect(reclamos(entrar('ana').body.accessToken)['idleTimeoutMinutes']).toBe(10);
      guardar([{ ...BASE[0]!, idleTimeoutMinutes: 45 }, { ...BASE[1]!, idleTimeoutMinutes: 30 }]);
      expect(reclamos(entrar('ana').body.accessToken)['idleTimeoutMinutes']).toBe(30);
      // La cuenta de la organización no es «personal»: le rige solo la de todas las cuentas.
      expect(reclamos(entrar('hospital_piloto').body.accessToken)['idleTimeoutMinutes']).toBe(45);
    });

    it('el renovado del token conserva el plazo', () => {
      const sesion = entrar('ana').body as unknown as { refreshToken: string };
      const renovado = llamar<{ accessToken: string }>(null, 'POST', '/iam/auth/token/refresh', { body: { refreshToken: sesion.refreshToken } });
      expect(reclamos(renovado.body.accessToken)['idleTimeoutMinutes']).toBe(10);
    });

    it('con dos pasos obligatorio: sin código se pide, con uno malo se rechaza, con el bueno se entra', () => {
      guardar([BASE[0]!, { ...BASE[1]!, requireMfa: true }]);
      const sinCodigo = entrar('ana');
      expect(sinCodigo.status).toBe(401);
      expect(sinCodigo.body.details?.reason).toBe('MFA_REQUIRED');
      expect(entrar('ana', { mfaCode: '000000' }).body.details?.reason).toBe('MFA_INVALID');
      expect(entrar('ana', { mfaCode: '123456' }).status).toBe(200);
    });

    it('quien aún no activó los dos pasos ENTRA —como la API— y la respuesta le avisa que debe darlos de alta', () => {
      guardar([BASE[0]!, { ...BASE[1]!, requireMfa: true }]);
      const marcos = entrar('marcos');
      expect(marcos.status).toBe(200);
      expect(marcos.body.accessToken).toBeDefined();
      expect((marcos.body as { mfaEnrollmentRequired?: boolean }).mfaEnrollmentRequired).toBe(true);
      // Quien ya los tiene no recibe el aviso.
      expect((entrar('ana', { mfaCode: '123456' }).body as { mfaEnrollmentRequired?: boolean }).mfaEnrollmentRequired).toBeUndefined();
    });

    it('sin la política que los exige, nadie recibe el aviso', () => {
      guardar(BASE);
      expect((entrar('marcos').body as { mfaEnrollmentRequired?: boolean }).mfaEnrollmentRequired).toBeUndefined();
    });

    it('fuera del horario laboral no entra; dentro sí', () => {
      const { day, minutes } = weekdayAndMinutes(new Date());
      const cerrado = { days: [(day + 3) % 7], from: '00:00', to: '23:30' };
      // Se restringe al personal (`ORG_STAFF`): una regla de «todas las cuentas» que deje fuera la hora de quien guarda es 422
      // `SESSION_POLICY_WOULD_LOCK_OUT_ACTOR`, y la cuenta de la organización no es personal.
      guardar([BASE[0]!, { ...BASE[1]!, allowedHours: cerrado }]);
      const fuera = entrar('ana');
      expect(fuera.status).toBe(401);
      expect(fuera.body.details?.reason).toBe('OUTSIDE_ALLOWED_HOURS');

      // Todos los días, casi todo el día: incluye este instante salvo el último minuto.
      expect(minutes).toBeGreaterThanOrEqual(0);
      guardar([BASE[0]!, { ...BASE[1]!, allowedHours: { days: [0, 1, 2, 3, 4, 5, 6], from: '00:00', to: '23:59' } }]);
      expect(entrar('ana').status).toBe(200);
    });

    it('una contraseña vacía sigue siendo credencial inválida, no un rechazo de política', () => {
      guardar([BASE[0]!, { ...BASE[1]!, requireMfa: true }]);
      const r = llamar<{ details?: { reason?: string } }>(null, 'POST', '/iam/auth/login', { body: { email: 'ana@alovida.mock', password: '' } });
      expect(r.status).toBe(401);
      expect(r.body.details?.reason).toBeUndefined();
    });
  });

  describe('dispositivo nuevo', () => {
    it('Lucía entra desde un dispositivo nuevo y se le avisa hasta que diga «fui yo»', () => {
      const primero = entrar('lucia');
      expect(primero.body.newDevice).toMatchObject({ label: expect.stringContaining('Chrome') });
      expect(entrar('lucia').body.newDevice).toBeDefined();

      const idDelDispositivo = primero.body.newDevice!.deviceId;
      // Solo la dueña lo puede confirmar, y solo con prueba: el código de 8 dígitos que llega al correo verificado.
      expect(llamar(ana, 'POST', `/iam/me/devices/${idDelDispositivo}/confirm`).status).toBe(404);
      expect(llamar(lucia, 'POST', `/iam/me/devices/${idDelDispositivo}/confirm`).status).toBe(422);
      llamar(lucia, 'POST', `/iam/me/devices/${idDelDispositivo}/confirm-code`);
      const confirmado = llamar<{ confirmed: boolean; deviceId: string }>(lucia, 'POST', `/iam/me/devices/${idDelDispositivo}/confirm`, { body: { code: CODIGO_DE_DISPOSITIVO } });
      expect(confirmado.status).toBe(200);
      expect(confirmado.body).toEqual({ confirmed: true, deviceId: idDelDispositivo });
      expect(entrar('lucia').body.newDevice).toBeUndefined();
    });

    it('«No fui yo» cierra las demás sesiones en una sola operación y devuelve cuántas', () => {
      const marcos = buscarUsuario('marcos')!;
      const aviso = entrar('marcos').body.newDevice!;
      // Solo su dueño lo puede reportar.
      expect(llamar(ana, 'POST', `/iam/me/devices/${aviso.deviceId}/not-me`).status).toBe(404);
      const r = llamar<{ revokedSessions: number; deviceId: string }>(marcos, 'POST', `/iam/me/devices/${aviso.deviceId}/not-me`);
      expect(r.status).toBe(200);
      expect(r.body).toEqual({ revokedSessions: 1, deviceId: aviso.deviceId });
      // Ya no quedan otras: la segunda vez no cierra nada.
      expect(llamar<{ revokedSessions: number }>(marcos, 'POST', `/iam/me/devices/${aviso.deviceId}/not-me`).body.revokedSessions).toBe(0);
      // El dispositivo sigue sin ser de confianza: el aviso vuelve en el próximo ingreso.
      expect(entrar('marcos').body.newDevice).toBeDefined();
    });

    it('si la política no lo avisa, no hay aviso', () => {
      guardar([{ ...BASE[0]!, newDeviceAlert: false }, { ...BASE[1]!, newDeviceAlert: false }]);
      expect(entrar('marcos').body.newDevice).toBeUndefined();
    });

    it('quien no es de las cuentas demo con aviso entra sin él', () => {
      expect(entrar('ana').body.newDevice).toBeUndefined();
    });
  });

  describe('recertificación', () => {
    type VinculoRed = Omit<SupportEngagement, 'status' | 'roleTemplate'> & { roleTemplateCode: string; status: string; recertificationDue: boolean };
    const vistos = () => comoOrg<{ items: VinculoRed[]; count: number }>('GET', '/org/support-engagements').body.items;
    const de = (nombre: string) => vistos().find((v) => v.personName === nombre)!;

    it('la lista trae `items` y `count`, con los nombres de la API y sin lo que la API no tiene', () => {
      const lista = comoOrg<{ items: VinculoRed[]; count: number }>('GET', '/org/support-engagements').body;
      expect(lista.count).toBe(lista.items.length);
      const ana_ = de('Ana Gutiérrez') as unknown as Record<string, unknown>;
      expect(ana_['roleTemplateCode']).toBe('SECRETARY');
      expect(ana_['organizationName']).toBe('Hospital Piloto Mantra');
      for (const campo of ['personEmail', 'reactivationRequestedAt', 'roleTemplate']) expect(ana_).not.toHaveProperty(campo);
    });

    it('Pedro venció pero sigue en plazo; Silvia ya se suspendió; Gabriel y Ana vencen pronto', () => {
      expect(de('Pedro Camacho').status).toBe('ACTIVE');
      expect(de('Pedro Camacho').recertificationDue).toBe(true);
      expect(de('Silvia Soria').status).toBe('SUSPENDED');
      expect(de('Silvia Soria').suspendedAt).toBeDefined();
      for (const nombre of ['Gabriel Rojas', 'Ana Gutiérrez']) {
        const dias = (new Date(de(nombre).nextRecertificationAt!).getTime() - Date.now()) / 86_400_000;
        expect(dias).toBeGreaterThan(0);
        expect(dias).toBeLessThan(30);
        expect(de(nombre).recertificationDue).toBe(false);
      }
    });

    it('un vínculo que pasa los 15 días sin confirmarse se suspende al leer —con `suspendedAt` = vencimiento + 15 días—, y su persona deja de tener acceso', () => {
      const lucas = vinculos.get(de('Marcos Ribera').id)!;
      const original = lucas.nextRecertificationAt;
      const vencio = new Date(Date.now() - 16 * 86_400_000).toISOString();
      vinculos.actualizar(lucas.id, { nextRecertificationAt: vencio });
      const suspendido = de('Marcos Ribera');
      expect(suspendido.status).toBe('SUSPENDED');
      expect(new Date(suspendido.suspendedAt!).getTime()).toBe(new Date(vencio).getTime() + 15 * 86_400_000);
      const agenda = llamar(buscarUsuario('marcos')!, 'GET', '/me/support-agenda', { query: { tenantId: TENANT_HOSPITAL_PILOTO, from: new Date().toISOString(), to: new Date().toISOString() } });
      expect(agenda.status).toBe(403);
      const hecho = llamar<{ items: { action: string }[] }>(org, 'GET', '/org/support-activity', { tenant: TENANT_HOSPITAL_PILOTO });
      expect(hecho.body.items.some((e) => e.action === 'engagement.suspended')).toBe(true);
      // La organización lo reactiva y vuelve a regir.
      expect(comoOrg('POST', `/org/support-engagements/${lucas.id}/recertify`, {}).status).toBe(200);
      expect(de('Marcos Ribera').status).toBe('ACTIVE');
      vinculos.actualizar(lucas.id, { nextRecertificationAt: original });
    });

    it('recertificar y terminar responden `{ ok: true }` como la API, no el vínculo', () => {
      const gabriel = de('Gabriel Rojas');
      const r = comoOrg<Record<string, unknown>>('POST', `/org/support-engagements/${gabriel.id}/recertify`, { recertifyEveryMonths: 12 });
      expect(r.body).toEqual({ ok: true });
    });

    it('Ana declara que sigue trabajando aquí: queda dicho quién y cuándo, pero NO se renueva ni se reactiva', () => {
      const antes = de('Ana Gutiérrez');
      const r = llamar<VinculoRed & { reactivated: boolean }>(ana, 'POST', `/me/support-engagements/${antes.id}/confirm`);
      expect(r.status).toBe(200);
      expect(r.body.reactivated).toBe(false);
      expect(r.body.lastConfirmedBy).toBe('PERSON');
      expect(r.body.lastConfirmedAt).toBeDefined();
      // La fecha de recertificación no se mueve: renovar es de la organización.
      expect(r.body.nextRecertificationAt).toBe(antes.nextRecertificationAt);
      const persona = llamar<{ items: VinculoRed[]; count: number; requests: unknown[] }>(ana, 'GET', '/me/support-engagements').body;
      expect(persona.count).toBe(persona.items.length);
      expect(persona.items[0]!.lastConfirmedBy).toBe('PERSON');
      expect(persona).not.toHaveProperty('engagements');
      // La organización lo ve y, al renovar, la confirmación pasa a ser suya.
      expect(comoOrg('POST', `/org/support-engagements/${antes.id}/recertify`, {}).status).toBe(200);
      expect(de('Ana Gutiérrez').lastConfirmedBy).toBe('ORGANIZATION');
    });

    it('nadie confirma el vínculo de otra persona', () => {
      expect(llamar(lucia, 'POST', `/me/support-engagements/${de('Ana Gutiérrez').id}/confirm`).status).toBe(404);
    });

    it('un vínculo suspendido NO se reactiva con la confirmación de la persona: sigue suspendido y solo la organización lo renueva', () => {
      const silvia = de('Silvia Soria');
      const suspendida = buscarUsuario('silvia')!;
      expect(suspendida.id).toBe(silvia.userId);
      const declaracion = llamar<VinculoRed & { reactivated: boolean }>(suspendida, 'POST', `/me/support-engagements/${silvia.id}/confirm`);
      expect(declaracion.status).toBe(200);
      expect(declaracion.body.status).toBe('SUSPENDED');
      expect(declaracion.body.reactivated).toBe(false);
      expect(de('Silvia Soria').status).toBe('SUSPENDED');

      expect(comoOrg('POST', `/org/support-engagements/${silvia.id}/recertify`, { recertifyEveryMonths: 6 }).status).toBe(200);
      const reactivada = de('Silvia Soria');
      expect(reactivada.status).toBe('ACTIVE');
      expect(reactivada.suspendedAt).toBeUndefined();
      expect(reactivada.recertifyEveryMonths).toBe(6);
      expect(reactivada.lastConfirmedBy).toBe('ORGANIZATION');
    });

    it('un vínculo terminado se ve como REVOKED —la API no tiene ENDED— y no se confirma', () => {
      const pedro = de('Pedro Camacho');
      expect(comoOrg('POST', `/org/support-engagements/${pedro.id}/end`, { reason: 'Ya no trabaja acá' }).body).toEqual({ ok: true });
      expect(de('Pedro Camacho').status).toBe('REVOKED');
      expect(comoOrg('POST', `/org/support-engagements/${pedro.id}/recertify`, {}).status).toBe(409);
    });
  });

  describe('bitácora con filtros', () => {
    const pagina = (query: Record<string, string> = {}) => llamar<SupportActivityPage & { count: number }>(org, 'GET', '/org/support-activity', { query, tenant: TENANT_HOSPITAL_PILOTO }).body;
    const org_ = (query: Record<string, string> = {}) => pagina(query).items;

    it('cada asiento trae la forma de la API: persona e instante repetidos, asiento crudo, resultado', () => {
      const e = org_({ action: 'schedule.create' })[0]! as unknown as Record<string, unknown>;
      expect(e['personName']).toBe(e['actorName']);
      expect(e['createdAt']).toBe(e['occurredAt']);
      expect(e['createdAt']).toBe(e['recordedAt']);
      expect(e['auditAction']).toBe('DIRECT_APPOINTMENT_CREATED');
      expect(e['permission']).toBe('schedule.create');
      expect(e['entity']).toBe('appointment');
      expect(e['success']).toBe(true);
      expect(e['result']).toBe('SUCCESS');
      expect(typeof e['userId']).toBe('string');
      // La bitácora de la API no trae nada del paciente.
      expect(e).not.toHaveProperty('patientLabel');
    });

    it('la organización filtra por persona (nombre o id), doctor, acción —código o asiento crudo— y fecha', () => {
      const todas = org_();
      expect(todas.length).toBeGreaterThan(15);
      expect(org_({ person: 'ana gutierrez' }).every((e) => e.personName === 'Ana Gutiérrez')).toBe(true);
      const idDeAna = org_({ person: 'Ana Gutiérrez' })[0]!.userId;
      expect(org_({ userId: idDeAna }).length).toBe(org_({ person: idDeAna }).length);
      expect(org_({ doctor: 'Dr. Andrés Pérez' }).every((e) => e.practitionerName === 'Dr. Andrés Pérez')).toBe(true);
      expect(org_({ action: 'schedule.create' }).every((e) => e.action === 'schedule.create')).toBe(true);
      expect(org_({ action: 'DIRECT_APPOINTMENT_CREATED' }).length).toBe(org_({ action: 'schedule.create' }).length);
      const hace10 = new Date(Date.now() - 10 * 86_400_000);
      const desde = `${hace10.getFullYear()}-${String(hace10.getMonth() + 1).padStart(2, '0')}-${String(hace10.getDate()).padStart(2, '0')}`;
      const recientes = org_({ from: desde });
      expect(recientes.length).toBeGreaterThan(0);
      expect(recientes.length).toBeLessThan(todas.length);
    });

    it('una fecha sin hora es el día completo en la hora de La Paz (UTC-4)', () => {
      const e = org_()[0]!;
      const dia = new Date(new Date(e.createdAt).getTime() - 4 * 3_600_000).toISOString().slice(0, 10);
      expect(org_({ from: dia, to: dia }).some((x) => x.id === e.id)).toBe(true);
      const anterior = new Date(new Date(`${dia}T00:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10);
      expect(org_({ from: anterior, to: anterior }).some((x) => x.id === e.id)).toBe(false);
    });

    it('viene lo más reciente primero', () => {
      const fechas = org_().map((e) => e.createdAt);
      expect([...fechas].sort().reverse()).toEqual(fechas);
    });

    it('pagina con `limit` y un cursor opaco, sin repetir ni perder asientos', () => {
      const todas = org_({ limit: '200' });
      const primera = pagina({ limit: '5' });
      expect(primera.items).toHaveLength(5);
      expect(primera.count).toBe(5);
      expect(primera.nextCursor).toEqual(expect.any(String));
      const segunda = pagina({ limit: '5', cursor: primera.nextCursor! });
      expect([...primera.items, ...segunda.items].map((e) => e.id)).toEqual(todas.slice(0, 10).map((e) => e.id));
      // Recorrerla entera da lo mismo que pedirla de una vez, y la última página no tiene cursor.
      const juntas: string[] = [];
      let cursor: string | null = null;
      do {
        const p: SupportActivityPage = pagina({ limit: '7', ...(cursor === null ? {} : { cursor }) });
        juntas.push(...p.items.map((e) => e.id));
        cursor = p.nextCursor;
      } while (cursor !== null);
      expect(juntas).toEqual(todas.map((e) => e.id));
    });

    it('el tope va de 1 a 200: fuera de ese rango, 400', () => {
      const pedir = (limit: string) => llamar(org, 'GET', '/org/support-activity', { query: { limit }, tenant: TENANT_HOSPITAL_PILOTO }).status;
      expect([pedir('0'), pedir('201'), pedir('9999'), pedir('tres')]).toEqual([400, 400, 400, 400]);
      expect([pedir('1'), pedir('200')]).toEqual([200, 200]);
    });

    it('el doctor ve solo lo que pasó sobre su agenda, y puede filtrar', () => {
      const r = llamar<SupportActivityPage>(perez, 'GET', '/me/practitioner/support-activity').body.items;
      expect(r.length).toBeGreaterThan(5);
      expect(r.every((e) => e.practitionerName === 'Dr. Andrés Pérez')).toBe(true);
      const soloAna = llamar<SupportActivityPage>(perez, 'GET', '/me/practitioner/support-activity', { query: { person: 'Ana Gutiérrez' } }).body.items;
      expect(soloAna.every((e) => e.personName === 'Ana Gutiérrez')).toBe(true);
      expect(llamar(ana, 'GET', '/me/practitioner/support-activity').status).toBe(403);
    });

    it('«Mi actividad»: la persona ve lo suyo, nada de lo de otras, y puede acotarlo a una organización', () => {
      const mia = llamar<SupportActivityPage>(ana, 'GET', '/me/support-activity').body.items;
      expect(mia.length).toBeGreaterThan(4);
      expect(mia.every((e) => e.personName === 'Ana Gutiérrez')).toBe(true);
      const deLucia = llamar<SupportActivityPage>(lucia, 'GET', '/me/support-activity').body.items;
      expect(deLucia.every((e) => e.personName === 'Lucía Paz')).toBe(true);
      expect(llamar<SupportActivityPage>(ana, 'GET', '/me/support-activity', { query: { tenantId: TENANT_FARMACIA } }).body.items).toEqual([]);
      expect(llamar(null, 'GET', '/me/support-activity').status).toBe(403);
    });
  });
});
