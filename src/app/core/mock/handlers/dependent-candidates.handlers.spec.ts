import { HttpHeaders } from '@angular/common/http';

import { PATIENTS } from '../fixtures/people';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarNotificaciones } from './notifications.handlers';
import { registrarPerfiles } from './profiles.handlers';

/**
 * Registrar un dependiente buscándolo por nombre, y decidir desde la
 * notificación.
 *
 * Es un recorrido (buscar → pedir → ver los botones → aceptar → ya no hay
 * botones): los casos comparten estado a propósito y corren en orden.
 */
describe('dependientes por nombre y acciones de la notificación (simulador)', () => {
  const router = new MockRouter();
  registrarPerfiles(router);
  registrarNotificaciones(router);

  const titular = buscarUsuario('paciente')!;
  const OTRA = PATIENTS.find((p) => p.email !== '' && p.id !== PATIENTS[0]!.id && p.id !== PATIENTS[1]!.id)!;
  const otra: MockUser = {
    ...titular,
    key: 'p-otra',
    id: OTRA.userId,
    displayName: OTRA.displayName,
    patientProfileId: OTRA.id,
    personId: OTRA.personId,
  };

  function call<T>(method: MockMethod, path: string, body: unknown, user: MockUser, query = ''): T | MockReply {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body,
      headers: new HttpHeaders(),
      user,
    }) as T | MockReply;
  }

  function estado(valor: unknown): number {
    return typeof valor === 'object' && valor !== null && 'body' in valor && typeof (valor as MockReply).status === 'number'
      ? (valor as MockReply).status
      : 200;
  }

  interface Candidato {
    patientProfileId: string;
    displayName: string;
    maskedNationalId?: string;
  }
  interface Aviso {
    id: string;
    subject: string;
    unread: boolean;
    destination: { type: string; id: string } | null;
    actions?: { key: string; label: string }[];
  }

  function buscar(texto: string): Candidato[] {
    return call<Candidato[]>('GET', '/profiles/patients/me/dependent-candidates', null, titular, `q=${encodeURIComponent(texto)}`) as Candidato[];
  }

  function avisoDeSolicitud(user: MockUser): Aviso | undefined {
    const pagina = call<{ items: Aviso[] }>('GET', '/notifications/me', null, user) as { items: Aviso[] };
    return pagina.items.find((a) => a.destination?.type === 'DEPENDENT_LINK_REQUEST');
  }

  it('con menos de tres letras no devuelve a nadie', () => {
    expect(buscar('')).toEqual([]);
    expect(buscar('  a ')).toEqual([]);
    expect(buscar('ma')).toEqual([]);
  });

  it('encuentra por nombre sin importar tildes ni mayúsculas, y no se incluye a sí misma', () => {
    const primerNombre = OTRA.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
    const filas = buscar(primerNombre);
    expect(filas.map((f) => f.patientProfileId)).toContain(OTRA.id);
    expect(filas.map((f) => f.patientProfileId)).not.toContain(PATIENTS[0]!.id);
  });

  it('devuelve pocas filas y nunca el CI entero', () => {
    const filas = buscar(OTRA.name);
    expect(filas.length).toBeLessThanOrEqual(8);
    for (const fila of filas) {
      expect(fila.maskedNationalId ?? '').toMatch(/^••••.{0,3}$|^•••$|^$/);
      expect(JSON.stringify(fila)).not.toContain(PATIENTS.find((p) => p.id === fila.patientProfileId)!.nationalId);
    }
  });

  it('todas las palabras escritas deben coincidir', () => {
    expect(buscar(`${OTRA.name} zzzzzz`)).toEqual([]);
  });

  let solicitudId = '';

  it('pedir por perfil elegido crea la solicitud y la notificación ofrece Aceptar y Rechazar', () => {
    const respuesta = call('POST', '/profiles/patients/me/dependent-requests', { patientProfileId: OTRA.id }, titular) as MockReply;
    expect(respuesta.status).toBe(201);
    solicitudId = (respuesta.body as { id: string }).id;

    const aviso = avisoDeSolicitud(otra)!;
    expect(aviso.destination!.id).toBe(solicitudId);
    expect(aviso.unread).toBe(true);
    expect(aviso.actions?.map((a) => a.key)).toEqual(['ACCEPT', 'REJECT']);
  });

  it('un perfil que no existe responde 404', () => {
    const respuesta = call('POST', '/profiles/patients/me/dependent-requests', { patientProfileId: 'no-existe' }, titular);
    expect(estado(respuesta)).toBe(404);
  });

  it('el propio perfil se rechaza con 422', () => {
    const respuesta = call('POST', '/profiles/patients/me/dependent-requests', { patientProfileId: PATIENTS[0]!.id }, titular);
    expect(estado(respuesta)).toBe(422);
  });

  it('sin CI ni perfil responde 400', () => {
    expect(estado(call('POST', '/profiles/patients/me/dependent-requests', {}, titular))).toBe(400);
  });

  it('quien tiene una solicitud pendiente sigue apareciendo en la búsqueda (no se filtra su estado)', () => {
    expect(buscar(OTRA.name).map((f) => f.patientProfileId)).toContain(OTRA.id);
  });

  it('responder la solicitud retira los botones de la notificación y la da por leída', () => {
    const respuesta = call('POST', `/profiles/patients/me/dependent-requests/${solicitudId}/accept`, {}, otra);
    expect(estado(respuesta)).toBe(200);

    const aviso = avisoDeSolicitud(otra)!;
    expect(aviso.actions ?? []).toEqual([]);
    expect(aviso.unread).toBe(false);
  });

  it('quien ya es dependiente deja de aparecer en la búsqueda', () => {
    expect(buscar(OTRA.name).map((f) => f.patientProfileId)).not.toContain(OTRA.id);
  });
});
