import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { ProfilesClient } from './profiles.client';

describe('ProfilesClient', () => {
  let client: ProfilesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(ProfilesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('createPatient no manda las claves opcionales ausentes', () => {
    client.createPatient({ patientCode: 'PAC-1' }).subscribe();

    const req = http.expectOne('/profiles/patients');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ patientCode: 'PAC-1' });

    req.flush({
      profileId: 'pp',
      personId: 'p',
      patientCode: 'PAC-1',
      recordLinkageStatus: 'UNLINKED',
      createdAt: '2026-07-31T12:00:00.000Z',
    });
  });

  it('createPatient convierte createdAt en fecha', () => {
    let creado: Date | undefined;
    client
      .createPatient({ patientCode: 'PAC-1', displayName: 'Ana' })
      .subscribe((perfil) => (creado = perfil.createdAt));

    http.expectOne('/profiles/patients').flush({
      profileId: 'pp',
      personId: 'p',
      patientCode: 'PAC-1',
      recordLinkageStatus: 'UNLINKED',
      createdAt: '2026-07-31T12:00:00.000Z',
    });

    expect(creado).toBeInstanceOf(Date);
    expect(creado?.toISOString()).toBe('2026-07-31T12:00:00.000Z');
  });

  it('createPractitioner manda matricula y credencial, que son obligatorias', () => {
    client
      .createPractitioner({
        practitionerCode: 'PRO-1',
        licenseNumber: 'MAT-9',
        credentialNumber: 'CRED-9',
      })
      .subscribe();

    const req = http.expectOne('/profiles/practitioners');
    expect(req.request.body).toEqual({
      practitionerCode: 'PRO-1',
      licenseNumber: 'MAT-9',
      credentialNumber: 'CRED-9',
    });

    req.flush({
      profileId: 'pp',
      personId: 'p',
      practitionerCode: 'PRO-1',
      verificationStatus: 'PENDING',
      practiceStatus: 'ACTIVE',
      licenseId: 'l',
      credentialId: 'c',
      createdAt: '2026-07-31T12:00:00.000Z',
    });
  });

  it('linkAccount pone el id de la persona en la ruta y el usuario en el cuerpo', () => {
    client.linkAccount('persona-1', 'usuario-1').subscribe();

    const req = http.expectOne('/profiles/persons/persona-1/account-links');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: 'usuario-1' });

    req.flush({
      id: 'al-1',
      personId: 'persona-1',
      userId: 'usuario-1',
      status: 'ACTIVE',
      validFrom: '2026-07-31T12:00:00.000Z',
    });
  });
});
