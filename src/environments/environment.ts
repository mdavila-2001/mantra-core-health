import type { Environment } from './environment.types';
import { envFromProcess } from './env.generated';

/**
 * Entorno por defecto (producción). `environment.development.ts` lo reemplaza
 * al compilar en desarrollo, vía `fileReplacements` de `angular.json`.
 *
 * No hay ningún valor concreto escrito acá, y es a propósito: los valores
 * entran por `envFromProcess`, que `scripts/generate-env.mjs` produce a partir
 * del entorno del proceso y de `.env` antes de cada build. Este archivo solo
 * pone el valor por defecto de lo que no venga definido, así que el repositorio
 * nunca guarda la configuración de un despliegue ni la de la máquina de nadie.
 *
 * Lo que sale de acá se empaqueta en el JavaScript que descarga el navegador:
 * es público por definición. Los secretos —claves de API, credenciales de
 * servicio, firmas— viven del lado de la API y no tienen forma de existir en un
 * frontend, por más ofuscados que se vean en el paquete. El generador rechaza
 * los que se intenten colar; ver el encabezado de `scripts/generate-env.mjs`.
 *
 * `apiBaseUrl` vacío significa rutas relativas: la aplicación pide al mismo
 * origen desde el que se sirvió, que es lo correcto si la API queda detrás del
 * mismo dominio. Un despliegue con la API en otro dominio define
 * `PUBLIC_API_BASE_URL` en su entorno, sin tocar este archivo.
 */
export const environment: Environment = {
  apiBaseUrl: envFromProcess.apiBaseUrl ?? '',

  /**
   * Apagada por defecto: en producción la barra de demostración no existe
   * salvo que el despliegue la pida (`PUBLIC_DEMO_PRESETS=true`, pensado para
   * el staging de una demo).
   */
  demoPresets: envFromProcess.demoPresets ?? true,

  /**
   * Apagada por defecto: sin pasarela real, en producción sólo existe el
   * camino del mostrador. El staging de una demo la enciende con
   * `PUBLIC_PAYMENT_DEMO=true`.
   */
  paymentDemo: envFromProcess.paymentDemo ?? true,

  /**
   * Apagada por defecto: en producción no hay de dónde leer una membresía
   * todavía, así que la billetera dice que no hay programa activo en vez de
   * mostrar un saldo sembrado. El staging de una demo la enciende con
   * `PUBLIC_LOYALTY_DEMO=true`.
   */
  loyaltyDemo: envFromProcess.loyaltyDemo ?? true,

  /**
   * Apagada por defecto: en producción no hay lecturas de campañas, así que
   * sembrarlas sería anunciar descuentos que ningún backend puede honrar. El
   * staging de una demo la enciende con `PUBLIC_CAMPAIGNS_DEMO=true`.
   */
  campaignsDemo: envFromProcess.campaignsDemo ?? true,

  /**
   * Siempre encendido en la rama `mockup`: es lo que la define. No lee el
   * entorno del proceso a propósito, para que no haya forma de apuntar esta
   * rama a una API real por accidente.
   */
  mockBackend: true,

  /**
   * Telemetría **apagada** salvo que el despliegue la encienda.
   *
   * No es timidez: apagada significa que el fragmento del SDK ni se descarga,
   * que no hay un solo span y que no sale ninguna petición. Un despliegue que
   * no configuró el Collector no empieza a mandar trazas a un endpoint que no
   * existe solo por actualizar.
   *
   * Se enciende con `PUBLIC_TELEMETRY_ENABLED=true`, que es una decisión
   * consciente por entorno, tomada donde se sabe si hay Collector detrás.
   */
  telemetry: {
    enabled: envFromProcess.telemetry?.enabled ?? false,
    serviceName: envFromProcess.telemetry?.serviceName ?? 'mantra-angular-web',
    namespace: envFromProcess.telemetry?.namespace ?? 'mantra',
    environment: envFromProcess.telemetry?.environment ?? 'production',
    // Mismo origen: lo reenvía `src/server.ts`. Ver 01-architecture-design.md.
    tracesEndpoint: envFromProcess.telemetry?.tracesEndpoint ?? '/otel/v1/traces',
    // El 10 % es un punto de partida, no una medición: se ajusta con volumen
    // real. El criterio está en 01-architecture-design.md.
    sampleRatio: envFromProcess.telemetry?.sampleRatio ?? 0.1,
  },
};
