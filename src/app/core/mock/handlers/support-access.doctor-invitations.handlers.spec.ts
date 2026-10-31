import { HttpHeaders } from '@angular/common/http';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { DoctorTeam } from '../../data-access/support-access/support-access.types';
import type { SupportInvitationCreated } from '../../data-access/support-access/support-invite.types';
import { permisos, PEREZ, ROJAS } from '../fixtures/support-hospital';
import { isMockReply, type MockMethod, type MockRouter } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { crearRouterSimulado } from './index';
import { invitacionesDelDoctor } from './support-access.doctor-invitations.handlers';

/**
 * «Invitar a una secretaria» contra el simulador: lo que la API hace en
 * `SupportStaffService.inviteForPractitioner`, con el estado que sobrevive a F5.
 */
let router: MockRouter;

const perez = buscarUsuario('perez')!;
const suarez = buscarUsuario('suarez')!;
const ana = buscarUsuario('ana')!;

interface Respuesta<T = unknown> {
  readonly status: number;
  readonly body: T;
}

function llamar<T = unknown>(user: MockUser | null, method: MockMethod, path: string, body?: unknown): Respuesta<T> {
  const match = router.match(method, path);
  if (match === null) throw new Error(`Sin manejador: ${method} ${path}`);
  const resultado = match.handler({
    method,
    path,
    params: match.params,
    query: new URLSearchParams(),
    body: body ?? null,
    headers: new HttpHeaders(),
    user,
  });
  return (isMockReply(resultado) ? resultado : { status: 200, body: resultado }) as Respuesta<T>;
}

const invitar = (user: MockUser | null, cuerpo: unknown) => llamar<SupportInvitationCreated>(user, 'POST', '/me/practitioner/support-invitations', cuerpo);
const equipoDe = (user: MockUser) => llamar<DoctorTeam>(user, 'GET', '/me/practitioner/support-team').body.items;

/** Lucía Paz (7005002) y Marcos Ribera (7005003): secretarias del hospital sin vínculo con el Dr. Pérez. */
const LUCIA = '7005002';
const MARCOS = '7005003';

describe('invitar a una secretaria (simulador)', () => {
  beforeAll(() => {
    router = crearRouterSimulado();
  });
  beforeEach(() => {
    invitacionesDelDoctor.reiniciar();
  });

  it('crea un vínculo PENDIENTE que espera a la secretaria y no concede nada', () => {
    const permisosAntes = permisos.todos().length;
    const r = invitar(perez, { nationalId: LUCIA, practitionerRoleAssignmentId: PEREZ.id });

    expect(r.status).toBe(201);
    expect(r.body.items).toHaveLength(1);
    expect(r.body.id).toBe(r.body.items[0]!.id);
    expect(r.body.items[0]).toMatchObject({
      kind: 'PRACTITIONER',
      status: 'PENDING',
      initiatedBy: 'PRACTITIONER',
      awaiting: 'SUPPORT_STAFF',
      personName: 'Lucía Paz',
      practitionerRoleAssignmentId: PEREZ.id,
    });
    // Ningún permiso nuevo: lo decide ella después.
    expect(permisos.todos()).toHaveLength(permisosAntes);
  });

  it('aparece en «Mi equipo» del doctor como pendiente de la secretaria, junto a quienes ya estaban', () => {
    const antes = equipoDe(perez);
    invitar(perez, { nationalId: LUCIA, practitionerRoleAssignmentId: PEREZ.id });
    const despues = equipoDe(perez);

    expect(despues).toHaveLength(antes.length + 1);
    // Lucía ya cubre parte de su agenda por ubicación (fila ACTIVE): la invitación es la fila que espera a la secretaria.
    const lucia = despues.find((m) => m.personName === 'Lucía Paz' && (m as { awaiting?: string }).awaiting === 'SUPPORT_STAFF')!;
    expect(lucia).toMatchObject({ status: 'PENDING_ACCEPTANCE', initiatedBy: 'PRACTITIONER', awaiting: 'SUPPORT_STAFF', actions: [] });
    // Lo que ya estaba sigue igual.
    expect(despues.some((m) => m.personName === 'Ana Gutiérrez')).toBe(true);
  });

  it('queda escrita en el almacenamiento de la pestaña, que es lo que la hace sobrevivir a F5', () => {
    invitar(perez, { nationalId: MARCOS, practitionerRoleAssignmentId: PEREZ.id });
    const guardado = JSON.parse(sessionStorage.getItem('mock.apoyo.invitaciones-del-doctor')!) as { filas: { personName: string; doctorId: string }[] };
    expect(guardado.filas).toEqual([expect.objectContaining({ personName: 'Marcos Ribera', doctorId: PEREZ.id })]);
  });

  it('otro doctor no ve la invitación de Pérez', () => {
    invitar(perez, { nationalId: LUCIA, practitionerRoleAssignmentId: PEREZ.id });
    expect(equipoDe(suarez).some((m) => m.personName === 'Lucía Paz' && (m as { awaiting?: string }).awaiting === 'SUPPORT_STAFF')).toBe(false);
  });

  it('el documento se busca por el texto exacto, como la API (`external_subject = ?`): puntos, guiones y ceros cambian a la persona', () => {
    for (const documento of ['7.005.002', '0.700-5002', '07005002']) {
      const r = invitar(perez, { nationalId: documento, practitionerRoleAssignmentId: PEREZ.id });
      expect(r.status).toBe(404);
      expect(r.body).toMatchObject({ reason: 'SUPPORT_STAFF_NOT_FOUND' });
    }
    expect(invitacionesDelDoctor.todos()).toHaveLength(0);
    expect(invitar(perez, { nationalId: LUCIA, practitionerRoleAssignmentId: PEREZ.id }).status).toBe(201);
  });

  it('invitar dos veces a la misma secretaria en la misma vinculación es 409 SUPPORT_LINK_DUPLICATE', () => {
    expect(invitar(perez, { nationalId: LUCIA, practitionerRoleAssignmentId: PEREZ.id }).status).toBe(201);
    const r = invitar(perez, { nationalId: LUCIA, practitionerRoleAssignmentId: PEREZ.id });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ code: 'CONFLICT', reason: 'SUPPORT_LINK_DUPLICATE' });
  });

  it('una secretaria que ya lo asiste (Ana) tampoco se invita otra vez', () => {
    const r = invitar(perez, { nationalId: '7005001', practitionerRoleAssignmentId: PEREZ.id });
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ reason: 'SUPPORT_LINK_DUPLICATE' });
  });

  it('un documento sin secretaria registrada es 404 SUPPORT_STAFF_NOT_FOUND', () => {
    const r = invitar(perez, { nationalId: '9999999', practitionerRoleAssignmentId: PEREZ.id });
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ code: 'NOT_FOUND', reason: 'SUPPORT_STAFF_NOT_FOUND' });
  });

  it('el documento de alguien que no es secretaria (el propio doctor) tampoco sirve', () => {
    expect(invitar(perez, { nationalId: perez.nationalId, practitionerRoleAssignmentId: PEREZ.id }).status).toBe(404);
  });

  it('una vinculación ajena responde igual que una inexistente: 404 SUPPORT_TARGET_NOT_FOUND', () => {
    const ajena = invitar(perez, { nationalId: LUCIA, practitionerRoleAssignmentId: ROJAS.id });
    const inexistente = invitar(perez, { nationalId: LUCIA, practitionerRoleAssignmentId: '11111111-1111-4111-a111-111111111111' });
    for (const r of [ajena, inexistente]) {
      expect(r.status).toBe(404);
      expect(r.body).toMatchObject({ reason: 'SUPPORT_TARGET_NOT_FOUND' });
    }
    expect(invitacionesDelDoctor.todos()).toHaveLength(0);
  });

  it('rechaza lo que el DTO rechaza: largo, caracteres, uuid y claves de más (400)', () => {
    const malos: unknown[] = [
      { nationalId: '123', practitionerRoleAssignmentId: PEREZ.id },
      { nationalId: 'x'.repeat(41), practitionerRoleAssignmentId: PEREZ.id },
      { nationalId: '12 345', practitionerRoleAssignmentId: PEREZ.id },
      { nationalId: LUCIA, practitionerRoleAssignmentId: 'no-es-uuid' },
      { nationalId: LUCIA },
      { practitionerRoleAssignmentId: PEREZ.id },
      { nationalId: LUCIA, practitionerRoleAssignmentId: PEREZ.id, nombre: 'Lucía' },
    ];
    for (const cuerpo of malos) {
      const r = invitar(perez, cuerpo);
      expect(r.status).toBe(400);
      expect(r.body).toMatchObject({ code: 'VALIDATION_FAILED' });
    }
    expect(invitacionesDelDoctor.todos()).toHaveLength(0);
  });

  it('la autoridad es la API: una secretaria no puede invitar a nadie (403) y sin sesión es 401', () => {
    expect(invitar(ana, { nationalId: LUCIA, practitionerRoleAssignmentId: PEREZ.id }).status).toBe(403);
    expect(invitar(null, { nationalId: LUCIA, practitionerRoleAssignmentId: PEREZ.id }).status).toBe(401);
  });
});
