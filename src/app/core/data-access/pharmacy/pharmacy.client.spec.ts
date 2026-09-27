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

  it('obtiene el perfil de una farmacia por id', () => {
    let sitios = -1;
    client.getPharmacy(FIXTURE_IDS.farmaciaAndina).subscribe((detalle) => (sitios = detalle.sites.length));

    const req = http.expectOne((r) => r.url === `/pharmacy/pharmacies/${FIXTURE_IDS.farmaciaAndina}`);
    expect(req.request.method).toBe('GET');
    req.flush({
      id: FIXTURE_IDS.farmaciaAndina,
      code: 'FARM_ANDINA',
      name: 'Farmacia Andina',
      legalName: 'Farmacia Andina S.R.L.',
      type: null,
      siteCount: 1,
      productCount: 2,
      homeDeliveryAvailable: true,
      pickupAvailable: true,
      sites: [
        {
          id: FIXTURE_IDS.sedeCentro,
          code: 'S1',
          name: 'Sucursal Centro',
          addressText: 'Calle Libertad 245',
          latitude: -17.7833,
          longitude: -63.1821,
        },
      ],
    });

    expect(sitios).toBe(1);
  });

  it('pide los precios de una sede sin declarar `product` cuando no viene', () => {
    let count = -1;
    client.getSitePrices(FIXTURE_IDS.sedeCentro).subscribe((precios) => (count = precios.count));

    const req = http.expectOne((r) => r.url === `/pharmacy/sites/${FIXTURE_IDS.sedeCentro}/prices`);
    expect(req.request.method).toBe('GET');
    // Un opcional en `undefined` que viaja como clave declarada vuelve 400.
    expect(req.request.params.has('product')).toBe(false);
    req.flush({
      siteId: FIXTURE_IDS.sedeCentro,
      siteName: 'Sucursal Centro',
      pharmacyId: FIXTURE_IDS.farmaciaAndina,
      pharmacyName: 'Farmacia Andina',
      items: [],
      count: 0,
    });

    expect(count).toBe(0);
  });

  it('acota los precios de una sede a un producto cuando `productId` viene', () => {
    client.getSitePrices(FIXTURE_IDS.sedeCentro, FIXTURE_IDS.productoAmoxicilina).subscribe();

    const req = http.expectOne((r) => r.url === `/pharmacy/sites/${FIXTURE_IDS.sedeCentro}/prices`);
    expect(req.request.params.get('product')).toBe(FIXTURE_IDS.productoAmoxicilina);
    req.flush({
      siteId: FIXTURE_IDS.sedeCentro,
      siteName: 'Sucursal Centro',
      pharmacyId: FIXTURE_IDS.farmaciaAndina,
      pharmacyName: 'Farmacia Andina',
      items: [],
      count: 0,
    });
  });

  it('devuelve `requiresPrescription` y el precio tal cual los sirve la sede', () => {
    let requierePrescripcion: boolean | null = null;
    let unitAmount = '';
    client.getSitePrices(FIXTURE_IDS.sedeCentro).subscribe((precios) => {
      requierePrescripcion = precios.items[0].requiresPrescription;
      unitAmount = precios.items[0].unitAmount;
    });

    const req = http.expectOne((r) => r.url === `/pharmacy/sites/${FIXTURE_IDS.sedeCentro}/prices`);
    req.flush({
      siteId: FIXTURE_IDS.sedeCentro,
      siteName: 'Sucursal Centro',
      pharmacyId: FIXTURE_IDS.farmaciaAndina,
      pharmacyName: 'Farmacia Andina',
      items: [
        {
          productId: FIXTURE_IDS.productoAmoxicilina,
          productCode: 'AMX-500-CAP',
          brandName: 'Amoxil',
          genericName: 'Amoxicilina',
          strengthText: '500 mg',
          packageSizeText: 'Caja x 21 cápsulas',
          medication: { code: 'MESH-AMOX', display: 'Amoxicilina' },
          requiresPrescription: true,
          unitAmount: '68.00',
          patientAmount: '68.00',
          currency: { code: 'BOB', display: 'Boliviano' },
          priceListCode: 'PUBLICO-2026',
        },
      ],
      count: 1,
    });

    expect(requierePrescripcion).toBe(true);
    expect(unitAmount).toBe('68.00');
  });
});
