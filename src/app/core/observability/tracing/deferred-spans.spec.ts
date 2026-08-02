import { trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
} from '@opentelemetry/sdk-trace-web';

import {
  DEFERRED_LIMIT,
  flushDeferredSpans,
  isTelemetryReady,
  pendingDeferredSpans,
  recordDeferredSpan,
  resetDeferredSpans,
} from './deferred-spans';

/**
 * Lo que esto resuelve: el SDK llega unos milisegundos tarde —vive en un
 * fragmento aparte— y justo en esa ventana ocurre lo primero que hay que medir.
 *
 * La alternativa prohibida sería generar un `trace_id` a mano para poder abrir
 * el span antes de tiempo. Estas pruebas fijan la solución que no lo necesita:
 * anotar el intervalo y emitirlo después **con sus tiempos reales**.
 */
describe('deferredSpans', () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;

  beforeEach(() => {
    resetDeferredSpans();
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    trace.setGlobalTracerProvider(provider);
  });

  afterEach(async () => {
    resetDeferredSpans();
    await provider.shutdown();
    trace.disable();
  });

  const SPAN = {
    name: 'angular.bootstrap',
    startTime: 1_000_000,
    endTime: 1_000_450,
    attributes: { 'ui.result': 'success' },
    events: [{ name: 'bootstrap.started', time: 1_000_000 }],
  };

  it('guarda mientras el SDK no está listo', () => {
    recordDeferredSpan(SPAN);

    expect(isTelemetryReady()).toBe(false);
    expect(pendingDeferredSpans()).toHaveLength(1);
    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });

  it('al vaciar, emite con la duración real y no con la del momento de emitir', () => {
    recordDeferredSpan(SPAN);
    flushDeferredSpans();

    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe('angular.bootstrap');
    // 450 ms: los que pasaron de verdad, no los que llevaba esperando.
    expect(hrToMs(span?.duration ?? [0, 0])).toBe(450);
    expect(span?.events[0]?.name).toBe('bootstrap.started');
    expect(span?.attributes['ui.result']).toBe('success');
  });

  it('emite en el acto lo que llegue después de estar listo', () => {
    flushDeferredSpans();
    recordDeferredSpan(SPAN);

    expect(pendingDeferredSpans()).toHaveLength(0);
    expect(exporter.getFinishedSpans()).toHaveLength(1);
  });

  it('emite como raíz: colgarlo de un padre casual inventaría la jerarquía', () => {
    recordDeferredSpan(SPAN);
    flushDeferredSpans();

    expect(exporter.getFinishedSpans()[0]?.parentSpanContext).toBeUndefined();
  });

  it('marca el error sin arrastrar el objeto', () => {
    recordDeferredSpan({ ...SPAN, errorType: 'ChunkLoadError' });
    flushDeferredSpans();

    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes['error.type']).toBe('ChunkLoadError');
    expect(span?.status.code).toBe(2);
  });

  it('deja de guardar al llegar al tope: sin él, un fragmento que no baja hace crecer el búfer', () => {
    for (let i = 0; i < DEFERRED_LIMIT + 20; i += 1) {
      recordDeferredSpan({ ...SPAN, name: `span-${i}` });
    }

    expect(pendingDeferredSpans()).toHaveLength(DEFERRED_LIMIT);
  });

  it('vaciar es idempotente: la recarga en caliente pasa dos veces por acá', () => {
    recordDeferredSpan(SPAN);
    flushDeferredSpans();
    flushDeferredSpans();

    expect(exporter.getFinishedSpans()).toHaveLength(1);
  });
});

/** `[segundos, nanosegundos]` → milisegundos. */
function hrToMs([seconds, nanos]: [number, number]): number {
  return seconds * 1000 + nanos / 1e6;
}
