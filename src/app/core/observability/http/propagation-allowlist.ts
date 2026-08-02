/**
 * A qué destinos se les manda el `traceparent`.
 *
 * ## Por qué hay una lista y no se manda siempre
 *
 * `traceparent` es un identificador que correlaciona todo lo que ocurre en una
 * traza. Mandárselo a un tercero le entrega una pieza para reconstruir
 * actividad: cuántas peticiones hace esta persona, en qué orden, con qué
 * cadencia. En un sistema de salud eso importa más que en otros.
 *
 * Y hay un motivo mucho más terrenal: una cabecera desconocida en una petición
 * a otro origen **dispara un preflight**. El servidor de terceros responde que
 * no la permite, el navegador bloquea la petición, y lo que se rompe no es la
 * telemetría sino la funcionalidad. Es el modo de fallo clásico de instrumentar
 * `fetch` sin lista blanca.
 *
 * ## Qué entra en la lista
 *
 * Solo la API de este sistema, en sus dos formas:
 *
 *   - **Rutas relativas** (`/iam/…`, `/profiles/…`). Es el caso normal: el
 *     paquete se compila con `apiBaseUrl` vacío y el destino lo resuelve el
 *     proxy en desarrollo o el mismo origen en un despliegue.
 *   - **La raíz configurada**, cuando la API vive en otro dominio.
 *
 * Nada más. Sin comodines, sin «cualquier cosa del mismo origen», sin dominios
 * de analítica ni CDN.
 */

/**
 * Los prefijos de ruta que la API expone.
 *
 * Salen de `proxy.conf.json`, que es la lista que este proyecto ya mantiene
 * para redirigir al backend en desarrollo. Tenerlos en dos sitios es el riesgo
 * conocido de esta pieza; la prueba que los compara con el proxy es lo que
 * impide que se separen.
 */
export const API_PATH_PREFIXES: readonly string[] = [
  '/iam',
  '/public',
  '/terminology',
  '/profiles',
  '/identity',
  '/common',
];

/**
 * Si a esta URL se le puede añadir la cabecera de traza.
 *
 * @param url La URL tal como la pidió `HttpClient`.
 * @param apiBaseUrl La raíz configurada. Vacía significa rutas relativas.
 */
export function shouldPropagateTrace(url: string, apiBaseUrl: string): boolean {
  if (url.startsWith('/')) {
    return hasApiPrefix(url);
  }

  if (!url.includes('://')) {
    /**
     * Una ruta relativa sin barra inicial (`iam/auth/login`). No se puede
     * resolver sin saber la ruta actual, y una resolución equivocada mandaría
     * la cabecera a un destino que no es el previsto. Ante la duda, no se
     * propaga: el coste es una traza partida, no una fuga.
     */
    return false;
  }

  if (apiBaseUrl !== '' && url.startsWith(apiBaseUrl)) {
    return true;
  }

  /**
   * Absoluta pero del mismo origen que la página. Ocurre cuando alguien arma la
   * URL completa en vez de dejarla relativa; el destino es el mismo.
   */
  if (typeof location !== 'undefined') {
    try {
      const parsed = new URL(url);
      if (parsed.origin === location.origin) {
        return hasApiPrefix(parsed.pathname);
      }
    } catch {
      return false;
    }
  }

  return false;
}

function hasApiPrefix(path: string): boolean {
  return API_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}
