import { HttpHeaders } from '@angular/common/http';

import { PROCEDURE_COLONOSCOPY, PROCEDURE_UPPER_ENDOSCOPY } from '../fixtures/healthcare-services';
import { affiliations, PRACTICE_CM_NORTE, PRACTICE_CM_SUR, SITE_CM_NORTE_1, SITE_CM_SUR_1 } from '../fixtures/role-assignments';
import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { offers, registerHealthcareServices } from './healthcare-services.handlers';
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
  registerHealthcareServices(router);
  registerRoleAssignments(router);
  const doctor = buscarUsuario('medica@alovida.mock')!;
  const admin = buscarUsuario('admin@alovida.mock')!;

  function call<T = Row>(method: MockMethod, path: string, body: unknown = null, user = doctor): { status: number; body: T } {
    const [route, query = ''] = path.split('?');
    const match = router.match(method, route!);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const output = match.handler({ method, path: route!, params: match.params, query: new URLSearchParams(query), body, headers: new HttpHeaders(), user });
    return isMockReply(output) ? { status: output.status, body: output.body as T } : { status: 200, body: output as T };
  }

  /** Un procedimiento de ejemplo que publica una sede, tal como lo sirve el doble del catálogo (CM-06). */
  const offerOf = (site: string, concept: string) => offers.todos().find((o) => o.practiceSiteId === site && o.serviceConceptId === concept)!;
  const endoscopy = () => offerOf(SITE_CM_NORTE_1, PROCEDURE_UPPER_ENDOSCOPY);
  const colonoscopy = () => offerOf(SITE_CM_NORTE_1, PROCEDURE_COLONOSCOPY);
  const invitations = `/practices/${PRACTICE_CM_NORTE}/role-assignments/invitations`;
  const selfRequest = `/practices/${PRACTICE_CM_NORTE}/role-assignments/self-request`;

  it('la invitación crea una fila INVITED por procedimiento, iniciada por el centro', () => {
    const published = offers.todos().filter((o) => o.practiceSiteId === SITE_CM_NORTE_1 && o.active);
    const reply = call<{ items: Row[] }>('POST', invitations, {
      practitionerProfileId: 'otro-medico-1',
      practiceSiteId: SITE_CM_NORTE_1,
      healthcareServiceIds: published.map((o) => o.id),
    }, admin);

    expect(reply.status).toBe(201);
    expect(reply.body.items).toHaveLength(published.length);
    for (const row of reply.body.items) {
      expect(row.statusCode).toBe('ROLE_ASG_INVITED');
      expect(row.initiatedBy).toBe('PRACTICE');
    }
  });

  it('no deja invitar a un procedimiento que la sede no publica, que retiró o de otra sede', () => {
    const withdrawn = offers.agregar({ ...colonoscopy(), id: 'offer-withdrawn', serviceConceptId: 'concept-withdrawn', active: false });
    const base = { practitionerProfileId: 'otro-medico-2', practiceSiteId: SITE_CM_NORTE_1 };

    for (const healthcareServiceIds of [[withdrawn.id], ['no-existe'], [endoscopy().id, 'no-existe']]) {
      const reply = call('POST', invitations, { ...base, healthcareServiceIds }, admin);
      expect([400, 422]).toContain(reply.status);
    }
    // Una sede ajena a la práctica tampoco sirve, aunque el procedimiento exista.
    const foreignSite = call('POST', `/practices/${PRACTICE_CM_SUR}/role-assignments/invitations`, {
      ...base,
      practiceSiteId: SITE_CM_NORTE_1,
      healthcareServiceIds: [endoscopy().id],
    }, admin);
    expect([400, 422]).toContain(foreignSite.status);
  });

  it('accept sobre INVITED → ACTIVE; sobre una ya activa → 409', () => {
    const invited = affiliations.filtrar((f) => f.statusCode === 'ROLE_ASG_INVITED' && f.practitionerProfileId === doctor.practitionerProfileId)[0]!;
    const accepted = call('POST', `/practitioners/me/role-assignments/${invited.id}/accept`);
    expect(accepted.status).toBe(200);
    expect(accepted.body.statusCode).toBe('ROLE_ASG_ACTIVE');
    expect(call('POST', `/practitioners/me/role-assignments/${invited.id}/accept`).status).toBe(409);
  });

  it('approve sobre una INVITED → 409: el centro no activa lo que el médico no aceptó', () => {
    const invited = call<{ items: Row[] }>('POST', invitations, {
      practitionerProfileId: doctor.practitionerProfileId,
      practiceSiteId: SITE_CM_NORTE_1,
      healthcareServiceIds: [colonoscopy().id],
    }, admin).body.items[0]!;
    expect(call('POST', `/role-assignments/${invited.id}/approve`, null, admin).status).toBe(409);
    expect(affiliations.get(invited.id)!.statusCode).toBe('ROLE_ASG_INVITED');
  });

  it('decline pasa la INVITED a REJECTED', () => {
    const invited = affiliations.filtrar((f) => f.statusCode === 'ROLE_ASG_INVITED' && f.practitionerProfileId === doctor.practitionerProfileId)[0]!;
    const reply = call('POST', `/practitioners/me/role-assignments/${invited.id}/decline`);
    expect(reply.body.statusCode).toBe('ROLE_ASG_REJECTED');
  });

  it('el médico no puede aceptar la afiliación de otro', () => {
    const foreign = call<{ items: Row[] }>('POST', invitations, {
      practitionerProfileId: 'otro-medico-3',
      practiceSiteId: SITE_CM_NORTE_1,
      healthcareServiceIds: [colonoscopy().id],
    }, admin).body.items[0]!;
    expect(call('POST', `/practitioners/me/role-assignments/${foreign.id}/accept`).status).toBe(403);
  });

  it('dos self-request, uno por procedimiento → una fila PENDING cada una, iniciada por el médico', () => {
    const requested = [colonoscopy(), endoscopy()].map((o) => call('POST', selfRequest, { practiceSiteId: SITE_CM_NORTE_1, healthcareServiceId: o.id }));
    for (const reply of requested) {
      expect(reply.status).toBe(201);
      expect(reply.body.statusCode).toBe('ROLE_ASG_PENDING');
      expect(reply.body.initiatedBy).toBe('PRACTITIONER');
    }
    expect(new Set(requested.map((r) => r.body.id)).size).toBe(2);
  });

  it('self-request de un procedimiento que la sede no publica → error, sin crear fila', () => {
    const before = affiliations.todos().length;
    const reply = call('POST', selfRequest, { practiceSiteId: SITE_CM_NORTE_1, healthcareServiceId: 'no-existe' });
    expect([400, 422]).toContain(reply.status);
    expect(affiliations.todos()).toHaveLength(before);
  });

  it('approve y reject solo actúan sobre PENDING', () => {
    const requested = [colonoscopy(), endoscopy()].map((o) =>
      call('POST', selfRequest, { practiceSiteId: SITE_CM_NORTE_1, healthcareServiceId: o.id }).body,
    );
    expect(call('POST', `/role-assignments/${requested[0]!.id}/approve`, null, admin).body.statusCode).toBe('ROLE_ASG_ACTIVE');
    expect(call('POST', `/role-assignments/${requested[1]!.id}/reject`, null, admin).body.statusCode).toBe('ROLE_ASG_REJECTED');
    expect(call('POST', `/role-assignments/${requested[0]!.id}/reject`, null, admin).status).toBe(409);
    // accept sobre una PENDING es un error: es del centro, no del médico
    expect(call('POST', `/practitioners/me/role-assignments/${requested[1]!.id}/accept`).status).toBe(409);
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
    const mine = body.find((f) => f.healthcareServiceId !== undefined);
    expect(mine).toEqual(expect.objectContaining({ practiceName: expect.any(String), serviceDisplay: expect.any(String), statusCode: expect.any(String), initiatedBy: expect.any(String) }));
    expect(body.some((f) => f.healthcareServiceId === undefined)).toBe(true);
  });

  it('GET /practices incluye practice-cm-norte y practice-cm-sur', () => {
    const { body } = call<{ id: string }[]>('GET', '/practices');
    expect(body.map((p) => p.id)).toEqual(expect.arrayContaining([PRACTICE_CM_NORTE, PRACTICE_CM_SUR]));
  });

  it('las sedes y los procedimientos los sirve el catálogo (CM-06), no este doble', () => {
    const sites = call<{ id: string }[]>('GET', `/practices/${PRACTICE_CM_SUR}/sites`).body;
    expect(sites.map((s) => s.id)).toEqual([SITE_CM_SUR_1]);
    const items = call<{ items: { practiceSiteId: string }[] }>('GET', `/practices/${PRACTICE_CM_NORTE}/healthcare-services?practiceSiteId=${SITE_CM_NORTE_1}`).body.items;
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items.every((o) => o.practiceSiteId === SITE_CM_NORTE_1)).toBe(true);
  });
});
