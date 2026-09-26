import type { Environment } from './environment.types';
import { envFromProcess } from './env.generated';

/**
 * Entorno de producción **contra la API real**, con SSR encendido (H1.S1).
 *
 * A diferencia de `environment.real-api.ts` — pensado para `ng serve`, que
 * apaga SSR y prerender porque el servidor de desarrollo no soporta ese modo
 * de arranque — ésta es la configuración que un despliegue real construye:
 * `yarn build --configuration=production-api` sale optimizado, con
 * `outputMode: server` y el mismo SSR que `production`.
 *
 * **No** se construye con `{ ...environment de environment.ts }` (como sí
 * hace `environment.real-api.ts` con `environment.development.ts`): el
 * `fileReplacements` de `production-api` sustituye el archivo
 * `src/environments/environment.ts` **por este mismo archivo** en todo el
 * programa, así que importar `./environment` desde acá resuelve al mismo path
 * reemplazado y arma un ciclo — el build fallaba en el paso de extracción de
 * rutas con `Cannot read properties of undefined (reading 'enabled')` porque
 * `environment.production-api.ts` se auto-importaba a mitad de su propia
 * inicialización. Por eso se repiten acá los mismos respaldos de
 * `envFromProcess` que `environment.ts`, en vez de heredarlos.
 *
 * Apaga el backend simulado y **las cuatro** demostraciones, no sólo dos.
 * `environment.real-api.ts` sólo apaga `campaignsDemo` y `paymentDemo`: contra
 * la API real, la barra de casos de demostración de la ficha clínica
 * (`demoPresets`) y la billetera sembrada (`loyaltyDemo`) seguirían apareciendo
 * si no se listaran acá también. Se fijan en `false` de forma explícita —no se
 * leen de `envFromProcess`— por la misma razón que `mockBackend` en
 * `environment.real-api.ts`: un despliegue real no tiene que poder prender una
 * demo por accidente con una variable de entorno olvidada.
 *
 * Cómo se usa:
 *
 *   yarn build --configuration=production-api
 *
 * El cableado lo verifica `scripts/check-real-api-config.mjs`.
 */
export const environment: Environment = {
  apiBaseUrl: envFromProcess.apiBaseUrl ?? '',
  aiBaseUrl: envFromProcess.aiBaseUrl ?? '/ai',
  demoPresets: false,
  paymentDemo: false,
  loyaltyDemo: false,
  campaignsDemo: false,
  mockBackend: false,
  telemetry: {
    enabled: envFromProcess.telemetry?.enabled ?? false,
    serviceName: envFromProcess.telemetry?.serviceName ?? 'mantra-angular-web',
    namespace: envFromProcess.telemetry?.namespace ?? 'mantra',
    environment: envFromProcess.telemetry?.environment ?? 'production',
    tracesEndpoint: envFromProcess.telemetry?.tracesEndpoint ?? '/otel/v1/traces',
    sampleRatio: envFromProcess.telemetry?.sampleRatio ?? 0.1,
  },
};
