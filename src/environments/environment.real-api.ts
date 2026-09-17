import type { Environment } from './environment.types';
import { environment as desarrollo } from './environment.development';

/**
 * Entorno de desarrollo **contra la API real**, sin el backend simulado.
 *
 * Es el de desarrollo con una sola diferencia: `mockBackend` apagado. El resto
 * —`apiBaseUrl` relativo, demos, telemetría— se hereda tal cual, así que las
 * peticiones salen relativas y las resuelve `proxy.conf.json` contra la API que
 * ese archivo declara, igual que en desarrollo.
 *
 * ## Por qué una configuración aparte y no una variable del `.env`
 *
 * `mockBackend` no lee el entorno del proceso a propósito: con una variable, un
 * `.env` olvidado apuntaría la maqueta a una API real sin que nadie lo
 * decidiera. Una configuración de Angular hay que pedirla por su nombre
 * (`--configuration real-api`), así que apagar el mock es siempre explícito, y
 * `development` y `production` quedan exactamente como estaban.
 *
 * ## Cómo se usa
 *
 *   yarn start:real-api        # ng serve --configuration real-api
 *
 * con la API levantada donde apunta `proxy.conf.json`. El cableado lo verifica
 * `scripts/check-real-api-config.mjs`.
 *
 * `apiRealForzada` —el interruptor del stock de componentes— no es esto: deja
 * pasar peticiones con la maqueta encendida. Acá la maqueta está apagada:
 * `mockBackendInterceptor` deja pasar todo y las rutas del stock no resuelven.
 */
export const environment: Environment = {
  ...desarrollo,
  mockBackend: false,
};
