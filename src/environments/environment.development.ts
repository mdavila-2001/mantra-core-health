import type { Environment } from './environment.types';

/**
 * Entorno de desarrollo.
 *
 * `apiBaseUrl` vacío a propósito: las peticiones salen relativas (`/iam/...`) y
 * las resuelve el proxy del servidor de Angular contra `localhost:3000`, así
 * que el navegador ve un solo origen y no hay CORS que negociar. La lista de
 * rutas que se redirigen está en `proxy.conf.json`.
 */
export const environment: Environment = {
  apiBaseUrl: '',
};
