import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PublicMarketplaceClient } from './public-marketplace.client';
import type { DisponibilidadDeMedicamento, PaginaDeVitrina } from './public-marketplace.types';

const SANTA_CRUZ = { lat: -17.7833, lng: -63.1821 };
const CONCEPTO = '6cec3c74-99d9-badf-f36c-3a0fe99a1daa';

const PAGINA_VACIA: PaginaDeVitrina = {
  items: [],
  total: 0,
  groups: [],
  generatedAt: '2026-08-27T16:00:00.000Z',
};

describe('PublicMarketplaceClient', () => {
  let client: PublicMarketplaceClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PublicMarketplaceClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('no declara ningún filtro que no se haya pedido', () => {
    client.listMedications().subscribe();

    const req = http.expectOne((r) => r.url === '/public/medications');
    expect(req.request.method).toBe('GET');
    // Una clave declarada en vacío no es lo mismo que una ausente: el backend
    // la lee y acota por texto vacío.
    expect(req.request.params.keys()).toEqual([]);
    req.flush(PAGINA_VACIA);
  });

  it('descarta el texto y el grupo vacíos en vez de mandarlos', () => {
    client.listMedications({ q: '', group: '' }).subscribe();

    const req = http.expectOne((r) => r.url === '/public/medications');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('group')).toBe(false);
    req.flush(PAGINA_VACIA);
  });

  it('manda el origen entero, con su radio', () => {
    client.listMedications({ origin: SANTA_CRUZ, radiusKm: 25, limit: 36 }).subscribe();

    const req = http.expectOne((r) => r.url === '/public/medications');
    expect(req.request.params.get('lat')).toBe('-17.7833');
    expect(req.request.params.get('lng')).toBe('-63.1821');
    expect(req.request.params.get('radiusKm')).toBe('25');
    expect(req.request.params.get('limit')).toBe('36');
    req.flush(PAGINA_VACIA);
  });

  it('sin origen no manda el radio: no hay desde dónde medirlo', () => {
    client.listMedications({ radiusKm: 25 }).subscribe();

    const req = http.expectOne((r) => r.url === '/public/medications');
    expect(req.request.params.has('radiusKm')).toBe(false);
    expect(req.request.params.has('lat')).toBe(false);
    req.flush(PAGINA_VACIA);
  });

  it('pide la disponibilidad por concepto y devuelve las ofertas tal cual', () => {
    let recibido: DisponibilidadDeMedicamento | null = null;
    client.getAvailability(CONCEPTO, { origin: SANTA_CRUZ }).subscribe((d) => (recibido = d));

    const req = http.expectOne((r) => r.url === `/public/medications/${CONCEPTO}/availability`);
    expect(req.request.params.get('lat')).toBe('-17.7833');
    expect(req.request.params.has('radiusKm')).toBe(false);

    req.flush({
      medication: {
        conceptId: CONCEPTO,
        atcCode: 'C09CA01',
        genericName: 'Losartán',
        therapeuticGroup: 'Aparato cardiovascular',
        brands: ['Cozaar'],
        presentations: ['50 mg · Caja x 30 comprimidos'],
        requiresPrescription: true,
        priceFrom: '67.95',
        priceTo: '92.96',
        currency: 'BOB',
        pharmacyCount: 2,
        nearestKm: 2.8,
      },
      offers: [
        {
          pharmacySlug: 'farmacia-equipetrol',
          pharmacyName: 'Farmacia Equipetrol',
          addressText: 'Av. San Martín 155',
          city: 'Santa Cruz de la Sierra',
          latitude: -17.7723,
          longitude: -63.2061,
          distanceKm: 2.8,
          brandName: 'Cozaar',
          presentation: '50 mg · Caja x 30 comprimidos',
          price: '92.96',
          currency: 'BOB',
          inStock: true,
          homeDelivery: true,
          pickup: true,
          requiresPrescription: true,
        },
      ],
      generatedAt: '2026-08-27T16:00:00.000Z',
    } satisfies DisponibilidadDeMedicamento);

    // El importe llega como texto y así se queda: convertirlo pierde centavos.
    expect(recibido!.offers[0].price).toBe('92.96');
    expect(recibido!.medication.priceFrom).toBe('67.95');
  });

  it('no lleva Authorization: es una superficie anónima y cacheable', () => {
    client.listMedications({ q: 'losartán' }).subscribe();

    const req = http.expectOne((r) => r.url === '/public/medications');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush(PAGINA_VACIA);
  });
});
