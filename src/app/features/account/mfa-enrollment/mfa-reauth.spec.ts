import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { REAUTH_FAILURE_TEXT, reauthFailureOf } from './mfa-reauth';

const falla = (status: number, reason?: string): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: { code: 'PRECONDITION_FAILED', message: 'x', details: reason === undefined ? {} : { reason }, timestamp: '', path: '' } });

describe('reauthFailureOf', () => {
  it('distingue «falta confirmar» de «no valen» por el motivo de la API', () => {
    expect(reauthFailureOf(falla(422, 'MFA_REAUTH_REQUIRED'))).toBe('REQUIRED');
    expect(reauthFailureOf(falla(422, 'MFA_REAUTH_FAILED'))).toBe('FAILED');
  });

  it('lee también el estado cuando no hay motivo', () => {
    expect(reauthFailureOf(falla(429))).toBe('TOO_MANY');
    expect(reauthFailureOf(falla(404))).toBe('GONE');
    expect(reauthFailureOf(new HttpErrorResponse({ status: 0 }))).toBe('OFFLINE');
    expect(reauthFailureOf(falla(500))).toBe('OTHER');
    expect(reauthFailureOf('x')).toBe('OTHER');
  });

  it('cada categoría tiene su texto', () => {
    for (const texto of Object.values(REAUTH_FAILURE_TEXT)) expect(texto.length).toBeGreaterThan(20);
  });
});
