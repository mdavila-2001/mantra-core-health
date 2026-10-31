import { HttpErrorResponse } from '@angular/common/http';

import { errorToViewState } from './error-to-view-state';
import { readApiError } from './api-error';

const forbiddenWith = (reason: string | undefined, message = 'x'): HttpErrorResponse =>
  new HttpErrorResponse({ status: 403, error: { statusCode: 403, code: 'FORBIDDEN', message, ...(reason === undefined ? {} : { reason, details: { reason } }), correlationId: 'req-77', timestamp: '', path: '/x' } });

describe('errores del gobierno de accesos', () => {
  it('readApiError trae el `reason` de arriba o, si falta, el de `details`', () => {
    expect(readApiError(forbiddenWith('STEP_UP_REQUIRED'))?.reason).toBe('STEP_UP_REQUIRED');
    const soloDetalle = new HttpErrorResponse({ status: 403, error: { code: 'FORBIDDEN', message: 'x', details: { reason: 'TIME_WINDOW' } } });
    expect(readApiError(soloDetalle)?.reason).toBe('TIME_WINDOW');
    expect(readApiError(forbiddenWith(undefined))?.reason).toBeUndefined();
  });

  it('un 403 con un `reason` del gobierno de accesos sin resolver se muestra con el texto en lenguaje simple y su ID de petición', () => {
    expect(errorToViewState(forbiddenWith('APPROVAL_REQUIRED', 'Texto técnico'))).toMatchObject({ status: 'forbidden', message: 'Esta acción necesita la aprobación de otra persona.', requestId: 'req-77' });
    expect(errorToViewState(forbiddenWith('ADMIN_SCOPE_EXCEEDED'))).toMatchObject({ status: 'forbidden', message: 'Esa persona o ese permiso está fuera de lo que usted administra.' });
  });

  it('un 403 sin `reason` conocido conserva el mensaje de la API', () => {
    expect(errorToViewState(forbiddenWith(undefined, 'Su vínculo de apoyo no le permite esta acción.'))).toMatchObject({ status: 'forbidden', message: 'Su vínculo de apoyo no le permite esta acción.' });
    expect(errorToViewState(forbiddenWith('ALGO_NUEVO', 'Mensaje de la API'))).toMatchObject({ message: 'Mensaje de la API' });
  });
});
