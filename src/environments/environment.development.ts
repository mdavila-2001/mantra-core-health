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
};
