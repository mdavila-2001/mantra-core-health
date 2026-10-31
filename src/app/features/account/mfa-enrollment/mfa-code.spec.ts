import { HttpErrorResponse } from '@angular/common/http';

import { CONFIRM_FAILURE_TEXT, cleanCode, confirmFailureOf, groupSecret, isCodeShape, safeReturnUrl } from './mfa-code';

const fallo = (status: number, reason?: string): HttpErrorResponse =>
  new HttpErrorResponse({
    status,
    error: { statusCode: status, code: status === 429 ? 'RATE_LIMITED' : 'PRECONDITION_FAILED', message: 'x', timestamp: '', path: '/iam/me/mfa/totp/f/confirm', ...(reason === undefined ? {} : { details: { reason } }) },
  });

describe('el código de la aplicación', () => {
  it('quita los espacios y guiones que quedan al copiarlo', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode(' 123-456 ')).toBe('123456');
  });

  it('tiene forma de código con 6 a 8 dígitos, y nada más', () => {
    for (const bueno of ['123456', '1234567', '12345678', '123 456']) expect(isCodeShape(bueno), bueno).toBe(true);
    for (const malo of ['', '12345', '123456789', '12345a', 'abcdef', '12 34']) expect(isCodeShape(malo), malo).toBe(false);
  });
});

describe('el secreto para escribir a mano', () => {
  it('se agrupa de a cuatro y es idempotente', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupSecret(groupSecret('JBSWY3DPEHPK3PXP'))).toBe('JBSW Y3DP EHPK 3PXP');
    expect(groupSecret('ABCDEF')).toBe('ABCD EF');
  });
});

describe('por qué falló la confirmación', () => {
  it('un código inválido es 422 con MFA_CODE_INVALID', () => {
    expect(confirmFailureOf(fallo(422, 'MFA_CODE_INVALID'))).toBe('WRONG_CODE');
  });

  it('un 422 que no se puede leer también es un código inválido', () => {
    expect(confirmFailureOf(new HttpErrorResponse({ status: 422, error: '<html>' }))).toBe('WRONG_CODE');
  });

  it('el factor que ya no existe, el tope de intentos y la falta de red tienen cada uno su categoría', () => {
    expect(confirmFailureOf(new HttpErrorResponse({ status: 404 }))).toBe('FACTOR_GONE');
    expect(confirmFailureOf(fallo(429))).toBe('TOO_MANY');
    expect(confirmFailureOf(new HttpErrorResponse({ status: 0 }))).toBe('OFFLINE');
  });

  it('cualquier otra cosa es un fallo general', () => {
    expect(confirmFailureOf(new HttpErrorResponse({ status: 500 }))).toBe('OTHER');
    expect(confirmFailureOf(new Error('x'))).toBe('OTHER');
  });

  it('ningún texto deja ver códigos de sistema, y todos hablan de usted', () => {
    for (const texto of Object.values(CONFIRM_FAILURE_TEXT)) {
      expect(texto).not.toMatch(/[A-Z]{3,}_[A-Z_]+/);
      expect(texto).not.toMatch(/\b(tu|tus|revisa|escribe|vuelve)\b/i);
    }
  });
});

describe('a dónde volver', () => {
  it('solo a rutas internas', () => {
    expect(safeReturnUrl('/dashboard')).toBe('/dashboard');
    expect(safeReturnUrl('/my-account/security?tab=1')).toBe('/my-account/security?tab=1');
    for (const malo of [null, '', 'https://otro.sitio', '//evil.com', '/\\evil.com', 'dashboard']) expect(safeReturnUrl(malo), String(malo)).toBeNull();
  });
});
