import { defaultResource, resourceFromAttributes, type Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import type { TelemetryConfig } from '../config/telemetry.types';

/**
 * Quién está emitiendo estas trazas.
 *
 * El recurso se adjunta a **todos** los spans del proceso, así que es donde va
 * lo que no cambia entre operaciones. Todo lo que se ponga acá se multiplica
 * por el número de spans en el almacenamiento de Jaeger: la lista es corta a
 * propósito.
 *
 * `service.namespace` y `deployment.environment.name` se escriben como texto y
 * no se importan de `@opentelemetry/semantic-conventions` porque ahí viven en
 * el submódulo *incubating*, que es un archivo con miles de constantes.
 * Importarlo por dos claves metería todo ese peso en un paquete que ya excede
 * su presupuesto.
 */
export function browserResource(config: TelemetryConfig): Resource {
  return defaultResource().merge(
    resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.version,
      'service.namespace': config.namespace,
      'deployment.environment.name': config.environment,

      /**
       * El commit. Es lo que responde «qué código está corriendo», que es la
       * primera pregunta de cualquier incidente y la que decide a qué versión
       * volver al revertir.
       */
      'app.build.id': config.buildId,

      'app.framework': 'angular',
      'angular.version': ANGULAR_MAJOR,

      /**
       * Con qué modo arrancó **esta** carga, no con cuál se compiló: la misma
       * compilación sirve rutas prerenderizadas y rutas que se pintan enteras
       * en el cliente.
       */
      'angular.rendering.mode': config.renderingMode,

      /**
       * Hoy siempre `zoneless`. Está escrito para que el día que alguien
       * reintroduzca Zone.js, las trazas de antes y las de después se puedan
       * separar sin adivinar cuál era cuál.
       */
      'angular.change_detection.mode': 'zoneless',
    }),
  );
}

/**
 * La versión mayor de Angular, fijada a mano.
 *
 * Leerla de `@angular/core` en ejecución significaría importar `VERSION`, que
 * es una constante que el empaquetador no puede eliminar y que arrastra el
 * módulo entero al fragmento de la telemetría. Para un número que cambia una
 * vez al año, no compensa.
 */
const ANGULAR_MAJOR = '21';
