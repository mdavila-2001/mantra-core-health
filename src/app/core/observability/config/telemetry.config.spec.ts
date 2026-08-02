import { shouldStartBrowserTelemetry, telemetryConfig } from './telemetry.config';
import { checkTelemetryConfig, describeProblems } from './telemetry-config.validator';
import type { TelemetryConfig, TelemetryEnvironment } from './telemetry.types';

const ENTORNO: TelemetryEnvironment = {
  enabled: true,
  serviceName: 'mantra-angular-web',
  namespace: 'mantra',
  environment: 'test',
  tracesEndpoint: '/otel/v1/traces',
  sampleRatio: 1,
};

const BUILD = { version: '1.2.3', commit: 'abc1234', builtAt: '2026-08-01T00:00:00.000Z' };

const CONFIG: TelemetryConfig = {
  ...ENTORNO,
  version: BUILD.version,
  buildId: BUILD.commit,
  renderingMode: 'csr',
};

describe('telemetryConfig', () => {
  it('junta el entorno con la identidad del artefacto', () => {
    const config = telemetryConfig(ENTORNO, BUILD, 'csr');

    expect(config.serviceName).toBe('mantra-angular-web');
    // El commit, no un valor nuevo: responde «qué código está corriendo».
    expect(config.buildId).toBe('abc1234');
    expect(config.version).toBe('1.2.3');
  });

  it('apaga la telemetría —sin lanzar— si la configuración es inválida', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const config = telemetryConfig({ ...ENTORNO, sampleRatio: 7 }, BUILD, 'csr');

    // Lanzar dejaría la aplicación sin arrancar por un problema que no es suyo.
    expect(config.enabled).toBe(false);
    expect(aviso).toHaveBeenCalled();

    aviso.mockRestore();
  });
});

describe('checkTelemetryConfig', () => {
  it('acepta una configuración correcta', () => {
    expect(checkTelemetryConfig(CONFIG).problems).toHaveLength(0);
  });

  it.each([
    ['ratio negativo', { sampleRatio: -1 }],
    ['ratio mayor que uno', { sampleRatio: 2 }],
    ['ratio no numérico', { sampleRatio: Number.NaN }],
  ])('rechaza un %s', (_caso, parche) => {
    const { problems, config } = checkTelemetryConfig({ ...CONFIG, ...parche });

    expect(problems[0]?.field).toBe('sampleRatio');
    expect(config.enabled).toBe(false);
  });

  it.each([
    ['relativa sin barra', 'otel/v1/traces'],
    ['esquema peligroso', 'javascript:alert(1)'],
    ['vacía', ''],
    ['solo una barra', '/'],
  ])('rechaza un endpoint %s', (_caso, tracesEndpoint) => {
    const { problems } = checkTelemetryConfig({ ...CONFIG, tracesEndpoint });

    expect(problems[0]?.field).toBe('tracesEndpoint');
  });

  it('acepta una URL absoluta para el caso del subdominio de telemetría', () => {
    const { problems } = checkTelemetryConfig({
      ...CONFIG,
      tracesEndpoint: 'https://telemetria.ejemplo.com/v1/traces',
    });

    expect(problems).toHaveLength(0);
  });

  it('un solo problema apaga todo: no hay telemetría a medias', () => {
    const { config } = checkTelemetryConfig({ ...CONFIG, serviceName: '' });

    expect(config.enabled).toBe(false);
  });

  it('describe los problemas en una línea legible', () => {
    const { problems } = checkTelemetryConfig({ ...CONFIG, sampleRatio: 5 });

    expect(describeProblems(problems)).toContain('sampleRatio');
  });
});

describe('shouldStartBrowserTelemetry', () => {
  it('no arranca si está apagada', () => {
    expect(shouldStartBrowserTelemetry({ ...CONFIG, enabled: false })).toBe(false);
  });

  it('arranca en un navegador con fetch', () => {
    expect(shouldStartBrowserTelemetry(CONFIG)).toBe(true);
  });
});
