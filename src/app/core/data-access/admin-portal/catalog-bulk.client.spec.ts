import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CatalogBulkClient } from './catalog-bulk.client';

describe('CatalogBulkClient', () => {
  let http: HttpTestingController;
  let client: CatalogBulkClient;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(CatalogBulkClient);
  });
  afterEach(() => http.verify());

  it('posts {mode, dryRun, rows} to the kind endpoint, dryRun defaulting to false', () => {
    let got: unknown;
    client.bulk('ph-1', 'prices', { mode: 'UPSERT', rows: [{ productCode: 'A', unitPrice: 1 }] }).subscribe((r) => (got = r));
    const req = http.expectOne((r) => r.url.endsWith('/pharmacies/ph-1/prices/bulk'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ mode: 'UPSERT', dryRun: false, rows: [{ productCode: 'A', unitPrice: 1 }] });
    req.flush({ dryRun: false, results: [] });
    expect(got).toEqual({ dryRun: false, results: [] });
  });

  it('reads back categories through the regular list endpoint', () => {
    let got: unknown;
    client.snapshot('ph-1', 'categories').subscribe((r) => (got = r));
    http.expectOne((r) => r.url.endsWith('/pharmacies/ph-1/categories')).flush({ items: [{ name: 'A', productCount: 2 }] });
    expect(got).toEqual([{ key: 'A', detail: '2 productos' }]);
  });

  it('has no read-back for sites', () => {
    let got: unknown = 'unset';
    client.snapshot('ph-1', 'sites').subscribe((r) => (got = r));
    expect(got).toBeNull();
  });
});
