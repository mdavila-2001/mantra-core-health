import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { defaultResource, resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  NodeTracerProvider,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import type { ServerTelemetryConfig } from './server-telemetry.config';

/**
 * El SDK de Node, para el proceso que renderiza en el servidor.
 *
 * ## Por qué instrumentación manual y no `auto-instrumentations-node`
 *
 * Es la recomendación habitual para un servicio de Node, y **acá no funciona**.
 * La instrumentación automática parchea los módulos al cargarlos: intercepta
 * `require('http')` y devuelve una versión envuelta. El servidor de Angular no
 * carga módulos así — `@angular/build` lo empaqueta entero con esbuild en un
 * `server.mjs`, donde no queda ningún `require` que interceptar.
 *
 * El resultado de instalarla sería el peor posible: se instala, arranca sin
 * error, no produce ni un span, y nadie sabe por qué. Por eso los spans del
 * servidor son manuales (`server-tracing.middleware.ts`), que es poco pero es
 * cierto: la petición entrante y su render.
 *
 * ## Lo que no cubre, dicho de frente
 *
 * Una llamada saliente del servidor no aparece sola. Si el SSR empieza a pedir
 * datos a la API, hay que envolver esa llamada a mano o el span del render
 * dirá que tardó sin decir en qué.
 */

let provider: NodeTracerProvider | null = null;

export interface ServerTelemetryHandle {
  readonly shutdown: () => Promise<void>;
}

/**
 * Arranca el SDK del servidor. Idempotente y silencioso ante fallos.
 *
 * Devuelve `null` con la telemetría apagada, que es lo que permite a
 * `server.ts` decidir si registra el middleware sin repetir la comprobación.
 */
export function startServerTelemetry(config: ServerTelemetryConfig): ServerTelemetryHandle | null {
  if (!config.enabled) {
    return null;
  }

  if (provider !== null) {
    return handleFor(provider);
  }

  provider = new NodeTracerProvider({
    resource: defaultResource().merge(
      resourceFromAttributes({
        [ATTR_SERVICE_NAME]: config.serviceName,
        [ATTR_SERVICE_VERSION]: config.version,
        'service.namespace': config.namespace,
        'deployment.environment.name': config.environment,
        'app.framework': 'angular',
        /**
         * Fijo, y por eso mismo útil: este proceso **siempre** renderiza en el
         * servidor. Es lo que separa sus spans de los del navegador cuando
         * alguien filtra por modo de renderizado sin mirar el servicio.
         */
        'angular.rendering.mode': 'ssr',
      }),
    ),

    /**
     * Basado en el padre. Cuando el navegador ya decidió muestrear una traza,
     * el render que la continúa se conserva aunque el ratio del servidor sea
     * más bajo: la traza llega entera o no llega.
     */
    sampler: new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(config.sampleRatio),
    }),

    spanProcessors: [
      new BatchSpanProcessor(
        new OTLPTraceExporter({ url: `${config.collectorUrl}/v1/traces` }),
        { maxQueueSize: 1_024, maxExportBatchSize: 256, scheduledDelayMillis: 2_000 },
      ),
    ],
  });

  /**
   * `register()` instala el gestor de contexto de Node, que sí propaga a través
   * de `await` y de los callbacks —usa `AsyncLocalStorage`—. Es la diferencia
   * con el navegador, donde sin Zone.js el contexto no cruza un `await` y hay
   * que propagarlo a mano.
   */
  provider.register({ propagator: new W3CTraceContextPropagator() });

  return handleFor(provider);
}

function handleFor(active: NodeTracerProvider): ServerTelemetryHandle {
  return {
    /**
     * Cierre limpio. Sin esto, al recibir una señal de parada el proceso muere
     * con la cola llena y se pierden las trazas de justo antes del reinicio,
     * que son las que explican por qué se reinició.
     */
    shutdown: async () => {
      provider = null;
      await active.shutdown();
    },
  };
}
