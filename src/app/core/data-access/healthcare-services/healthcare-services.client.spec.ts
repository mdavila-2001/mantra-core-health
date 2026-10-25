import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { HealthcareServicesClient } from './healthcare-services.client';
import type { HealthcareServiceOffer } from './healthcare-services.types';

const OFFER: HealthcareServiceOffer = {
  id: 'o-1',
  practiceSiteId: 's-1',
  serviceConceptId: 'c-1',
  serviceDisplay: 'Endoscopía digestiva alta',
  serviceCatalogId: 'sc-1',
  price: 350,
  currencyConceptId: 'cur-1',
  referencePrice: 20,
  referenceUnit: 'UMA',
  overMargin: null,
  visibleInSearch: true,
  active: true,
};

describe('HealthcareServicesClient', () => {
  let client: HealthcareServicesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(HealthcareServicesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listOffers pide GET con practiceSiteId y devuelve items sin renombrar campos', () => {
    let result: readonly HealthcareServiceOffer[] = [];
    client.listOffers('p-1', 's-1').subscribe((items) => (result = items));

    const req = http.expectOne((r) => r.url.endsWith('/practices/p-1/healthcare-services'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('practiceSiteId')).toBe('s-1');
    req.flush({ items: [OFFER] });

    expect(result).toEqual([OFFER]);
    expect(result[0]?.serviceCatalogId).toBe('sc-1');
    expect(result[0]?.visibleInSearch).toBe(true);
  });

  it('createOffer envía exactamente practiceSiteId, serviceConceptId y serviceCatalogId', () => {
    client
      .createOffer('p-1', { practiceSiteId: 's-1', serviceConceptId: 'c-1', serviceCatalogId: 'sc-1' })
      .subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/practices/p-1/healthcare-services'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      practiceSiteId: 's-1',
      serviceConceptId: 'c-1',
      serviceCatalogId: 'sc-1',
    });
    req.flush(OFFER, { status: 201, statusText: 'Created' });
  });

  it('createOffer manda los opcionales sólo cuando vienen', () => {
    client
      .createOffer('p-1', {
        practiceSiteId: 's-1',
        serviceConceptId: 'c-1',
        serviceCatalogId: 'sc-1',
        referralRequired: true,
      })
      .subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/practices/p-1/healthcare-services'));
    expect(Object.keys(req.request.body as object).sort()).toEqual([
      'practiceSiteId',
      'referralRequired',
      'serviceCatalogId',
      'serviceConceptId',
    ]);
    req.flush(OFFER);
  });

  it('updateOffer hace PATCH con { serviceCatalogId } o con { active }', () => {
    client.updateOffer('p-1', 'o-1', { serviceCatalogId: 'sc-2' }).subscribe();
    const precio = http.expectOne((r) => r.url.endsWith('/practices/p-1/healthcare-services/o-1'));
    expect(precio.request.method).toBe('PATCH');
    expect(precio.request.body).toEqual({ serviceCatalogId: 'sc-2' });
    precio.flush(OFFER);

    client.updateOffer('p-1', 'o-1', { active: false }).subscribe();
    const activo = http.expectOne((r) => r.url.endsWith('/practices/p-1/healthcare-services/o-1'));
    expect(activo.request.body).toEqual({ active: false });
    activo.flush({ ...OFFER, active: false, visibleInSearch: false });
  });

  it('listSites pide GET /practices/:practiceId/sites y acepta array pelado o página', () => {
    const resultados: (readonly { id: string }[])[] = [];
    client.listSites('p-1').subscribe((sites) => resultados.push(sites));
    http
      .expectOne((r) => r.url.endsWith('/practices/p-1/sites'))
      .flush([{ id: 's-1', name: 'Sede Norte' }]);

    client.listSites('p-1').subscribe((sites) => resultados.push(sites));
    http
      .expectOne((r) => r.url.endsWith('/practices/p-1/sites'))
      .flush({ items: [{ id: 's-2', name: 'Sede Sur' }] });

    expect(resultados.map((sites) => sites[0]?.id)).toEqual(['s-1', 's-2']);
  });

  it('un 409 y un 422 se propagan como error, no se tragan', () => {
    const errores: number[] = [];
    for (const status of [409, 422]) {
      client
        .createOffer('p-1', { practiceSiteId: 's-1', serviceConceptId: 'c-1', serviceCatalogId: 'sc-1' })
        .subscribe({ error: (e: unknown) => errores.push((e as HttpErrorResponse).status) });
      http
        .expectOne((r) => r.url.endsWith('/practices/p-1/healthcare-services'))
        .flush({ code: 'CONFLICT' }, { status, statusText: 'Error' });
    }
    expect(errores).toEqual([409, 422]);
  });
});
