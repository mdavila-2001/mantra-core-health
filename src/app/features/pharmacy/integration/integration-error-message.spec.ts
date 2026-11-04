import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { integrationErrorMessage, INTEGRATION_ERROR_TEXT } from './integration-error-message';
import { pharmacyErrorMessage } from '../pharmacy-error-message';

function unavailable(errorReason?: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 502, error: {
      code: 'DEPENDENCY_UNAVAILABLE', reason: 'PHARMACY_INTEGRATION_UNAVAILABLE',
      correlationId: 'synthetic-request', details: { errorReason },
    },
  });
}

describe('Integration errors · reconciled contract', () => {
  it.each([
    ['AUTH_REJECTED', 'rechazó la clave'], ['UNREACHABLE', 'no responde'],
  ])('la causa %s prima sobre un override genérico y conserva correlación', (reason, text) => {
    const message = integrationErrorMessage(unavailable(reason), 'fallback', {
      PHARMACY_INTEGRATION_UNAVAILABLE: 'override genérico',
    });
    expect(message).toContain(text);
    expect(message).toContain('(petición synthetic-request)');
    expect(message).not.toContain('override genérico');
  });

  it('con causa desconocida conserva el tercer argumento y requestId', () => {
    expect(integrationErrorMessage(unavailable('UNKNOWN'), 'fallback', {
      PHARMACY_INTEGRATION_UNAVAILABLE: 'Revise los cuatro campos.',
    })).toBe('Revise los cuatro campos. (petición synthetic-request)');
  });

  it('sin override conserva el texto canónico y la firma de dos argumentos', () => {
    expect(integrationErrorMessage(unavailable(), 'fallback'))
      .toBe(`${INTEGRATION_ERROR_TEXT.PHARMACY_INTEGRATION_UNAVAILABLE} (petición synthetic-request)`);
  });

  it('lee reason anidado y el requestId de cabecera sin mostrar texto remoto', () => {
    const error = new HttpErrorResponse({ status: 502,
      headers: new HttpHeaders({ 'x-request-id': 'header-request' }),
      error: { message: 'raw provider diagnostics', details: {
        reason: 'PHARMACY_INTEGRATION_UNAVAILABLE', errorReason: 'AUTH_REJECTED',
      } },
    });
    const message = integrationErrorMessage(error, 'fallback');
    expect(message).toContain('rechazó la clave');
    expect(message).toContain('(petición header-request)');
    expect(message).not.toContain('raw provider diagnostics');
  });

  it.each([401, 403, 404])('un status %s sin reason conocido mantiene el formatter común', (status) => {
    const error = new HttpErrorResponse({ status, error: null });
    expect(integrationErrorMessage(error, 'Texto de reserva.'))
      .toBe(pharmacyErrorMessage(error, 'Texto de reserva.'));
  });
});
