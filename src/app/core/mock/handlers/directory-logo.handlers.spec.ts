import { HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { MockRouter, type MockMethod } from '../mock-router';
import { buscarUsuario, TENANT_ASEGURADORA, TENANT_FARMACIA } from '../mock-session';
import { registrarDirectorio } from './directory.handlers';

/**
 * El logo de una organización en la maqueta (PENDIENTES-BACKEND P58): lo lee cualquiera
 * que vea la ficha, lo escribe sólo quien administra esa organización.
 */
describe('handlers del logo de una organización', () => {
  const router = new MockRouter();
  registrarDirectorio(router);

  const farmacia = buscarUsuario('farmacia')!;
  const paciente = buscarUsuario('paciente')!;

  interface Respuesta<T> {
    readonly status: number;
    readonly body: T;
  }

  function llamar<T = unknown>(method: MockMethod, path: string, quien = farmacia, body: unknown = {}): Respuesta<T> {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const resultado = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(),
      body,
      headers: new HttpHeaders(),
      user: quien,
    });
    if (resultado !== null && typeof resultado === 'object' && 'status' in resultado && 'body' in resultado) {
      return resultado as Respuesta<T>;
    }
    return { status: 200, body: resultado as T };
  }

  const logo = (tenantId: string, quien = paciente) =>
    llamar<{ fileId: string | null }>('GET', `/tenants/${tenantId}/logo`, quien);
  const guardar = (tenantId: string, fileId: string | null, quien = farmacia) =>
    llamar<{ fileId: string | null }>('PUT', `/tenants/${tenantId}/logo`, quien, { fileId });

  it('una organización sin logo responde fileId null', () => {
    expect(logo(TENANT_ASEGURADORA).body).toEqual({ fileId: null });
  });

  it('quien administra la organización guarda su logo y cualquiera lo lee', () => {
    expect(guardar(TENANT_FARMACIA, 'archivo-1').body).toEqual({ fileId: 'archivo-1' });
    expect(logo(TENANT_FARMACIA).body).toEqual({ fileId: 'archivo-1' });
  });

  it('con null se quita', () => {
    guardar(TENANT_FARMACIA, 'archivo-2');
    guardar(TENANT_FARMACIA, null);
    expect(logo(TENANT_FARMACIA).body).toEqual({ fileId: null });
  });

  it('un paciente no cambia el logo de nadie: 403', () => {
    expect(guardar(TENANT_FARMACIA, 'archivo-3', paciente).status).toBe(403);
    expect(logo(TENANT_FARMACIA).body.fileId).not.toBe('archivo-3');
  });

  it('quien administra una organización no cambia el logo de otra: 403', () => {
    expect(guardar(TENANT_ASEGURADORA, 'archivo-4', farmacia).status).toBe(403);
  });

  it('una organización que no existe responde 404', () => {
    expect(logo('no-existe').status).toBe(404);
    expect(guardar('no-existe', 'archivo-5').status).toBe(404);
  });
});
