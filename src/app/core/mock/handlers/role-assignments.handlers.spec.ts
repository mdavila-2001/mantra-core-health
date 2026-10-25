import { HttpHeaders } from '@angular/common/http';

import {
  affiliations,
  PRACTICE_CM_NORTE,
  PRACTICE_CM_SUR,
  PUBLISHED_PROCEDURES,
  SITE_CM_NORTE_1,
  SITE_CM_SUR_1,
} from '../fixtures/role-assignments';
import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarPracticas } from './practice.handlers';
import { registerRoleAssignments } from './role-assignments.handlers';

interface Row {
  readonly id: string;
  readonly practiceId: string;
  readonly statusCode: string;
  readonly initiatedBy: string;
  readonly healthcareServiceId?: string;
}

describe('handlers de afiliación médico-centro', () => {
  const router = new MockRouter();
  registrarPracticas(router);
  registerRoleAssignments(router);
  const doctor = buscarUsuario('medica@alovida.mock')!;
  const admin = buscarUsuario('admin@alovida.mock')!;

    function call<T = Row>(method: MockMethod, path: string, body: unknown = null, user = doctor): { status: number; body: T } {
    const [ruta, consulta = ''] = path.split('?');
    const match = router.match(method, ruta!);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const salida = match.handler({ method, path: ruta!, params: match.params, query: new URLSearchParams(consulta), body, headers: new HttpHeaders(), user });
    return isMockReply(salida) ? { status: salida.status, body: salida.body as T } : { status: 200, body: salida as T };
  }

  const offer = (site: string, proc: string) => PUBLISHED_PROCEDURES.find((p) => p.practiceSiteId === site && p.serviceDisplay === proc && p.active)!;

  it('la invitación crea una fila INVITED por procedimiento, iniciada por el centro', () => {
    const north = PUBLISHED_PROCEDURES.filter((p) => p.practiceSiteId === SITE_CM_NORTE_1 && p.active);
    const other = buscarUsuario('medica@alovida.mock')!.practitionerProfileId!;
    // otro médico, para no chocar con las filas de ejemplo de la médica
    const reply = call<{ items: Row[] }>('POST', `/practices/${PRACTICE_CM_NORTE}/role-assignments/invitations`, {
      practitionerProfileId: `${other}-otro`,
      practiceSiteId: SITE_CM_NORTE_1,
      healthcareServiceIds: north.map((p) => p.id),
    }, admin);

    expect(reply.status).toBe(201);
    expect(reply.body.items).toHaveLength(north.length);
    for (const row of reply.body.items) {
      expect(row.statusCode).toBe('ROLE_ASG_INVITED');
      expect(row.initiatedBy).toBe('PRACTICE');
    }
  });

  it('no deja invitar a un procedimiento que la sede no publica o retiró', () => {
    const withdrawn = PUBLISHED_PROCEDURES.find((p) => !p.active)!;
    const reply = call('POST', `/practices/${PRACTICE_CM_NORTE}/role-assignments/invitations`, {
      practitionerProfileId: 'pp-x',
      practiceSiteId: SITE_CM_NORTE_1,
      healthcareServiceIds: [withdrawn.id],
    }, admin);
    expect(reply.status).toBe(422);
  });

  it('accept sobre INVITED → ACTIVE; sobre una ya activa → 409', () => {
    const invited = affiliations.filtrar((f) => f.statusCode === 'ROLE_ASG_INVITED' && f.practitionerProfileId === doctor.practitionerProfileId)[0]!;
    const accepted = call('POST', `/practitioners/me/role-assignments/${invited.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.statusCode).toBe('ROLE_ASG_ACTIVE');
    expect(call('POST', `/practitioners/me/role-assignments/${invited.id}/accept`).status).toBe(409);
  });

  it('approve sobre una INVITED → 409: el centro no activa lo que el médico no aceptó', () => {
    const invited = call<{ items: Row[] }>('POST', `/practices/${PRACTICE_CM_SUR}/role-assignments/invitations`, {
      practitionerProfileId: doctor.practitionerProfileId,
      practiceSiteId: SITE_CM_SUR_1,
      healthcareServiceIds: [offer(SITE_CM_SUR_1, 'Endoscopia digestiva alta').id],
    }, admin).body.items[0];
    expect(call('POST', `/role-assignments/${invited.id}/approve`, null, admin).status).toBe(409);
    expect(affiliations.get(invited.id)!.statusCode).toBe('ROLE_ASG_INVITED');
  });

  it('decline pasa la INVITED a REJECTED', () => {
    const invited = affiliations.filtrar((f) => f.statusCode === 'ROLE_ASG_INVITED' && f.practitionerProfileId === doctor.practitionerProfileId)[0]!;
    const reply = call('POST', `/practitioners/me/role-assignments/${invited.id}/decline`);
    expect(reply.body.statusCode).toBe('ROLE_ASG_REJECTED');
  });

  it('el médico no puede aceptar la afiliación de otro', () => {
    const foreign = call<{ items: Row[] }>('POST', `/practices/${PRACTICE_CM_NORTE}/role-assignments/invitations`, {
      practitionerProfileId: 'otro-medico',
      practiceSiteId: SITE_CM_NORTE_1,
      healthcareServiceIds: [offer(SITE_CM_NORTE_1, 'Colonoscopia').id],
    }, admin).body.items[0];
    expect(call('POST', `/practitioners/me/role-assignments/${foreign.id}/accept`).status).toBe(403);
  });

  it('dos self-request, uno por procedimiento → una fila PENDING cada una, iniciada por el médico', () => {
    const south = [offer(SITE_CM_SUR_1, 'Colonoscopia'), offer(SITE_CM_SUR_1, 'Endoscopia digestiva alta')];
    const rows = south.map((p) => call('POST', `/practices/${PRACTICE_CM_SUR}/role-assignments/self-request`, { practiceSiteId: SITE_CM_SUR_1, healthcareServiceId: p.id }));
    for (const f of rows) {
      expect(f.status).toBe(201);
      expect(f.body.statusCode).toBe('ROLE_ASG_PENDING');
      expect(f.body.initiatedBy).toBe('PRACTITIONER');
    }
    expect(new Set(rows.map((f) => f.body.id)).size).toBe(2);
  });

  it('approve y reject solo actúan sobre PENDING', () => {
    const requested = [offer(SITE_CM_NORTE_1, 'Colonoscopia'), offer(SITE_CM_NORTE_1, 'Endoscopia digestiva alta')].map((p) =>
      call('POST', `/practices/${PRACTICE_CM_NORTE}/role-assignments/self-request`, { practiceSiteId: SITE_CM_NORTE_1, healthcareServiceId: p.id }).body,
    );
    expect(call('POST', `/role-assignments/${requested[0].id}/approve`, null, admin).body.statusCode).toBe('ROLE_ASG_ACTIVE');
    expect(call('POST', `/role-assignments/${requested[1].id}/reject`, null, admin).body.statusCode).toBe('ROLE_ASG_REJECTED');
    expect(call('POST', `/role-assignments/${requested[0].id}/reject`, null, admin).status).toBe(409);
    // accept sobre una PENDING es un error: es del centro, no del médico
    expect(call('POST', `/practitioners/me/role-assignments/${requested[1].id}/accept`).status).toBe(409);
  });

  it('GET por práctica devuelve solo las filas de esa práctica, con los campos del contrato', () => {
    const { body } = call<Record<string, unknown>[]>('GET', `/practices/${PRACTICE_CM_SUR}/role-assignments`, null, admin);
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((f) => f['practiceId'] === PRACTICE_CM_SUR)).toBe(true);
    expect(body[0]).toEqual(expect.objectContaining({ practitionerName: expect.any(String), serviceDisplay: expect.any(String), statusCode: expect.any(String), statusConceptId: expect.any(String), initiatedBy: expect.any(String) }));
    expect('createdAt' in body[0]!).toBe(false);
  });

  it('GET me suma los campos nuevos a las vinculaciones de siempre', () => {
    const { body } = call<Row[]>('GET', '/practitioners/me/role-assignments');
    const created = body.find((f) => f.healthcareServiceId !== undefined);
    expect(created).toEqual(expect.objectContaining({ practiceName: expect.any(String), serviceDisplay: expect.any(String), statusCode: expect.any(String), initiatedBy: expect.any(String) }));
    expect(body.some((f) => f.healthcareServiceId === undefined)).toBe(true);
  });

  it('las casillas leen los procedimientos de la sede', () => {
    const { body } = call<{ items: { practiceSiteId: string }[] }>('GET', `/practices/${PRACTICE_CM_SUR}/healthcare-services?practiceSiteId=${SITE_CM_SUR_1}`);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((p) => p.practiceSiteId === SITE_CM_SUR_1)).toBe(true);
  });

  it('las sedes de un centro salen de GET /practices/:practiceId/sites', () => {
    const { body } = call<{ items: { id: string }[] }>('GET', `/practices/${PRACTICE_CM_SUR}/sites`);
    expect(body.items.map((s) => s.id)).toEqual([SITE_CM_SUR_1]);
  });

  it('GET /practices incluye practice-cm-norte y practice-cm-sur', () => {
    const { body } = call<{ id: string }[]>('GET', '/practices');
    expect(body.map((p) => p.id)).toEqual(expect.arrayContaining([PRACTICE_CM_NORTE, PRACTICE_CM_SUR]));
  });
});
