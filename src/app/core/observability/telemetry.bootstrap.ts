import { shouldStartBrowserTelemetry, telemetryConfig } from './config/telemetry.config';
import type { TelemetryConfig } from './config/telemetry.types';
import { recordDeferredSpan, type DeferredSpanEvent } from './tracing/deferred-spans';
import { recordDocumentLoadSpan } from './tracing/document-load';
import { typeOf } from './errors/error-sanitizer';
import { ATTR, SPAN_EVENTS, SPAN_NAMES } from './tracing/tracing.constants';

/**
 * El único punto que corre **antes** que Angular.
 *
 * Lo llama `src/main.ts`, y de ahí salen dos cosas a la vez:
 *
 *   1. **La descarga del SDK arranca**, sin que nadie la espere. Es un
 *      `import()` cuyo resultado se ignora: si tarda, si falla, si un
 *      bloqueador de contenido lo corta, el arranque de Angular no se entera.
 *   2. **Empieza a medirse el arranque**, aunque el SDK todavía no exista. Los
 *      instantes se anotan y el span se emite cuando el SDK llega, con su
 *      duración real. Ver `tracing/deferred-spans.ts`.
 *
 * ## Lo que este archivo no hace, y es a propósito
 *
 * **No espera nada.** No devuelve una promesa que `main.ts` deba resolver, no
 * agrega un inicializador bloqueante y no retrasa el primer pintado ni un
 * milisegundo. Una aplicación que arranca más lento por su telemetría ya
 * perdió: la observabilidad está para explicar la latencia, no para causarla.
 *
 * **No lanza.** Ni con la configuración rota, ni sin `fetch`, ni con el
 * fragmento del SDK caído. En todos esos casos devuelve un objeto que no hace
 * nada y la aplicación sigue exactamente igual.
 */

/** Lo que `main.ts` usa para cerrar el span del arranque. */
export interface BootstrapTrace {
  readonly completed: () => void;
  readonly failed: (error: unknown) => void;
}

const NOOP: BootstrapTrace = { completed: () => undefined, failed: () => undefined };

export function startTelemetry(config: TelemetryConfig = telemetryConfig()): BootstrapTrace {
  if (!shouldStartBrowserTelemetry(config)) {
    return NOOP;
  }

  const startTime = Date.now();
  const events: DeferredSpanEvent[] = [
    { name: SPAN_EVENTS.bootstrapStarted, time: startTime },
  ];

  /**
   * `void` y no `await`: es lo que convierte esto en no bloqueante.
   *
   * El `import()` dinámico es lo que mantiene el SDK —unos 150 kB— fuera del
   * paquete inicial, que en este proyecto ya excede su presupuesto en 41 kB.
   */
  void import('./browser/telemetry-browser.bootstrap')
    .then(({ startBrowserTelemetry }) => {
      startBrowserTelemetry(config);
      events.push({ name: SPAN_EVENTS.otelInitialized, time: Date.now() });
    })
    .catch(() => {
      /**
       * El fragmento no bajó. Pasa con un bloqueador de contenido, con una
       * versión desplegada mientras alguien tenía la anterior abierta, o sin
       * conexión. Lo anotado se descarta solo al vencer su plazo, y la
       * aplicación no se entera: es exactamente el comportamiento que se pide.
       */
    });

  const close = (result: 'success' | 'error', error?: unknown): void => {
    const endTime = Date.now();
    events.push({ name: SPAN_EVENTS.bootstrapCompleted, time: endTime });

    recordDeferredSpan({
      name: SPAN_NAMES.bootstrap,
      startTime,
      endTime,
      events,
      errorType: error === undefined ? undefined : typeOf(error),
      attributes: {
        [ATTR.result]: result,
        [ATTR.renderingMode]: config.renderingMode,
        [ATTR.environment]: config.environment,
        [ATTR.release]: config.version,
        [ATTR.buildId]: config.buildId,
      },
    });

    /**
     * La carga del documento se anota **después** del arranque de Angular a
     * propósito: para entonces `loadEventEnd` ya tiene valor y el intervalo
     * está cerrado.
     */
    recordDocumentLoadSpan();
  };

  return {
    completed: () => close('success'),
    failed: (error: unknown) => close('error', error),
  };
}
