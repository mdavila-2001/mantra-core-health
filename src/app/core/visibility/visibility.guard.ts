import { inject } from '@angular/core';
import {
  PRIMARY_OUTLET,
  Router,
  type ActivatedRouteSnapshot,
  type CanActivateChildFn,
  type RouterStateSnapshot,
} from '@angular/router';

import { SessionStore } from '../auth/session.store';
import { APP_SECTIONS } from '../navigation/navigation.map';
import type { AppSection } from '../navigation/navigation.types';
import { navScreenKey } from './ui-element-keys';
import { UiVisibilityService } from './ui-visibility.service';

/**
 * A dónde se manda a quien llega a una pantalla que una regla de visibilidad le oculta.
 *
 * Una pantalla propia («No disponible para su perfil», estado S3 con su próxima acción) y no el 404: la persona
 * escribió una dirección real y lo honesto es decirle que no está disponible **para su perfil**, no que no existe.
 * Tampoco se dice cuál regla lo causa ni quién la puso: eso se consulta en el portal de administración.
 */
export const PANTALLA_NO_DISPONIBLE_ROUTE = '/unavailable';

/**
 * Cierra por ruta lo que el menú ya no ofrece por una regla de visibilidad.
 *
 * ## Qué NO es
 *
 * **No es autorización.** La API sigue autorizando cada petición: quien tenga el permiso y llame al endpoint
 * directamente recibe la respuesta, y eso es correcto —la visibilidad decide qué se *presenta*—. Esto evita que una
 * pantalla que el menú ya no ofrece se abra por un enlace guardado o escrito a mano, y que lo haga a medias.
 *
 * ## Cómo decide
 *
 * Busca la sección del registro (`APP_SECTIONS`) que corresponde a la ruta —la coincidencia más larga, igual que el
 * menú y que `seccionRolesGuard`— y pregunta por su clave `nav.<ruta>`. La cascada de ancestros (un grupo oculto
 * oculta a sus pantallas) la resuelve el servidor: el cliente no la recalcula. Una ruta sin sección —la propia
 * pantalla de «No disponible», por ejemplo— pasa.
 *
 * Espera al pedido de reglas en vuelo (acotado) para no dejar entrar a una pantalla que está por ocultarse, y falla
 * **abierto**: si las reglas no se pudieron leer, deja pasar (la API protege).
 *
 * Va como `canActivateChild` del armazón: una sola declaración cubre todas las secciones y sus hijas.
 */
export const visibilityChildGuard: CanActivateChildFn = async (_route, state) => {
  const session = inject(SessionStore);
  if (!session.isAuthenticated()) {
    return true;
  }

  const seccion = seccionDe(segmentosEmparejados(state));
  if (seccion === null) {
    return true;
  }

  const visibilidad = inject(UiVisibilityService);
  const router = inject(Router);
  visibilidad.ensureStarted();
  await visibilidad.whenSettled();

  return visibilidad.isVisible(navScreenKey(seccion.path))
    ? true
    : router.createUrlTree([PANTALLA_NO_DISPONIBLE_ROUTE]);
};

/** Los segmentos de la ruta emparejada (sin parámetros matriciales ni de consulta): los mismos que eligieron la pantalla. */
function segmentosEmparejados(state: RouterStateSnapshot): readonly string[] {
  const segmentos: string[] = [];
  let nodo: ActivatedRouteSnapshot | undefined = state.root;
  while (nodo !== undefined) {
    for (const segmento of nodo.url) segmentos.push(segmento.path);
    nodo = nodo.children.find((hijo) => hijo.outlet === PRIMARY_OUTLET);
  }
  return segmentos;
}

/** La sección a la que pertenecen los segmentos: la coincidencia más larga con el `path` del registro. */
function seccionDe(segmentos: readonly string[]): AppSection | null {
  const ruta = segmentos.join('/');
  return (
    APP_SECTIONS.filter((s) => ruta === s.path || ruta.startsWith(`${s.path}/`)).sort(
      (a, b) => b.path.length - a.path.length,
    )[0] ?? null
  );
}
