import type { Environment } from './environment.types';
import { environment as developmentEnvironment } from './environment.development';

/**
 * Entorno exclusivo del recorrido contra la API real.
 *
 * Hereda los respaldos de desarrollo porque el runner usa `ng serve`, pero
 * apaga el interceptor simulado en el artefacto compilado. A diferencia del
 * interruptor manual del stock, este valor sobrevive refresh y logout/login.
 */
export const environment: Environment = {
  ...developmentEnvironment,
  mockBackend: false,
};
