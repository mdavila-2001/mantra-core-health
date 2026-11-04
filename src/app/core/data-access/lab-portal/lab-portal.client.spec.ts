import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { forcedRealApi } from '../../mock/api-mode';
import { LabPortalClient } from './lab-portal.client';

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
    http.expectOne('/diagnostics/lab/orders').flush({ items: [], count: 0 });

    expect(labName).toBe('Laboratorio Central');
    expect(orders).toBe(0);
  });

  it('un paso de la orden se manda con su acción', () => {
    client.transitionOrder('o/1', 'RECEIVE').subscribe();
    const req = http.expectOne('/diagnostics/lab/orders/o%2F1/transitions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ action: 'RECEIVE' });
    req.flush({});
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
