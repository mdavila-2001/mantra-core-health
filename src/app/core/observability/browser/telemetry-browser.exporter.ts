import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchSpanProcessor, type SpanProcessor } from '@opentelemetry/sdk-trace-web';

import type { TelemetryConfig } from '../config/telemetry.types';

/**
 * Cómo salen los spans del navegador.
 *
 * ## Por lotes, no de uno en uno
 *
 * `SimpleSpanProcessor` exporta cada span en cuanto se cierra: una petición de
 * red por span. En una navegación con cuatro llamadas a la API serían seis
 * peticiones extra compitiendo con las de la aplicación por las conexiones del
 * navegador. `BatchSpanProcessor` acumula y manda una cada cinco segundos.
 *
 * ## Los números, y por qué éstos
 *
 * No son los que trae el SDK. Están bajados porque una pestaña no es un
 * servidor: no hay memoria de sobra, y una traza que se queda esperando en la
 * cola mientras la persona cierra la pestaña es una traza perdida.
 *
 * ## Qué pasa si el Collector no está
 *
 * Nada visible. El exportador falla, el lote se descarta y la aplicación sigue
 * igual: no hay reintento infinito, no hay cola que crezca y no hay excepción
 * que suba a la interfaz. Es un requisito, no una consecuencia — una
 * aplicación de salud no puede dejar de funcionar porque un servidor de
 * observabilidad esté caído.
 */
export function browserSpanProcessor(config: TelemetryConfig): SpanProcessor {
  return new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: config.tracesEndpoint,

      /**
       * **Sin cabeceras.** Y no es un olvido: una cabecera de autenticación
       * acá viajaría dentro del paquete que descarga cualquiera, así que no
       * autenticaría a nadie. Y agregarla dispararía el preflight que el
       * endpoint de mismo origen existe para evitar.
       *
       * El endpoint lo protege el servidor. Ver la fase del gateway en
       * `docs/observability/angular/07-operations-runbook.md`.
       */

      /**
       * Un lote en vuelo por vez. Dos peticiones de telemetría simultáneas
       * compiten con las de la aplicación por el límite de conexiones del
       * navegador, y la telemetría nunca es lo urgente.
       */
      concurrencyLimit: 1,

      /** Un lote que no salió en cinco segundos ya no interesa. */
      timeoutMillis: 5_000,
    }),
    {
      /**
       * El tope de la cola. Al llenarse se descartan los spans nuevos: es la
       * salvaguarda contra el caso «Collector caído y sesión larga», donde sin
       * tope la pestaña acumularía spans hasta quedarse sin memoria.
       */
      maxQueueSize: 256,

      /**
       * Cuántos van en cada petición. Con 64 spans el cuerpo queda en decenas
       * de kilobytes, muy por debajo del límite que el gateway impone.
       */
      maxExportBatchSize: 64,

      /**
       * Cada cinco segundos. Más seguido gasta batería y conexiones; más
       * espaciado aumenta lo que se pierde si la pestaña se cierra de golpe
       * —aunque el vaciado de `telemetry-browser.lifecycle.ts` cubre justo ese
       * caso—.
       */
      scheduledDelayMillis: 5_000,

      exportTimeoutMillis: 5_000,
    },
  );
}
