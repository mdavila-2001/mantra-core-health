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
        .registerPatient({ nationalId: '1234567', password: 'secreto12', displayName: 'Ana Paz' })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-patient');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        nationalId: '1234567',
        password: 'secreto12',
        displayName: 'Ana Paz',
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
          displayName: 'Ana Paz',
          email: 'ana@mantra.test',
          birthDate: '1990-04-12',
        })
        .subscribe();

      const req = http.expectOne('/iam/auth/register-patient');
      expect(req.request.body.email).toBe('ana@mantra.test');
      expect(req.request.body.birthDate).toBe('1990-04-12');
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
});
