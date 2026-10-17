import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AssistedPractitionerClient } from './assisted-practitioner.client';
import type { AssistedPractitionerResult } from './assisted-practitioner.types';

const URL = '/iam/users/assisted-practitioner-registration';

const MINIMO = {
  email: 'dra.rojas@mantra.test',
  name: 'Ana',
  lastName: 'Rojas',
  licenseNumber: 'SEDES-1234',
  nationalId: '1234567',
  issuerAdministrativeAreaConceptId: 'dep-sc',
  reason: 'Alta cargada por el equipo de operaciones',
};

const RESPUESTA = {
  userId: 'u-1',
  personId: 'p-1',
  practitionerProfileId: 'pp-1',
  practitionerCode: 'DOC-0001',
  licenseId: 'l-1',
  verificationStatus: 'PENDING',
  activationToken: 'tok-1',
  activationExpiresAt: '2026-10-24T10:00:00Z',
  clinicalRoles: ['CLINICIAN'],
};

describe('AssistedPractitionerClient', () => {
  let client: AssistedPractitionerClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(AssistedPractitionerClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('va a /iam/users/assisted-practitioner-registration y no manda contraseña', () => {
    client.register(MINIMO).subscribe();

    const req = http.expectOne(URL);
    expect(req.request.method).toBe('POST');
    // El titular fija su clave al activar: acá no viaja ninguna.
    expect('password' in (req.request.body as object)).toBe(false);
    expect(req.request.body).toEqual(MINIMO);
    req.flush(RESPUESTA);
  });

  it('no manda claves vacías: opcionales ausentes, listas vacías y nada más', () => {
    client.register({ ...MINIMO, specialtyConceptIds: [], clinicalRoles: [] }).subscribe();

    const body = http.expectOne(URL).request.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(Object.keys(MINIMO).sort());
  });

  it('manda las partes del nombre, las especialidades y los roles cuando hay', () => {
    client
      .register({
        ...MINIMO,
        middleName: 'Lucía',
        motherLastName: 'Vaca',
        specialtyConceptIds: ['esp-1'],
        clinicalRoles: ['CLINICIAN'],
      })
      .subscribe();

    expect(http.expectOne(URL).request.body).toMatchObject({
      middleName: 'Lucía',
      motherLastName: 'Vaca',
      specialtyConceptIds: ['esp-1'],
      clinicalRoles: ['CLINICIAN'],
    });
  });

  it('devuelve la caducidad como fecha y los roles concedidos', () => {
    let resultado: AssistedPractitionerResult | undefined;
    client.register(MINIMO).subscribe((r) => (resultado = r));

    http.expectOne(URL).flush(RESPUESTA);

    expect(resultado?.activationExpiresAt).toBeInstanceOf(Date);
    expect(resultado?.activationToken).toBe('tok-1');
    expect(resultado?.verificationStatus).toBe('PENDING');
    expect(resultado?.clinicalRoles).toEqual(['CLINICIAN']);
  });

  it('sin `clinicalRoles` en la respuesta, devuelve una lista vacía y no undefined', () => {
    let resultado: AssistedPractitionerResult | undefined;
    client.register(MINIMO).subscribe((r) => (resultado = r));

    const { clinicalRoles: _omitido, ...sinRoles } = RESPUESTA;
    http.expectOne(URL).flush(sinRoles);

    expect(resultado?.clinicalRoles).toEqual([]);
  });
});
