import { HttpHeaders } from '@angular/common/http';

import { crearRouterSimulado } from './index';
import { buscarUsuario, TENANT_FARMACIA, type MockUser } from '../mock-session';
import { isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { uuid } from '../mock-store';

/**
 * El pedido que llega mientras la farmacia mira la bandeja (3.2: «alguna
 * alarma o sonido al llegar el pedido»). Archivo propio: el pedido nace una
 * vez por sesión, y el estado del módulo tiene que arrancar limpio.
 *
 * También, que las sucursales cargadas en «Sucursales» aparezcan como sedes
 * del mostrador sin duplicar las que ya estaban.
 */
const SEDE_CENTRAL = uuid('pharmacy-site-farmacia-vida');

describe('handlers de farmacia: el pedido entrante y las sedes cargadas', () => {
  const router = crearRouterSimulado();
  const farmacia = buscarUsuario('farmacia')!;
  const paciente = buscarUsuario('paciente')!;

  function pedir(method: MockMethod, path: string, user: MockUser | null, query = '', body: unknown = {}) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const r = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body,
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest);
    return (isMockReply(r) ? r.body : r) as { items: readonly { id?: string; patientName?: string; status?: string; name?: string }[] };
  }

  const ENTRANTE = uuid('pharmacy-order-entrante');
  const entrantes = (user: MockUser, query: string) =>
    pedir('GET', '/pharmacy/orders', user, query).items.filter((p) => p.id === ENTRANTE);

  beforeEach(() => vi.useFakeTimers({ toFake: ['Date'] }));
  afterEach(() => vi.useRealTimers());

  it('mirar la bandeja de otra cuenta no siembra el pedido de Farmacia Vida', () => {
    // Por id y no por nombre: «Carla Montaño Rivero» también es una paciente
    // de los pedidos de ejemplo, y el nombre solo hacía depender la prueba de
    // la hora del día.
    const ids = () => pedir('GET', '/pharmacy/orders', paciente).items.map((p) => p.id);
    ids();
    vi.advanceTimersByTime(60_000);
    expect(ids()).not.toContain(ENTRANTE);
  });

  it('para Farmacia Vida llega después de abrir la bandeja, una sola vez, en «Nuevos»', () => {
    const consulta = `siteId=${SEDE_CENTRAL}&limit=500`;
    expect(entrantes(farmacia, consulta)).toHaveLength(0);

    vi.advanceTimersByTime(16_000);
    expect(entrantes(farmacia, consulta)).toHaveLength(1);

    // Volver a mirar no siembra otro.
    vi.advanceTimersByTime(60_000);
    expect(entrantes(farmacia, consulta)).toHaveLength(1);
  });

  it('una sucursal cargada en «Sucursales» es una sede más del mostrador, sin duplicar las sembradas', () => {
    pedir('POST', `/tenants/${TENANT_FARMACIA}/branches`, farmacia, '', { code: 'URUBO', name: 'Sucursal Urubó', branchType: 'OFFICE' });
    const ficha = pedir('GET', `/pharmacy/pharmacies/${TENANT_FARMACIA}`, farmacia) as unknown as {
      sites: readonly { name: string }[];
      siteCount: number;
    };
    const sedes = ficha.sites.map((s) => s.name);

    expect(sedes).toContain('Sucursal Urubó');
    expect(sedes.filter((n) => n === 'Sucursal Equipetrol')).toHaveLength(1);
    expect(ficha.siteCount).toBe(ficha.sites.length);
  });
});
