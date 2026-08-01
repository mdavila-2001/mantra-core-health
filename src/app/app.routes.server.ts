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
 * El login y la vitrina se ven igual para todo el mundo, así que salen del servidor ya pintados: la
 * primera pantalla aparece sin esperar a que arranque JavaScript. Es justo donde el SSR paga.
 */
export const serverRoutes: ServerRoute[] = [
  {
    path: 'auth/login',
    renderMode: RenderMode.Prerender,
  },
  {
    // La elección de organización depende de los tenants del token: sin sesión no hay lista que
    // prerenderizar, solo el caso «tu sesión expiró».
    path: 'auth/organizacion',
    renderMode: RenderMode.Client,
  },
  {
    path: 'design-system',
    renderMode: RenderMode.Prerender,
  },
  {
    path: '**',
    renderMode: RenderMode.Client,
  },
];
