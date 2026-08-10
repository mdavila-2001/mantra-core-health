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

  describe('registerPatient', () => {
    it('manda solo los campos obligatorios cuando no hay opcionales', () => {
      client
        .registerPatient({
          nationalId: '1234567',
          password: 'secreto12',
          name: 'Ana',
          lastName: 'Paz',
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
          email: 'ana@mantra.test',
          birthDate: '1990-04-12',
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-patient');
      expect(req.request.body.email).toBe('ana@mantra.test');
      expect(req.request.body.birthDate).toBe('1990-04-12');
      expect(req.request.body.middleName).toBe('María');
      expect(req.request.body.motherLastName).toBe('Quiroga');
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
        displayName: 'Ana Paciente',
        email: 'ana@mantra.test',
        reason: 'No puede registrarse por sí misma',
      })
      .subscribe();

    const req = http.expectOne('/iam/users/assisted-registration');
    expect(req.request.method).toBe('POST');
    // El titular fija su clave al activar: acá no viaja ninguna.
    expect(req.request.body).toEqual({
      displayName: 'Ana Paciente',
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
      .assistedRegistration({ displayName: 'Ana', email: 'a@m.test', reason: 'motivo' })
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
});
