import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PractitionerAccessClient } from './practitioner-access.client';

/**
 * El acceso por especialidad: lo pide el profesional y lo decide el paciente.
 * Se fija la forma de cada pedido; qué responde la API lo relee el buzón.
 */
describe('PractitionerAccessClient', () => {
  let client: PractitionerAccessClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PractitionerAccessClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requestAccess publica el paciente, las especialidades pedidas y el motivo', () => {
    let done = false;
    client
      .requestAccess({ patientProfileId: 'p-1', specialtyConceptIds: ['esp-1', 'esp-2'], reasonText: 'Control' })
      .subscribe(() => (done = true));

    const req = http.expectOne('/consent/practitioner-access-requests');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      patientProfileId: 'p-1',
      specialtyConceptIds: ['esp-1', 'esp-2'],
      reasonText: 'Control',
    });
    req.flush({ id: 'pa-1' }, { status: 201, statusText: 'Created' });
    expect(done).toBe(true);
  });

  it('decide lleva la decisión y lo autorizado al id de la solicitud', () => {
    client.decide('pa/1', { decision: 'ACCEPTED', authorizedSpecialtyConceptIds: ['esp-1'] }).subscribe();

    const req = http.expectOne('/consent/practitioner-access-requests/pa%2F1/decision');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'ACCEPTED', authorizedSpecialtyConceptIds: ['esp-1'] });
    req.flush({ ok: true });
  });

  it('revoke pega contra la ruta de revocación del id', () => {
    client.revoke('pa-1').subscribe();

    const req = http.expectOne('/consent/practitioner-access-requests/pa-1/revoke');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ ok: true });
  });
});
