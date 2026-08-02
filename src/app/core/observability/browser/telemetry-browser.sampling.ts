import {
  AlwaysOffSampler,
  AlwaysOnSampler,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
  type Sampler,
} from '@opentelemetry/sdk-trace-web';

import type { TelemetryConfig } from '../config/telemetry.types';

/**
 * Cuántas trazas se conservan.
 *
 * ## Por qué «basado en el padre»
 *
 * Sin él, cada servicio decidiría por su cuenta y una traza saldría partida: el
 * navegador conserva el span de la navegación, el backend descarta el de la
 * consulta a la base de datos, y en Jaeger aparece una traza con un agujero en
 * el medio. Peor que no tenerla, porque parece completa.
 *
 * `ParentBasedSampler` invierte la regla: **la decisión se toma una vez, en el
 * primero que ve la traza, y todos los demás la respetan**. En este sistema el
 * primero es casi siempre el navegador —es quien inicia la petición— así que el
 * ratio de acá es el que gobierna el volumen del sistema entero, incluido el
 * backend. Bajarlo a la mitad reduce el almacenamiento de todos.
 *
 * ## Por qué no se conservan los errores
 *
 * La tentación es «muestrear al 10 %, pero guardar el 100 % de los errores».
 * No se puede hacer acá: cuando la traza empieza, todavía no se sabe si va a
 * fallar. Un muestreador de cabeza decide antes de que exista el error.
 *
 * Eso se resuelve en el Collector, que ve la traza terminada y puede quedarse
 * con las que tienen error o son lentas
 * (`infra/otel-collector/otel-collector.angular.yml`). El precio es que este
 * ratio no puede bajar tanto: lo que se descarta acá, allá ya no existe.
 */
export function browserSampler(config: TelemetryConfig): Sampler {
  return new ParentBasedSampler({ root: rootSampler(config.sampleRatio) });
}

/**
 * Los dos extremos se atajan aparte.
 *
 * `TraceIdRatioBasedSampler` con 0 o 1 daría el mismo resultado, pero con una
 * comparación por traza que no hace falta y —en el caso del 0— con el SDK
 * generando identificadores para descartarlos acto seguido.
 */
function rootSampler(ratio: number): Sampler {
  if (ratio >= 1) return new AlwaysOnSampler();
  if (ratio <= 0) return new AlwaysOffSampler();
  return new TraceIdRatioBasedSampler(ratio);
}
