import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { IamClient } from './iam.client';

describe('IamClient', () => {
  let client: IamClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(IamClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  describe('login dual', () => {
    it('con correo manda solo el correo, nunca el documento', () => {
      client.login({ kind: 'email', email: 'admin@mantra.test', password: 'secreto' }).subscribe();

      const req = http.expectOne('/iam/auth/login');
      expect(req.request.method).toBe('POST');
      // forbidNonWhitelisted: un campo de mas devuelve 400.
      expect(req.request.body).toEqual({ email: 'admin@mantra.test', password: 'secreto' });
      expect('nationalId' in req.request.body).toBe(false);

      req.flush({ accessToken: 'a', refreshToken: 'r', expiresAt: '2026-07-31T12:00:00.000Z' });
    });

    it('con documento manda solo el documento, nunca el correo', () => {
      client.login({ kind: 'nationalId', nationalId: '1234567', password: 'secreto' }).subscribe();

      const req = http.expectOne('/iam/auth/login');
      expect(req.request.body).toEqual({ nationalId: '1234567', password: 'secreto' });
      expect('email' in req.request.body).toBe(false);

      req.flush({ accessToken: 'a', refreshToken: 'r', expiresAt: '2026-07-31T12:00:00.000Z' });
    });

    it('incluye el codigo MFA solo cuando se aporta', () => {
      client
        .login({ kind: 'email', email: 'a@b.test', password: 'p', mfaCode: '123456' })
        .subscribe();

      const req = http.expectOne('/iam/auth/login');
      expect(req.request.body.mfaCode).toBe('123456');

      req.flush({ accessToken: 'a', refreshToken: 'r', expiresAt: '2026-07-31T12:00:00.000Z' });
    });

    it('convierte la expiracion en fecha: el texto ISO es del transporte', () => {
      let session: { expiresAt: Date } | undefined;
      client
        .login({ kind: 'email', email: 'a@b.test', password: 'p' })
        .subscribe((value) => (session = value));

      http.expectOne('/iam/auth/login').flush({
        accessToken: 'token-de-acceso',
        refreshToken: 'token-de-refresco',
        expiresAt: '2026-07-31T12:00:00.000Z',
      });

      expect(session?.expiresAt).toBeInstanceOf(Date);
      expect(session?.expiresAt.toISOString()).toBe('2026-07-31T12:00:00.000Z');
    });
  });

  it('refresh rota el par contra la ruta del backend', () => {
    client.refresh('token-viejo').subscribe();

    const req = http.expectOne('/iam/auth/token/refresh');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ refreshToken: 'token-viejo' });

    req.flush({ accessToken: 'a', refreshToken: 'r', expiresAt: '2026-07-31T12:00:00.000Z' });
  });

  /**
   * Un municipio de `VS_BO_MUNICIPALITY`.
   *
   * Va en los dos casos porque el contrato lo declara **obligatorio**, igual que
   * el DTO del servidor: un alta sin él vuelve con 400.
   */
  const MUNICIPIO = 'ee4f2681-6c58-5f4c-8f83-8d19de56099a';

  /** Los cinco campos que la API exige además del documento (ID-21). */
  const EXIGIDOS = {
    email: 'ana@mantra.test',
    birthDate: '1990-04-12',
    phone: '+591 70012345',
    sexAtBirth: 'FEMALE',
    issuerAdministrativeAreaConceptId: 'c0a80101-0000-4000-8000-000000000001',
  } as const;

  describe('registerPatient', () => {
    it('manda solo los campos obligatorios cuando no hay opcionales', () => {
      client
        .registerPatient({
          nationalId: '1234567',
          password: 'secreto12',
          name: 'Ana',
          lastName: 'Paz',
          ...EXIGIDOS,
          residenceMunicipalityConceptId: MUNICIPIO,
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-patient');
      expect(req.request.method).toBe('POST');
      // El nombre viaja en partes y el backend compone el visible: el segundo
      // nombre y el apellido materno no se mandan si no vinieron.
      expect(req.request.body).toEqual({
        nationalId: '1234567',
        password: 'secreto12',
        name: 'Ana',
        lastName: 'Paz',
        ...EXIGIDOS,
        residenceMunicipalityConceptId: MUNICIPIO,
      });

      req.flush({
        userId: 'u',
        personId: 'p',
        patientProfileId: 'pp',
        patientCode: 'PAC-1',
        emailVerificationSent: false,
      });
    });

    it('agrega los opcionales solo si vinieron', () => {
      client
        .registerPatient({
          nationalId: '1234567',
          password: 'secreto12',
          name: 'Ana',
          middleName: 'María',
          lastName: 'Paz',
          motherLastName: 'Quiroga',
          ...EXIGIDOS,
          residenceMunicipalityConceptId: MUNICIPIO,
          guardianName: 'Rosa Quispe',
          guardianRelationshipConceptId: 'd7c1a94e-5b32-5d68-9f11-3ac52e8b6d40',
          billingTaxId: '1023456789',
          billingLegalName: 'Empresa SRL',
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-patient');
      expect(req.request.body.email).toBe('ana@mantra.test');
      expect(req.request.body.birthDate).toBe('1990-04-12');
      expect(req.request.body.middleName).toBe('María');
      expect(req.request.body.motherLastName).toBe('Quiroga');
      // El cuerpo se re-proyecta campo por campo, así que un campo del contrato
      // que esta lista no repita se descarta EN SILENCIO. El parentesco y la
      // razón social entran acá para que ese olvido se vea en la prueba y no en
      // producción — la razón social se descartaba así, y su prueba de pantalla
      // llevaba en rojo desde entonces.
      expect(req.request.body.guardianRelationshipConceptId).toBe(
        'd7c1a94e-5b32-5d68-9f11-3ac52e8b6d40',
      );
      expect(req.request.body.billingTaxId).toBe('1023456789');
      expect(req.request.body.billingLegalName).toBe('Empresa SRL');
      expect('timeZone' in req.request.body).toBe(false);

      req.flush({
        userId: 'u',
        personId: 'p',
        patientProfileId: 'pp',
        patientCode: 'PAC-1',
        emailVerificationSent: true,
      });
    });
  });

  it('verifyEmail manda el token en el cuerpo', () => {
    client.verifyEmail('tok-123').subscribe();

    const req = http.expectOne('/iam/auth/verify-email');
    expect(req.request.body).toEqual({ token: 'tok-123' });

    req.flush({ userId: 'u', emailVerified: true });
  });

  it('activate usa los nombres del contrato del backend', () => {
    client.activate({ activationToken: 'tok', newPassword: 'nueva-clave' }).subscribe();

    const req = http.expectOne('/iam/auth/activate');
    expect(req.request.body).toEqual({ activationToken: 'tok', newPassword: 'nueva-clave' });

    req.flush({ userId: 'u', status: 'ACTIVE', activated: true });
  });

  it('createUser va a /iam/users', () => {
    client
      .createUser({ displayName: 'Bruno', email: 'bruno@mantra.test', password: 'secreto12' })
      .subscribe();

    const req = http.expectOne('/iam/users');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      displayName: 'Bruno',
      email: 'bruno@mantra.test',
      password: 'secreto12',
    });

    req.flush({ id: 'u-1' });
  });

  it('createUser omite los opcionales que no se completaron', () => {
    // `forbidNonWhitelisted` rechaza lo que sobra, pero un `undefined` explícito
    // tampoco sirve: viaja como ausencia en JSON y ensucia la comparación acá.
    client
      .createUser({
        displayName: 'Bruno',
        email: 'bruno@mantra.test',
        password: 'secreto12',
        phone: '+591 700 00000',
        initialRole: 'SECURITY_ADMIN',
      })
      .subscribe();

    const req = http.expectOne('/iam/users');
    expect(req.request.body).toEqual({
      displayName: 'Bruno',
      email: 'bruno@mantra.test',
      password: 'secreto12',
      phone: '+591 700 00000',
      initialRole: 'SECURITY_ADMIN',
    });

    req.flush({
      id: 'u-1',
      displayName: 'Bruno',
      status: 'c-1',
      createdAt: '2026-08-04T10:00:00Z',
    });
  });

  it('createUser nombra el estado como lo que es: un concept id, no una etiqueta', () => {
    let creado: { statusConceptId: string; createdAt: Date } | undefined;
    client
      .createUser({ displayName: 'Bruno', email: 'b@m.test', password: 'secreto12' })
      .subscribe((r) => (creado = r));

    http.expectOne('/iam/users').flush({
      id: 'u-1',
      displayName: 'Bruno',
      status: 'c-1',
      createdAt: '2026-08-04T10:00:00Z',
    });

    expect(creado?.statusConceptId).toBe('c-1');
    // La fecha llega como texto por el transporte y sale como fecha.
    expect(creado?.createdAt).toBeInstanceOf(Date);
  });

  it('assistedRegistration va a /iam/users/assisted-registration y no manda contraseña', () => {
    client
      .assistedRegistration({
        name: 'Ana',
        lastName: 'Paciente',
        email: 'ana@mantra.test',
        reason: 'No puede registrarse por sí misma',
      })
      .subscribe();

    const req = http.expectOne('/iam/users/assisted-registration');
    expect(req.request.method).toBe('POST');
    // El titular fija su clave al activar: acá no viaja ninguna.
    expect(req.request.body).toEqual({
      name: 'Ana',
      lastName: 'Paciente',
      email: 'ana@mantra.test',
      reason: 'No puede registrarse por sí misma',
    });

    req.flush({
      userId: 'u-2',
      activationToken: 'tok-1',
      activationExpiresAt: '2026-08-05T10:00:00Z',
      status: 'PENDING_ACTIVATION',
    });
  });

  it('assistedRegistration devuelve la caducidad como fecha, no como texto', () => {
    let resultado: { activationExpiresAt: Date } | undefined;
    client
      .assistedRegistration({
        name: 'Ana',
        lastName: 'Paciente',
        email: 'a@m.test',
        reason: 'motivo',
      })
      .subscribe((r) => (resultado = r));

    http.expectOne('/iam/users/assisted-registration').flush({
      userId: 'u-2',
      activationToken: 'tok-1',
      activationExpiresAt: '2026-08-05T10:00:00Z',
      status: 'PENDING_ACTIVATION',
    });

    // La pantalla tiene que poder decir cuándo vence sin volver a parsear.
    expect(resultado?.activationExpiresAt).toBeInstanceOf(Date);
  });

  describe('registerOrganization', () => {
    const RESPUESTA = {
      tenantId: 't-1',
      code: 'ANDINA-SALUD',
      ownerUserId: 'u-1',
      status: 'pending',
      emailVerificationSent: true,
    };

    /** El bloque `payer` sin la casa matriz georreferenciada (subtarea 1.3). */
    const PAYER_SIN_UBICACION = {
      carrierCode: 'CARRIER-AS',
      regulatorIdentifier: 'NIT-123456',
      sigla: 'AS',
      address: 'Av. Siempre Viva 123',
    };

    it('con la casa matriz confirmada, manda latitude y longitude dentro de payer', () => {
      client
        .registerOrganization({
          code: 'ANDINA-SALUD',
          legalName: 'Andina Salud S.A.',
          legalEntityType: 'SRL',
          payer: { ...PAYER_SIN_UBICACION, latitude: -17.7833, longitude: -63.1821 },
          owner: { email: 'a@m.test', password: 'secreto12', name: 'Ana', lastName: 'Paz' },
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.payer).toEqual({
        ...PAYER_SIN_UBICACION,
        latitude: -17.7833,
        longitude: -63.1821,
      });

      req.flush(RESPUESTA);
    });

    it('sin la casa matriz, payer no lleva latitude ni longitude', () => {
      client
        .registerOrganization({
          code: 'ANDINA-SALUD',
          legalName: 'Andina Salud S.A.',
          legalEntityType: 'SRL',
          payer: PAYER_SIN_UBICACION,
          owner: { email: 'a@m.test', password: 'secreto12', name: 'Ana', lastName: 'Paz' },
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.payer).toEqual(PAYER_SIN_UBICACION);
      expect('latitude' in req.request.body.organization.payer).toBe(false);
      expect('longitude' in req.request.body.organization.payer).toBe(false);

      req.flush(RESPUESTA);
    });

    it('la aseguradora sigue mandando tenantType PAYER y su bloque payer, sin diagnosticUnit', () => {
      client
        .registerOrganization({
          code: 'ANDINA-SALUD',
          legalName: 'Andina Salud S.A.',
          legalEntityType: 'SRL',
          payer: PAYER_SIN_UBICACION,
          owner: { email: 'a@m.test', password: 'secreto12', name: 'Ana', lastName: 'Paz' },
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.tenantType).toBe('PAYER');
      expect(req.request.body.organization.diagnosticUnit).toBeUndefined();
      expect(req.request.body.organization.countryConceptId).toBeUndefined();

      req.flush(RESPUESTA);
    });

    it('un centro diagnóstico manda su unidad y su territorio, sin payer y sin claves de más', () => {
      client
        .registerOrganization({
          tenantType: 'DIAGNOSTIC_CENTER',
          code: 'LAB_SUR_ABCDE',
          legalName: 'Laboratorio del Sur',
          legalEntityType: 'UNIPERSONAL',
          timeZone: 'America/La_Paz',
          countryConceptId: 'c-bo',
          jurisdictionConceptId: 'j-nac',
          diagnosticUnit: {
            diagnosticUnitTypeConceptId: 'u-lab',
            modalityConceptIds: ['m-lab'],
            primarySite: {
              name: 'Central',
              timeZone: 'America/La_Paz',
              address: { lines: ['Av. Cañoto 234'], latitude: -17.78, longitude: -63.18 },
            },
          },
          owner: { email: 'a@m.test', password: 'secreto12', displayName: 'Ana Paz' },
          legalDocuments: {
            taxIdentifierFileId: 'f1',
            commerceRegistryFileId: 'f2',
            operatingLicenseFileId: 'f3',
            healthAuthorityCertificateFileId: 'f4',
          },
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body).toEqual({
        organization: {
          code: 'LAB_SUR_ABCDE',
          legalName: 'Laboratorio del Sur',
          legalEntityType: 'UNIPERSONAL',
          tenantType: 'DIAGNOSTIC_CENTER',
          timeZone: 'America/La_Paz',
          countryConceptId: 'c-bo',
          jurisdictionConceptId: 'j-nac',
          diagnosticUnit: {
            diagnosticUnitTypeConceptId: 'u-lab',
            modalityConceptIds: ['m-lab'],
            primarySite: {
              name: 'Central',
              timeZone: 'America/La_Paz',
              address: { lines: ['Av. Cañoto 234'], latitude: -17.78, longitude: -63.18 },
            },
          },
          legalDocuments: {
            taxIdentifierFileId: 'f1',
            commerceRegistryFileId: 'f2',
            operatingLicenseFileId: 'f3',
            healthAuthorityCertificateFileId: 'f4',
          },
        },
        owner: { email: 'a@m.test', password: 'secreto12', displayName: 'Ana Paz' },
      });

      req.flush({ ...RESPUESTA, diagnosticUnitId: 'du-1' });
    });

    it('el punto de la sede sólo viaja completo: sin longitud no manda ninguno', () => {
      client
        .registerOrganization({
          tenantType: 'DIAGNOSTIC_CENTER',
          code: 'LAB_SUR_ABCDE',
          legalName: 'Laboratorio del Sur',
          legalEntityType: 'UNIPERSONAL',
          countryConceptId: 'c-bo',
          jurisdictionConceptId: 'j-nac',
          diagnosticUnit: {
            diagnosticUnitTypeConceptId: 'u-lab',
            modalityConceptIds: [],
            primarySite: { name: 'Central', address: { lines: ['x'], latitude: -17.78 } },
          },
          owner: { email: 'a@m.test', password: 'secreto12', displayName: 'Ana Paz' },
          legalDocuments: {
            taxIdentifierFileId: 'f1',
            commerceRegistryFileId: 'f2',
            operatingLicenseFileId: 'f3',
            healthAuthorityCertificateFileId: 'f4',
          },
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.diagnosticUnit.primarySite.address).toEqual({ lines: ['x'] });

      req.flush(RESPUESTA);
    });

    /** El representante legal y las tres gerencias (subtarea 1.4). */
    const LEGAL_REPRESENTATIVE = {
      fullName: 'Mariana Siles Justiniano',
      idNumber: '4872190 SC',
      email: 'legal@aseguradora.com',
      powerOfAttorneyFileId: 'file-poder',
    };
    const EXECUTIVES = {
      generalManager: {
        fullName: 'Carlos Mendoza',
        phone: '+591 70000001',
        email: 'gm@aseguradora.com',
      },
      commercialManager: {
        fullName: 'Ana Paz',
        phone: '+591 70000002',
        email: 'cm@aseguradora.com',
      },
      marketingManager: {
        fullName: 'Luis Rojas',
        phone: '+591 70000003',
        email: 'mm@aseguradora.com',
      },
    };

    it('con representante y gerencias, viajan dentro de organization (subtarea 1.4)', () => {
      client
        .registerOrganization({
          code: 'ANDINA-SALUD',
          legalName: 'Andina Salud S.A.',
          legalEntityType: 'SRL',
          payer: PAYER_SIN_UBICACION,
          owner: { email: 'a@m.test', password: 'secreto12', name: 'Ana', lastName: 'Paz' },
          legalRepresentative: LEGAL_REPRESENTATIVE,
          executives: EXECUTIVES,
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-organization');
      expect(req.request.body.organization.legalRepresentative).toEqual(LEGAL_REPRESENTATIVE);
      expect(req.request.body.organization.executives).toEqual(EXECUTIVES);
      // Nunca dentro de payer: el registro de procesos repite el mismo
      // bloque para farmacia/laboratorio/imagenología — no es dato de la
      // aseguradora.
      expect('legalRepresentative' in req.request.body.organization.payer).toBe(false);
      expect('executives' in req.request.body.organization.payer).toBe(false);

      req.flush({ ...RESPUESTA, representativesRegistered: 4 });
    });

    it('sin representante ni gerencias, organization no lleva esas claves', () => {
      client
        .registerOrganization({
          code: 'ANDINA-SALUD',
          legalName: 'Andina Salud S.A.',
          legalEntityType: 'SRL',
          payer: PAYER_SIN_UBICACION,
          owner: { email: 'a@m.test', password: 'secreto12', name: 'Ana', lastName: 'Paz' },
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-organization');
      expect('legalRepresentative' in req.request.body.organization).toBe(false);
      expect('executives' in req.request.body.organization).toBe(false);

      req.flush(RESPUESTA);
    });
  });
});
