import type { Environment } from './environment.types';

/**
 * Entorno por defecto (producción). `environment.development.ts` lo reemplaza
 * al compilar en desarrollo, vía `fileReplacements` de `angular.json`.
 *
 * TODO: fijar la raíz real de la API cuando exista el despliegue. Mientras siga
 * vacío, la aplicación pide al mismo origen desde el que se sirvió, que solo es
 * correcto si la API queda detrás del mismo dominio.
 */
export const environment: Environment = {
  apiBaseUrl: '',
};
