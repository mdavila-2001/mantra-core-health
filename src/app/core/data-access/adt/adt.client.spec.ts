import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AdtClient } from './adt.client';
import { adtErrorToViewState, adtMessage, readAdtError } from './adt.errors';

describe('AdtClient', () => {
  let client: AdtClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(AdtClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('el ingreso va por POST /clinical/admissions, sin If-Match y sin claves vacías', () => {
    client
      .admit({ patientProfileId: 'p', practiceSiteId: 's', attendingPractitionerId: 'a', levelOfCareCode: 'LOC_CARE_GENERAL', admissionSourceCode: 'ADM_SRC_EMERGENCY', reasonText: 'x', isolationOrganismText: '' })
      .subscribe();
    const req = http.expectOne('/clinical/admissions');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.has('If-Match')).toBe(false);
    expect('isolationOrganismText' in req.request.body).toBe(false);
    req.flush({});
  });

  it('asignar, trasladar y egresar llevan If-Match con la versión del encuentro', () => {
    client.assignBed('e1', 4, { careSpaceId: 'c', mode: 'ASSIGN' }).subscribe();
    const a = http.expectOne('/clinical/encounters/e1/bed-assignment');
    expect(a.request.headers.get('If-Match')).toBe('4');
    a.flush({});

    client.transfer('e1', 5, { toCareSpaceId: 'c', reasonCode: 'ADT_RSN_CLINICAL' }).subscribe();
    const t = http.expectOne('/clinical/encounters/e1/transfer');
    expect(t.request.headers.get('If-Match')).toBe('5');
    expect(t.request.body.toCareSpaceId).toBe('c');
    t.flush({});

    client.discharge('e1', 6, { dischargeDispositionCode: 'DISP_HOME', occurredAt: '2026-10-29T12:00:00Z' }).subscribe();
    expect(http.expectOne('/clinical/encounters/e1/discharge').request.headers.get('If-Match')).toBe('6');
  });

  it('el intercambio y la cancelación no llevan If-Match', () => {
    client.swap({ encounterAId: 'a', encounterBId: 'b', reasonText: 'x' }).subscribe();
    const s = http.expectOne('/clinical/bed-swaps');
    expect(s.request.headers.has('If-Match')).toBe(false);
    s.flush({ locations: [] });
    client.cancelLocation('l1', { reasonText: 'x' }).subscribe();
    expect(http.expectOne('/clinical/encounter-locations/l1/cancel').request.method).toBe('POST');
  });

  it('escapa los ids y arma las consultas del censo y los indicadores', () => {
    client.getCensus('s/1', '2026-10-28', 'u1').subscribe();
    const c = http.expectOne((r) => r.url === '/sites/s%2F1/census');
    expect(c.request.params.get('date')).toBe('2026-10-28');
    expect(c.request.params.get('unitId')).toBe('u1');
    c.flush({});
    client.getIndicators('s1', '2026-10-01', '2026-10-07').subscribe();
    const i = http.expectOne((r) => r.url === '/sites/s1/inpatient-indicators');
    expect(i.request.params.get('from')).toBe('2026-10-01');
    expect(i.request.params.has('unitId')).toBe(false);
    i.flush({});
  });

  it('cerrar el censo y ajustarlo usan las rutas del contrato', () => {
    client.closeCensus('s1', '2026-10-28').subscribe();
    const cierre = http.expectOne('/sites/s1/census/2026-10-28/close');
    expect(cierre.request.body).toEqual({});
    cierre.flush({ closed: [] });
    client.adjustCensus('d1', { fieldCode: 'admissions', newValue: 3, reasonText: 'x' }).subscribe();
    expect(http.expectOne('/census-days/d1/adjustments').request.body.newValue).toBe(3);
  });

  it('el censo vivo acepta un arreglo o una página', () => {
    let pagina: unknown;
    client.listInpatients('s1').subscribe((p) => (pagina = p));
    http.expectOne((r) => r.url === '/sites/s1/inpatients').flush([]);
    expect(pagina).toMatchObject({ items: [], nextCursor: null });
  });

  it('lee el reason, las violaciones y los roles de un fallo, y los traduce a S4/S5', () => {
    const error = new HttpErrorResponse({
      status: 409,
      error: {
        statusCode: 409,
        code: 'CONFLICT',
        message: 'x',
        correlationId: 'req-1',
        details: { reason: 'BED_NOT_ASSIGNABLE', violations: [{ rule: 'OCCUPANCY', severity: 'BLOCKING', detail: 'ocupada' }, { rule: 'NOPE', detail: 1 }] },
      },
    });
    const d = readAdtError(error)!;
    expect(d.reason).toBe('BED_NOT_ASSIGNABLE');
    expect(d.violations).toHaveLength(1);
    expect(d.requestId).toBe('req-1');
    const estado = adtErrorToViewState(error);
    expect(estado).toMatchObject({ status: 'validation', requestId: 'req-1' });

    const sinPermiso = new HttpErrorResponse({
      status: 403,
      error: { statusCode: 403, code: 'FORBIDDEN', message: 'No', details: { reason: 'INFRA_ACTION_NOT_ALLOWED', requiredRoles: ['NURSE'] } },
    });
    expect(readAdtError(sinPermiso)?.requiredRoles).toEqual(['NURSE']);
    expect(adtErrorToViewState(sinPermiso).status).toBe('forbidden');
    expect(adtErrorToViewState(new HttpErrorResponse({ status: 0 })).status).toBe('offline');
    expect(adtErrorToViewState(new HttpErrorResponse({ status: 412, error: { statusCode: 412, code: 'CONCURRENCY_CONFLICT', message: 'x' } }))).toMatchObject({ status: 'validation' });
  });

  it('todo reason del contrato tiene mensaje propio salvo los de permisos', () => {
    expect(adtMessage('CENSUS_ALREADY_CLOSED')).toContain('cerrado');
    expect(adtMessage(null)).toBeNull();
  });
});
