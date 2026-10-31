import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MfaClient } from './mfa.client';

describe('MfaClient', () => {
  let client: MfaClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(MfaClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('GET /iam/me/mfa trae si lo exigen, si lo tiene y sus factores, con fechas', () => {
    let estado: unknown;
    client.getStatus().subscribe((e) => (estado = e));
    const req = http.expectOne('/iam/me/mfa');
    expect(req.request.method).toBe('GET');
    req.flush({
      required: true,
      enrolled: false,
      enrollmentRequired: true,
      factors: [{ id: 'f-1', type: 'TOTP', state: 'PENDING', label: 'Teléfono', createdAt: '2026-10-30T12:00:00Z' }],
    });
    expect(estado).toMatchObject({ required: true, enrolled: false, enrollmentRequired: true });
    const factor = (estado as { factors: { createdAt: Date; verifiedAt?: Date; label?: string }[] }).factors[0]!;
    expect(factor.createdAt).toEqual(new Date('2026-10-30T12:00:00Z'));
    expect(factor.label).toBe('Teléfono');
    expect('verifiedAt' in factor).toBe(false);
  });

  it('POST /iam/me/mfa/totp exige la reautenticación: manda la contraseña actual y lee solo el id, el secreto y el URI', () => {
    let alta: unknown;
    client.startTotp({ currentPassword: 'mi-clave' }).subscribe((a) => (alta = a));
    const req = http.expectOne('/iam/me/mfa/totp');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ currentPassword: 'mi-clave' });
    // `MfaFactorResponseDto`: no trae type, label ni createdAt, y su state es un concept id.
    req.flush({ id: 'f-1', userId: 'u-1', state: 'uuid-estado', secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/Alovida:ana?secret=JBSWY3DPEHPK3PXP' });
    expect(alta).toEqual({ factorId: 'f-1', secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/Alovida:ana?secret=JBSWY3DPEHPK3PXP' });
  });

  it('también se reautentica con el código de un factor ya verificado (`mfaCode`), y la etiqueta va aparte', () => {
    client.startTotp({ mfaCode: '123456' }, 'Teléfono personal').subscribe();
    const req = http.expectOne('/iam/me/mfa/totp');
    expect(req.request.body).toEqual({ label: 'Teléfono personal', mfaCode: '123456' });
    req.flush({ id: 'f', secret: 's', otpauthUri: 'u' });
  });

  it('POST /iam/me/mfa/:factorId/revoke manda la reautenticación y devuelve cuántos factores quedan', () => {
    let r: unknown;
    client.revokeFactor('f/1', { currentPassword: 'mi-clave' }).subscribe((x) => (r = x));
    const req = http.expectOne('/iam/me/mfa/f%2F1/revoke');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ currentPassword: 'mi-clave' });
    req.flush({ revoked: true, remainingVerified: 0 });
    expect(r).toEqual({ revoked: true, remainingVerified: 0 });
  });

  it('POST …/confirm manda { code } al factor, escapado en la ruta, y lee verifiedAt como fecha', () => {
    let r: { verified: boolean; factorId: string; verifiedAt: Date } | undefined;
    client.confirmTotp('a/b', '123456').subscribe((x) => (r = x));
    const req = http.expectOne('/iam/me/mfa/totp/a%2Fb/confirm');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ code: '123456' });
    req.flush({ verified: true, factorId: 'a/b', verifiedAt: '2026-10-30T12:05:00Z' });
    expect(r).toEqual({ verified: true, factorId: 'a/b', verifiedAt: new Date('2026-10-30T12:05:00Z') });
  });
});
