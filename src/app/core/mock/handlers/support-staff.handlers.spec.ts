import { HttpHeaders } from '@angular/common/http';

import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, emitirAccessToken, type MockUser } from '../mock-session';
import { registrarPersonalDeApoyo } from './support-staff.handlers';

/**
 * El alta de la secretaria en la maqueta: la cuenta nace con `SUPPORT_STAFF`, entra
 * con su documento y no trae organizaciones hasta que un vínculo se acepte.
 */
describe('personal de apoyo (simulador)', () => {
  const router = new MockRouter();
  registrarPersonalDeApoyo(router);

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
});
