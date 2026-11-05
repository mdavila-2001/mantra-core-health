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

/**
 * ¿Es esta URL de **la API configurada**? (F9, defensa en profundidad.)
 *
 * Solo a la API se le adjuntan la credencial de la sesión y la organización activa. Se compara el **origen** completo
 * (esquema + anfitrión + puerto), no un prefijo de texto: `https://api.x.com.evil.net` o `https://api.x.com@evil.net` no son
 * `https://api.x.com`. Una ruta relativa se resuelve contra la página, igual que lo hará el navegador; con `apiBaseUrl`
 * vacío la API es el propio origen. Una URL ilegible no es de la API (cierra, no abre).
 *
 * @param url La URL tal como la pidió `HttpClient`.
 * @param apiBaseUrl La raíz configurada (`API_BASE_URL`); vacía significa rutas relativas.
 */
export function isApiUrl(url: string, apiBaseUrl: string): boolean {
  // Sin navegador (SSR, pruebas sin DOM) no hay origen de página: se usa un anfitrión de reserva que nunca coincide con un tercero real.
  const pagina = typeof location !== 'undefined' && /^https?:/.test(location.href) ? location.href : 'http://mismo-origen.invalid/';
  try {
    const raiz = new URL(apiBaseUrl === '' ? '/' : apiBaseUrl, pagina);
    return new URL(url, pagina).origin === raiz.origin;
  } catch {
    return false;
  }
}

/**
 * Si el refresh token viaja en una cookie `httpOnly` (TX-10, D-I).
 *
 * Token y no lectura directa de `environment` por la misma razón que
 * {@link API_BASE_URL}: las pruebas fijan el modo sin tocar el entorno. Con
 * `true`, el front nunca ve ni guarda el refresh token: pide el refresco sin
 * cuerpo y el navegador manda la cookie (mismo origen).
 */
export const REFRESH_COOKIE_MODE = new InjectionToken<boolean>('REFRESH_COOKIE_MODE', {
  providedIn: 'root',
  factory: () => environment.refreshCookie,
});
