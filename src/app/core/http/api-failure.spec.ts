import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { describeApiFailure, fieldErrorsOf, OFFLINE_MESSAGE } from './api-failure';
import {
  API_FAILURE_LOG_PREFIX,
  apiFailureLogInterceptor,
  describeForConsole,
} from './api-failure-log.interceptor';
import { errorToViewState } from './error-to-view-state';

const FALLBACK = 'No se pudo guardar la cita.';

/** Un 400 con la forma de `createGlobalValidationPipe` de la API. */
function validation400(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 400,
    url: '/api/scheduling/appointments?token=secreto',
    error: {
      code: 'VALIDATION_FAILED',
      message: 'Error de validación',
      correlationId: '5b0c1a2e-0000-4000-8000-000000000001',
      details: {
        violations: ['lines.0.quantity must not be less than 1', 'property patientName should not exist'],
        fields: [
          { field: 'lines.0.quantity', constraints: ['min'], messages: ['quantity must not be less than 1'] },
          { field: 'patientName', constraints: ['whitelistValidation'], messages: ['property patientName should not exist'] },
        ],
      },
      timestamp: '2026-10-08T22:00:00.000Z',
      path: '/scheduling/appointments',
    },
  });
}

function apiError(status: number, code: string, message: string, correlationId?: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: { code, message, timestamp: '', path: '/x', ...(correlationId ? { correlationId } : {}) },
  });
}

describe('describeApiFailure', () => {
  it('usa el motivo de negocio de la API y agrega el código de soporte', () => {
    const error = apiError(409, 'CONFLICT', 'Ese horario se pisa con otra cita ya confirmada', 'abc-123');
    expect(describeApiFailure(error, FALLBACK)).toBe(
      'Ese horario se pisa con otra cita ya confirmada (Código de soporte: abc-123)',
    );
  });

  it('en un 500 conserva el texto de la pantalla, nunca «Error interno del servidor»', () => {
    const error = apiError(500, 'INTERNAL', 'Error interno del servidor', 'abc-500');
    expect(describeApiFailure(error, FALLBACK)).toBe(`${FALLBACK} (Código de soporte: abc-500)`);
  });

  it('en una validación no repite «Error de validación»: el detalle va por campo', () => {
    expect(describeApiFailure(validation400(), FALLBACK)).toBe(
      `${FALLBACK} (Código de soporte: 5b0c1a2e-0000-4000-8000-000000000001)`,
    );
  });

  it('sin red lo dice, en vez de culpar al formulario', () => {
    expect(describeApiFailure(new HttpErrorResponse({ status: 0 }), FALLBACK)).toBe(OFFLINE_MESSAGE);
  });

  it('una respuesta sin el contrato toma el id de la cabecera si lo hay', () => {
    const error = new HttpErrorResponse({
      status: 502,
      error: '<html>Bad Gateway</html>',
      headers: new HttpHeaders({ 'x-request-id': 'nginx-77' }),
    });
    expect(describeApiFailure(error, FALLBACK)).toBe(`${FALLBACK} (Código de soporte: nginx-77)`);
  });

  it('algo que no es un error HTTP deja el texto de la pantalla', () => {
    expect(describeApiFailure(new Error('x'), FALLBACK)).toBe(FALLBACK);
  });
});

describe('fieldErrorsOf', () => {
  it('indexa el primer mensaje por la ruta exacta, incluidos los anidados', () => {
    expect(fieldErrorsOf(validation400())).toEqual({
      'lines.0.quantity': 'quantity must not be less than 1',
      patientName: 'property patientName should not exist',
    });
  });

  it('un fallo que no es de campos da un objeto vacío', () => {
    expect(fieldErrorsOf(apiError(409, 'CONFLICT', 'x'))).toEqual({});
    expect(fieldErrorsOf(new Error('x'))).toEqual({});
  });
});

describe('errorToViewState con details.fields', () => {
  it('ancla cada problema al campo que nombró la API, también el anidado', () => {
    const state = errorToViewState(validation400());
    expect(state.status).toBe('validation');
    expect(state.status === 'validation' ? state.issues : []).toEqual([
      { field: 'lines.0.quantity', message: 'quantity must not be less than 1', code: 'VALIDATION_FAILED' },
      { field: 'patientName', message: 'property patientName should not exist', code: 'VALIDATION_FAILED' },
    ]);
  });
});

describe('describeForConsole', () => {
  it('cuenta código, mensaje, correlationId y campos, sin la query', () => {
    const [headline, detail] = describeForConsole('POST', '/api/scheduling/appointments?token=secreto', validation400());

    expect(headline).toBe(
      `${API_FAILURE_LOG_PREFIX} POST /api/scheduling/appointments → 400 · VALIDATION_FAILED · «Error de validación» · correlationId=5b0c1a2e-0000-4000-8000-000000000001`,
    );
    expect(headline).not.toContain('secreto');
    expect(detail).toMatchObject({
      code: 'VALIDATION_FAILED',
      fields: [
        expect.objectContaining({ field: 'lines.0.quantity', constraints: ['min'] }),
        expect.objectContaining({ field: 'patientName', constraints: ['whitelistValidation'] }),
      ],
    });
  });

  it('muestra el diagnóstico cuando la API lo manda', () => {
    const error = new HttpErrorResponse({
      status: 500,
      error: {
        code: 'INTERNAL',
        message: 'Error interno del servidor',
        correlationId: 'c-1',
        timestamp: '',
        path: '/x',
        diagnostics: { exception: 'TypeError', where: ['src/modules/x.service.ts:10:3'] },
      },
    });
    expect(describeForConsole('PATCH', '/api/x', error)[1]).toMatchObject({
      diagnostics: { exception: 'TypeError', where: ['src/modules/x.service.ts:10:3'] },
    });
  });

  it('un estado 0 dice que no hubo respuesta', () => {
    expect(describeForConsole('GET', '/api/x', new HttpErrorResponse({ status: 0 }))[0]).toContain('sin respuesta');
  });
});

/**
 * El interceptor de punta a punta: el manejador de la pantalla descarta el
 * error —el patrón que hay en cientos de lugares— y el fallo igual queda en la
 * consola. Las pruebas corren en modo desarrollo, que es cuando registra.
 */
describe('apiFailureLogInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([apiFailureLogInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registra el fallo aunque el manejador lo tire', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    http.post('/api/scheduling/appointments', { lines: [] }).subscribe({ error: () => undefined });
    backend.expectOne('/api/scheduling/appointments').flush(validation400().error, { status: 400, statusText: 'Bad Request' });

    expect(consoleError).toHaveBeenCalledTimes(1);
    expect(String(consoleError.mock.calls[0][0])).toContain('POST /api/scheduling/appointments → 400 · VALIDATION_FAILED');
  });

  it('no escribe nada cuando la respuesta es correcta', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    http.get('/api/ok').subscribe();
    backend.expectOne('/api/ok').flush({ ok: true });

    expect(consoleError).not.toHaveBeenCalled();
  });

  it('no altera el error que recibe la pantalla', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let received: unknown;

    http.post('/api/x', {}).subscribe({ error: (error: unknown) => (received = error) });
    backend.expectOne('/api/x').flush(validation400().error, { status: 400, statusText: 'Bad Request' });

    expect(received).toBeInstanceOf(HttpErrorResponse);
    expect((received as HttpErrorResponse).status).toBe(400);
  });
});
