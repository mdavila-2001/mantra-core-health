import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import { cleanDeviceCode, DEVICE_CONFIRM_FAILURE_TEXT, deviceConfirmFailureOf, isDeviceCodeShape } from './new-device-code';

const falla = (status: number, reason?: string): HttpErrorResponse =>
  new HttpErrorResponse({ status, error: { code: 'PRECONDITION_FAILED', message: 'x', details: reason === undefined ? {} : { reason }, timestamp: '', path: '' } });

describe('código de confirmación de dispositivo', () => {
  it('exige 8 dígitos y tolera espacios y guiones al pegarlo', () => {
    expect(isDeviceCodeShape('12345678')).toBe(true);
    expect(isDeviceCodeShape('1234 5678')).toBe(true);
    expect(isDeviceCodeShape('1234-5678')).toBe(true);
    expect(cleanDeviceCode(' 1234 5678 ')).toBe('12345678');
    for (const mal of ['1234567', '123456789', 'abcdefgh', '']) expect(isDeviceCodeShape(mal)).toBe(false);
  });

  it('lee los tres motivos 422 de la API y el tope de 3 por minuto', () => {
    expect(deviceConfirmFailureOf(falla(422, 'DEVICE_CONFIRM_CODE_REQUIRED'))).toBe('CODE_REQUIRED');
    expect(deviceConfirmFailureOf(falla(422, 'DEVICE_CONFIRM_CODE_INVALID'))).toBe('CODE_INVALID');
    expect(deviceConfirmFailureOf(falla(422, 'DEVICE_CONFIRM_NO_VERIFIED_EMAIL'))).toBe('NO_VERIFIED_EMAIL');
    expect(deviceConfirmFailureOf(falla(429))).toBe('TOO_MANY');
    expect(deviceConfirmFailureOf(falla(404))).toBe('DEVICE_GONE');
    expect(deviceConfirmFailureOf(new HttpErrorResponse({ status: 0 }))).toBe('OFFLINE');
    expect(deviceConfirmFailureOf(falla(500))).toBe('OTHER');
    for (const texto of Object.values(DEVICE_CONFIRM_FAILURE_TEXT)) expect(texto.length).toBeGreaterThan(20);
  });
});
