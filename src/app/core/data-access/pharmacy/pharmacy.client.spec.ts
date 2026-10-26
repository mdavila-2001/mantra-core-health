import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PharmacyClient } from './pharmacy.client';
import {
  DISPONIBILIDAD_FIXTURE,
  FIXTURE_IDS,
  PHARMACY_CONTACTS_FIXTURE,
  PHARMACY_LICENSES_FIXTURE,
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

  it('pide la carpeta de licencias de la farmacia, sin parámetros', () => {
    let vencimientos: readonly (number | null)[] = [];
    client
      .listLicenses(FIXTURE_IDS.farmaciaAndina)
      .subscribe((page) => (vencimientos = page.items.map((item) => item.daysToExpiry)));

    const req = http.expectOne(
      (r) => r.url === `/pharmacy/pharmacies/${FIXTURE_IDS.farmaciaAndina}/licenses`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(PHARMACY_LICENSES_FIXTURE);

    expect(vencimientos).toEqual([110, 13]);
  });

  it('pide el representante y las gerencias de la farmacia', () => {
    let representante: string | null = null;
    client
      .getContacts(FIXTURE_IDS.farmaciaAndina)
      .subscribe((contactos) => (representante = contactos.legalRepresentative?.fullName ?? null));

    const req = http.expectOne(
      (r) => r.url === `/pharmacy/pharmacies/${FIXTURE_IDS.farmaciaAndina}/contacts`,
    );
    expect(req.request.method).toBe('GET');
    req.flush(PHARMACY_CONTACTS_FIXTURE);

    expect(representante).toBe('María Elena Ortiz Camacho');
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

  it('edita un producto con PATCH y manda el cuerpo tal cual, `null` incluido (P47 §2)', () => {
    const changes = { brandName: 'Amoxil', genericName: null, requiresPrescription: true };
    let returned: string | null = null;
    client
      .updateProduct(FIXTURE_IDS.farmaciaAndina, FIXTURE_IDS.productoAmoxicilina, changes)
      .subscribe((product) => (returned = product.id));

    const req = http.expectOne(
      (r) => r.url === `/pharmacies/${FIXTURE_IDS.farmaciaAndina}/products/${FIXTURE_IDS.productoAmoxicilina}`,
    );
    // El verbo es el que publica la API: con `POST` o `PUT` respondería 404 o 405.
    expect(req.request.method).toBe('PATCH');
    // `null` borra el dato y una clave ausente lo deja como está: el cliente no decide nada.
    expect(req.request.body).toEqual(changes);
    req.flush({ id: FIXTURE_IDS.productoAmoxicilina });

    expect(returned).toBe(FIXTURE_IDS.productoAmoxicilina);
  });

  it('retira un producto con DELETE sobre la misma ruta que la edición (UC-24-09)', () => {
    let outcome: boolean | null = null;
    client
      .retireProduct(FIXTURE_IDS.farmaciaAndina, FIXTURE_IDS.productoAmoxicilina)
      .subscribe((reply) => (outcome = reply.ok));

    const req = http.expectOne(
      (r) => r.url === `/pharmacies/${FIXTURE_IDS.farmaciaAndina}/products/${FIXTURE_IDS.productoAmoxicilina}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({ ok: true });

    expect(outcome).toBe(true);
  });

  /*
   * P47 §3-5 (2026-10-26): lo que administra la farmacia ya está en la API.
   * Estas pruebas corren sin el simulador: la petición tiene que salir a la red
   * con el cuerpo entero, no filtrarse como extensión de la maqueta.
   */
  it('manda precio, categoría, existencias, estado e imágenes también a la API real (P47 §3-5)', () => {
    const changes = {
      unitPrice: 12.5,
      category: 'Medicamentos',
      description: null,
      inStock: false,
      status: 'DRAFT' as const,
      imageFileIds: ['f-1'],
    };
    client.updateProduct(FIXTURE_IDS.farmaciaAndina, FIXTURE_IDS.productoAmoxicilina, changes).subscribe();

    const req = http.expectOne(
      (r) => r.url === `/pharmacies/${FIXTURE_IDS.farmaciaAndina}/products/${FIXTURE_IDS.productoAmoxicilina}`,
    );
    expect(req.request.body).toEqual(changes);
    req.flush({ id: FIXTURE_IDS.productoAmoxicilina });
  });

  it('el alta con venta viaja entera a la API real (P47 §3-5)', () => {
    const draft = {
      productCode: 'AMX-1',
      genericName: 'Amoxicilina',
      unitPrice: 12.5,
      category: 'Medicamentos',
      inStock: true,
      stock: 10,
      minStock: 3,
    };
    client.publishProduct(FIXTURE_IDS.farmaciaAndina, draft).subscribe();

    const req = http.expectOne((r) => r.url === `/pharmacies/${FIXTURE_IDS.farmaciaAndina}/products`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(draft);
    req.flush({ id: 'nuevo' });
  });

  it('crea, renombra y elimina categorías contra la API real (P47 D8)', () => {
    const base = `/pharmacies/${FIXTURE_IDS.farmaciaAndina}/categories`;
    client.createCategory(FIXTURE_IDS.farmaciaAndina, 'Vitaminas').subscribe();
    const created = http.expectOne((r) => r.url === base);
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual({ name: 'Vitaminas' });
    created.flush({ id: 'c-1', name: 'Vitaminas', productCount: 0 });

    client.renameCategory(FIXTURE_IDS.farmaciaAndina, 'c-1', 'Suplementos').subscribe();
    const renamed = http.expectOne((r) => r.url === `${base}/c-1`);
    expect(renamed.request.method).toBe('PATCH');
    expect(renamed.request.body).toEqual({ name: 'Suplementos' });
    renamed.flush({ id: 'c-1', name: 'Suplementos', productCount: 0 });

    client.deleteCategory(FIXTURE_IDS.farmaciaAndina, 'c-1').subscribe();
    const deleted = http.expectOne((r) => r.url === `${base}/c-1`);
    expect(deleted.request.method).toBe('DELETE');
    deleted.flush({ ok: true });
  });

  it('guarda el inventario en lote con un único PATCH contra la API real (P47 D7)', () => {
    let updated: number | null = null;
    const lines = [
      { productId: 'p-1', stock: 4, minStock: 2 },
      { productId: 'p-2', inStock: false },
    ];
    client.updateInventory(FIXTURE_IDS.farmaciaAndina, lines).subscribe((r) => (updated = r.updated));

    const req = http.expectOne((r) => r.url === `/pharmacies/${FIXTURE_IDS.farmaciaAndina}/inventory`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ lines });
    req.flush({ updated: 2 });
    expect(updated).toBe(2);
  });

  describe('P34 · 24 h y turnos', () => {
    it('pide sólo las abiertas con openNow=true, y no lo manda si no se pidió', () => {
      client.nearbySites({ openNow: true }).subscribe();
      const con = http.expectOne((r) => r.url === '/pharmacy/sites');
      expect(con.request.params.get('openNow')).toBe('true');
      con.flush({ items: [], count: 0 });

      client.nearbySites({}).subscribe();
      const sin = http.expectOne((r) => r.url === '/pharmacy/sites');
      expect(sin.request.params.has('openNow')).toBe(false);
      sin.flush({ items: [], count: 0 });
    });

    it('open-now: modo, ciudad, origen y cursor viajan; any y vacíos no', () => {
      client
        .openNow({
          mode: 'on-call',
          city: ' La Paz ',
          origin: { lat: -16.5, lng: -68.15 },
          cursor: 'c1',
          limit: 6,
        })
        .subscribe();
      const req = http.expectOne((r) => r.url === '/public/pharmacies/open-now');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('mode')).toBe('on-call');
      expect(req.request.params.get('city')).toBe('La Paz');
      expect(req.request.params.get('lat')).toBe('-16.5');
      expect(req.request.params.get('lng')).toBe('-68.15');
      expect(req.request.params.get('cursor')).toBe('c1');
      expect(req.request.params.get('limit')).toBe('6');
      req.flush({
        items: [],
        nextCursor: null,
        asOf: '',
        asOfLocal: '',
        timeZone: 'America/La_Paz',
      });

      client.openNow({ mode: 'any', city: '  ' }).subscribe();
      const vacio = http.expectOne((r) => r.url === '/public/pharmacies/open-now');
      expect(vacio.request.params.keys()).toEqual([]);
      vacio.flush({
        items: [],
        nextCursor: null,
        asOf: '',
        asOfLocal: '',
        timeZone: 'America/La_Paz',
      });
    });

    it('lee el horario y declara 24 h con PUT, null incluido', () => {
      client.getOpeningHours('ph-1').subscribe();
      const lectura = http.expectOne('/pharmacies/ph-1/opening-hours');
      expect(lectura.request.method).toBe('GET');
      lectura.flush({ pharmacyId: 'ph-1', asOf: '', sites: [] });

      client.setOpen24h('ph-1', 's-1', null).subscribe();
      const put = http.expectOne('/pharmacies/ph-1/sites/s-1/open-24h');
      expect(put.request.method).toBe('PUT');
      expect(put.request.body).toEqual({ open24h: null });
      put.flush({});
    });

    it('carga y cancela un turno', () => {
      const draft = { startsAt: '2026-10-26T20:00:00-04:00', endsAt: '2026-10-27T08:00:00-04:00' };
      client.createOnCallShift('ph-1', 's-1', draft).subscribe();
      const alta = http.expectOne('/pharmacies/ph-1/sites/s-1/on-call-shifts');
      expect(alta.request.method).toBe('POST');
      expect(alta.request.body).toEqual(draft);
      alta.flush({});

      client.cancelOnCallShift('ph-1', 'sh-1').subscribe();
      const baja = http.expectOne('/pharmacies/ph-1/on-call-shifts/sh-1/cancel');
      expect(baja.request.method).toBe('POST');
      baja.flush({});
    });
  });
});
