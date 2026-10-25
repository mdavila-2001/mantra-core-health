import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProcedureCentersClient } from './procedure-centers.client';

describe('ProcedureCentersClient', () => {
  let client: ProcedureCentersClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(ProcedureCentersClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide los centros del titular con el origen elegido y nunca los procedimientos', () => {
    client.getOwn({ origin: { lat: -16.5, lng: -68.1 }, limit: 10 }).subscribe();
    const request = http.expectOne((r) => r.url === '/clinical/me/procedure-centers');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('lat')).toBe('-16.5');
    expect(request.request.params.get('lng')).toBe('-68.1');
    expect(request.request.params.get('limit')).toBe('10');
    expect(request.request.params.keys().sort()).toEqual(['lat', 'limit', 'lng']);
    request.flush({ procedures: [], centers: [], total: 0, limit: 10 });
  });

  it('sin origen no manda coordenadas', () => {
    client.getOwn().subscribe();
    const request = http.expectOne((r) => r.url === '/clinical/me/procedure-centers');
    expect(request.request.params.keys()).toEqual([]);
    request.flush({ procedures: [], centers: [], total: 0, limit: 20 });
  });

  it('convierte la fecha del pedido a Date', () => {
    let requestedAt: Date | undefined;
    client.getOwn().subscribe((result) => (requestedAt = result.procedures[0]?.requestedAt));
    http.expectOne((r) => r.url === '/clinical/me/procedure-centers').flush({
      procedures: [
        {
          serviceRequestId: 'sr-1',
          conceptId: 'c-1',
          categoryConceptId: 'cat-1',
          requestedAt: '2026-10-24T12:00:00.000Z',
        },
      ],
      centers: [],
      total: 0,
      limit: 20,
    });
    expect(requestedAt).toEqual(new Date('2026-10-24T12:00:00.000Z'));
  });
});
