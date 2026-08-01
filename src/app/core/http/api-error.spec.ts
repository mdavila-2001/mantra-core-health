import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import {
  API_ERROR_CODES,
  IDENTITY_VERIFICATION_ROUTE,
  isKnownApiErrorCode,
  parseApiError,
  viewStateFromHttpError,
} from './api-error';

/**
 * Los cuerpos de esta prueba **no son inventados**: se copiaron de respuestas reales de la API
 * corriendo en `localhost:3000`, capturadas el 2026-08-01. Están anotadas con la petición que las
 * produjo para que cualquiera pueda volver a obtenerlas.
 */

/** `POST /iam/auth/login` con `{}`. */
const VALIDACION_REAL = {
  code: 'VALIDATION_FAILED',
  message: 'Error de validación',
  correlationId: 9452,
  details: {
    violations: [
      'email must be shorter than or equal to 320 characters',
      'email must be an email',
      'password must be a string',
    ],
  },
  timestamp: '2026-08-01T06:40:12.830Z',
  path: '/iam/auth/login',
};

/** `POST /iam/auth/login` con credenciales que no existen. */
const NO_AUTENTICADO_REAL = {
  code: 'UNAUTHENTICATED',
  message: 'Credenciales inválidas',
  correlationId: 9451,
  timestamp: '2026-08-01T06:40:12.822Z',
  path: '/iam/auth/login',
};

function httpError(status: number, body: unknown, headers?: Record<string, string>) {
  return new HttpErrorResponse({
    status,
    statusText: 'Error',
    url: 'http://localhost:4200/iam/auth/login',
    error: body,
    ...(headers === undefined ? {} : { headers: new HttpHeaders(headers) }),
  });
}

describe('parseApiError', () => {
  it('lee la envoltura estable de la API', () => {
    const error = parseApiError(httpError(400, VALIDACION_REAL));

    expect(error.status).toBe(400);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.message).toBe('Error de validación');
    expect(error.violations).toHaveLength(3);
  });

  it('normaliza el correlationId numérico a texto', () => {
    // Verificado contra la API viva: `pino-http` numera las peticiones y el campo llega como
    // número, no como el string que declara el DTO.
    expect(parseApiError(httpError(401, NO_AUTENTICADO_REAL)).correlationId).toBe('9451');
  });

  it('trata el status 0 como fallo de red y no como error del servidor', () => {
    const error = parseApiError(httpError(0, null));

    expect(error.isNetworkFailure).toBe(true);
    expect(error.code).toBe('OFFLINE');
  });

  it('sobrevive a un cuerpo que no es la envoltura esperada', () => {
    // Un proxy delante de la API puede devolver HTML. Sigue siendo un error que hay que mostrar.
    const error = parseApiError(httpError(502, '<html>502 Bad Gateway</html>'));

    expect(error.code).toBe('INTERNAL');
    expect(error.correlationId).toBeNull();
    expect(error.violations).toEqual([]);
  });

  it('lee Retry-After solo en su forma en segundos', () => {
    expect(parseApiError(httpError(429, {}, { 'Retry-After': '30' })).retryAfterSeconds).toBe(30);
    // La variante con fecha HTTP obligaría a confiar en el reloj del navegador: se descarta.
    expect(
      parseApiError(httpError(429, {}, { 'Retry-After': 'Wed, 01 Aug 2026 07:00:00 GMT' }))
        .retryAfterSeconds,
    ).toBeNull();
  });

  it('un error que no es de HttpClient tampoco lanza', () => {
    expect(parseApiError(new Error('se rompió algo')).message).toBe('se rompió algo');
    expect(parseApiError(undefined).code).toBe('INTERNAL');
  });
});

describe('isKnownApiErrorCode', () => {
  it('reconoce los doce códigos que la API declara estables', () => {
    expect(API_ERROR_CODES).toHaveLength(12);
    for (const code of API_ERROR_CODES) {
      expect(isKnownApiErrorCode(code)).toBe(true);
    }
  });

  it('un código nuevo no reventa: se reporta como desconocido', () => {
    expect(isKnownApiErrorCode('ALGO_QUE_NO_EXISTE_TODAVIA')).toBe(false);
  });
});

describe('viewStateFromHttpError', () => {
  it('S4 · la validación ancla cada mensaje a su campo', () => {
    const state = viewStateFromHttpError(httpError(400, VALIDACION_REAL));

    expect(state.status).toBe('validation');
    if (state.status !== 'validation') {
      throw new Error('se esperaba S4');
    }
    expect(state.issues[0]?.field).toBe('email');
    expect(state.issues[2]?.field).toBe('password');
  });

  it('S4 · el 401 del login se muestra como problema de lo escrito', () => {
    // Es el único 401 que llega a verse: en el resto lo atrapa `authInterceptor`.
    const state = viewStateFromHttpError(httpError(401, NO_AUTENTICADO_REAL));

    expect(state.status).toBe('validation');
    if (state.status !== 'validation') {
      throw new Error('se esperaba S4');
    }
    expect(state.issues[0]?.message).toBe('Credenciales inválidas');
  });

  it('S4 · el 429 propaga los segundos de espera', () => {
    const state = viewStateFromHttpError(
      httpError(429, { code: 'RATE_LIMITED', message: 'Demasiadas peticiones' }, {
        'Retry-After': '45',
      }),
    );

    expect(state.status).toBe('validation');
    if (state.status !== 'validation') {
      throw new Error('se esperaba S4');
    }
    expect(state.retryAfterSeconds).toBe(45);
  });

  it('S5 · el 403 por rol insuficiente es un muro: sin próxima acción', () => {
    const state = viewStateFromHttpError(
      // Mensaje literal de `RolesGuard` en el repo de la API.
      httpError(403, { code: 'FORBIDDEN', message: 'Rol insuficiente para la operación' }),
    );

    expect(state.status).toBe('forbidden');
    if (state.status !== 'forbidden') {
      throw new Error('se esperaba S5');
    }
    expect(state.nextAction).toBeUndefined();
  });

  it('S5 · el 403 por identidad sin verificar es una puerta: lleva a verificarse', () => {
    const state = viewStateFromHttpError(
      // Cuerpo literal de `VerifiedIdentityGuard`, que desde que la API declara
      // el código propio ya no se distingue por el texto del mensaje.
      httpError(403, {
        code: 'IDENTITY_VERIFICATION_REQUIRED',
        message: 'Verifique su identidad para acceder a esta función',
        details: { reason: 'identity-not-verified' },
      }),
    );

    expect(state.status).toBe('forbidden');
    if (state.status !== 'forbidden') {
      throw new Error('se esperaba S5');
    }
    expect(state.nextAction?.route).toBe(IDENTITY_VERIFICATION_ROUTE);
  });

  it('S5 · sin persona vinculada no ofrece el trámite: sería un callejón', () => {
    const state = viewStateFromHttpError(
      httpError(403, {
        code: 'IDENTITY_VERIFICATION_REQUIRED',
        message: 'La cuenta no tiene una persona vinculada que verificar',
        details: { reason: 'no-person-linked' },
      }),
    );

    expect(state.status).toBe('forbidden');
    if (state.status !== 'forbidden') {
      throw new Error('se esperaba S5');
    }
    // Verificar la identidad de una persona que todavía no está asociada a la
    // cuenta no es algo que quien mira pueda hacer por su cuenta.
    expect(state.nextAction).toBeUndefined();
  });

  it('S6 · el no encontrado no transporta ningún dato del recurso', () => {
    const state = viewStateFromHttpError(
      httpError(404, { code: 'NOT_FOUND', message: 'El paciente 12345 no existe' }),
    );

    expect(state).toEqual({ status: 'not-found' });
    // El mensaje de la API se descarta a propósito: repetir «el paciente 12345 no existe»
    // confirmaría que ese identificador es real. Ver `NotFoundViewState`.
    expect(JSON.stringify(state)).not.toContain('12345');
  });

  it('S8 · sin respuesta se ofrece reintentar, que es una salida razonable', () => {
    expect(viewStateFromHttpError(httpError(0, null)).status).toBe('offline');
  });

  it('S9 · el error interno lleva el identificador de la petición', () => {
    const state = viewStateFromHttpError(
      httpError(500, {
        code: 'INTERNAL',
        message: 'Error interno del servidor',
        correlationId: '7788',
      }),
    );

    expect(state.status).toBe('error');
    if (state.status !== 'error') {
      throw new Error('se esperaba S9');
    }
    expect(state.requestId).toBe('7788');
  });

  it('S9 · sin correlationId igual hay identificador: el tipo lo exige', () => {
    const state = viewStateFromHttpError(httpError(502, '<html>502</html>'));

    expect(state.status).toBe('error');
    if (state.status !== 'error') {
      throw new Error('se esperaba S9');
    }
    expect(state.requestId).not.toBe('');
  });

  it('una dependencia caída es del servidor, no de la red: S9 y no S8', () => {
    const state = viewStateFromHttpError(
      httpError(503, {
        code: 'DEPENDENCY_UNAVAILABLE',
        message: 'Postgres no responde',
        correlationId: '99',
      }),
    );

    // La diferencia importa: en S8 reintentar depende de la persona; acá no.
    expect(state.status).toBe('error');
  });

  it('un código que la API todavía no tenía cae en el status, no en un error', () => {
    const state = viewStateFromHttpError(
      httpError(404, { code: 'CODIGO_FUTURO', message: 'algo nuevo' }),
    );

    expect(state.status).toBe('not-found');
  });
});
