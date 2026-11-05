import { TestBed } from '@angular/core/testing';

import { ErrorTelemetry } from '../observability/errors/error-telemetry';
import { AppErrorHandler } from './app-error-handler';
import { ErrorReporter } from './error-reporter';
import { StaleBuildRecovery } from './stale-build-recovery';

/** Un token sintético con la forma del real (base64url, 43 caracteres). */
const TOKEN = 'Q2hhcmxpZVN5bnRoZXRpY1Rva2VuMDEyMzQ1Njc4OWFi';

/**
 * El recorrido completo de un fallo no capturado en `/rx/<token>` (FAR-01):
 * `AppErrorHandler` toma `location.pathname` tal cual, y en esa página la
 * ruta **es** una credencial. Ni la consola, ni el registro que lee la
 * pantalla de recuperación, ni la telemetría pueden recibir el token.
 */
describe('AppErrorHandler', () => {
  let telemetryReport: ReturnType<typeof vi.fn>;
  let consoleError: ReturnType<typeof vi.spyOn>;
  let previousUrl: string;

  beforeEach(() => {
    telemetryReport = vi.fn();
    TestBed.configureTestingModule({
      providers: [AppErrorHandler, { provide: ErrorTelemetry, useValue: { report: telemetryReport } }],
    });
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    previousUrl = location.pathname;
    history.pushState(null, '', `/rx/${TOKEN}`);
  });

  afterEach(() => {
    history.pushState(null, '', previousUrl);
    consoleError.mockRestore();
  });

  it('un fallo en /rx/<token> no deja el token en la consola, el registro ni la telemetría', () => {
    TestBed.inject(AppErrorHandler).handleError(new Error('roto al pintar'));

    const reported = TestBed.inject(ErrorReporter).ultimo();
    expect(reported?.context.route).toBe('/rx/:token');
    expect(telemetryReport).toHaveBeenCalledWith(
      expect.any(Error),
      'error-handler',
      expect.any(String),
      '/rx/:token',
    );
    const logged = consoleError.mock.calls.map((call: unknown[]) => String(call[0]));
    expect(logged.join('\n')).not.toContain(TOKEN);
  });
});

describe('AppErrorHandler · trozo de una construcción que ya no existe', () => {
  it('registra el fallo y le pasa el error a StaleBuildRecovery', () => {
    const recoverFromBackground = vi.fn().mockResolvedValue(false);
    TestBed.configureTestingModule({
      providers: [
        AppErrorHandler,
        { provide: ErrorTelemetry, useValue: { report: vi.fn() } },
        { provide: StaleBuildRecovery, useValue: { recoverFromBackground } },
      ],
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = new Error('NG0750');

    TestBed.inject(AppErrorHandler).handleError(error);

    expect(TestBed.inject(ErrorReporter).ultimo()?.message).toContain('NG0750');
    expect(recoverFromBackground).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });
});
