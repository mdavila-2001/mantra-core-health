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

describe('falta fijar organización (H1): S5 «Elegir organización»', () => {
  const withReason = (status: number, reason: string, code = 'FORBIDDEN'): HttpErrorResponse =>
    new HttpErrorResponse({ status, error: { statusCode: status, code, message: 'x', details: { reason }, correlationId: 'req-9', timestamp: '', path: '/x' } });

  it.each([
    [403, 'TENANT_AMBIGUOUS', 'FORBIDDEN'],
    [403, 'TENANT_REQUIRED', 'FORBIDDEN'],
    [412, 'TENANT_REQUIRED', 'PRECONDITION_FAILED'],
    [422, 'TENANT_REQUIRED', 'PRECONDITION_FAILED'],
  ])('%s %s se pinta como S5 con la acción «Elegir organización» y el ID de petición', (status, reason, code) => {
    const viewState = errorToViewState(withReason(status, reason, code));
    expect(viewState).toMatchObject({
      status: 'forbidden',
      requestId: 'req-9',
      nextAction: { label: 'Elegir organización' },
    });
    expect((viewState as { nextAction: { route: string } }).nextAction.route.startsWith('/auth/organization')).toBe(true);
  });

  it('NEGATIVO: un 412 con otro `reason` no se confunde con la elección de organización', () => {
    const viewState = errorToViewState(withReason(412, 'OTRA_COSA', 'PRECONDITION_FAILED'));
    expect(viewState.status).not.toBe('forbidden');
  });

  it('NEGATIVO: un 403 de rol insuficiente no ofrece elegir organización', () => {
    const viewState = errorToViewState(withReason(403, 'ROLE_INSUFFICIENT'));
    expect(viewState).not.toHaveProperty('nextAction');
  });
});
