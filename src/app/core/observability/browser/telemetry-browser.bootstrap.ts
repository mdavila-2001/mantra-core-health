import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { StackContextManager, WebTracerProvider } from '@opentelemetry/sdk-trace-web';

import type { TelemetryConfig } from '../config/telemetry.types';
import { flushDeferredSpans, resetDeferredSpans } from '../tracing/deferred-spans';
import { browserSpanProcessor } from './telemetry-browser.exporter';
import { registerFlushOnPageHide } from './telemetry-browser.lifecycle';
import { browserResource } from './telemetry-browser.resource';
import { browserSampler } from './telemetry-browser.sampling';

/**
 * Registra el SDK del navegador. **Este archivo es el fragmento diferido.**
 *
 * Todo lo que importa —el SDK, el exportador, los recursos— entra por acá y por
 * ningún otro sitio, que es lo que mantiene esos ~150 kB fuera del paquete
 * inicial. La regla práctica: si un archivo de `core/observability/` importa de
 * `@opentelemetry/sdk-trace-web` o de `@opentelemetry/exporter-*`, tiene que
 * estar debajo de `browser/`, o el empaquetador lo arrastrará al inicio.
 *
 * Lo único que el resto de la aplicación importa de forma estática es
 * `@opentelemetry/api`, que son unos pocos kilobytes y no trae maquinaria.
 */

let started: TelemetryHandle | null = null;

export interface TelemetryHandle {
  /** Cierra el proveedor y da de baja los oyentes. Para pruebas y recargas. */
  readonly shutdown: () => Promise<void>;
  /** Fuerza la salida de la cola. Lo usa la verificación de extremo a extremo. */
  readonly flush: () => Promise<void>;
}

/**
 * Arranca la telemetría del navegador. Idempotente.
 *
 * La idempotencia no es defensiva: hace falta en tres situaciones reales.
 * La recarga en caliente del servidor de desarrollo vuelve a evaluar el módulo;
 * las pruebas arrancan la aplicación varias veces en el mismo proceso; y
 * `main.ts` podría llamarse dos veces si alguien agrega otro punto de entrada.
 * Registrar dos proveedores globales dejaría spans huérfanos en el primero, sin
 * ningún error visible.
 */
export function startBrowserTelemetry(config: TelemetryConfig): TelemetryHandle {
  if (started !== null) {
    return started;
  }

  const provider = new WebTracerProvider({
    resource: browserResource(config),
    sampler: browserSampler(config),
    spanProcessors: [browserSpanProcessor(config)],
  });

  provider.register({
    /**
     * `StackContextManager` es el que trae el SDK y el único posible acá: el
     * otro, `ZoneContextManager`, necesita Zone.js, y este proyecto no lo
     * tiene. Mantiene el contexto de forma **síncrona**; cruzando un `await` o
     * un operador de RxJS se pierde, y por eso todo lo que lo necesita lo
     * propaga de forma explícita. Ver
     * `docs/observability/angular/03-async-context-strategy.md`.
     */
    contextManager: new StackContextManager(),

    /**
     * Solo `traceparent` y `tracestate`. **Sin `baggage`**: es un mecanismo
     * para arrastrar pares clave-valor por toda la traza, y en un sistema de
     * salud es la vía más directa para que un identificador de persona termine
     * viajando a cada servicio. Se agregará el día que haya una necesidad
     * concreta que lo justifique, no antes.
     */
    propagator: new W3CTraceContextPropagator(),
  });

  const unregisterLifecycle = registerFlushOnPageHide(provider);

  /**
   * Lo que se anotó mientras este fragmento se descargaba —el arranque de
   * Angular, la primera navegación— sale ahora, con sus tiempos originales.
   */
  flushDeferredSpans();

  started = {
    flush: () => provider.forceFlush(),
    shutdown: async () => {
      unregisterLifecycle();
      started = null;
      resetDeferredSpans();
      await provider.shutdown();
    },
  };

  return started;
}

/** Si ya hay telemetría corriendo. Existe para poder afirmarlo en una prueba. */
export function browserTelemetryHandle(): TelemetryHandle | null {
  return started;
}
