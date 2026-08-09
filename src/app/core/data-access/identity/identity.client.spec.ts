import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IdentityClient } from './identity.client';

describe('IdentityClient', () => {
  let client: IdentityClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(IdentityClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('la verificacion del paciente no manda a quien se verifica', () => {
    client.requestPatientIdentityVerification({ evidenceFileId: 'file-1' }).subscribe();

    const req = http.expectOne('/identity/me/identity-verification');
    expect(req.request.method).toBe('POST');
    // El backend lo resuelve del usuario autenticado: mandarlo seria una via
    // para pedir la verificacion de otra persona.
    expect(req.request.body).toEqual({ evidenceFileId: 'file-1' });

    req.flush({ caseId: 'c', checkId: 'ch', status: 'OPEN' });
  });

  it('la identidad del profesional va por su propia ruta', () => {
    client.requestPractitionerIdentityVerification({ evidenceFileId: 'file-2' }).subscribe();

    http
      .expectOne('/identity/me/practitioner/identity-verification')
      .flush({ caseId: 'c', checkId: 'ch', status: 'OPEN' });
  });

  it('la matricula admite acotar la jurisdiccion y la omite si no vino', () => {
    client
      .requestPractitionerLicenseVerification({
        evidenceFileId: 'file-3',
        jurisdictionAuthorizationId: 'ja-1',
      })
      .subscribe();

    const conJurisdiccion = http.expectOne('/identity/me/practitioner/license-verification');
    expect(conJurisdiccion.request.body).toEqual({
      evidenceFileId: 'file-3',
      jurisdictionAuthorizationId: 'ja-1',
    });
    conJurisdiccion.flush({ caseId: 'c', checkId: 'ch', status: 'OPEN' });

    client.requestPractitionerLicenseVerification({ evidenceFileId: 'file-4' }).subscribe();

    const sinJurisdiccion = http.expectOne('/identity/me/practitioner/license-verification');
    expect(sinJurisdiccion.request.body).toEqual({ evidenceFileId: 'file-4' });
    sinJurisdiccion.flush({ caseId: 'c', checkId: 'ch', status: 'OPEN' });
  });

  it('getVerificationCase consulta por id y convierte las fechas que vengan', () => {
    let caso: { openedAt?: Date; completedAt?: Date } | undefined;
    client.getVerificationCase('caso-1').subscribe((value) => (caso = value));

    const req = http.expectOne('/identity/me/verification-cases/caso-1');
    expect(req.request.method).toBe('GET');
    req.flush({ id: 'caso-1', status: 'OPEN', openedAt: '2026-07-31T12:00:00.000Z' });

    expect(caso?.openedAt).toBeInstanceOf(Date);
    // Sin veredicto todavia: la clave no debe aparecer inventada.
    expect(caso?.completedAt).toBeUndefined();
  });
});
