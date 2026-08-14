import { ATTR } from './tracing.constants';
import { recordDeferredSpan, type DeferredSpanEvent } from './deferred-spans';
import { sanitizeUrl } from '../privacy/sanitize-url';
import { SPAN_NAMES } from './tracing.constants';

/**
 * La carga del documento, medida con la API del propio navegador.
 *
 * ## Por qué no se usa `@opentelemetry/instrumentation-document-load`
 *
 * Existe, es oficial y hace más que esto. También hace dos cosas que acá no
 * convienen:
 *
 *   1. **Un span por recurso descargado.** Con las tipografías autoalojadas y
 *      cinco archivos iniciales, son decenas de spans por carga que repiten lo
 *      que estos cinco atributos ya dicen. Multiplicado por cada visita, es la
 *      mayor fuente de volumen de todo el sistema.
 *   2. **Arrastra `@opentelemetry/instrumentation`** y su maquinaria de
 *      parcheo, en un paquete que ya excede su presupuesto.
 *
 * Lo que sí aporta —la duración de la carga, el tiempo hasta el primer byte, el
 * tipo de navegación— sale entero de `PerformanceNavigationTiming`, que el
 * navegador ya calculó.
 *
 * ## Por qué es un span diferido
 *
 * Cuando esto corre, el SDK todavía puede estar descargándose. El intervalo ya
 * ocurrió y sus tiempos son conocidos, así que se anota y se emite después con
 * su duración real. Ver `deferred-spans.ts`.
 */
export function recordDocumentLoadSpan(): void {
  const timing = navigationTiming();
  if (timing === null) {
    return;
  }

  const origin = performance.timeOrigin;

  /**
   * Con `loadEventEnd` en cero el evento `load` todavía no terminó, y el
   * intervalo no está cerrado. Se usa `responseEnd`, que sí lo está: mejor un
   * span más corto y cierto que uno completo e inventado.
   */
  const end = timing.loadEventEnd > 0 ? timing.loadEventEnd : timing.responseEnd;

  const events: DeferredSpanEvent[] = [];
  const at = (name: string, relative: number): void => {
    if (relative > 0) {
      events.push({ name, time: origin + relative });
    }
  };

  at('document.response.start', timing.responseStart);
  at('document.response.end', timing.responseEnd);
  at('document.interactive', timing.domInteractive);
  at('document.dom.content.loaded', timing.domContentLoadedEventEnd);
  at('document.load.end', timing.loadEventEnd);

  recordDeferredSpan({
    name: SPAN_NAMES.documentLoad,
    startTime: origin,
    endTime: origin + end,
    events,
    attributes: {
      /**
       * La ruta, sin query. Es la única forma en que puede viajar: dos de las
       * rutas de esta aplicación llevan un token de un solo uso en el query
       * string (`/auth/verify-email?token=…`).
       */
      [ATTR.routeTemplate]: sanitizeUrl(location.pathname),

      /** `navigate`, `reload`, `back_forward` o `prerender`. */
      'browser.navigation.type': timing.type,

      /**
       * Tiempo hasta el primer byte, en milisegundos. Es lo que separa «el
       * servidor tardó» de «el navegador tardó», que es la primera bifurcación
       * al mirar una carga lenta.
       */
      'http.server.response.time_ms': Math.round(timing.responseStart),

      /**
       * Si el documento llegó comprimido y ya descomprimido. Sirve para
       * detectar una regresión de tamaño sin guardar la lista de recursos.
       */
      'document.transfer.size': timing.transferSize,
      'document.decoded.size': timing.decodedBodySize,
    },
  });
}

/**
 * La entrada de navegación, si el navegador la expone.
 *
 * Puede faltar: en jsdom, tras una restauración desde la caché de retroceso, o
 * en un navegador que no implemente la especificación. La ausencia no es un
 * error — simplemente no hay carga que medir.
 */
function navigationTiming(): PerformanceNavigationTiming | null {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function') {
    return null;
  }

  const [entry] = performance.getEntriesByType('navigation');
  return entry instanceof PerformanceNavigationTiming ? entry : null;
}
