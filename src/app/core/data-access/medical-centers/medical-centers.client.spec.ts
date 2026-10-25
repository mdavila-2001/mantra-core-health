import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MedicalCentersClient } from './medical-centers.client';
import type { MedicalCenterPage } from './medical-centers.types';

const PAGE: MedicalCenterPage = {
  items: [
    {
      practiceId: 'p-2',
      practiceSiteId: 's-2',
      name: 'Centro Sur',
      addressText: null,
      latitude: null,
      longitude: null,
      distanceKm: null,
      complete: false,
      missingProcedureConceptIds: ['c-2'],
      offers: [],
      totalPrice: null,
    },
    {
      practiceId: 'p-1',
      practiceSiteId: 's-1',
      name: 'Centro Norte',
      addressText: 'Av. Busch 120',
      latitude: -17.75,
      longitude: -63.18,
      distanceKm: 2.4,
      complete: true,
      missingProcedureConceptIds: [],
      offers: [],
      totalPrice: 300,
      suggestedByPractitioner: true,
    },
  ],
  total: 2,
  limit: 20,
  offset: 0,
};

describe('MedicalCentersClient', () => {
  let client: MedicalCentersClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(MedicalCentersClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('arma procedureConceptIds separados por coma y sin repetidos', () => {
    client.search({ procedureConceptIds: ['c-1', 'c-2', 'c-1'], includePartial: false }).subscribe();

    const req = http.expectOne((r) => r.url === '/medical-centers/search');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('procedureConceptIds')).toBe('c-1,c-2');
    req.flush(PAGE);
  });

  it('sin ids o con más de 50 falla en el cliente y no hace ninguna petición', () => {
    const errores: string[] = [];
    const guardar = { error: (e: unknown) => errores.push((e as Error).message) };

    client.search({ procedureConceptIds: [], includePartial: false }).subscribe(guardar);
    client
      .search({
        procedureConceptIds: Array.from({ length: 51 }, (_, i) => `c-${i}`),
        includePartial: false,
      })
      .subscribe(guardar);
    client.searchForMyOrders({ serviceRequestIds: [], includePartial: true }).subscribe(guardar);

    expect(errores).toHaveLength(3);
    http.expectNone(() => true);
  });

  it('50 ids distintos todavía se aceptan; los repetidos no cuentan', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `c-${i}`);
    client.search({ procedureConceptIds: [...ids, 'c-0'], includePartial: false }).subscribe();

    http.expectOne((r) => r.url === '/medical-centers/search').flush(PAGE);
  });

  it('lat y lng viajan juntos o no viajan', () => {
    client.search({ procedureConceptIds: ['c-1'], includePartial: false, lat: -17.78 }).subscribe();
    client.search({ procedureConceptIds: ['c-1'], includePartial: false, lng: -63.18 }).subscribe();
    client
      .search({ procedureConceptIds: ['c-1'], includePartial: false, lat: -17.78, lng: -63.18 })
      .subscribe();

    const pedidos = http.match((r) => r.url === '/medical-centers/search');
    expect(pedidos.map((r) => [r.request.params.get('lat'), r.request.params.get('lng')])).toEqual([
      [null, null],
      [null, null],
      ['-17.78', '-63.18'],
    ]);
    pedidos.forEach((r) => r.flush(PAGE));
  });

  it('searchForMyOrders pide solo ids de órdenes: sin conceptos ni textos en la URL', () => {
    client
      .searchForMyOrders({ serviceRequestIds: ['o-1', 'o-2', 'o-1'], includePartial: true })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/medical-centers/search/for-my-orders');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('serviceRequestIds')).toBe('o-1,o-2');
    expect(req.request.params.keys().sort()).toEqual(['includePartial', 'serviceRequestIds']);
    req.flush(PAGE);
  });

  it('includePartial viaja tal cual, explícito en los dos valores', () => {
    client.search({ procedureConceptIds: ['c-1'], includePartial: false }).subscribe();
    client.search({ procedureConceptIds: ['c-1'], includePartial: true }).subscribe();

    const pedidos = http.match((r) => r.url === '/medical-centers/search');
    expect(pedidos.map((r) => r.request.params.get('includePartial'))).toEqual(['false', 'true']);
    pedidos.forEach((r) => r.flush(PAGE));
  });

  it('devuelve la respuesta sin renombrar ni reordenar', () => {
    let page: MedicalCenterPage | undefined;
    client
      .searchForMyOrders({ serviceRequestIds: ['o-1'], includePartial: true })
      .subscribe((result) => (page = result));

    http.expectOne((r) => r.url === '/medical-centers/search/for-my-orders').flush(PAGE);

    expect(page).toEqual(PAGE);
    expect(page?.items.map((item) => item.practiceSiteId)).toEqual(['s-2', 's-1']);
  });

  it('manda los filtros opcionales solo si traen valor', () => {
    client
      .search({
        procedureConceptIds: ['c-1'],
        includePartial: false,
        specialty: 'Gastroenterología',
        city: '',
        offset: 20,
        limit: 10,
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/medical-centers/search');
    expect(req.request.params.get('specialty')).toBe('Gastroenterología');
    expect(req.request.params.has('city')).toBe(false);
    expect(req.request.params.get('offset')).toBe('20');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush(PAGE);
  });
});
