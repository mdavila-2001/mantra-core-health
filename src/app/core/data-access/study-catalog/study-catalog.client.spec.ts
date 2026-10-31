import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { StudyCatalogClient } from './study-catalog.client';

describe('StudyCatalogClient', () => {
  let client: StudyCatalogClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(StudyCatalogClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('list: manda solo los parametros con valor', () => {
    client.list({ family: 'LAB', q: 'hemo', cursor: undefined, limit: 25 }).subscribe();

    const req = http.expectOne((r) => r.url === '/clinical/study-catalog');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('family')).toBe('LAB');
    expect(req.request.params.get('q')).toBe('hemo');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
  });

  it('list: sin filtros no manda ningun parametro, ni un q vacio', () => {
    client.list({ q: '' }).subscribe();

    const req = http.expectOne((r) => r.url === '/clinical/study-catalog');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], count: 0, limit: 25, nextCursor: null });
  });

  it('detail: GET por conceptId', () => {
    let detalle;
    client.detail('c-1').subscribe((d) => (detalle = d));

    const req = http.expectOne('/clinical/study-catalog/c-1');
    expect(req.request.method).toBe('GET');
    req.flush({ conceptId: 'c-1', components: [] });

    expect(detalle).toEqual({ conceptId: 'c-1', components: [] });
  });
});
