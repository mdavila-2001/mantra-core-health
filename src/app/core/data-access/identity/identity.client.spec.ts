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

  it('la organizacion viaja en la ruta y el cuerpo solo lleva la evidencia', () => {
    client.requestTenantVerification('t-1', { evidenceFileId: 'file-5' }).subscribe();

    const req = http.expectOne('/identity/me/tenants/t-1/verification');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ evidenceFileId: 'file-5' });

    req.flush({ caseId: 'c', checkId: 'ch', status: 'OPEN' });
  });

  it('lista los casos propios y convierte las fechas de cada uno', () => {
    let casos: readonly { id: string; openedAt?: Date }[] | undefined;
    client.listVerificationCases().subscribe((value) => (casos = value));

    const req = http.expectOne('/identity/me/verification-cases');
    expect(req.request.method).toBe('GET');
    req.flush([
      // El backend emite `completedAt: null` mientras el caso sigue abierto.
      { id: 'caso-1', status: 'OPEN', openedAt: '2026-07-31T12:00:00.000Z', completedAt: null },
      { id: 'caso-2', status: 'VERIFIED' },
    ]);

    expect(casos?.length).toBe(2);
    expect(casos?.[0].openedAt).toBeInstanceOf(Date);
    // `null` vale lo mismo que ausente: la clave no aparece (nada de 01/01/1970).
    expect(casos?.[0]).not.toHaveProperty('completedAt');
    // Sin fecha en el cuerpo, la clave no aparece inventada.
    expect(casos?.[1].openedAt).toBeUndefined();
  });

  it('getVerificationCase consulta por id y convierte las fechas que vengan', () => {
    let caso: { openedAt?: Date; completedAt?: Date } | undefined;
    client.getVerificationCase('caso-1').subscribe((value) => (caso = value));

    const req = http.expectOne('/identity/me/verification-cases/caso-1');
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'caso-1',
      status: 'OPEN',
      openedAt: '2026-07-31T12:00:00.000Z',
      // Asi lo manda el backend con el caso abierto: null, no ausente.
      completedAt: null,
    });

    expect(caso?.openedAt).toBeInstanceOf(Date);
    // Sin veredicto todavia la clave no debe aparecer: un `new Date(null)`
    // seria el 01/01/1970, truthy, y pasaria los @if de las pantallas.
    expect(caso).not.toHaveProperty('completedAt');
  });
});
