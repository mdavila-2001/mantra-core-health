import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ReceivedServicesClient } from './received-services.client';

const PATIENT = '11111111-1111-1111-1111-111111111111';
const URL = `/clinical/patients/${PATIENT}/received-services`;

/** Un servicio tal como lo manda el servidor (fechas como texto, sin opcionales vacíos). */
function wire(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'rs-1',
    type: 'INTERVENTION',
    typeConceptId: 'type-1',
    serviceConceptId: 'service-1',
    statusConceptId: 'status-1',
    performedAt: '2026-08-12T14:30:00.000Z',
    cost: null,
    ...overrides,
  };
}

describe('ReceivedServicesClient', () => {
  let client: ReceivedServicesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(ReceivedServicesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide GET /clinical/patients/:id/received-services sin parámetros si no se pide un tope', () => {
    client.list(PATIENT).subscribe();
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ patientProfileId: PATIENT, items: [], limit: 50, truncated: false, costsVisible: true });
  });

  it('manda el tope cuando se pide', () => {
    client.list(PATIENT, 20).subscribe();
    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.get('limit')).toBe('20');
    req.flush({ patientProfileId: PATIENT, items: [], limit: 20, truncated: false, costsVisible: true });
  });

  it('escapa el id del paciente en la ruta', () => {
    client.list('a/b').subscribe();
    http.expectOne((r) => r.url === '/clinical/patients/a%2Fb/received-services').flush({
      patientProfileId: 'a/b',
      items: [],
      limit: 50,
      truncated: false,
      costsVisible: true,
    });
  });

  it('convierte la fecha del servicio en Date', () => {
    let performedAt: Date | undefined;
    client.list(PATIENT).subscribe((page) => (performedAt = page.items[0]?.performedAt));
    http
      .expectOne((r) => r.url === URL)
      .flush({ patientProfileId: PATIENT, items: [wire()], limit: 50, truncated: false, costsVisible: true });
    expect(performedAt).toBeInstanceOf(Date);
    expect(performedAt?.toISOString()).toBe('2026-08-12T14:30:00.000Z');
  });

  it('un opcional que llega en null desaparece: no se muestra como dato', () => {
    let item: Record<string, unknown> | undefined;
    client.list(PATIENT).subscribe((page) => (item = page.items[0] as unknown as Record<string, unknown>));
    http.expectOne((r) => r.url === URL).flush({
      patientProfileId: PATIENT,
      items: [wire({ performerName: null, practiceSiteName: null, resultText: null, outcomeConceptId: null })],
      limit: 50,
      truncated: false,
      costsVisible: true,
    });
    expect('performerName' in (item ?? {})).toBe(false);
    expect('practiceSiteName' in (item ?? {})).toBe(false);
    expect('resultText' in (item ?? {})).toBe(false);
    expect('outcomeConceptId' in (item ?? {})).toBe(false);
  });

  it('un tipo que el cliente no conoce se informa como OTHER y conserva su concepto', () => {
    let item: { type: string; typeConceptId: string } | undefined;
    client.list(PATIENT).subscribe((page) => (item = page.items[0]));
    http.expectOne((r) => r.url === URL).flush({
      patientProfileId: PATIENT,
      items: [wire({ type: 'DIALYSIS', typeConceptId: 'tipo-nuevo' })],
      limit: 50,
      truncated: false,
      costsVisible: true,
    });
    expect(item).toMatchObject({ type: 'OTHER', typeConceptId: 'tipo-nuevo' });
  });

  it('reconoce intervención y vacunación', () => {
    const types: string[] = [];
    client.list(PATIENT).subscribe((page) => types.push(...page.items.map((i) => i.type)));
    http.expectOne((r) => r.url === URL).flush({
      patientProfileId: PATIENT,
      items: [wire({ type: 'INTERVENTION' }), wire({ id: 'rs-2', type: 'VACCINATION' })],
      limit: 50,
      truncated: false,
      costsVisible: true,
    });
    expect(types).toEqual(['INTERVENTION', 'VACCINATION']);
  });

  it('el importe viaja como texto decimal exacto, sin pasar por number', () => {
    let amount: unknown;
    client.list(PATIENT).subscribe((page) => (amount = page.items[0]?.cost?.amount));
    http.expectOne((r) => r.url === URL).flush({
      patientProfileId: PATIENT,
      items: [wire({ cost: { amount: '350.10', currencyCode: 'BOB', source: 'INVOICE_LINE' } })],
      limit: 50,
      truncated: false,
      costsVisible: true,
    });
    expect(amount).toBe('350.10');
  });

  it('conserva truncated y costsVisible tal cual: son parte del contrato', () => {
    let page: { truncated: boolean; costsVisible: boolean } | undefined;
    client.list(PATIENT).subscribe((p) => (page = p));
    http
      .expectOne((r) => r.url === URL)
      .flush({ patientProfileId: PATIENT, items: [], limit: 1, truncated: true, costsVisible: false });
    expect(page).toMatchObject({ truncated: true, costsVisible: false });
  });
});
