import { HttpHeaders } from '@angular/common/http';

import { CATALOGOS_DE_APOYO } from '../fixtures/support-staff';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, emitirAccessToken, TENANT_CLINICA, TENANT_HOSPITAL, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { registrarPersonalDeApoyo } from './support-staff.handlers';
import type { Vinculo } from './support-staff.store';

interface Lista {
  items: Vinculo[];
}

/**
 * La secretaria de punta a punta en la maqueta: alta, invitación del hospital,
 * aceptación, lo que ve, su solicitud y la decisión del doctor.
 *
 * Los casos corren en orden y comparten estado: es un recorrido.
 */
describe('personal de apoyo (simulador)', () => {
  const router = new MockRouter();
  registrarPersonalDeApoyo(router);

  const admin = buscarUsuario('admin')!;
  const medica = buscarUsuario('medica')!;
  const paciente = buscarUsuario('paciente')!;
  const clinica = CATALOGOS_DE_APOYO[TENANT_CLINICA]!;
  const drCespedes = clinica.practitioners[1]!;
  const pisoGinecologia = clinica.floors[1]!;

  function call<T>(method: MockMethod, path: string, body: unknown, user: MockUser | null, opciones: { tenant?: string; query?: string } = {}): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(opciones.query ?? ''),
      body,
      headers: opciones.tenant === undefined ? new HttpHeaders() : new HttpHeaders({ 'X-Tenant-Id': opciones.tenant }),
      user,
    }) as T;
  }

  function estado(valor: unknown): number {
    return typeof valor === 'object' && valor !== null && 'body' in valor && typeof (valor as MockReply).status === 'number'
      ? (valor as MockReply).status
      : 200;
  }

  function cuerpoDe<T>(valor: unknown): T {
    return (estado(valor) === 200 ? valor : (valor as MockReply).body) as T;
  }

  function token(user: MockUser): { roles: string[]; tenants: string[] } {
    const payload = emitirAccessToken(user).split('.')[1]!;
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { roles: string[]; tenants: string[] };
  }

  let marta: MockUser;

  it('el alta crea una cuenta con el rol SUPPORT_STAFF que entra con su documento', () => {
    const alta = call('POST', '/iam/auth/register-support-staff', { email: 'marta.vaca@ejemplo.com', nationalId: '7770001', name: 'Marta', lastName: 'Vaca', password: 'secreta123' }, null);
    expect(estado(alta)).toBe(201);
    expect(cuerpoDe<{ role: string }>(alta).role).toBe('SUPPORT_STAFF');
    marta = buscarUsuario('7770001')!;
    expect(marta.displayName).toBe('Marta Vaca');
    expect(token(marta).roles).toContain('SUPPORT_STAFF');
    expect(token(marta).tenants).toEqual([]);
  });

  it('un documento repetido es un 409 con su motivo', () => {
    const alta = call('POST', '/iam/auth/register-support-staff', { email: 'otra@ejemplo.com', nationalId: '7770001', name: 'A', lastName: 'B', password: 'x' }, null);
    expect(estado(alta)).toBe(409);
    expect(cuerpoDe<{ reason: string }>(alta).reason).toBe('NATIONAL_ID_ALREADY_REGISTERED');
  });

  it('el hospital invita por documento con un doctor y un piso; un documento desconocido es SUPPORT_STAFF_NOT_FOUND', () => {
    const items = [
      { targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: drCespedes.id },
      { targetKind: 'SPACE', careSpaceId: pisoGinecologia.id },
    ];
    const nadie = call('POST', '/org/team/invitations', { nationalId: '0000000', items }, admin, { tenant: TENANT_CLINICA });
    expect(cuerpoDe<{ reason: string }>(nadie).reason).toBe('SUPPORT_STAFF_NOT_FOUND');
    const invitacion = call('POST', '/org/team/invitations', { nationalId: '7770001', items }, admin, { tenant: TENANT_CLINICA });
    expect(estado(invitacion)).toBe(201);
    const creados = cuerpoDe<{ items: Vinculo[] }>(invitacion).items;
    expect(creados.map((v) => [v.targetName, v.awaiting])).toEqual([
      [drCespedes.name, 'SUPPORT_STAFF'],
      [pisoGinecologia.name, 'SUPPORT_STAFF'],
    ]);
    // Repetir la invitación es un duplicado.
    expect(estado(call('POST', '/org/team/invitations', { nationalId: '7770001', items }, admin, { tenant: TENANT_CLINICA }))).toBe(409);
  });

  it('quien no administra el hospital no lo opera', () => {
    expect(estado(call('GET', '/org/support-engagements', null, paciente, { tenant: TENANT_CLINICA }))).toBe(403);
  });

  it('la secretaria acepta: el hospital entra a su token y ve sólo ese doctor y ese piso', () => {
    const mios = call<{ items: Vinculo[]; requests: Vinculo[] }>('GET', '/me/support-engagements', null, marta);
    expect(mios.requests).toHaveLength(2);
    for (const vinculo of mios.requests) {
      expect(call<Vinculo>('POST', `/me/support-engagements/${vinculo.id}/confirm`, {}, marta).status).toBe('ACTIVE');
    }
    // Aceptar dos veces ya no corresponde.
    expect(estado(call('POST', `/me/support-engagements/${mios.requests[0]!.id}/confirm`, {}, marta))).toBe(422);
    expect(token(marta).tenants).toEqual([TENANT_CLINICA]);
    const acceso = call<{ tenants: { tenantId: string; careSpaceIds: string[]; practitioners: { name: string }[] }[] }>('GET', '/me/support-access', null, marta);
    expect(acceso.tenants).toEqual([
      expect.objectContaining({ tenantId: TENANT_CLINICA, careSpaceIds: [pisoGinecologia.id], practitioners: [expect.objectContaining({ name: drCespedes.name })] }),
    ]);
  });

  it('lo que pide a un doctor lo decide el doctor', () => {
    const rojas = clinica.practitioners[0]!;
    const pedido = call('POST', '/support-engagement-requests', { tenantId: TENANT_CLINICA, items: [{ targetKind: 'PRACTITIONER', practitionerRoleAssignmentId: rojas.id }] }, marta);
    expect(estado(pedido)).toBe(201);
    const [vinculo] = cuerpoDe<{ items: Vinculo[] }>(pedido).items;
    expect(vinculo!.awaiting).toBe('PRACTITIONER');
    const equipo = call<Lista>('GET', '/me/practitioner/support-team', null, medica);
    expect(equipo.items.map((v) => v.id)).toContain(vinculo!.id);
    expect(call<Vinculo>('POST', `/practitioner-delegates/${vinculo!.id}/accept`, {}, medica).status).toBe('ACTIVE');
  });

  it('el hospital acepta lo que le pidieron a él', () => {
    const pendientes = call<Lista>('GET', '/org/support-engagement-requests', null, admin, { tenant: TENANT_CLINICA, query: 'status=PENDING' });
    const deLucia = pendientes.items.find((v) => v.awaiting === 'ORGANIZATION')!;
    expect(call<Vinculo>('POST', `/org/support-engagement-requests/${deLucia.id}/decision`, { decision: 'APPROVED' }, admin, { tenant: TENANT_CLINICA }).status).toBe('ACTIVE');
  });

  it('el doctor invita a su secretaria en un hospital donde está vinculado', () => {
    const invitacion = call('POST', '/me/practitioner/support-invitations', { nationalId: '6001001', practitionerRoleAssignmentId: uuid('ra-olivos') }, medica);
    expect(estado(invitacion)).toBe(201);
    expect(cuerpoDe<{ items: Vinculo[] }>(invitacion).items[0]).toEqual(expect.objectContaining({ initiatedBy: 'PRACTITIONER', awaiting: 'SUPPORT_STAFF', tenantId: TENANT_CLINICA }));
    // Una vinculación que no es suya no le sirve.
    expect(estado(call('POST', '/me/practitioner/support-invitations', { nationalId: '6001001', practitionerRoleAssignmentId: clinica.practitioners[2]!.id }, medica))).toBe(404);
  });

  it('si la acepta sólo el doctor, ve al doctor y su agenda, pero no el hospital', () => {
    const rosa = buscarUsuario('secretaria@alovida.mock')!;
    const pendientes = call<{ requests: Vinculo[] }>('GET', '/me/support-engagements', null, rosa).requests;
    const delDoctor = pendientes.find((v) => v.initiatedBy === 'PRACTITIONER')!;
    expect(call<Vinculo>('POST', `/me/support-engagements/${delDoctor.id}/confirm`, {}, rosa).status).toBe('ACTIVE');
    expect(token(rosa).tenants).not.toContain(TENANT_CLINICA);
    const acceso = call<{ tenants: { tenantId: string; organizationAccess: boolean; careSpaceIds: string[] }[] }>('GET', '/me/support-access', null, rosa);
    expect(acceso.tenants.find((t) => t.tenantId === TENANT_CLINICA)).toEqual(
      expect.objectContaining({ organizationAccess: false, careSpaceIds: [] }),
    );
    const agenda = call<{ count: number }>('GET', '/me/support-agenda', null, rosa, {
      query: `tenantId=${TENANT_CLINICA}&practitionerRoleAssignmentId=${uuid('ra-olivos')}&from=2026-11-02T00:00:00Z&to=2026-11-03T00:00:00Z`,
    });
    expect(agenda.count).toBe(2);
    const ajena = call('GET', '/me/support-agenda', null, rosa, {
      query: `tenantId=${TENANT_CLINICA}&practitionerRoleAssignmentId=${drCespedes.id}&from=2026-11-02T00:00:00Z&to=2026-11-03T00:00:00Z`,
    });
    expect(cuerpoDe<{ reason: string }>(ajena).reason).toBe('SUPPORT_SCOPE_DENIED');
  });

  it('la secretaria sembrada trabaja en el hospital y entra con su correo', () => {
    const rosa = buscarUsuario('secretaria@alovida.mock')!;
    expect(token(rosa).roles).toContain('SUPPORT_STAFF');
    expect(token(rosa).tenants).toContain(TENANT_HOSPITAL);
  });
});
