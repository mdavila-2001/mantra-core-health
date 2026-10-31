/**
 * Si una dirección interna vuelve a una página con el token de una receta
 * compartida (`/rx/<token>`, también colgada de otra ruta). La usan el login y
 * el selector de organización a los que se llega desde «Soy farmacia»: mientras
 * llevan ese `returnUrl`, no mandan su dirección como `Referer` (S-6).
 *
 * `/verify/rx/<id>` lleva el id de la receta, no una credencial.
 */
export function isShareTokenRoute(url: string | null): boolean {
  if (url === null) {
    return false;
  }
  const path = url.split(/[?#]/)[0] ?? '';
  return /(?:^|\/)(?<!verify\/)rx\/+[^/]/i.test(path);
}
