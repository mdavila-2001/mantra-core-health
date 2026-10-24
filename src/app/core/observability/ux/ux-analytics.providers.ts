import {
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
  type EnvironmentProviders,
} from '@angular/core';

import { UX_ANALYTICS_CONFIG } from './ux-analytics.config';
import { UxAnalytics } from './ux-analytics.service';

/**
 * Lo que `app.config.ts` agrega para capturar interacciones.
 *
 * Como `provideObservability`: el inicializador no devuelve nada, así que no
 * demora el arranque, y con la captura apagada no instancia el servicio. Se
 * engancha acá y no desde una pantalla porque tiene que estar escuchando antes
 * de la primera navegación, que es la primera `pagina_vista`.
 */
export function provideUxAnalytics(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideAppInitializer(() => {
      if (!inject(UX_ANALYTICS_CONFIG).active) {
        return;
      }
      // Un fallo de la captura no puede impedir que la aplicación arranque.
      try {
        inject(UxAnalytics).start();
      } catch (error) {
        console.warn('[ux-analytics] no se pudo iniciar la captura', error);
      }
    }),
  ]);
}
