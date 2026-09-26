import { HttpHeaders } from '@angular/common/http';

import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarSeguros } from './insurance.handlers';
import {
  registrarAutorizacionesPrevias,
  reiniciarAutorizacionesPrevias,
} from './prior-authorization.handlers';

interface Resumen {
  readonly id: string;
  readonly status: string;
  readonly decision: string | null;
}
interface Detalle extends Resumen {
  readonly items: readonly {
    readonly id: string;
    readonly decision: {
      readonly decision: string;
      readonly policyClauseReference: string | null;
    } | null;
  }[];
}

/**
 * La bandeja simulada tiene que comportarse como la API: sólo la aseguradora
 * la ve, cada ítem se decide una vez, NO APROBADO exige cláusula y la decisión
 * global se deriva. Si el mock fuera más permisivo, la pantalla pasaría acá y
 * fallaría contra el servidor real.
 */
describe('handlers de solicitudes de aprobación', () => {
  const router = new MockRouter();
  const owner = buscarUsuario('aseguradora')!;
  const medica = buscarUsuario('medica')!;
  registrarSeguros(router);
  registrarAutorizacionesPrevias(router);

  beforeEach(() => reiniciarAutorizacionesPrevias());

  function call<T>(
    method: MockMethod,
    path: string,
    user: MockUser | null,
    { query = {}, body = null }: { query?: Record<string, string>; body?: unknown } = {},
  ): T {
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
    }) as T;
  }

  function pendiente(): Detalle {
    const bandeja = call<{ items: readonly Resumen[] }>(
      'GET',
      '/prior-authorization-requests/inbox',
      owner,
      { query: { status: 'PENDING' } },
    );
    const primera = bandeja.items.find((s) => s.status === 'SUBMITTED')!;
    return call<Detalle>('GET', `/prior-authorization-requests/${primera.id}`, owner);
  }

  it('quien no es de la aseguradora recibe 403', () => {
    const reply = call<MockReply>('GET', '/prior-authorization-requests/inbox', medica);
    expect(reply.status).toBe(403);
  });

  it('filtra pendientes y respondidas', () => {
    const pendientes = call<{ items: readonly Resumen[] }>(
      'GET',
      '/prior-authorization-requests/inbox',
      owner,
      { query: { status: 'PENDING' } },
    );
    const respondidas = call<{ items: readonly Resumen[] }>(
      'GET',
      '/prior-authorization-requests/inbox',
      owner,
      { query: { status: 'DETERMINED' } },
    );
    expect(pendientes.items.every((s) => s.status !== 'DETERMINED')).toBe(true);
    expect(respondidas.items.every((s) => s.status === 'DETERMINED')).toBe(true);
    expect(pendientes.items.length).toBeGreaterThan(0);
    expect(respondidas.items.length).toBeGreaterThan(0);
  });

  it('NO APROBADO sin cláusula: 400 y no cambia nada', () => {
    const detalle = pendiente();
    const reply = call<MockReply>(
      'POST',
      `/prior-authorization-requests/${detalle.id}/determinations`,
      owner,
      {
        body: {
          items: detalle.items.map((i) => ({ priorAuthorizationItemId: i.id, decision: 'DENIED' })),
        },
      },
    );
    expect(reply.status).toBe(400);
    expect(call<Detalle>('GET', `/prior-authorization-requests/${detalle.id}`, owner).status).toBe(
      'SUBMITTED',
    );
  });

  it('faltan ítems: 422', () => {
    const detalle = pendiente();
    const reply = call<MockReply>(
      'POST',
      `/prior-authorization-requests/${detalle.id}/determinations`,
      owner,
      { body: { items: [] } },
    );
    expect(reply.status).toBe(422);
  });

  it('una aprobación parcial queda registrada con la cláusula, y no admite otra', () => {
    const detalle = pendiente();
    const [primero, ...resto] = detalle.items;
    const body = {
      items: [
        {
          priorAuthorizationItemId: primero!.id,
          decision: 'DENIED',
          policyClauseReference: 'Cláusula 4.1',
        },
        ...resto.map((i) => ({ priorAuthorizationItemId: i.id, decision: 'APPROVED' })),
      ],
    };
    const reply = call<MockReply>(
      'POST',
      `/prior-authorization-requests/${detalle.id}/determinations`,
      owner,
      { body },
    );
    expect(reply.status).toBe(201);

    const releido = call<Detalle>('GET', `/prior-authorization-requests/${detalle.id}`, owner);
    expect(releido.status).toBe('DETERMINED');
    expect(releido.decision).toBe(resto.length > 0 ? 'PARTIAL' : 'DENIED');
    expect(releido.items[0]?.decision).toMatchObject({
      decision: 'DENIED',
      policyClauseReference: 'Cláusula 4.1',
    });

    const otra = call<MockReply>(
      'POST',
      `/prior-authorization-requests/${detalle.id}/determinations`,
      owner,
      { body },
    );
    expect(otra.status).toBe(422);
  });
});
