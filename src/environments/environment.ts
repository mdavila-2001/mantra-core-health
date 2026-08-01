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
};
