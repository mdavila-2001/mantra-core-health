import { TestBed } from '@angular/core/testing';
import { context, trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  StackContextManager,
} from '@opentelemetry/sdk-trace-web';

import { TELEMETRY_CONFIG } from '../config/telemetry.token';
import type { TelemetryConfig } from '../config/telemetry.types';
import { TracingService } from '../tracing/tracing.service';
import { ErrorDeduplicator } from './error-deduplicator';
import { ErrorTelemetry } from './error-telemetry';

const CONFIG: TelemetryConfig = {
  enabled: true,
  serviceName: 'mantra-angular-web',
  namespace: 'mantra',
  environment: 'test',
  tracesEndpoint: '/otel/v1/traces',
  sampleRatio: 1,
  version: '1.2.3',
  buildId: 'abc1234',
  renderingMode: 'csr',
};

describe('ErrorDeduplicator', () => {
  let dedup: ErrorDeduplicator;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    dedup = TestBed.inject(ErrorDeduplicator);
  });

  it('deja pasar la primera aparición', () => {
    expect(dedup.shouldReport(new Error('roto'), 1_000)).toBe(true);
  });

  it('corta las repeticiones dentro de la ventana', () => {
    // Un mismo fallo llega por ErrorHandler, window.error y unhandledrejection.
    // Sin esto, el panel contaría tres errores donde hubo uno.
    dedup.shouldReport(new Error('roto'), 1_000);

    expect(dedup.shouldReport(new Error('roto'), 1_010)).toBe(false);
    expect(dedup.shouldReport(new Error('roto'), 1_500)).toBe(false);
  });

  it('vuelve a contar pasada la ventana: repetir de verdad sí es otro fallo', () => {
    dedup.shouldReport(new Error('roto'), 1_000);

    expect(dedup.shouldReport(new Error('roto'), 5_000)).toBe(true);
  });

  it('agrupa por clase y mensaje, no por identidad del objeto', () => {
    // `unhandledrejection` entrega el motivo, no el mismo objeto.
    dedup.shouldReport(new Error('roto'), 1_000);

    expect(dedup.shouldReport(new Error('roto'), 1_100)).toBe(false);
  });

  it('el identificador saneado hace que dos fallos «distintos» agrupen', () => {
    dedup.shouldReport(new Error('no se encontró 3f2504e0-4f89-11d3-9a0c-0305e82c3301'), 1_000);

    expect(
      dedup.shouldReport(new Error('no se encontró 7b1e4a02-1234-11d3-9a0c-0305e82c3399'), 1_100),
    ).toBe(false);
  });

  it('distingue errores realmente distintos', () => {
    dedup.shouldReport(new Error('uno'), 1_000);

    expect(dedup.shouldReport(new TypeError('uno'), 1_010)).toBe(true);
    expect(dedup.shouldReport(new Error('dos'), 1_020)).toBe(true);
  });
});

describe('ErrorTelemetry', () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;
  let telemetry: ErrorTelemetry;
  let tracing: TracingService;

  function montar(config: Partial<TelemetryConfig> = {}): void {
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    trace.setGlobalTracerProvider(provider);
    context.setGlobalContextManager(new StackContextManager().enable());

    TestBed.configureTestingModule({
      providers: [{ provide: TELEMETRY_CONFIG, useValue: { ...CONFIG, ...config } }],
    });
    telemetry = TestBed.inject(ErrorTelemetry);
    tracing = TestBed.inject(TracingService);
  }

  afterEach(async () => {
    await provider.shutdown();
    trace.disable();
    context.disable();
  });

  it('abre una traza propia cuando no hay ninguna: el fallo de render era invisible', () => {
    montar();

    telemetry.report(new Error('roto al pintar'), 'error-handler', 'E-abc1234-001', '/panel');

    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe('angular.error');
    expect(span?.attributes['error.type']).toBe('Error');
    expect(span?.attributes['error.source']).toBe('error-handler');
    expect(span?.attributes['error.handled']).toBe(false);
    expect(span?.status.code).toBe(2);
  });

  it('lleva el código de soporte, que es lo que cierra el circuito con la persona', () => {
    montar();

    telemetry.report(new Error('roto'), 'error-handler', 'E-abc1234-007', '/panel');

    expect(exporter.getFinishedSpans()[0]?.attributes['app.support.id']).toBe('E-abc1234-007');
  });

  it('marca el span abierto en vez de crear otro: «error durante esto» es lo accionable', () => {
    montar();

    tracing.runInSpan('angular.navigation', {}, () => {
      telemetry.report(new Error('roto'), 'router', 'E-abc1234-002', '/panel');
    });

    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(spans[0]?.name).toBe('angular.navigation');
    expect(spans[0]?.attributes['error.type']).toBe('Error');
  });

  it('reconoce un fallo de hidratación por su código', () => {
    montar();

    telemetry.report(new Error('NG0500: Hydration node mismatch'), 'error-handler', 'E-1', '/');

    expect(exporter.getFinishedSpans()[0]?.attributes['error.source']).toBe('hydration');
  });

  it('NO registra la traza de pila', () => {
    montar();

    const error = new Error('roto');
    error.stack = 'Error: roto\n    at Paciente (dni 12345678)';
    telemetry.report(error, 'error-handler', 'E-1', '/panel');

    const [span] = exporter.getFinishedSpans();
    const expuesto = `${JSON.stringify(span?.attributes)} ${span?.status.message ?? ''}`;
    expect(expuesto).not.toContain('12345678');
    expect(span?.events).toHaveLength(0);
  });

  it('sanea el mensaje antes de ponerlo en el estado', () => {
    montar();

    telemetry.report(new Error('falló para ana@clinica.example'), 'http', 'E-1', '/panel');

    expect(exporter.getFinishedSpans()[0]?.status.message).toBe('falló para «correo»');
  });

  it('con la telemetría apagada no hace nada', () => {
    montar({ enabled: false });

    telemetry.report(new Error('roto'), 'error-handler', 'E-1', '/panel');

    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });

  it('no duplica el mismo fallo llegado por dos caminos', () => {
    montar();

    const error = new Error('roto');
    telemetry.report(error, 'error-handler', 'E-1', '/panel');
    telemetry.report(error, 'router', 'E-2', '/panel');

    expect(exporter.getFinishedSpans()).toHaveLength(1);
  });
});
