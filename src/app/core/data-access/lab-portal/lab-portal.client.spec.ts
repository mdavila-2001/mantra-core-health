import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { forcedRealApi } from '../../mock/api-mode';
import { LabPortalClient } from './lab-portal.client';
import type { LabOrderPage } from './lab-portal.types';

/**
 * The real API publishes `/diagnostics/lab/*` (04/11/2026): against it the
 * client must send the request instead of answering «todavía no está disponible».
 */
describe('LabPortalClient contra la API real', () => {
  let http: HttpTestingController;
  let client: LabPortalClient;

  beforeEach(() => {
    forcedRealApi.set(true);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(LabPortalClient);
  });

  afterEach(() => {
    http.verify();
    forcedRealApi.set(false);
  });

  it('el resumen y las órdenes salen a la red', () => {
    let labName = '';
    let orders = -1;
    client.getSummary().subscribe((s) => (labName = s.labName));
    client.listOrders().subscribe((page) => (orders = page.count));

    http.expectOne('/diagnostics/lab/summary').flush({ labName: 'Laboratorio Central' });
    http.expectOne((r) => r.url === '/diagnostics/lab/orders').flush({ items: [], count: 0 });

    expect(labName).toBe('Laboratorio Central');
    expect(orders).toBe(0);
  });

  describe('listOrders sigue el cursor', () => {
    const order = (id: string) => ({ orderId: id });
    const pedir = () => http.expectOne((r) => r.url === '/diagnostics/lab/orders');

    it('junta las páginas hasta que se agota nextCursor y conserva el total del laboratorio', () => {
      let page: LabOrderPage | undefined;
      client.listOrders().subscribe((p) => (page = p));

      const first = pedir();
      expect(first.request.params.get('limit')).toBe('500');
      expect(first.request.params.has('cursor')).toBe(false);
      first.flush({ items: [order('a'), order('b')], count: 3, nextCursor: 'c1' });

      const second = pedir();
      expect(second.request.params.get('cursor')).toBe('c1');
      second.flush({ items: [order('c')], count: 3 });

      expect(page?.items.map((o) => o.orderId)).toEqual(['a', 'b', 'c']);
      expect(page?.count).toBe(3);
      expect(page?.nextCursor).toBeUndefined();
    });

    it('corta en 20 páginas y deja el nextCursor que quedó sin pedir', () => {
      let page: LabOrderPage | undefined;
      client.listOrders().subscribe((p) => (page = p));

      for (let n = 0; n < 20; n++) {
        pedir().flush({ items: [order(`o${n}`)], count: 99, nextCursor: `c${n + 1}` });
      }

      http.expectNone((r) => r.url === '/diagnostics/lab/orders');
      expect(page?.items).toHaveLength(20);
      expect(page?.count).toBe(99);
      expect(page?.nextCursor).toBe('c20');
    });

    it('una sola página sin cursor hace una sola petición', () => {
      let page: LabOrderPage | undefined;
      client.listOrders().subscribe((p) => (page = p));
      pedir().flush({ items: [order('a')], count: 1 });
      expect(page?.items).toHaveLength(1);
    });

    it('un error en una página posterior se propaga y no entrega una lista a medias', () => {
      let failed = false;
      let delivered = false;
      client.listOrders().subscribe({ next: () => (delivered = true), error: () => (failed = true) });
      pedir().flush({ items: [order('a')], count: 2, nextCursor: 'c1' });
      pedir().flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      expect(failed).toBe(true);
      expect(delivered).toBe(false);
    });
  });

  it('un paso de la orden se manda con su acción', () => {
    client.transitionOrder('o/1', 'RECEIVE').subscribe();
    const req = http.expectOne('/diagnostics/lab/orders/o%2F1/transitions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ action: 'RECEIVE' });
    req.flush({});
  });

  it('el catálogo manda los componentes destildados sólo si los hay', () => {
    client.importCatalog(['a', 'b']).subscribe();
    const plain = http.expectOne('/diagnostics/lab/catalog/import');
    expect(plain.request.body).toEqual({ conceptIds: ['a', 'b'] });
    plain.flush({});

    client.importCatalog(['a'], ['p1']).subscribe();
    const skipping = http.expectOne('/diagnostics/lab/catalog/import');
    expect(skipping.request.body).toEqual({ conceptIds: ['a'], skipComponentIds: ['p1'] });
    skipping.flush({});
  });

  it('los servicios filtran sin mandar parámetros vacíos', () => {
    client.listServices({ q: 'hemo', categoryId: '' }).subscribe();
    const req = http.expectOne((r) => r.url === '/diagnostics/lab/services');
    expect(req.request.params.keys()).toEqual(['q']);
    req.flush({ items: [], count: 0 });
  });

  it('una búsqueda por texto va en el cuerpo de un POST, nunca en la URL', () => {
    client.listResultFiles({ q: 'Ana', kind: 'PDF', orderId: '' }).subscribe();
    const req = http.expectOne('/diagnostics/lab/result-files/search');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ q: 'Ana', kind: 'PDF' });
    req.flush({ items: [], count: 0, totalBytes: 0 });
  });

  it('sin texto, la lista sigue siendo un GET con sus filtros', () => {
    client.listResultFiles({ kind: 'PDF' }).subscribe();
    const req = http.expectOne((r) => r.url === '/diagnostics/lab/result-files');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('kind')).toBe('PDF');
    req.flush({ items: [], count: 0, totalBytes: 0 });
  });
});
