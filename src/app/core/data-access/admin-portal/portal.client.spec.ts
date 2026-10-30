import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import { PortalClient } from './portal.client';

describe('PortalClient', () => {
  let client: PortalClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PortalClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la versión del inventario', () => {
    let hash = '';
    client.version().subscribe((v) => (hash = v.hash));
    const req = http.expectOne((r) => r.url.endsWith('/admin/portal/version'));
    expect(req.request.method).toBe('GET');
    req.flush({
      hash: 'abc',
      operaciones: 1,
      procesos: 1,
      tablas: 1,
      columnas: 1,
      origen: 'inventario',
    });
    expect(hash).toBe('abc');
  });

  it('manda sólo los filtros presentes y omite los vacíos', () => {
    client.listOperations({ q: 'hold', riesgo: 'ALTO', modulo: '', limit: 25 }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/admin/portal/operaciones'));
    expect(req.request.params.get('q')).toBe('hold');
    expect(req.request.params.get('riesgo')).toBe('ALTO');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.has('modulo')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 25, total: 0 });
  });

  it('codifica el identificador de la operación y el código de un proceso con dos puntos', () => {
    client.getOperation('A/B_c').subscribe();
    http.expectOne((r) => r.url.endsWith('/admin/portal/operaciones/A%2FB_c')).flush({});
    client.getProcessGraph('critico:scheduling').subscribe();
    http
      .expectOne((r) => r.url.endsWith('/admin/portal/flujos/critico%3Ascheduling/grafo'))
      .flush({ proceso: 'x', nombre: 'x', roles: [], nodos: [], aristas: [] });
  });

  it('el mapa de rutas y los hallazgos van por sus propias rutas', () => {
    client.routeMap({ senal: 'SIN_PRUEBAS' }).subscribe();
    const mapa = http.expectOne((r) => r.url.endsWith('/admin/portal/flujos/mapa'));
    expect(mapa.request.params.get('senal')).toBe('SIN_PRUEBAS');
    mapa.flush({ items: [], nextCursor: null, limit: 50, total: 0 });
    client.getFinding('FLU-02', { cursor: 'c1', limit: 10 }).subscribe();
    const hallazgo = http.expectOne((r) => r.url.endsWith('/admin/portal/flujos/hallazgos/FLU-02'));
    expect(hallazgo.request.params.get('cursor')).toBe('c1');
    hallazgo.flush({});
  });

  it('la ficha de una tabla y su linaje usan schema y tabla como segmentos', () => {
    client.getTable('scheduling', 'slot_holds').subscribe();
    http
      .expectOne((r) => r.url.endsWith('/admin/portal/catalogo/tablas/scheduling/slot_holds'))
      .flush({});
    client.tableLineage('scheduling', 'slot_holds').subscribe();
    http
      .expectOne((r) => r.url.endsWith('/admin/portal/linaje/tablas/scheduling/slot_holds'))
      .flush({});
  });

  it('un appendOnly falso se manda como «false», no se pierde', () => {
    client.listTables({ appendOnly: false }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/admin/portal/catalogo/tablas'));
    expect(req.request.params.get('appendOnly')).toBe('false');
    req.flush({ items: [], nextCursor: null, limit: 50, total: 0 });
  });

  it('un error de la API llega al suscriptor sin traducirse', () => {
    let status = 0;
    client.getOperation('X').subscribe({ error: (e: { status: number }) => (status = e.status) });
    http
      .expectOne((r) => r.url.includes('/admin/portal/operaciones/X'))
      .flush({ code: 'NOT_FOUND' }, { status: 404, statusText: 'Not Found' });
    expect(status).toBe(404);
  });
});
