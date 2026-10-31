import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from './index';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, TENANT_CESPEDES, TENANT_HOSPITAL_PILOTO, TENANT_LABORATORIO, type MockUser } from '../mock-session';

/**
 * Las invitaciones de organizaciones: `POST /tenants/:id/memberships` deja la membresía pendiente; la persona la ve, la
 * acepta o la rechaza (404 uniforme) y la organización puede retirarla antes. Las pruebas se leen en orden.
 */
let router: MockRouter;
const marcos = buscarUsuario('marcos')!;
const ana = buscarUsuario('ana')!;
const org = buscarUsuario('hospital_piloto')!;

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}

function llamar<T = unknown>(user: MockUser | null, method: MockMethod, path: string, body?: unknown): Respuesta<T> {
  const match = router.match(method, path);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({ method, path, params: match.params, query: new URLSearchParams(), body: body ?? null, headers: new HttpHeaders(), user });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}

interface Invitacion {
  id: string;
  tenantId: string;
  tenantName: string;
  role: string;
  invitedAt: string;
}

const pendientes = (user: MockUser): Invitacion[] => llamar<{ items: Invitacion[] }>(user, 'GET', '/tenants/me/membership-invitations').body.items;

beforeAll(() => {
  router = crearRouterSimulado();
});

describe('invitaciones de organizaciones', () => {
  it('Marcos tiene dos pendientes, con el nombre de la organización, su rol y la fecha; Ana, ninguna', () => {
    const lista = pendientes(marcos);
    expect(lista.map((i) => i.tenantId).sort()).toEqual([TENANT_CESPEDES, TENANT_LABORATORIO].sort());
    expect(lista.find((i) => i.tenantId === TENANT_CESPEDES)).toMatchObject({ tenantName: 'Consultorio Dra. Paola Céspedes', role: 'STAFF' });
    expect(typeof lista[0]!.invitedAt).toBe('string');
    expect(pendientes(ana)).toEqual([]);
    expect(llamar(null, 'GET', '/tenants/me/membership-invitations').status).toBe(401);
  });

  it('aceptar activa la membresía: responde { id, tenantId, status: ACTIVE } y deja de estar pendiente', () => {
    const cespedes = pendientes(marcos).find((i) => i.tenantId === TENANT_CESPEDES)!;
    const r = llamar<{ id: string; tenantId: string; status: string }>(marcos, 'POST', `/tenants/me/membership-invitations/${cespedes.id}/accept`);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ id: cespedes.id, tenantId: TENANT_CESPEDES, status: 'ACTIVE' });
    expect(pendientes(marcos).map((i) => i.tenantId)).toEqual([TENANT_LABORATORIO]);
  });

  it('decidir dos veces, o una ajena, es el mismo 404', () => {
    const laboratorio = pendientes(marcos)[0]!;
    const ajena = llamar(ana, 'POST', `/tenants/me/membership-invitations/${laboratorio.id}/accept`);
    const inexistente = llamar(marcos, 'POST', '/tenants/me/membership-invitations/00000000-0000-4000-8000-000000000000/accept');
    expect(ajena.status).toBe(404);
    expect(inexistente.status).toBe(404);
    expect(ajena.body).toEqual(inexistente.body);
    // La ya aceptada tampoco se vuelve a decidir.
    expect(llamar(marcos, 'POST', `/tenants/me/membership-invitations/${laboratorio.id}/accept`).status).toBe(200);
    expect(llamar(marcos, 'POST', `/tenants/me/membership-invitations/${laboratorio.id}/decline`).status).toBe(404);
  });

  it('crear una membresía desde la organización la deja PENDIENTE y la persona la ve; rechazarla la descarta', () => {
    const creada = llamar<{ id: string; status: string }>(org, 'POST', `/tenants/${TENANT_HOSPITAL_PILOTO}/memberships`, { userId: ana.id, role: 'STAFF' });
    expect(creada.status).toBe(201);
    const vista = pendientes(ana);
    expect(vista).toHaveLength(1);
    expect(vista[0]).toMatchObject({ id: creada.body.id, tenantId: TENANT_HOSPITAL_PILOTO });
    const r = llamar<{ status: string }>(ana, 'POST', `/tenants/me/membership-invitations/${creada.body.id}/decline`);
    expect(r.body.status).toBe('DECLINED');
    expect(pendientes(ana)).toEqual([]);
  });

  it('la organización retira una invitación antes de que la acepten: POST …/offboard → { ok: true } y la persona ya no la ve', () => {
    const creada = llamar<{ id: string }>(org, 'POST', `/tenants/${TENANT_HOSPITAL_PILOTO}/memberships`, { userId: ana.id, role: 'ADMIN' });
    expect(pendientes(ana)).toHaveLength(1);
    const r = llamar(org, 'POST', `/tenants/${TENANT_HOSPITAL_PILOTO}/memberships/${creada.body.id}/offboard`);
    expect(r.body).toEqual({ ok: true });
    expect(pendientes(ana)).toEqual([]);
    // Aceptarla ya no se puede: el mismo 404.
    expect(llamar(ana, 'POST', `/tenants/me/membership-invitations/${creada.body.id}/accept`).status).toBe(404);
  });
});
