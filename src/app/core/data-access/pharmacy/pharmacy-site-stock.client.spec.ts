import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PharmacySiteStockClient } from './pharmacy-site-stock.client';
import type { SiteAvailability, SiteStock } from './pharmacy-site-stock.types';

const PHARMACY_ID = '620f8a13-123c-429f-9099-7220b30ece54';
const SITE_ID = '77fba9cc-93b1-4c7c-89f8-79d21f5dcf53';
const PRODUCT_ID = '2a8d27e5-4d5b-4a07-8c84-ca5d13059ffb';

describe('PharmacySiteStockClient', () => {
  let client: PharmacySiteStockClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PharmacySiteStockClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('«No lo tengo» es un PUT a la sede y el producto, sin cantidad', () => {
    let result: SiteAvailability | null = null;
    client
      .setSiteAvailability(PHARMACY_ID, SITE_ID, PRODUCT_ID, { available: false })
      .subscribe((value) => (result = value));

    const request = http.expectOne(
      `/pharmacies/${PHARMACY_ID}/sites/${SITE_ID}/products/${PRODUCT_ID}/availability`,
    );
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual({ available: false });
    const response: SiteAvailability = {
      siteId: SITE_ID,
      productId: PRODUCT_ID,
      available: false,
      quantity: 0,
      stockUpdatedAt: '2026-10-30T03:00:00.000Z',
    };
    request.flush(response);

    expect(result).toEqual(response);
  });

  it('«Lo tengo» con cantidad manda las dos claves', () => {
    client.setSiteAvailability(PHARMACY_ID, SITE_ID, PRODUCT_ID, { available: true, quantity: 3 }).subscribe();

    const request = http.expectOne((r) => r.url.endsWith('/availability'));
    expect(request.request.body).toEqual({ available: true, quantity: 3 });
    request.flush({});
  });

  it('«Lo tengo» sin cantidad no declara la clave: la API toma la del catálogo', () => {
    client.setSiteAvailability(PHARMACY_ID, SITE_ID, PRODUCT_ID, { available: true, quantity: undefined }).subscribe();

    const request = http.expectOne((r) => r.url.endsWith('/availability'));
    expect(Object.keys(request.request.body as object)).toEqual(['available']);
    request.flush({});
  });

  it('lee el stock de la sede', () => {
    let stock: SiteStock | null = null;
    client.getSiteStock(SITE_ID).subscribe((value) => (stock = value));

    const request = http.expectOne(`/pharmacy-inventory/sites/${SITE_ID}/stock`);
    expect(request.request.method).toBe('GET');
    request.flush({ siteId: SITE_ID, siteName: 'Casa central', pharmacyId: PHARMACY_ID, pharmacyName: 'F', items: [], count: 0 });

    expect(stock).toMatchObject({ siteId: SITE_ID, items: [] });
  });
});
