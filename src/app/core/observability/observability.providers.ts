import {
  makeEnvironmentProviders,
  provideAppInitializer,
  inject,
  type EnvironmentProviders,
} from '@angular/core';

import { TELEMETRY_CONFIG } from './config/telemetry.token';
import { RouterTracing } from './routing/router-tracing';
import { AppStabilityTracing } from './tracing/app-stability';

/**
 * Lo que `app.config.ts` agrega para tener trazas.
 *
 * Una sola línea en la configuración de la aplicación, y aquí adentro la
 * decisión de qué se engancha. Es a propósito: la lista de instrumentaciones va
 * a crecer, y hacerlo en `app.config.ts` convertiría ese archivo —que hoy se
 * lee de un vistazo— en un inventario.
 *
 * ## El inicializador no bloquea. Nunca.
 *
 * `provideAppInitializer` admite devolver una promesa, y Angular espera a que
 * se resuelva antes de arrancar. Este **no devuelve nada**, así que no añade ni
 * un milisegundo al arranque.
 *
 * Importa más de lo que parece en este proyecto: `app.config.ts` ya tiene un
 * inicializador que sí bloquea —el que espera al canje del refresh token para
 * que nadie vea un parpadeo al login—. Sumar la telemetría a esa espera sería
 * hacer que la observabilidad cause la latencia que existe para explicar.
 *
 * ## Con la telemetría apagada esto no hace nada
 *
 * Ni suscripciones al Router, ni oyentes, ni servicios instanciados. La
 * comprobación está acá y no dentro de cada servicio para que el coste de
 * tenerla apagada sea exactamente cero.
 */
export function provideObservability(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      const config = inject(TELEMETRY_CONFIG);
      if (!config.enabled) {
        return;
      }

      /**
       * El seguimiento del Router se engancha acá, en el inicializador, y no en
       * el constructor de un servicio: tiene que estar escuchando **antes** de
       * la primera navegación, y un servicio inyectado por una pantalla se
       * instanciaría después de ella.
       */
      inject(RouterTracing).start();
      inject(AppStabilityTracing).start();
    }),
  ]);
}
