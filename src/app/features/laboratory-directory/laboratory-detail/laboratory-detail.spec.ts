import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { LaboratoryDetail } from './laboratory-detail';

const UNIT_ID = '11111111-1111-4111-8111-111111111111';
const SITE_ID = '22222222-2222-4222-8222-222222222222';
const DETAIL = {
  id: UNIT_ID,
  code: 'LAB-CENTRAL',
  name: 'Laboratorio Central Mantra',
  type: { code: 'DU_TYPE_LAB', display: 'Clinical laboratory unit' },
  siteCount: 1,
  equipmentCount: 1,
  studyCount: 1,
  acceptsExternalOrders: true,
  walkInAvailable: true,
  homeCollectionAvailable: true,
  sites: [
    {
      id: SITE_ID,
      code: 'CENTRO',
      name: 'Sede Centro',
      role: { code: 'DU_SITE_PRIMARY', display: 'Sede principal' },
      sampleCollectionAvailable: true,
      imagingAvailable: false,
    },
  ],
  equipment: [
    {
      id: '33333333-3333-4333-8333-333333333333',
      siteId: SITE_ID,
      type: { code: 'DU_EQ_ANALYZER', display: 'Analizador automatizado' },
      manufacturer: 'DemoLab',
      model: 'Analyzer 500',
      modality: { code: 'DU_MODALITY_LAB', display: 'Laboratorio' },
      operationalStatus: { code: 'DU_EQ_OPERATIONAL', display: 'Operativo' },
      lastCalibrationAt: '2026-07-01T10:00:00.000Z',
      nextCalibrationDueAt: '2027-07-01T10:00:00.000Z',
    },
  ],
  studies: [
    {
      id: '44444444-4444-4444-8444-444444444444',
      code: 'HEM-COMP',
      name: 'Hemograma completo',
      description: 'Conteo automatizado.',
      siteId: SITE_ID,
      modality: { code: 'DU_MODALITY_LAB', display: 'Laboratorio' },
      preparationInstructions: 'No requiere ayuno.',
      expectedDurationMinutes: 15,
      expectedTurnaroundMinutes: 240,
      requiresMedicalOrder: false,
      prices: [
        {
          amount: '85.00',
          currency: { code: 'DU_CUR_BOB', display: 'Boliviano' },
          scheduleCode: 'PUBLIC-LAB',
          siteId: SITE_ID,
        },
      ],
    },
  ],
  accreditations: [
    {
      id: '55555555-5555-4555-8555-555555555555',
      type: { code: 'DU_ACC_ISO15189', display: 'ISO 15189' },
      number: 'ISO-DEMO',
      siteId: SITE_ID,
      validFrom: '2026-01-01',
      validTo: '2028-01-01',
    },
  ],
};

describe('LaboratoryDetail', () => {
  let fixture: ComponentFixture<LaboratoryDetail>;
  let http: HttpTestingController;

  function mount(unitId: string | null = UNIT_ID): void {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ unitId: unitId ?? '' })) },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(LaboratoryDetail);
    fixture.detectChanges();
  }

  afterEach(() => http?.verify());

  it('renders sites, equipment, studies, public prices and accreditation', () => {
    mount();
    http.expectOne(`/diagnostic-units/${UNIT_ID}`).flush(DETAIL);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sede Centro');
    expect(text).toContain('Analyzer 500');
    expect(text).toContain('Hemograma completo');
    expect(text).toContain('85.00 Boliviano');
    expect(text).toContain('ISO-DEMO');
  });

  it('does not expose any technical UUID in visible profile text', () => {
    mount();
    http.expectOne(`/diagnostic-units/${UNIT_ID}`).flush(DETAIL);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).not.toContain(UNIT_ID);
    expect(text).not.toContain(SITE_ID);
  });

  it('maps a cross-tenant/not-found response to the neutral not-found state', () => {
    mount();
    http
      .expectOne(`/diagnostic-units/${UNIT_ID}`)
      .flush({ code: 'NOT_FOUND', message: 'not found' }, { status: 404, statusText: 'Not Found' });

    const component = fixture.componentInstance as unknown as Record<
      string,
      () => { status: string }
    >;
    expect(component['state']().status).toBe('not-found');
  });

  it('does not call the API when the route has no id', () => {
    mount(null);
    http.verify();
  });
});
