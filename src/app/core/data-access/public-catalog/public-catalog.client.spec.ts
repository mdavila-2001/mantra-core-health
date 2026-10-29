import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PublicCatalogClient } from './public-catalog.client';
import type { PublicBranchAvailability } from './public-catalog.types';

/**
 * P37 — el cliente de las sucursales y de la receta, contra el contrato de la
 * API real (`PublicCatalogController` en la API): la lista por `GET` y la
 * receta por `POST` con cuerpo, nunca en la URL.
 */
describe('PublicCatalogClient — sucursales y receta (P37)', () => {
  let client: PublicCatalogClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PublicCatalogClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pharmacyBranches pide GET /public/profiles/f/:slug/branches con el slug escapado', () => {
    let total: number | null | undefined;
    client.pharmacyBranches('farmacia vida').subscribe((page) => (total = page.totalHint));

    const req = http.expectOne('/public/profiles/f/farmacia%20vida/branches');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [], nextCursor: null, totalHint: 0, generatedAt: '2026-10-26T00:00:00.000Z' });
    expect(total).toBe(0);
  });

  it('prescriptionAvailability manda los renglones en el cuerpo de un POST, sin nada en la URL', () => {
    let items: readonly PublicBranchAvailability[] | undefined;
    client
      .prescriptionAvailability('farmacia-vida', ['Paracetamol 500 mg', 'Amoxicilina, 875 mg'])
      .subscribe((respuesta) => (items = respuesta));

    const req = http.expectOne('/public/profiles/f/farmacia-vida/branch-availability');
    expect(req.request.method).toBe('POST');
    expect(req.request.urlWithParams).toBe('/public/profiles/f/farmacia-vida/branch-availability');
    // Sin `lat`/`lng`: sin ubicación la búsqueda sirve igual.
    expect(req.request.body).toEqual({ items: ['Paracetamol 500 mg', 'Amoxicilina, 875 mg'] });
    req.flush({ items: [], count: 0, generatedAt: '2026-10-26T00:00:00.000Z' });
    expect(items).toEqual([]);
  });

  it('con ubicación, lat y lng viajan juntas en el mismo cuerpo', () => {
    client
      .prescriptionAvailability('farmacia-vida', ['Losartán'], { lat: -17.78, lng: -63.18 })
      .subscribe();

    const req = http.expectOne('/public/profiles/f/farmacia-vida/branch-availability');
    expect(req.request.body).toEqual({ items: ['Losartán'], lat: -17.78, lng: -63.18 });
    req.flush({ items: [], count: 0, generatedAt: '2026-10-26T00:00:00.000Z' });
  });

  it('un 400 de la API llega como error, no como lista vacía', () => {
    let fallo: unknown;
    client.prescriptionAvailability('farmacia-vida', ['x']).subscribe({ error: (e: unknown) => (fallo = e) });

    http
      .expectOne('/public/profiles/f/farmacia-vida/branch-availability')
      .flush({ code: 'VALIDATION_FAILED' }, { status: 400, statusText: 'Bad Request' });
    expect(fallo).toBeDefined();
  });
});
