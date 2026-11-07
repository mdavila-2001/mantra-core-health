import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ServicesGridClient } from './services-grid.client';
import type { ServicesGridPage } from './services-grid.types';

describe('ServicesGridClient', () => {
  let client: ServicesGridClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(ServicesGridClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('doctor: names the organization type and marks a next cursor as truncated', () => {
    let out: unknown;
    client.doctor().subscribe((p) => (out = p));
    http.expectOne((r) => r.url.endsWith('/admin/catalogs/services') && r.params.get('limit') === '50').flush({
      items: [{ id: 's1', code: 'C1', name: 'Consulta', practiceTypeConceptId: 't1', defaultPrice: '80.00', isActive: false }],
      count: 1, limit: 50, nextCursor: 'abc',
    });
    http.expectOne((r) => r.url.endsWith('/admin/catalogs/services/scopes')).flush({
      types: [{ conceptId: 't1', code: 'PR_TYPE_OFFICE', display: 'Consultorio' }], practices: [], currencies: [],
    });
    expect(out).toEqual({
      truncated: true,
      rows: [{ id: 's1', code: 'C1', name: 'Consulta', group: 'Consultorio', price: '80.00', statusLabel: 'Inactivo', statusTone: 'secondary' }],
    });
  });

  it('laboratory: maps the status and keeps a missing price as null', () => {
    let out: ServicesGridPage | undefined;
    client.laboratory().subscribe((p) => (out = p));
    http.expectOne((r) => r.url.endsWith('/diagnostics/lab/services')).flush({
      items: [{ id: 'l1', code: 'HEM', name: 'Hemograma', kind: 'SERVICE', price: null, status: 'DRAFT' }], count: 1,
    });
    expect(out?.rows[0]).toMatchObject({ price: null, statusLabel: 'Borrador', group: 'Estudio' });
  });

  it('pharmacy: carries truncated and joins form and strength', () => {
    let out: ServicesGridPage | undefined;
    client.pharmacy().subscribe((p) => (out = p));
    http.expectOne((r) => r.url.endsWith('/pharmacy/catalog-products')).flush({
      items: [{ id: 'm1', code: 'R1', display: 'Paracetamol', dosageForm: 'Tableta', strengthText: '500 mg', selectable: false }],
      limit: 50, truncated: true,
    });
    expect(out?.truncated).toBe(true);
    expect(out?.rows[0]).toMatchObject({ group: 'Tableta · 500 mg', statusLabel: 'No vigente' });
  });
});
