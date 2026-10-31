import { HttpErrorResponse } from '@angular/common/http';

import { forbidden, notFound, unexpectedError } from '../../../core/view-state/view-state';
import { requestAccessRoute } from '../clinical-record.routes';
import {
  CONSULTATION_FORBIDDEN_MESSAGE,
  REQUEST_ACCESS_LABEL,
  consultationError,
  consultationForbidden,
} from './consultation-forbidden';

/** El 403 que manda hoy la API, igual para un paciente ajeno y un id inventado. */
function apiForbidden(correlationId?: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 403,
    statusText: 'Forbidden',
    error: {
      code: 'FORBIDDEN',
      message: 'Sólo puede consultar su propia historia clínica.',
      ...(correlationId === undefined ? {} : { correlationId }),
    },
  });
}

describe('consultationForbidden (H07)', () => {
  it('un 403 genérico habla al profesional y ofrece pedir acceso a esa historia', () => {
    const state = consultationError(apiForbidden('req-7'), 'p-1');

    expect(state).toEqual(
      forbidden({
        message: CONSULTATION_FORBIDDEN_MESSAGE,
        nextAction: { label: REQUEST_ACCESS_LABEL, route: requestAccessRoute('p-1') },
        requestId: 'req-7',
      }),
    );
    expect(JSON.stringify(state)).not.toContain('Sólo puede consultar su propia historia');
    expect(REQUEST_ACCESS_LABEL).toBe('Pedir acceso a su historia');
  });

  it('sin código de soporte no inventa uno', () => {
    const state = consultationError(apiForbidden(), 'p-1');
    expect(state.status === 'forbidden' && state.requestId).toBeUndefined();
  });

  it('el texto no distingue un paciente ajeno de un id inventado', () => {
    const ajeno = consultationError(apiForbidden(), 'p-ajeno');
    const inventado = consultationError(apiForbidden(), 'no-existe-123');

    const message = (s: typeof ajeno): string | undefined =>
      s.status === 'forbidden' ? s.message : undefined;
    expect(message(ajeno)).toBe(CONSULTATION_FORBIDDEN_MESSAGE);
    expect(message(inventado)).toBe(message(ajeno));
  });

  it('un 403 que ya trae su salida (verificar la identidad) se deja como llegó', () => {
    const identity = forbidden({
      message: 'Necesita verificar su identidad para continuar.',
      nextAction: { label: 'Verificar identidad', route: '/my-account/identity' },
      requestId: 'req-9',
    });

    expect(consultationForbidden(identity, 'p-1')).toBe(identity);
  });

  it('los demás estados de error pasan sin cambios', () => {
    const missing = notFound();
    const failure = unexpectedError('req-1', 'Falló');

    expect(consultationForbidden(missing, 'p-1')).toBe(missing);
    expect(consultationForbidden(failure, 'p-1')).toBe(failure);
  });
});
