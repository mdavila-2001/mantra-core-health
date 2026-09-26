import type { Environment } from './environment.types';
import { envFromProcess } from './env.generated';

/**
 * Entorno de desarrollo.
 *
 * Misma regla que en `environment.ts`: acá no se escriben valores, solo el
 * respaldo de lo que no venga del entorno. Lo concreto lo aporta
 * `envFromProcess`, generado desde `.env` por `scripts/generate-env.mjs`.
 *
 * El respaldo de `apiBaseUrl` es vacío a propósito: las peticiones salen
 * relativas (`/iam/...`) y las resuelve el proxy del servidor de Angular contra
 * `localhost:3000`, así que el navegador ve un solo origen y no hay CORS que
 * negociar. La lista de rutas que se redirigen está en `proxy.conf.json`.
 *
 * Apuntar a una API que no sea la local es cambiar `PUBLIC_API_BASE_URL` en el
 * `.env`, que no se versiona: nadie arrastra al repositorio el destino que usó
 * para probar.
 */
export const environment: Environment = {
  apiBaseUrl: envFromProcess.apiBaseUrl ?? '',

  /** Mismo origen: ver `aiBaseUrl` en `environment.types.ts`. */
  aiBaseUrl: envFromProcess.aiBaseUrl ?? '/ai',

  /**
   * Encendida por defecto en desarrollo: quien levanta la app local ve la
   * barra de casos de demostración sin configurar nada. Se apaga con
   * `PUBLIC_DEMO_PRESETS=false` en el `.env`.
   */
  demoPresets: envFromProcess.demoPresets ?? true,

  /**
   * Encendida por defecto en desarrollo, como `demoPresets`: la demo de dos
   * ventanas muestra el ciclo del QR completo. Se apaga con
   * `PUBLIC_PAYMENT_DEMO=false` en el `.env`.
   */
  paymentDemo: envFromProcess.paymentDemo ?? true,

  /**
   * Encendida por defecto: sin ella la billetera de puntos se ve vacía en
   * desarrollo, que es correcto pero no deja probar nada. Se apaga con
   * `PUBLIC_LOYALTY_DEMO=false` — y ese apagado es justamente la prueba de que
   * el estado vacío está bien hecho.
   */
  loyaltyDemo: envFromProcess.loyaltyDemo ?? true,

  /**
   * Encendida por defecto: sin campañas sembradas no hay nada que recorrer en
   * el carril de promociones. Se apaga con `PUBLIC_CAMPAIGNS_DEMO=false` — y
   * ese apagado es la prueba de que las secciones desaparecen enteras en vez
   * de quedar vacías.
   */
  campaignsDemo: envFromProcess.campaignsDemo ?? true,

  /**
   * Apagada por defecto: el refresh token sigue en el cuerpo y en `localStorage`
   * hasta que el despliegue encienda **las dos puntas** —`PUBLIC_REFRESH_COOKIE`
   * acá y `AUTH_REFRESH_COOKIE_ENABLED` en la API—. Ver `environment.types.ts`.
   */
  refreshCookie: envFromProcess.refreshCookie ?? false,

  /**
   * Siempre encendido en la rama `mockup`: es lo que la define. No lee el
   * entorno del proceso a propósito, para que no haya forma de apuntar esta
   * rama a una API real por accidente. Contra la API real se corre con la
   * configuración explícita `real-api` (`yarn start:real-api`), que lo apaga
   * sin tocar este archivo: ver `environment.real-api.ts`.
   */
  mockBackend: true,

  /**
   * También apagada por defecto en desarrollo, y por un motivo práctico: sin un
   * Collector escuchando, cada lote de spans sería una petición fallida cada
   * cinco segundos en la consola de quien esté trabajando en otra cosa.
   *
   * Para encenderla: levantar el Collector
   * (`docker compose -f infra/otel-collector/docker-compose.observability.yml up`)
   * y poner `PUBLIC_TELEMETRY_ENABLED=true` en el `.env`. Con eso el muestreo es
   * del 100 %, que es lo que hace falta cuando se está mirando lo que uno acaba
   * de hacer.
   */
  telemetry: {
    enabled: envFromProcess.telemetry?.enabled ?? false,
    serviceName: envFromProcess.telemetry?.serviceName ?? 'mantra-angular-web',
    namespace: envFromProcess.telemetry?.namespace ?? 'mantra',
    environment: envFromProcess.telemetry?.environment ?? 'development',
    tracesEndpoint: envFromProcess.telemetry?.tracesEndpoint ?? '/otel/v1/traces',
    sampleRatio: envFromProcess.telemetry?.sampleRatio ?? 1,
  },
};
