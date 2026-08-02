import { TestBed } from '@angular/core/testing';
import { context, trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  StackContextManager,
} from '@opentelemetry/sdk-trace-web';
import { Subject, throwError, timer } from 'rxjs';

import { TELEMETRY_CONFIG } from '../config/telemetry.token';
import type { TelemetryConfig } from '../config/telemetry.types';
import { TracingService } from './tracing.service';

/**
 * Se prueba contra un exportador **en memoria**, no contra un Collector.
 *
 * Una prueba unitaria que necesita red no es una prueba unitaria: falla por
 * motivos que no son del código y se acaba desactivando. `InMemorySpanExporter`
 * da exactamente lo que hace falta —los spans terminados, con sus atributos— y
 * corre en milisegundos.
 */
const CONFIG: TelemetryConfig = {
  enabled: true,
  serviceName: 'mantra-angular-web',
  namespace: 'mantra',
  environment: 'test',
  tracesEndpoint: '/otel/v1/traces',
  sampleRatio: 1,
  version: '0.0.0-test',
  buildId: 'test',
  renderingMode: 'csr',
};

describe('TracingService', () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;
  let tracing: TracingService;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    trace.setGlobalTracerProvider(provider);
    context.setGlobalContextManager(new StackContextManager().enable());

    TestBed.configureTestingModule({
      providers: [{ provide: TELEMETRY_CONFIG, useValue: CONFIG }],
    });
    tracing = TestBed.inject(TracingService);
  });

  afterEach(async () => {
    await provider.shutdown();
    trace.disable();
    context.disable();
  });

  const nombres = (): string[] => exporter.getFinishedSpans().map((span) => span.name);

  describe('runInSpan', () => {
    it('cierra el span y devuelve el resultado', () => {
      const resultado = tracing.runInSpan('prueba', { 'app.feature': 'test' }, () => 42);

      expect(resultado).toBe(42);
      expect(nombres()).toEqual(['prueba']);
      expect(exporter.getFinishedSpans()[0]?.attributes['app.feature']).toBe('test');
    });

    it('relanza el error: un span no puede cambiar el comportamiento', () => {
      expect(() =>
        tracing.runInSpan('falla', {}, () => {
          throw new Error('roto');
        }),
      ).toThrow('roto');

      const span = exporter.getFinishedSpans()[0];
      expect(span?.status.code).toBe(2); // ERROR
      expect(span?.attributes['error.type']).toBe('Error');
    });

    it('NO registra la traza de pila del error', () => {
      const error = new Error('roto');
      error.stack = 'Error: roto\n    at Paciente (dni 12345678)';

      expect(() =>
        tracing.runInSpan('falla', {}, () => {
          throw error;
        }),
      ).toThrow();

      const span = exporter.getFinishedSpans()[0];

      // Los tres sitios por donde una traza de pila podría colarse: los
      // atributos, la descripción del estado y los eventos —que es donde
      // `span.recordException` la habría dejado si se usara—.
      const expuesto = [
        JSON.stringify(span?.attributes),
        span?.status.message ?? '',
        JSON.stringify(span?.events),
      ].join(' ');

      expect(expuesto).not.toContain('12345678');
      expect(expuesto).not.toContain('at Paciente');
      expect(span?.events).toHaveLength(0);
    });

    it('deja el span activo, para que lo de dentro cuelgue de él', () => {
      tracing.runInSpan('padre', {}, () => {
        tracing.runInSpan('hijo', {}, () => undefined);
      });

      const [hijo, padre] = exporter.getFinishedSpans();
      expect(hijo?.name).toBe('hijo');
      expect(hijo?.parentSpanContext?.spanId).toBe(padre?.spanContext().spanId);
    });
  });

  describe('runInAsyncSpan', () => {
    it('cierra el span cuando la promesa resuelve', async () => {
      const resultado = await tracing.runInAsyncSpan('async', {}, async () => 'listo');

      expect(resultado).toBe('listo');
      expect(nombres()).toEqual(['async']);
    });

    it('marca el error y lo relanza', async () => {
      await expect(
        tracing.runInAsyncSpan('async', {}, () => Promise.reject(new TypeError('mal'))),
      ).rejects.toThrow('mal');

      expect(exporter.getFinishedSpans()[0]?.attributes['error.type']).toBe('TypeError');
    });
  });

  describe('traceObservable', () => {
    it('NO abre span si nadie se suscribe', () => {
      tracing.traceObservable('nunca', {}, () => timer(0));

      expect(exporter.getFinishedSpans()).toHaveLength(0);
    });

    it('abre uno solo al suscribirse y lo cierra al completar', async () => {
      await new Promise<void>((resolve) => {
        tracing.traceObservable('flujo', {}, () => timer(1)).subscribe({ complete: resolve });
      });

      expect(nombres()).toEqual(['flujo']);
    });

    it('un span por operación, no uno por emisión', () => {
      const fuente = new Subject<number>();
      const suscripcion = tracing.traceObservable('flujo', {}, () => fuente).subscribe();

      fuente.next(1);
      fuente.next(2);
      fuente.next(3);
      expect(exporter.getFinishedSpans()).toHaveLength(0);

      fuente.complete();
      suscripcion.unsubscribe();

      expect(nombres()).toEqual(['flujo']);
    });

    it('marca cancelado —no error— cuando alguien se da de baja antes', () => {
      const fuente = new Subject<number>();
      tracing.traceObservable('flujo', {}, () => fuente).subscribe().unsubscribe();

      const span = exporter.getFinishedSpans()[0];
      expect(span?.attributes['ui.result']).toBe('cancelled');
      expect(span?.status.code).not.toBe(2);
    });

    it('marca el error y lo deja pasar', () => {
      let recibido: unknown = null;
      tracing
        .traceObservable('flujo', {}, () => throwError(() => new Error('caído')))
        .subscribe({ error: (error: unknown) => (recibido = error) });

      expect((recibido as Error).message).toBe('caído');
      expect(exporter.getFinishedSpans()[0]?.status.code).toBe(2);
    });

    it('deja el span activo durante la suscripción, no solo al construir', () => {
      let hijoCreado = false;

      tracing
        .traceObservable('padre', {}, () => {
          return new (class extends Subject<void> {})();
        })
        .subscribe();

      // El span padre está abierto: un span creado ahora cuelga de él.
      tracing.runInSpan('suelto', {}, () => {
        hijoCreado = true;
      });

      expect(hijoCreado).toBe(true);
    });
  });

});

/**
 * El comportamiento «no-op», que es el que corre en la inmensa mayoría de las
 * cargas: la telemetría viene apagada por defecto.
 *
 * No hay una clase aparte para esto —`@opentelemetry/api` ya devuelve un
 * trazador que no registra nada cuando no hay proveedor— y precisamente por eso
 * hace falta fijarlo con pruebas: es un comportamiento heredado de una
 * dependencia, no código propio, y podría cambiar al actualizar.
 *
 * Este bloque **no registra ningún proveedor**, que es la única forma honesta
 * de reproducir el caso.
 */
describe('TracingService sin SDK registrado', () => {
  let tracing: TracingService;

  beforeEach(() => {
    trace.disable();
    context.disable();

    TestBed.configureTestingModule({
      providers: [{ provide: TELEMETRY_CONFIG, useValue: { ...CONFIG, enabled: false } }],
    });
    tracing = TestBed.inject(TracingService);
  });

  it('ejecuta la operación y devuelve su resultado', () => {
    expect(tracing.runInSpan('nada', {}, () => 'resultado')).toBe('resultado');
  });

  it('crea spans que no registran nada', () => {
    const span = tracing.startSpan('nada');

    expect(span.isRecording()).toBe(false);
    span.end();
  });

  it('conserva los errores', () => {
    expect(() =>
      tracing.runInSpan('nada', {}, () => {
        throw new Error('sigue subiendo');
      }),
    ).toThrow('sigue subiendo');
  });

  it('no altera un Observable: mismas emisiones, mismo final', () => {
    const recibido: number[] = [];
    let completado = false;

    const fuente = new Subject<number>();
    tracing
      .traceObservable('nada', {}, () => fuente)
      .subscribe({ next: (n) => recibido.push(n), complete: () => (completado = true) });

    fuente.next(1);
    fuente.next(2);
    fuente.complete();

    expect(recibido).toEqual([1, 2]);
    expect(completado).toBe(true);
  });
});
