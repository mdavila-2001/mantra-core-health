import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { registerPortalInventory } from './portal-inventory.handlers';

describe('maqueta del inventario del portal (`/admin/portal/*`)', () => {
  const router = new MockRouter();
  registerPortalInventory(router);

  function get(path: string, query: Record<string, string> = {}) {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: null,
    } satisfies MockRequest);
  }
  const status = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const data = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;

  it('cubre todas las rutas que llama `PortalClient`: ninguna cae en el 501 genérico', () => {
    for (const path of [
      '/admin/portal/version',
      '/admin/portal/operaciones',
      '/admin/portal/operaciones/SchedulingController_book',
      '/admin/portal/operaciones/SchedulingController_book/arbol',
      '/admin/portal/flujos',
      '/admin/portal/flujos/scheduling',
      '/admin/portal/flujos/scheduling/grafo',
      '/admin/portal/flujos/mapa',
      '/admin/portal/flujos/hallazgos',
      '/admin/portal/flujos/hallazgos/FLU-02',
      '/admin/portal/catalogo/tablas',
      '/admin/portal/catalogo/tablas/scheduling/slots',
      '/admin/portal/catalogo/deriva',
      '/admin/portal/linaje',
      '/admin/portal/linaje/tablas/scheduling/slots',
      '/admin/portal/glosario',
    ]) {
      expect(status(get(path)), path).toBe(200);
    }
  });

  it('filtra y pagina como la API, con total y sin filtrar campos internos', () => {
    const altas = data<{ items: Record<string, unknown>[]; total: number }>(
      get('/admin/portal/operaciones', { riesgo: 'ALTO' }),
    );
    expect(altas.items.every((o) => o['riesgo'] === 'ALTO')).toBe(true);
    expect(altas.total).toBe(altas.items.length);
    expect(altas.items.some((o) => '_tablas' in o)).toBe(false);

    const primera = data<{ items: unknown[]; nextCursor: string | null }>(get('/admin/portal/operaciones', { limit: '2' }));
    expect(primera.items).toHaveLength(2);
    expect(primera.nextCursor).toBe('2');
  });

  it('«mapa» le gana a `flujos/:codigo` y lo desconocido es 404', () => {
    expect(data<{ items: unknown[] }>(get('/admin/portal/flujos/mapa')).items.length).toBeGreaterThan(0);
    expect(status(get('/admin/portal/flujos/no-existe'))).toBe(404);
    expect(status(get('/admin/portal/catalogo/tablas/x/y'))).toBe(404);
  });

  it('el linaje de una tabla trae la forma real: etiqueta, id y efecto', () => {
    const linaje = data<{ operaciones: Record<string, unknown>[] }>(get('/admin/portal/linaje/tablas/scheduling/slots'));
    expect(Object.keys(linaje.operaciones[0]!).sort()).toEqual(['efecto', 'id', 'operacion']);
  });
});
