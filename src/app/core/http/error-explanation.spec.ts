import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';

import { classifyFailure, explainFailure, explanationOf, type ErrorKind } from './error-explanation';
import { describeApiFailure, OFFLINE_MESSAGE, TIMEOUT_MESSAGE } from './api-failure';
import { errorToViewState } from './error-to-view-state';
import { isOffline, isUnexpectedError } from '../view-state/view-state';

function apiError(status: number, body: unknown, headers?: Record<string, string>): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: body,
    url: '/api/clinical/patients/00000000-0000-4000-8000-0000000000aa?token=secreto',
    statusText: 'Internal Server Error',
    ...(headers ? { headers: new HttpHeaders(headers) } : {}),
  });
}

const TIMEOUT = new HttpErrorResponse({ status: 0, statusText: 'Timeout', error: new Error('La petición superó los 30 segundos.') });
const OFFLINE = new HttpErrorResponse({ status: 0 });

describe('classifyFailure', () => {
  it.each<[string, unknown, ErrorKind]>([
    ['sin red', OFFLINE, 'offline'],
    ['límite de espera', TIMEOUT, 'timeout'],
    ['UNAUTHENTICATED', apiError(401, { code: 'UNAUTHENTICATED', message: 'x' }), 'session-expired'],
    ['PAYLOAD_TOO_LARGE', apiError(413, { code: 'PAYLOAD_TOO_LARGE', message: '' }), 'too-large'],
    ['RATE_LIMITED', apiError(429, { code: 'RATE_LIMITED', message: '' }), 'rate-limited'],
    ['DEPENDENCY_UNAVAILABLE', apiError(503, { code: 'DEPENDENCY_UNAVAILABLE', message: '' }), 'unavailable'],
    ['INTERNAL', apiError(500, { code: 'INTERNAL', message: 'Error interno del servidor' }), 'server'],
    ['CONFLICT', apiError(409, { code: 'CONFLICT', message: 'x' }), 'rejected'],
    ['502 de un proxy', apiError(502, '<html>Bad Gateway</html>'), 'unavailable'],
    ['504 de un proxy', apiError(504, '<html>Gateway Timeout</html>'), 'timeout'],
    ['413 de un proxy', apiError(413, '<html>Too Large</html>'), 'too-large'],
    ['500 sin contrato', apiError(500, 'boom'), 'server'],
    ['418 sin contrato', apiError(418, null), 'rejected'],
    ['un error que no es HTTP', new TypeError('x is undefined'), 'client'],
  ])('%s → %s', (_caso, error, esperado) => {
    expect(classifyFailure(error)).toBe(esperado);
  });
});

describe('las explicaciones dicen qué pasó, por qué y qué hacer', () => {
  const KINDS: readonly ErrorKind[] = [
    'offline', 'timeout', 'session-expired', 'too-large', 'rate-limited', 'unavailable', 'server', 'rejected', 'client',
  ];

  it.each(KINDS)('%s tiene título, causa y acción no vacíos', (kind) => {
    const { title, cause, action } = explanationOf(kind);
    expect(title.trim().length).toBeGreaterThan(0);
    expect(cause.trim().length).toBeGreaterThan(20);
    expect(action.trim().length).toBeGreaterThan(10);
    expect(explanationOf(kind).brief.trim().length).toBeGreaterThan(10);
  });

  it('el tiempo agotado avisa que el envío pudo haberse guardado', () => {
    expect(explanationOf('timeout').action).toContain('quedó registrado');
  });
});

/**
 * Lo que una respuesta hostil o un fallo sin censurar podría traer, y que
 * **ninguna** salida de los traductores puede repetir.
 */
describe('nada técnico de la respuesta llega al texto', () => {
  const FILTRACIONES = [
    'SELECT * FROM patients',
    'at PatientsService.find (/app/dist/main.js:12:9)',
    'ECONNREFUSED 10.0.3.14:5432',
    '00000000-0000-4000-8000-0000000000aa',
    'secreto',
    'Internal Server Error',
    '/api/clinical',
  ];

  const respuestas: readonly [string, HttpErrorResponse][] = [
    ['INTERNAL sin censurar', apiError(500, {
      code: 'INTERNAL',
      message: 'SELECT * FROM patients WHERE id = 00000000-0000-4000-8000-0000000000aa',
      details: { stack: 'at PatientsService.find (/app/dist/main.js:12:9)' },
      correlationId: 'corr-1',
    })],
    ['UNAUTHENTICATED con detalle', apiError(401, { code: 'UNAUTHENTICATED', message: 'jwt secreto expired', correlationId: 'corr-2' })],
    ['502 con HTML', apiError(502, '<html>ECONNREFUSED 10.0.3.14:5432</html>', { 'x-request-id': 'corr-3' })],
  ];

  it.each(respuestas)('%s: S9 sólo lleva textos del catálogo y el código de soporte', (_caso, error) => {
    const estado = errorToViewState(error);
    expect(isUnexpectedError(estado)).toBe(true);
    const visible = JSON.stringify(estado);
    for (const f of FILTRACIONES) expect(visible).not.toContain(f);
  });

  it.each(respuestas)('%s: el toast tampoco', (_caso, error) => {
    const texto = describeApiFailure(error, 'No se pudo guardar.');
    for (const f of FILTRACIONES) expect(texto).not.toContain(f);
    expect(texto).toMatch(/Código de soporte: corr-\d/);
  });
});

describe('S8 distingue sin red de tiempo agotado', () => {
  it('sin red', () => {
    const estado = errorToViewState(OFFLINE);
    expect(isOffline(estado) && estado.timedOut).toBeFalsy();
  });

  it('tiempo agotado', () => {
    const estado = errorToViewState(TIMEOUT);
    expect(isOffline(estado) && estado.timedOut).toBe(true);
  });

  it('describeApiFailure dice cuál de los dos fue', () => {
    expect(describeApiFailure(OFFLINE, 'No se pudo guardar.')).toBe(OFFLINE_MESSAGE);
    expect(describeApiFailure(TIMEOUT, 'No se pudo guardar.')).toBe(`No se pudo guardar. ${explanationOf('timeout').brief}`);
    expect(TIMEOUT_MESSAGE).toContain('quedó registrado');
  });
});

describe('S9 trae título y próxima acción', () => {
  it('INTERNAL', () => {
    const estado = errorToViewState(apiError(500, { code: 'INTERNAL', message: 'Error interno del servidor', correlationId: 'c' }));
    const esperado = explainFailure(apiError(500, { code: 'INTERNAL', message: '' }));
    expect(estado).toEqual({
      status: 'error',
      requestId: 'c',
      title: esperado.title,
      message: esperado.cause,
      hint: esperado.action,
    });
  });
});
