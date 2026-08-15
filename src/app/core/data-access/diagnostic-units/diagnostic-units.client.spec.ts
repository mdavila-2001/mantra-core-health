import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DiagnosticUnitsClient } from './diagnostic-units.client';
import type { DiagnosticUnitDetail } from './diagnostic-units.types';

const CONCEPT = { code: 'DU_TYPE_LAB', display: 'Clinical laboratory unit' };
const SUMMARY = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'LAB-CENTRAL',
  name: 'Laboratorio Central',
  type: CONCEPT,
  siteCount: 1,
  equipmentCount: 1,
  studyCount: 2,
  acceptsExternalOrders: true,
  walkInAvailable: true,
  homeCollectionAvailable: false,
};

describe('DiagnosticUnitsClient', () => {
  let client: DiagnosticUnitsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(DiagnosticUnitsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets the tenant directory from the dedicated API prefix', () => {
    let count = -1;
    client.list().subscribe((result) => (count = result.count));

    const req = http.expectOne('/diagnostic-units');
    expect(req.request.method).toBe('GET');
    req.flush({ items: [SUMMARY], count: 1 });

    expect(count).toBe(1);
  });

  it('gets detail, escapes its id and converts dates', () => {
    let detail: DiagnosticUnitDetail | undefined;
    client.getById('unit/one').subscribe((result) => (detail = result));

    const req = http.expectOne('/diagnostic-units/unit%2Fone');
    expect(req.request.method).toBe('GET');
    req.flush({
      ...SUMMARY,
      sites: [],
      studies: [],
      equipment: [
        {
          id: 'eq-1',
          siteId: 'site-1',
          type: CONCEPT,
          manufacturer: 'Demo',
          model: 'A1',
          modality: null,
          operationalStatus: CONCEPT,
          lastCalibrationAt: '2026-07-01T10:00:00.000Z',
          nextCalibrationDueAt: null,
        },
      ],
      accreditations: [
        {
          id: 'acc-1',
          type: CONCEPT,
          number: 'ISO-DEMO',
          siteId: null,
          validFrom: '2026-01-10',
          validTo: null,
        },
      ],
    });

    expect(detail?.equipment[0].lastCalibrationAt).toBeInstanceOf(Date);
    expect(detail?.equipment[0].nextCalibrationDueAt).toBeNull();
    expect(detail?.accreditations[0].validFrom).toBeInstanceOf(Date);
  });
});
