import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AdtClient } from './adt.client';

describe('AdtClient', () => {
  let client: AdtClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(AdtClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('el ingreso va por POST /clinical/admissions con la cama y el forzado', () => {
    client
      .admit({
        patientProfileId: 'p1', practiceSiteId: 's1', attendingPractitionerId: 'm1', levelOfCareCode: 'LOC_CARE_GENERAL',
        admissionSourceCode: 'ADM_SRC_EMERGENCY', reasonText: 'Neumonía', bed: { careSpaceId: 'c1', mode: 'ASSIGN' },
        override: { justification: 'x'.repeat(20), ruleCodes: ['SEX'] },
      })
      .subscribe();
    const req = http.expectOne('/clinical/admissions');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.bed).toEqual({ careSpaceId: 'c1', mode: 'ASSIGN' });
    expect(req.request.body.override.ruleCodes).toEqual(['SEX']);
    req.flush({});
  });

  it('traslado, asignación y egreso mandan If-Match del encuentro', () => {
    client.transfer('e1', 4, { toCareSpaceId: 'c2', reasonCode: 'TRF_CLINICAL' }).subscribe();
    expect(http.expectOne('/clinical/encounters/e1/transfer').request.headers.get('If-Match')).toBe('4');
    client.assignBed('e1', 5, { careSpaceId: 'c2', mode: 'ASSIGN' }).subscribe();
    expect(http.expectOne('/clinical/encounters/e1/bed-assignment').request.headers.get('If-Match')).toBe('5');
    client.discharge('e1', 6, { dischargeDispositionCode: 'DISP_HOME', occurredAt: '2026-10-31T10:00:00Z' }).subscribe();
    expect(http.expectOne('/clinical/encounters/e1/discharge').request.headers.get('If-Match')).toBe('6');
  });

  it('intercambio y cancelación usan las rutas del contrato', () => {
    client.swap({ encounterAId: 'a', encounterBId: 'b', reasonText: 'pedido' }).subscribe();
    expect(http.expectOne('/clinical/bed-swaps').request.method).toBe('POST');
    client.cancelLocation('l1', 'error').subscribe();
    expect(http.expectOne('/clinical/encounter-locations/l1/cancel').request.body).toEqual({ reasonText: 'error' });
  });

  it('censo: lectura por fecha, cierre y ajuste', () => {
    client.getCensus('s1', '2026-10-30', 'u1').subscribe();
    const lectura = http.expectOne((r) => r.url === '/sites/s1/census');
    expect(lectura.request.params.get('date')).toBe('2026-10-30');
    expect(lectura.request.params.get('unitId')).toBe('u1');
    client.closeCensus('s1', '2026-10-30').subscribe();
    expect(http.expectOne('/sites/s1/census/2026-10-30/close').request.body).toEqual({});
    client.closeCensus('s1', '2026-10-30', ['u1', 'u2']).subscribe();
    expect(http.expectOne('/sites/s1/census/2026-10-30/close').request.body).toEqual({ unitIds: ['u1', 'u2'] });
    client.adjustCensus('d1', { fieldCode: 'admissions', newValue: 2, reasonText: 'Ingreso sin registrar' }).subscribe();
    expect(http.expectOne('/census-days/d1/adjustments').request.body.fieldCode).toBe('admissions');
  });

  it('la revisión de un incidente manda REVIEWED o CLOSED (ReviewIncidentDto)', () => {
    client.reviewIncident('i1', { status: 'REVIEWED', reviewNote: 'Revisado con supervisión' }).subscribe();
    const req = http.expectOne('/clinical/placement-incidents/i1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'REVIEWED', reviewNote: 'Revisado con supervisión' });
  });

  it('indicadores con rango', () => {
    client.getIndicators('s1', '2026-10-24', '2026-10-30').subscribe();
    const req = http.expectOne((r) => r.url === '/sites/s1/inpatient-indicators');
    expect(req.request.params.get('from')).toBe('2026-10-24');
    expect(req.request.params.get('to')).toBe('2026-10-30');
  });
});
