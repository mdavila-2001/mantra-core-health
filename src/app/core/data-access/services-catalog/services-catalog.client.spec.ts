import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ServicesCatalogClient } from './services-catalog.client';
import type { ServiceCatalogItem, ServiceCatalogPage } from './services-catalog.types';

const item: ServiceCatalogItem = {
  id: 's1',
  practiceId: 'pr1',
  code: 'CONS-01',
  name: 'Consulta general',
  defaultPrice: '100.00',
  isActive: true,
};

function pageOf(items: ServiceCatalogItem[], nextCursor: string | null = null): ServiceCatalogPage {
  return { items, count: items.length, limit: 50, nextCursor };
}

describe('ServicesCatalogClient', () => {
  let client: ServicesCatalogClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(ServicesCatalogClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('lista las prácticas', () => {
    let recibidas: readonly { id: string }[] | undefined;
    client.listPractices().subscribe((p) => (recibidas = p));

    const req = http.expectOne((r) => r.url === '/practices');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [{ id: 'pr1', code: 'P1', name: 'Práctica 1' }], count: 1 });

    expect(recibidas).toEqual([{ id: 'pr1', code: 'P1', name: 'Práctica 1' }]);
  });

  it('busca el catálogo mandando sólo los parámetros presentes', () => {
    client.search('pr1').subscribe();

    const req = http.expectOne((r) => r.url === '/billing/service-catalog');
    expect(req.request.params.get('practiceId')).toBe('pr1');
    expect(req.request.params.keys()).toEqual(['practiceId']);

    req.flush(pageOf([item]));
  });

  it('propaga texto, isActive, cursor y tope como parámetros', () => {
    client.search('pr1', { query: 'consul', isActive: true, cursor: 'abc', limit: 10 }).subscribe();

    const req = http.expectOne((r) => r.url === '/billing/service-catalog');
    expect(req.request.params.get('q')).toBe('consul');
    expect(req.request.params.get('isActive')).toBe('true');
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.get('limit')).toBe('10');

    req.flush(pageOf([]));
  });

  it('no manda texto vacío', () => {
    client.search('pr1', { query: '' }).subscribe();

    const req = http.expectOne((r) => r.url === '/billing/service-catalog');
    expect(req.request.params.has('q')).toBe(false);

    req.flush(pageOf([]));
  });

  it('crea un servicio nuevo', () => {
    let creado: ServiceCatalogItem | undefined;
    client
      .create({ practiceId: 'pr1', code: 'CONS-01', name: 'Consulta general', defaultPrice: '100.00' })
      .subscribe((res) => (creado = res));

    const req = http.expectOne((r) => r.url === '/billing/service-catalog');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      practiceId: 'pr1',
      code: 'CONS-01',
      name: 'Consulta general',
      defaultPrice: '100.00',
    });
    req.flush(item);

    expect(creado).toEqual(item);
  });
});
