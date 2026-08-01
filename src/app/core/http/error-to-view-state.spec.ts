import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { errorToViewState, IDENTITY_VERIFICATION_ROUTE } from './error-to-view-state';
import { isForbidden, isNotFound, isOffline, isUnexpectedError, isValidation } from '../view-state/view-state';

/**
 * Los cuerpos son **literales del catálogo** que entregó el backend
 * (`docs/api/error-model.md`), no inventados: ese era el requisito de la tarea.
 */
function apiError(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    statusText: 'Error',
    error: body,
    headers: new HttpHeaders(headers),
  });
}

describe('errorToViewState · catálogo real de la API', () => {
  describe('S4 · validación y conflicto', () => {
    it('VALIDATION_FAILED con lista de mensajes los expone uno por uno', () => {
      const state = errorToViewState(
        apiError(400, {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed',
          details: { messages: ['email must be an email', 'password is too short'] },
          correlationId: '4',
          timestamp: '2026-08-01T06:15:16.742Z',
          path: '/iam/auth/login',
        }),
      );

      expect(isValidation(state)).toBe(true);
      if (isValidation(state)) {
        expect(state.issues.map((i) => i.message)).toEqual([
          'email must be an email',
          'password is too short',
        ]);
      }
    });

    it('VALIDATION_FAILED sin lista usa el mensaje general', () => {
      const state = errorToViewState(
        apiError(400, {
          code: 'VALIDATION_FAILED',
          message: 'Validation failed (uuid is expected)',
          timestamp: '2026-08-01T06:15:16.742Z',
          path: '/iam/users/no-es-uuid/lock',
        }),
      );

      if (isValidation(state)) {
        expect(state.issues[0]?.message).toBe('Validation failed (uuid is expected)');
      } else {
        throw new Error('esperaba S4');
      }
    });

    it('CONFLICT es S4', () => {
      const state = errorToViewState(
        apiError(409, {
          code: 'CONFLICT',
          message: 'El correo ya está en uso',
          timestamp: 't',
          path: '/iam/users',
        }),
      );

      expect(isValidation(state)).toBe(true);
    });

    it('CONCURRENCY_CONFLICT explica que alguien más modificó el dato', () => {
      const state = errorToViewState(
        apiError(409, {
          code: 'CONCURRENCY_CONFLICT',
          message: '',
          timestamp: 't',
          path: '/x',
        }),
      );

      if (isValidation(state)) {
        expect(state.issues[0]?.message).toContain('modificó este dato');
      } else {
        throw new Error('esperaba S4');
      }
    });

    it('RATE_LIMITED lleva los segundos de espera si el servidor los declara', () => {
      const state = errorToViewState(
        apiError(
          429,
          { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes', timestamp: 't', path: '/x' },
          { 'retry-after': '30' },
        ),
      );

      if (isValidation(state)) {
        expect(state.retryAfterSeconds).toBe(30);
      } else {
        throw new Error('esperaba S4');
      }
    });

    it('PAYLOAD_TOO_LARGE es S4 y no un error de servidor', () => {
      // El backend lo corrigió: antes salía como 500.
      const state = errorToViewState(
        apiError(413, { code: 'PAYLOAD_TOO_LARGE', message: '', timestamp: 't', path: '/x' }),
      );

      expect(isValidation(state)).toBe(true);
    });
  });

  describe('S5 · los DOS 403, que son estados opuestos', () => {
    it('FORBIDDEN es un muro: no ofrece acción', () => {
      const state = errorToViewState(
        apiError(403, {
          code: 'FORBIDDEN',
          message: 'Requiere rol SECURITY_ADMIN',
          timestamp: 't',
          path: '/iam/users',
        }),
      );

      expect(isForbidden(state)).toBe(true);
      if (isForbidden(state)) {
        // Inventar una salida seria mandarla a un lugar donde tampoco va a poder.
        expect(state.nextAction).toBeUndefined();
        expect(state.message).toBe('Requiere rol SECURITY_ADMIN');
      }
    });

    it('IDENTITY_VERIFICATION_REQUIRED es una puerta: lleva al flujo de verificación', () => {
      const state = errorToViewState(
        apiError(403, {
          code: 'IDENTITY_VERIFICATION_REQUIRED',
          message: 'Necesitás verificar tu identidad',
          details: { reason: 'NO_ASSERTION' },
          timestamp: 't',
          path: '/clinical/records',
        }),
      );

      if (isForbidden(state)) {
        expect(state.nextAction?.route).toBe(IDENTITY_VERIFICATION_ROUTE);
        expect(state.nextAction?.label).toBe('Verificar identidad');
      } else {
        throw new Error('esperaba S5');
      }
    });

    it('los dos comparten el 403 y se separan SOLO por el código', () => {
      const muro = errorToViewState(
        apiError(403, { code: 'FORBIDDEN', message: 'm', timestamp: 't', path: '/x' }),
      );
      const puerta = errorToViewState(
        apiError(403, {
          code: 'IDENTITY_VERIFICATION_REQUIRED',
          message: 'm',
          timestamp: 't',
          path: '/x',
        }),
      );

      expect(isForbidden(muro) && muro.nextAction === undefined).toBe(true);
      expect(isForbidden(puerta) && puerta.nextAction !== undefined).toBe(true);
    });
  });

  describe('S6 · no encontrado', () => {
    it('descarta el mensaje y los detalles para no filtrar existencia', () => {
      const state = errorToViewState(
        apiError(404, {
          code: 'NOT_FOUND',
          message: 'Usuario 00000000-0000-4000-8000-0000000000ff no existe',
          details: { userId: '00000000-0000-4000-8000-0000000000ff' },
          timestamp: 't',
          path: '/iam/users/00000000-0000-4000-8000-0000000000ff/lock',
        }),
      );

      expect(isNotFound(state)).toBe(true);
      // Repetir el identificador confirmaria que se consulto por algo concreto.
      expect(JSON.stringify(state)).not.toContain('0000000000ff');
    });
  });

  describe('S8 · sin conexión', () => {
    it('el estado 0 es que la petición no llegó, no un error del servidor', () => {
      const state = errorToViewState(apiError(0, null));

      expect(isOffline(state)).toBe(true);
    });
  });

  describe('S9 · error inesperado', () => {
    it('INTERNAL lleva el correlationId del cuerpo', () => {
      const state = errorToViewState(
        apiError(500, {
          code: 'INTERNAL',
          message: 'Error interno',
          correlationId: 'req-77',
          timestamp: 't',
          path: '/x',
        }),
      );

      if (isUnexpectedError(state)) {
        expect(state.requestId).toBe('req-77');
      } else {
        throw new Error('esperaba S9');
      }
    });

    it('sin correlationId en el cuerpo cae a la cabecera x-request-id', () => {
      const state = errorToViewState(
        apiError(
          500,
          { code: 'INTERNAL', message: 'm', timestamp: 't', path: '/x' },
          { 'x-request-id': 'hdr-9' },
        ),
      );

      if (isUnexpectedError(state)) {
        expect(state.requestId).toBe('hdr-9');
      } else {
        throw new Error('esperaba S9');
      }
    });

    it('DEPENDENCY_UNAVAILABLE sugiere reintentar en unos minutos', () => {
      const state = errorToViewState(
        apiError(503, { code: 'DEPENDENCY_UNAVAILABLE', message: '', timestamp: 't', path: '/x' }),
      );

      if (isUnexpectedError(state)) {
        expect(state.message).toContain('Reintentá');
      } else {
        throw new Error('esperaba S9');
      }
    });

    it('una respuesta que no tiene la forma del contrato no se cree', () => {
      // Un proxy o un balanceador devolviendo HTML.
      const state = errorToViewState(apiError(502, '<html>Bad Gateway</html>'));

      expect(isUnexpectedError(state)).toBe(true);
    });

    it('un error que no es HTTP no rompe el mapeo', () => {
      expect(isUnexpectedError(errorToViewState(new Error('boom')))).toBe(true);
    });
  });
});
