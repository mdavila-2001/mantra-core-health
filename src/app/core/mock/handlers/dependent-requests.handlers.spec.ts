import { HttpHeaders } from '@angular/common/http';

import { PACIENTES } from '../fixtures/personas';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarNotificaciones } from './notifications.handlers';
import { registrarPerfiles } from './profiles.handlers';

/**
 * Registrar un dependiente que ya tiene cuenta: sólo con su CI.
 *
 * Los casos corren en orden y comparten estado a propósito: es un recorrido
 * (pedir → avisar → aceptar), y cada paso depende del anterior.
 */
describe('solicitudes de dependiente por CI (simulador)', () => {
  const router = new MockRouter();
  registrarPerfiles(router);
  registrarNotificaciones(router);

  const titular = buscarUsuario('paciente')!;
  const JORGE = PACIENTES[1]!;
  const jorge: MockUser = {
    ...titular,
    key: 'p-mamani',
    id: JORGE.userId,
    displayName: JORGE.displayName,
    patientProfileId: JORGE.id,
    personId: JORGE.personId,
  };

  function call<T>(method: MockMethod, path: string, body: unknown, user: MockUser): T | MockReply {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user,
    }) as T | MockReply;
  }

  /** El estado HTTP, con el mismo criterio que el enrutador: sólo `{status, body}` es respuesta. */
  function estado(valor: unknown): number {
    return typeof valor === 'object' &&
      valor !== null &&
      'body' in valor &&
      typeof (valor as MockReply).status === 'number'
      ? (valor as MockReply).status
      : 200;
  }

  function avisosDe(user: MockUser): { subject: string; destination: { type: string } | null }[] {
    const pagina = call<{ items: { subject: string; destination: { type: string } | null }[] }>(
      'GET',
      '/notifications/me',
      null,
      user,
    ) as { items: { subject: string; destination: { type: string } | null }[] };
    return pagina.items;
  }

  let solicitudId = '';

  it('un CI sin cuenta registrada responde 404 y no avisa a nadie', () => {
    const respuesta = call('POST', '/profiles/patients/me/dependent-requests', { nationalId: '999999999' }, titular);
    expect(estado(respuesta)).toBe(404);
    expect((respuesta as MockReply).body).toMatchObject({
      message: 'No hay ninguna cuenta registrada con ese CI.',
    });
  });

  it('el propio CI se rechaza con 422', () => {
    const propio = PACIENTES[0]!.nationalId;
    const respuesta = call('POST', '/profiles/patients/me/dependent-requests', { nationalId: propio }, titular);
    expect(estado(respuesta)).toBe(422);
  });

  it('un CI vacío se rechaza con 400', () => {
    const respuesta = call('POST', '/profiles/patients/me/dependent-requests', { nationalId: '  ' }, titular);
    expect(estado(respuesta)).toBe(400);
  });

  it('con una cuenta existente crea la solicitud y le llega la notificación', () => {
    const antes = avisosDe(jorge).filter((a) => a.destination?.type === 'DEPENDENT_LINK_REQUEST').length;

    const respuesta = call<{ status: number; body: { id: string; status: string } }>(
      'POST',
      '/profiles/patients/me/dependent-requests',
      { nationalId: JORGE.nationalId },
      titular,
    ) as MockReply;

    expect(respuesta.status).toBe(201);
    const cuerpo = respuesta.body as { id: string; status: string };
    expect(cuerpo.status).toBe('PENDING');
    // No revela de quién es el CI.
    expect(JSON.stringify(cuerpo)).not.toContain(JORGE.displayName);
    solicitudId = cuerpo.id;

    const despues = avisosDe(jorge).filter((a) => a.destination?.type === 'DEPENDENT_LINK_REQUEST');
    expect(despues.length).toBe(antes + 1);
    expect(despues[0]!.subject).toBe('Te quieren registrar como dependiente');
  });

  it('repetir la solicitud pendiente responde 409', () => {
    const respuesta = call('POST', '/profiles/patients/me/dependent-requests', { nationalId: JORGE.nationalId }, titular);
    expect(estado(respuesta)).toBe(409);
  });

  it('la cuenta destinataria la ve en su bandeja; el titular no', () => {
    const deJorge = call<{ id: string; requesterDisplayName: string }[]>(
      'GET',
      '/profiles/patients/me/dependent-requests/incoming',
      null,
      jorge,
    ) as { id: string; requesterDisplayName: string }[];
    expect(deJorge.map((s) => s.id)).toContain(solicitudId);
    expect(deJorge.find((s) => s.id === solicitudId)!.requesterDisplayName).toBe(PACIENTES[0]!.displayName);

    const delTitular = call<unknown[]>(
      'GET',
      '/profiles/patients/me/dependent-requests/incoming',
      null,
      titular,
    ) as { id: string }[];
    expect(delTitular.map((s) => s.id)).not.toContain(solicitudId);
  });

  it('sólo la persona destinataria puede responder', () => {
    const respuesta = call('POST', `/profiles/patients/me/dependent-requests/${solicitudId}/accept`, {}, titular);
    expect(estado(respuesta)).toBe(404);
  });

  it('aceptar crea el vínculo y le avisa al titular', () => {
    const respuesta = call('POST', `/profiles/patients/me/dependent-requests/${solicitudId}/accept`, {}, jorge);
    expect(estado(respuesta)).toBe(200);

    const dependientes = call<{ patientProfileId: string }[]>(
      'GET',
      '/profiles/patients/me/dependents',
      null,
      titular,
    ) as { patientProfileId: string }[];
    expect(dependientes.map((d) => d.patientProfileId)).toContain(JORGE.id);

    const avisos = avisosDe(titular).map((a) => a.subject);
    expect(avisos).toContain(`${JORGE.displayName} aceptó ser tu dependiente`);
  });

  it('una solicitud ya respondida no se vuelve a responder', () => {
    const respuesta = call('POST', `/profiles/patients/me/dependent-requests/${solicitudId}/reject`, {}, jorge);
    expect(estado(respuesta)).toBe(409);
  });

  it('pedir de nuevo a quien ya es dependiente responde 409', () => {
    const respuesta = call('POST', '/profiles/patients/me/dependent-requests', { nationalId: JORGE.nationalId }, titular);
    expect(estado(respuesta)).toBe(409);
  });
});
