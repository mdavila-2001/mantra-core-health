import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Cómo se renderiza cada ruta en el servidor.
 *
 * ## Lo que tiene sesión no se puede prerenderizar
 *
 * La sesión vive en el navegador —refresh token en `localStorage`, access token en memoria— y el
 * servidor no la ve: la API entrega el refresh token en el cuerpo del login, no como cookie, así
 * que no hay nada en la petición que le diga al servidor quién está entrando.
 *
 * Prerenderizar una pantalla con sesión produciría entonces HTML de «no autenticado» —el shell sin
 * usuario, el panel sin datos— que al hidratar se reemplaza por el real. Eso es un parpadeo en el
 * mejor caso, y en el peor un `<main>` vacío servido como si fuera el contenido de la aplicación.
 *
 * Por eso el área con sesión va en `Client`: el servidor manda el cascarón y el navegador, que sí
 * tiene la sesión, pinta lo que corresponde.
 *
 * ## Lo público sí se prerenderiza, y conviene
 *
 * El login, el registro y la vitrina se ven igual para todo el mundo, así que salen del servidor ya
 * pintados: la primera pantalla aparece sin esperar a que arranque JavaScript. Es justo donde el
 * SSR paga.
 *
 * Las landings que leen un token del query string (`verificar`, `nueva-clave`) van en `Client`:
 * prerenderizadas mostrarían el estado «falta el código», porque en el build no hay query string.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: 'auth',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'auth/register',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'auth/forgot-password',
    renderMode: RenderMode.Prerender,
  },
  {
    path: 'auth/verify-email',
    renderMode: RenderMode.Client,
  },
  {
    path: 'auth/reset-password',
    renderMode: RenderMode.Client,
  },
  {
    // La elección de organización depende de los tenants del token: sin sesión no hay lista que
    // prerenderizar, solo el caso «tu sesión expiró».
    path: 'auth/organization',
    renderMode: RenderMode.Client,
  },
  {
    path: 'design-system',
    renderMode: RenderMode.Prerender,
  },
  /**
   * Las fichas públicas por slug: `Server`, no `Prerender` ni `Client`.
   *
   * **`Client` no sirve** —y era lo que hacían hasta ahora por caer en el
   * comodín—: el criterio del carril P4 es que `curl http://…/p/doctor-uno-e2e`
   * devuelva HTML que ya contenga el nombre. Con `Client` devuelve el cascarón,
   * y quien lo lea sin ejecutar JavaScript —un rastreador, una vista previa de
   * enlace en WhatsApp, alguien con la conexión a medias— no ve nada. Una ficha
   * pública que sólo existe después de hidratar no es una ficha pública.
   *
   * **`Prerender` tampoco**: el slug es un parámetro y el directorio crece; no
   * hay una lista de rutas que congelar al construir, y la que hubiera quedaría
   * vieja en cuanto alguien publique su vitrina.
   *
   * Con `Server` el servidor resuelve la ficha por petición —el resolver de la
   * ruta espera a la API antes de activar— y manda el HTML ya pintado, con su
   * `<title>` y sus metadatos de Open Graph adentro.
   */
  /**
   * El buscador público, también en `Server`.
   *
   * Mismo criterio que las fichas y por el mismo motivo: `/buscar` y sus seis
   * verticales se ven **igual para todo el mundo** —no hay sesión que consultar—
   * y son la puerta de entrada de quien todavía no tiene cuenta. Servidas en
   * `Client` devolverían el cascarón, y una búsqueda compartida en un mensaje
   * llegaría sin resultados a quien la abra desde una vista previa.
   *
   * **`Prerender` no sirve acá**: el contenido depende de `?q=` y del estado del
   * directorio, y una lista congelada en el momento de construir queda vieja en
   * cuanto alguien publica su vitrina. Con `Server` cada petición resuelve
   * contra la API — el texto buscado viaja en la URL, que es justamente lo que
   * el servidor puede leer y una caja de texto no.
   */
  { path: 'buscar', renderMode: RenderMode.Server },
  { path: 'buscar/profesionales', renderMode: RenderMode.Server },
  { path: 'buscar/medicamentos', renderMode: RenderMode.Server },
  { path: 'buscar/hospitales', renderMode: RenderMode.Server },
  { path: 'buscar/diagnostico', renderMode: RenderMode.Server },
  { path: 'buscar/aseguradoras', renderMode: RenderMode.Server },
  /**
   * El mapa **no**: abre pidiendo consentimiento para usar la ubicación, y esa
   * pantalla no tiene nada que el servidor pueda resolver. Renderizarla en el
   * servidor sólo adelantaría el botón, y la geolocalización vive en el
   * navegador de todos modos.
   */
  { path: 'buscar/mapa', renderMode: RenderMode.Client },
  { path: 'p/:slug', renderMode: RenderMode.Server },
  { path: 'o/:slug', renderMode: RenderMode.Server },
  { path: 'f/:slug', renderMode: RenderMode.Server },
  { path: 'l/:slug', renderMode: RenderMode.Server },
  { path: 's/:slug', renderMode: RenderMode.Server },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
