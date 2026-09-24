import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { CotizacionesFuentes } from './cotizaciones.fuentes';

/**
 * Las fuentes de Cotizaciones — H3.S1.M4 / H3.S2.M6.
 *
 * Lo que fijan: qué endpoint existente alimenta cada vertical, que el origen
 * viaja a la disponibilidad de farmacias, que todo importe sale de la
 * respuesta con su procedencia, y que lo no publicado queda en `null`.
 */
describe('CotizacionesFuentes', () => {
  let fuentes: CotizacionesFuentes;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fuentes = TestBed.inject(CotizacionesFuentes);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const BOB = { code: 'BOB', display: 'Boliviano' };

  function producto(id: string, precio: string | null) {
    return {
      productId: id,
      productCode: 'MED-PARACETAMOL',
      brandName: null,
      genericName: 'Paracetamol',
      strengthText: '500 mg',
      packageSizeText: null,
      medication: null,
      availableQuantity: 10,
      price:
        precio === null
          ? null
          : { unitAmount: precio, patientAmount: null, currency: BOB, priceListCode: 'PUBLICO' },
    };
  }

  function sede(siteId: string, distanceKm: number | null, productos: unknown[]) {
    return {
      siteId,
      siteName: `Sede ${siteId}`,
      pharmacyId: `ph-${siteId}`,
      pharmacyName: `Farmacia ${siteId}`,
      addressText: null,
      latitude: null,
      longitude: null,
      distanceKm,
      homeDeliveryAvailable: null,
      pickupAvailable: true,
      complete: true,
      availableCount: productos.length,
      missingProductIds: [],
      totalAmount: null,
      currency: BOB,
      products: productos,
    };
  }

  it('medicamentos: busca productos y pide su disponibilidad con el origen', async () => {
    const resultado = firstValueFrom(
      fuentes.buscar('paracetamol', 'MEDICAMENTOS', { source: 'home', lat: -17.8, lng: -63.2 }),
    );

    const productos = http.expectOne((r) => r.url === '/pharmacy/products');
    expect(productos.request.params.get('search')).toBe('paracetamol');
    productos.flush({ items: [{ id: 'p1' }, { id: 'p2' }], limit: 20, truncated: false });

    const disponibilidad = http.expectOne((r) => r.url === '/pharmacy-inventory/availability');
    // El nombre del contrato real (`@Query('products')`), no `productIds`.
    expect(disponibilidad.request.params.get('products')).toBe('p1,p2');
    expect(disponibilidad.request.params.get('lat')).toBe('-17.8');
    expect(disponibilidad.request.params.get('lng')).toBe('-63.2');
    disponibilidad.flush({
      requestedProductIds: ['p1', 'p2'],
      items: [
        sede('s1', 1.2, [producto('p1', '12.50'), producto('p1', '12.50')]),
        sede('s2', 3, [producto('p2', null)]),
      ],
      count: 2,
    });

    const { resultados, fuentesCaidas } = await resultado;
    expect(fuentesCaidas).toEqual([]);
    // La repetida se cuenta una sola vez.
    expect(resultados).toHaveLength(2);
    expect(resultados[0]).toMatchObject({
      vertical: 'MEDICAMENTOS',
      que: 'Paracetamol · 500 mg',
      price: {
        amount: 12.5,
        currency: 'BOB',
        source: 'Precio publicado por Farmacia s1 · dato de la maqueta',
      },
      distanceKm: 1.2,
    });
    expect(resultados[1]!.price).toBeNull();
    expect(resultados[1]!.sinPrecio).toBe('La farmacia no publicó este precio');
  });

  it('medicamentos sin productos no pide disponibilidad', async () => {
    const resultado = firstValueFrom(fuentes.buscar('nada', 'MEDICAMENTOS', null));
    http
      .expectOne((r) => r.url === '/pharmacy/products')
      .flush({ items: [], limit: 20, truncated: false });

    expect((await resultado).resultados).toEqual([]);
    http.expectNone((r) => r.url === '/pharmacy-inventory/availability');
  });

  it('análisis: abre los laboratorios y toma el tarifario del estudio que coincide', async () => {
    const resultado = firstValueFrom(fuentes.buscar('hemograma', 'ANALISIS', null));

    const centros = http.expectOne((r) => r.url === '/diagnostic-units/search');
    expect(centros.request.params.get('kind')).toBe('LABORATORY');
    centros.flush({ items: [{ id: 'u1' }], total: 1, limit: 10, offset: 0 });

    http.expectOne('/diagnostic-units/u1').flush({
      id: 'u1',
      code: 'LAB-1',
      name: 'Laboratorio Central',
      type: { code: 'LAB', display: 'Laboratorio' },
      siteCount: 1,
      equipmentCount: 0,
      studyCount: 2,
      acceptsExternalOrders: true,
      walkInAvailable: true,
      homeCollectionAvailable: false,
      sites: [],
      equipment: [],
      accreditations: [],
      studies: [
        {
          id: 'e1',
          code: 'HEMO',
          name: 'Hemograma completo',
          description: null,
          siteId: null,
          modality: null,
          preparationInstructions: null,
          expectedDurationMinutes: null,
          expectedTurnaroundMinutes: null,
          requiresMedicalOrder: false,
          prices: [{ amount: '80.00', currency: BOB, scheduleCode: 'TAR-2026', siteId: null }],
        },
        {
          id: 'e2',
          code: 'GLU',
          name: 'Glucosa',
          description: null,
          siteId: null,
          modality: null,
          preparationInstructions: null,
          expectedDurationMinutes: null,
          expectedTurnaroundMinutes: null,
          requiresMedicalOrder: false,
          prices: [],
        },
      ],
    });

    const { resultados } = await resultado;
    expect(resultados).toHaveLength(1);
    expect(resultados[0]).toMatchObject({
      vertical: 'ANALISIS',
      que: 'Hemograma completo',
      donde: 'Laboratorio Central',
      price: {
        amount: 80,
        currency: 'BOB',
        source: 'Tarifario publicado por Laboratorio Central · dato de la maqueta',
      },
      distanceKm: null,
      accion: { ruta: '/laboratory-directory/u1' },
    });
  });

  it('servicios médicos: el arancel de referencia en su unidad, sin convertir', async () => {
    const resultado = firstValueFrom(fuentes.buscar('consulta', 'SERVICIOS_MEDICOS', null));

    const arancel = http.expectOne((r) => r.url === '/billing/service-catalog/procedures');
    expect(arancel.request.params.get('q')).toBe('consulta');
    arancel.flush({
      items: [
        {
          conceptId: 'c1',
          code: 'MG-1',
          display: 'Consulta médica',
          specialty: 'Medicina general',
          group: null,
          referencePrice: '5',
          priceUnit: 'UMA',
          ocrSuspect: true,
        },
        {
          conceptId: 'c2',
          code: 'MG-2',
          display: 'Consulta domiciliaria',
          specialty: null,
          group: null,
          referencePrice: null,
          priceUnit: null,
          ocrSuspect: false,
        },
      ],
      nextCursor: null,
    });

    const { resultados } = await resultado;
    expect(resultados[0]).toMatchObject({
      price: {
        amount: 5,
        currency: 'UMA',
        source: 'Referencia del Colegio Médico de Santa Cruz 2025, en UMA (sin conversión)',
      },
      distanceKm: null,
    });
    expect(resultados[0]!.advertencia).toBeDefined();
    expect(resultados[1]!.price).toBeNull();
    expect(resultados[1]!.sinPrecio).toBe(
      'El arancel de referencia no fija precio para esta prestación',
    );
  });

  it('con «Todas» consulta las cuatro en paralelo y una caída no tira las otras', async () => {
    const resultado = firstValueFrom(fuentes.buscar('consulta', 'TODAS', null));

    http
      .expectOne((r) => r.url === '/pharmacy/products')
      .flush({ items: [], limit: 20, truncated: false });
    const centros = http.match((r) => r.url === '/diagnostic-units/search');
    expect(centros.map((c) => c.request.params.get('kind')).sort()).toEqual([
      'IMAGING',
      'LABORATORY',
    ]);
    centros[0]!.flush({ message: 'caído' }, { status: 503, statusText: 'Service Unavailable' });
    centros[1]!.flush({ items: [], total: 0, limit: 10, offset: 0 });
    http
      .expectOne((r) => r.url === '/billing/service-catalog/procedures')
      .flush({ items: [], nextCursor: null });

    const { fuentesCaidas } = await resultado;
    expect(fuentesCaidas).toHaveLength(1);
  });

  it('si ninguna fuente responde, es un error', async () => {
    const resultado = firstValueFrom(fuentes.buscar('x', 'TODAS', null));
    const caida = { status: 503, statusText: 'Service Unavailable' };
    http.expectOne((r) => r.url === '/pharmacy/products').flush({}, caida);
    for (const pedido of http.match((r) => r.url === '/diagnostic-units/search')) {
      pedido.flush({}, caida);
    }
    http.expectOne((r) => r.url === '/billing/service-catalog/procedures').flush({}, caida);

    await expect(resultado).rejects.toThrow('Ninguna fuente de cotizaciones respondió.');
  });
});
