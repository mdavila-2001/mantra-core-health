import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { forcedRealApi } from '../../mock/api-mode';
import { LabOrderIntakeClient } from './lab-order-intake.client';

describe('LabOrderIntakeClient contra la API real', () => {
  let http: HttpTestingController;
  let client: LabOrderIntakeClient;

  beforeEach(() => {
    forcedRealApi.set(true);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(LabOrderIntakeClient);
  });

  afterEach(() => {
    http.verify();
    forcedRealApi.set(false);
  });

  it('busca al paciente con el documento en el cuerpo, nunca en la URL', () => {
    client.lookupPatient('1234567').subscribe();
    const req = http.expectOne('/diagnostics/lab/patients/lookup');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ nationalId: '1234567' });
    expect(req.request.urlWithParams).not.toContain('1234567');
    req.flush({ patientProfileId: 'p-1', displayName: 'Ana', patientCode: null });
  });

  it('carga una orden con POST y la corrige con PUT sobre su id', () => {
    const fields = { codeConceptId: 'c-1', category: 'LAB' as const };
    client.createOrder({ ...fields, patientProfileId: 'p-1' }).subscribe();
    client.updateOrder('sr/1', fields).subscribe();

    const created = http.expectOne('/diagnostics/lab/orders');
    expect(created.request.method).toBe('POST');
    expect(created.request.body).toEqual({ ...fields, patientProfileId: 'p-1' });
    created.flush({});

    const edited = http.expectOne('/diagnostics/lab/orders/sr%2F1');
    expect(edited.request.method).toBe('PUT');
    expect(edited.request.body).toEqual(fields);
    edited.flush({});
  });
});
