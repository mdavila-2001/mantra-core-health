import { HttpHeaders } from '@angular/common/http';

import { prescriptionList } from '../fixtures/clinic';
import { PRESCRIPTION_STATUS } from '../fixtures/concepts';
import { MEDICAL, PACIENTE } from '../fixtures/people';
import { isMockReply, MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { crearRouterSimulado } from './index';
import { registerPrescriptionShares, shareList } from './prescription-shares.handlers';

/**
 * El enlace para compartir una receta en el simulador (FAR-01), con las formas
 * del DTO de la API. Lo que se fija: el token sale una vez y no se guarda; la
 * receta vale si está emitida y vigente; solo el dueño (o quien lo creó) lo ve
 * y lo revoca; la vista pública no dice nada del paciente ni de los fármacos;
 * y las cinco rutas están registradas en el router del simulador.
 */
describe('enlace de receta compartida en el mock', () => {
  const router = new MockRouter();
  registerPrescriptionShares(router);
  const patient = buscarUsuario('paciente@alovida.mock')!;
  const doctor = buscarUsuario('medica@alovida.mock')!;
  const otherDoctor = buscarUsuario('medico.nuevo@alovida.mock')!;
  const otherPatient: MockUser = { ...patient, id: 'u-otro-paciente', patientProfileId: 'pp-otro-paciente' };

  const own = prescriptionList.filtrar((item) => item.patientProfileId === PACIENTE.id);
  const issued = own.filter((item) => item.statusConceptId === PRESCRIPTION_STATUS['MR_ISSUED']);
  const fromEncounter = issued.find((item) => item.encounterId !== undefined)!;
  const standalone = issued.find((item) => item.encounterId === undefined && item.prescriberProfileId !== MEDICAL.id)!;
  const notActive = own.find((item) => item.statusConceptId !== PRESCRIPTION_STATUS['MR_ISSUED'])!;

  function send(method: MockMethod, path: string, body: unknown = null, user: MockUser | null = patient): MockReply {
    const url = new URL(path, 'http://localhost');
    const route = router.match(method, url.pathname);
    if (!route) throw new Error(`Falta ruta ${method} ${path}`);
    const output = route.handler({
      method,
      path: url.pathname,
      params: route.params,
      query: url.searchParams,
      body,
      headers: new HttpHeaders(),
      user,
    });
    return isMockReply(output) ? output : { status: 200, body: output };
  }

  interface Created {
    readonly shareId: string;
    readonly url: string;
    readonly token: string;
    readonly expiresAt: string;
    readonly itemCount: number;
  }

  function create(body: object, user: MockUser = patient): Created {
    const { status, body: created } = send('POST', '/clinical/prescription-shares', body, user);
    expect(status).toBe(201);
    return created as Created;
  }

  it('las recetas sembradas tienen los tres casos que hacen falta', () => {
    expect(fromEncounter).toBeDefined();
    expect(standalone).toBeDefined();
    expect(notActive).toBeDefined();
  });

  it('crea el enlace de una consulta: token base64url de 43, url /rx/<token>, vence en 30 días o antes', () => {
    const created = create({ encounterId: fromEncounter.encounterId });

    expect(created.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(created.url.endsWith(`/rx/${created.token}`)).toBe(true);
    expect(created.itemCount).toBe(1);
    const days = (Date.parse(created.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000);
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(30);
  });

  it('el token en claro no queda guardado: solo su hash', () => {
    const created = create({ medicationRequestId: standalone.id });

    expect(JSON.stringify(shareList.todos())).not.toContain(created.token);
  });

  it('pide exactamente uno de los dos ids', () => {
    expect(send('POST', '/clinical/prescription-shares', {}).status).toBe(400);
    expect(
      send('POST', '/clinical/prescription-shares', {
        encounterId: fromEncounter.encounterId,
        medicationRequestId: standalone.id,
      }).status,
    ).toBe(400);
  });

  it('receta de otro paciente o inexistente: el mismo 404; otra médica: 403', () => {
    const foreign = send('POST', '/clinical/prescription-shares', { encounterId: fromEncounter.encounterId }, otherPatient);
    const unknown = send('POST', '/clinical/prescription-shares', { encounterId: 'enc-que-no-existe' });
    expect(foreign.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(foreign.body).toEqual(unknown.body);

    expect(send('POST', '/clinical/prescription-shares', { medicationRequestId: standalone.id }, otherDoctor).status).toBe(403);
  });

  it('la médica que la emitió también puede compartirla', () => {
    expect(create({ encounterId: fromEncounter.encounterId }, doctor).itemCount).toBe(1);
  });

  it('sin ítems emitidos y vigentes: 422 con el motivo', () => {
    const { status, body } = send('POST', '/clinical/prescription-shares', { medicationRequestId: notActive.id });
    expect(status).toBe(422);
    expect(body).toMatchObject({
      code: 'PRECONDITION_FAILED',
      reason: 'PRESCRIPTION_SHARE_NO_ACTIVE_ITEMS',
      details: { reason: 'PRESCRIPTION_SHARE_NO_ACTIVE_ITEMS' },
    });
  });

  it('la lista del paciente trae sus enlaces sin token, con estado y usos; otro paciente: 404', () => {
    const created = create({ encounterId: fromEncounter.encounterId });

    const { status, body } = send('GET', `/clinical/prescription-shares?patientProfileId=${PACIENTE.id}`);
    expect(status).toBe(200);
    const rows = body as Record<string, unknown>[];
    const row = rows.find((item) => item['shareId'] === created.shareId);
    expect(row).toEqual({
      shareId: created.shareId,
      resourceType: 'PRESCRIPTION_ENCOUNTER',
      resourceId: fromEncounter.encounterId,
      createdAt: expect.any(String),
      expiresAt: created.expiresAt,
      status: 'VALID',
      uses: 0,
    });
    expect(JSON.stringify(rows)).not.toContain('token');

    expect(send('GET', `/clinical/prescription-shares?patientProfileId=${PACIENTE.id}`, null, otherPatient).status).toBe(404);
  });

  it('by-token responde 200 solo al dueño o a quien lo creó', () => {
    const created = create({ medicationRequestId: standalone.id });
    const path = `/clinical/prescription-shares/by-token/${created.token}`;

    expect(send('GET', path)).toEqual({
      status: 200,
      body: { shareId: created.shareId, resourceType: 'MEDICATION_REQUEST', resourceId: standalone.id },
    });
    expect(send('GET', path, null, otherPatient).status).toBe(404);
  });

  it('revocar: ajeno 404; el dueño 204 y la vista pública dice REVOKED sin nada más; dos veces, 204', () => {
    const created = create({ encounterId: fromEncounter.encounterId });
    const revoke = `/clinical/prescription-shares/${created.shareId}/revoke`;

    expect(send('POST', revoke, {}, otherPatient).status).toBe(404);
    expect(send('POST', revoke, {}).status).toBe(204);
    expect(send('POST', revoke, {}).status).toBe(204);

    expect(send('GET', `/public/prescription-shares/${created.token}`, null, null).body).toEqual({
      status: 'REVOKED',
      issuedAt: null,
      prescriberName: null,
      prescriberLicense: null,
      itemCount: 0,
    });
  });

  it('la vista pública, sin sesión: solo las cinco claves del DTO, nada del paciente ni de los fármacos', () => {
    const created = create({ encounterId: fromEncounter.encounterId });

    const reply = send('GET', `/public/prescription-shares/${created.token}`, null, null);
    expect(reply.status).toBe(200);
    expect(reply.headers?.['Cache-Control']).toBe('no-store');
    const view = reply.body as Record<string, unknown>;
    expect(Object.keys(view).sort()).toEqual(['issuedAt', 'itemCount', 'prescriberLicense', 'prescriberName', 'status']);
    expect(view['status']).toBe('VALID');
    expect(view['itemCount']).toBe(1);
    expect(view['prescriberName']).toBe(MEDICAL.displayName);
    const text = JSON.stringify(view);
    expect(text).not.toContain(PACIENTE.displayName);
    expect(text).not.toContain(fromEncounter.medicationConceptId);
  });

  it('una receta continua (sin validTo) compartida sigue vigente y el enlace vence a los 30 días', () => {
    const continuous = prescriptionList.agregar({ ...standalone, id: 'rx-continua-far01', validTo: null });
    try {
      const created = create({ medicationRequestId: continuous.id });

      expect(created.itemCount).toBe(1);
      const days = (Date.parse(created.expiresAt) - Date.now()) / (24 * 60 * 60 * 1000);
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThanOrEqual(30);
      const view = send('GET', `/public/prescription-shares/${created.token}`, null, null).body as {
        status: string;
        itemCount: number;
      };
      expect(view).toMatchObject({ status: 'VALID', itemCount: 1 });
    } finally {
      prescriptionList.borrar(continuous.id);
    }
  });

  it('un token desconocido: 404', () => {
    expect(send('GET', '/public/prescription-shares/token-inventado', null, null).status).toBe(404);
  });

  it('un enlace cuya fecha pasó se lee EXPIRED, en la lista y en la vista pública', () => {
    const created = create({ medicationRequestId: standalone.id });
    shareList.actualizar(created.shareId, { expiresAt: new Date(Date.now() - 1000).toISOString() });

    expect((send('GET', `/public/prescription-shares/${created.token}`, null, null).body as { status: string }).status).toBe(
      'EXPIRED',
    );
    const rows = send('GET', `/clinical/prescription-shares?patientProfileId=${PACIENTE.id}`).body as {
      shareId: string;
      status: string;
    }[];
    expect(rows.find((row) => row.shareId === created.shareId)?.status).toBe('EXPIRED');
  });

  it('las cinco rutas están en el router del simulador y ninguna otra las tapa', () => {
    const simulated = crearRouterSimulado();
    for (const [method, path] of [
      ['POST', '/clinical/prescription-shares'],
      ['GET', '/clinical/prescription-shares'],
      ['GET', '/clinical/prescription-shares/by-token/tk'],
      ['POST', '/clinical/prescription-shares/sh-1/revoke'],
      ['GET', '/public/prescription-shares/tk'],
    ] as const) {
      // El mismo manejador que registra este archivo: ninguna ruta anterior lo tapa.
      expect(simulated.match(method, path)?.handler, `${method} ${path}`).toBe(router.match(method, path)?.handler);
    }
  });
});
