import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { openFailureOf } from './open-failure';

/**
 * El fallo de `GET /pharmacy/prescription-shares/:token` (REQ-FAR-02-011),
 * suelto: los casos que llegan sin el cuerpo de la API, como los manda un
 * proxy, también tienen estado y texto.
 */
describe('openFailureOf', () => {
  it('un 410 sin cuerpo es S5 «venció»: el enlace ya no abre, aunque no se sepa por qué', () => {
    const outcome = openFailureOf(new HttpErrorResponse({ status: 410, statusText: 'Gone' }));

    expect(outcome.state.status).toBe('forbidden');
    expect(outcome.failure).toBe('EXPIRED');
  });

  it('un 410 con reason REVOKED y su correlationId es S5 «revocada» con el código', () => {
    const outcome = openFailureOf(
      new HttpErrorResponse({
        status: 410,
        error: {
          code: 'PRECONDITION_FAILED',
          message: 'El paciente dejó de compartir esta receta.',
          reason: 'PRESCRIPTION_SHARE_REVOKED',
          correlationId: 'req-1',
          timestamp: '',
          path: '',
        },
      }),
    );

    expect(outcome.failure).toBe('REVOKED');
    expect(outcome.state).toEqual({ status: 'forbidden', requestId: 'req-1' });
  });

  it('un 404 sin cuerpo es S6 «este enlace no existe»', () => {
    const outcome = openFailureOf(new HttpErrorResponse({ status: 404 }));

    expect(outcome.state.status).toBe('not-found');
    expect(outcome.failure).toBe('UNKNOWN_LINK');
  });

  it('un 502 de un proxy, sin cuerpo, es S9 con el x-request-id', () => {
    const outcome = openFailureOf(
      new HttpErrorResponse({ status: 502, headers: new HttpHeaders({ 'x-request-id': 'req-502' }) }),
    );

    expect(outcome.failure).toBeNull();
    expect(outcome.state).toMatchObject({ status: 'error', requestId: 'req-502' });
  });

  it('algo que no es un HttpErrorResponse es S9', () => {
    expect(openFailureOf(new Error('x')).state.status).toBe('error');
  });
});
