import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

/**
 * Raíz de la API.
 *
 * Es un token y no una lectura directa de `environment` para que las pruebas
 * puedan fijar otra raíz sin tocar el archivo de entorno, y para que un futuro
 * despliegue con varias APIs pueda proveerla por rama del árbol de inyección.
 *
 * Vacío significa rutas relativas — ver `environment.types.ts`.
 */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiBaseUrl,
});

/**
 * Une la raíz con una ruta de la API.
 *
 * Con raíz vacía devuelve la ruta tal cual (relativa, la resuelve el proxy);
 * con raíz definida evita la doble barra que aparece al concatenar a mano.
 */
export function apiUrl(baseUrl: string, path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return baseUrl === '' ? normalizedPath : `${baseUrl.replace(/\/$/, '')}${normalizedPath}`;
}
