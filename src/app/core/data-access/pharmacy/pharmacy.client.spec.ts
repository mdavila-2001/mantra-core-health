import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PharmacyClient } from './pharmacy.client';
import {
  DISPONIBILIDAD_FIXTURE,
  FIXTURE_IDS,
  productosDelConcepto,
} from './pharmacy.fixtures';

describe('PharmacyClient', () => {
  let client: PharmacyClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PharmacyClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('busca productos por concepto sin declarar los filtros que no viajan', () => {
    let truncated: boolean | null = null;
    client
      .searchProducts({ conceptId: FIXTURE_IDS.conceptoAmoxicilina, limit: 1 })
      .subscribe((page) => (truncated = page.truncated));

    const req = http.expectOne((r) => r.url === '/pharmacy/products');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('conceptId')).toBe(FIXTURE_IDS.conceptoAmoxicilina);
    expect(req.request.params.get('limit')).toBe('1');
    // Un opcional en `undefined` que viaja como clave declarada vuelve 400.
    expect(req.request.params.has('search')).toBe(false);
    req.flush(productosDelConcepto(FIXTURE_IDS.conceptoAmoxicilina));

    expect(truncated).toBe(false);
  });

  it('consulta disponibilidad con los productos como lista separada por comas', () => {
    let count = -1;
    client
      .availability({
        productIds: [FIXTURE_IDS.productoAmoxicilina, FIXTURE_IDS.productoIbuprofeno],
      })
      .subscribe((result) => (count = result.count));

    const req = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('products')).toBe(
      `${FIXTURE_IDS.productoAmoxicilina},${FIXTURE_IDS.productoIbuprofeno}`,
    );
    // Sin origen no viaja ninguna de las dos coordenadas: el contrato exige
    // `lat` y `lng` juntos o ninguno.
    expect(req.request.params.has('lat')).toBe(false);
    expect(req.request.params.has('lng')).toBe(false);
    req.flush(DISPONIBILIDAD_FIXTURE);

    expect(count).toBe(2);
  });

  it('manda lat y lng juntos cuando hay origen', () => {
    client
      .availability({
        productIds: [FIXTURE_IDS.productoAmoxicilina],
        origin: { lat: -17.7833, lng: -63.1821 },
        limit: 10,
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    expect(req.request.params.get('lat')).toBe('-17.7833');
    expect(req.request.params.get('lng')).toBe('-63.1821');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush(DISPONIBILIDAD_FIXTURE);
  });

  it('busca productos filtrados por farmacia', () => {
    client.searchProducts({ pharmacyId: 'ph-1' }).subscribe();

    const req = http.expectOne((r) => r.url === '/pharmacy/products');
    expect(req.request.params.get('pharmacyId')).toBe('ph-1');
    req.flush({ items: [], limit: 50, truncated: false });
  });

  it('lista sedes sin exigir origen ni búsqueda', () => {
    let count = -1;
    client.nearbySites().subscribe((page) => (count = page.count));

    const req = http.expectOne((r) => r.url === '/pharmacy/sites');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('lat')).toBe(false);
    expect(req.request.params.has('lng')).toBe(false);
    req.flush({ items: [], count: 0 });

    expect(count).toBe(0);
  });

  it('lista sedes con búsqueda y origen cuando vienen', () => {
    client
      .nearbySites({ search: 'central', origin: { lat: -17.7833, lng: -63.1821 } })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/pharmacy/sites');
    expect(req.request.params.get('search')).toBe('central');
    expect(req.request.params.get('lat')).toBe('-17.7833');
    expect(req.request.params.get('lng')).toBe('-63.1821');
    req.flush({ items: [], count: 0 });
  });
});
