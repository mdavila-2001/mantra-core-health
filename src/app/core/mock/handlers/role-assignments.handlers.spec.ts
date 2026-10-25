import { HttpHeaders } from '@angular/common/http';

import {
  afiliaciones,
  PRACTICE_CM_NORTE,
  PRACTICE_CM_SUR,
  PROCEDIMIENTOS_PUBLICADOS,
  SITE_CM_NORTE_1,
  SITE_CM_SUR_1,
} from '../fixtures/role-assignments';
import { MockRouter, isMockReply, type MockMethod } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarPracticas } from './practice.handlers';
import { registerRoleAssignments } from './role-assignments.handlers';

interface Fila {
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
  const medica = buscarUsuario('medica@alovida.mock')!;
  const admin = buscarUsuario('admin@alovida.mock')!;

    function call<T = Fila>(method: MockMethod, path: string, body: unknown = null, user = medica): { status: number; body: T } {
    const [ruta, consulta = ''] = path.split('?');
    const match = router.match(method, ruta!);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const salida = match.handler({ method, path: ruta!, params: match.params, query: new URLSearchParams(consulta), body, headers: new HttpHeaders(), user });
    return isMockReply(salida) ? { status: salida.status, body: salida.body as T } : { status: 200, body: salida as T };
  }

  const oferta = (sede: string, proc: string) => PROCEDIMIENTOS_PUBLICADOS.find((p) => p.practiceSiteId === sede && p.serviceDisplay === proc && p.active)!;

  it('la invitación crea una fila INVITED por procedimiento, iniciada por el centro', () => {
    const norte = PROCEDIMIENTOS_PUBLICADOS.filter((p) => p.practiceSiteId === SITE_CM_NORTE_1 && p.active);
    const otra = buscarUsuario('medica@alovida.mock')!.practitionerProfileId!;
    // otro médico, para no chocar con las filas de ejemplo de la médica
    const respuesta = call<{ items: Fila[] }>('POST', `/practices/${PRACTICE_CM_NORTE}/role-assignments/invitations`, {
      practitionerProfileId: `${otra}-otro`,
      practiceSiteId: SITE_CM_NORTE_1,
      healthcareServiceIds: norte.map((p) => p.id),
    }, admin);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.items).toHaveLength(norte.length);
    for (const fila of respuesta.body.items) {
      expect(fila.statusCode).toBe('ROLE_ASG_INVITED');
      expect(fila.initiatedBy).toBe('PRACTICE');
    }
  });

  it('no deja invitar a un procedimiento que la sede no publica o retiró', () => {
    const retirado = PROCEDIMIENTOS_PUBLICADOS.find((p) => !p.active)!;
    const respuesta = call('POST', `/practices/${PRACTICE_CM_NORTE}/role-assignments/invitations`, {
      practitionerProfileId: 'pp-x',
      practiceSiteId: SITE_CM_NORTE_1,
      healthcareServiceIds: [retirado.id],
    }, admin);
    expect(respuesta.status).toBe(422);
  });

  it('accept sobre INVITED → ACTIVE; sobre una ya activa → 409', () => {
    const invitada = afiliaciones.filtrar((f) => f.statusCode === 'ROLE_ASG_INVITED' && f.practitionerProfileId === medica.practitionerProfileId)[0]!;
    const aceptada = call('POST', `/practitioners/me/role-assignments/${invitada.id}/accept`);
    expect(aceptada.status).toBe(200);
    expect(aceptada.body.statusCode).toBe('ROLE_ASG_ACTIVE');
    expect(call('POST', `/practitioners/me/role-assignments/${invitada.id}/accept`).status).toBe(409);
  });

  it('approve sobre una INVITED → 409: el centro no activa lo que el médico no aceptó', () => {
    const invitada = call<{ items: Fila[] }>('POST', `/practices/${PRACTICE_CM_SUR}/role-assignments/invitations`, {
      practitionerProfileId: medica.practitionerProfileId,
      practiceSiteId: SITE_CM_SUR_1,
      healthcareServiceIds: [oferta(SITE_CM_SUR_1, 'Endoscopia digestiva alta').id],
    }, admin).body.items[0];
    expect(call('POST', `/role-assignments/${invitada.id}/approve`, null, admin).status).toBe(409);
    expect(afiliaciones.get(invitada.id)!.statusCode).toBe('ROLE_ASG_INVITED');
  });

  it('decline pasa la INVITED a REJECTED', () => {
    const invitada = afiliaciones.filtrar((f) => f.statusCode === 'ROLE_ASG_INVITED' && f.practitionerProfileId === medica.practitionerProfileId)[0]!;
    const respuesta = call('POST', `/practitioners/me/role-assignments/${invitada.id}/decline`);
    expect(respuesta.body.statusCode).toBe('ROLE_ASG_REJECTED');
  });

  it('el médico no puede aceptar la afiliación de otro', () => {
    const ajena = call<{ items: Fila[] }>('POST', `/practices/${PRACTICE_CM_NORTE}/role-assignments/invitations`, {
      practitionerProfileId: 'otro-medico',
      practiceSiteId: SITE_CM_NORTE_1,
      healthcareServiceIds: [oferta(SITE_CM_NORTE_1, 'Colonoscopia').id],
    }, admin).body.items[0];
    expect(call('POST', `/practitioners/me/role-assignments/${ajena.id}/accept`).status).toBe(403);
  });

  it('dos self-request, uno por procedimiento → una fila PENDING cada una, iniciada por el médico', () => {
    const sur = [oferta(SITE_CM_SUR_1, 'Colonoscopia'), oferta(SITE_CM_SUR_1, 'Endoscopia digestiva alta')];
    const filas = sur.map((p) => call('POST', `/practices/${PRACTICE_CM_SUR}/role-assignments/self-request`, { practiceSiteId: SITE_CM_SUR_1, healthcareServiceId: p.id }));
    for (const f of filas) {
      expect(f.status).toBe(201);
      expect(f.body.statusCode).toBe('ROLE_ASG_PENDING');
      expect(f.body.initiatedBy).toBe('PRACTITIONER');
    }
    expect(new Set(filas.map((f) => f.body.id)).size).toBe(2);
  });

  it('approve y reject solo actúan sobre PENDING', () => {
    const pedidas = [oferta(SITE_CM_NORTE_1, 'Colonoscopia'), oferta(SITE_CM_NORTE_1, 'Endoscopia digestiva alta')].map((p) =>
      call('POST', `/practices/${PRACTICE_CM_NORTE}/role-assignments/self-request`, { practiceSiteId: SITE_CM_NORTE_1, healthcareServiceId: p.id }).body,
    );
    expect(call('POST', `/role-assignments/${pedidas[0].id}/approve`, null, admin).body.statusCode).toBe('ROLE_ASG_ACTIVE');
    expect(call('POST', `/role-assignments/${pedidas[1].id}/reject`, null, admin).body.statusCode).toBe('ROLE_ASG_REJECTED');
    expect(call('POST', `/role-assignments/${pedidas[0].id}/reject`, null, admin).status).toBe(409);
    // accept sobre una PENDING es un error: es del centro, no del médico
    expect(call('POST', `/practitioners/me/role-assignments/${pedidas[1].id}/accept`).status).toBe(409);
  });

  it('GET por práctica devuelve solo las filas de esa práctica, con los campos del contrato', () => {
    const { body } = call<Record<string, unknown>[]>('GET', `/practices/${PRACTICE_CM_SUR}/role-assignments`, null, admin);
    expect(body.length).toBeGreaterThan(0);
    expect(body.every((f) => f['practiceId'] === PRACTICE_CM_SUR)).toBe(true);
    expect(body[0]).toEqual(expect.objectContaining({ practitionerName: expect.any(String), serviceDisplay: expect.any(String), statusCode: expect.any(String), statusConceptId: expect.any(String), initiatedBy: expect.any(String) }));
    expect('createdAt' in body[0]!).toBe(false);
  });

  it('GET me suma los campos nuevos a las vinculaciones de siempre', () => {
    const { body } = call<Fila[]>('GET', '/practitioners/me/role-assignments');
    const nueva = body.find((f) => f.healthcareServiceId !== undefined);
    expect(nueva).toEqual(expect.objectContaining({ practiceName: expect.any(String), serviceDisplay: expect.any(String), statusCode: expect.any(String), initiatedBy: expect.any(String) }));
    expect(body.some((f) => f.healthcareServiceId === undefined)).toBe(true);
  });

  it('las casillas leen los procedimientos de la sede', () => {
    const { body } = call<{ items: { practiceSiteId: string }[] }>('GET', `/practices/${PRACTICE_CM_SUR}/healthcare-services?practiceSiteId=${SITE_CM_SUR_1}`);
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((p) => p.practiceSiteId === SITE_CM_SUR_1)).toBe(true);
  });

  it('GET /practices incluye practice-cm-norte y practice-cm-sur', () => {
    const { body } = call<{ id: string }[]>('GET', '/practices');
    expect(body.map((p) => p.id)).toEqual(expect.arrayContaining([PRACTICE_CM_NORTE, PRACTICE_CM_SUR]));
  });
});
