/* ============================================================================
    El rail vertical del marco público.

    ## Qué reemplaza

    Ocho bloques `role="tablist"` copiados dentro de ocho plantillas de
    `features/redsat/buscar/`, con listas distintas en cada uno. Ese marcado
    decía ser pestañas —`role="tab"`, `aria-selected`— y no lo era: cada
    «pestaña» navegaba a otra URL y destruía el panel anterior. Un lector de
    pantalla anunciaba «pestaña 3 de 6, seleccionada» sobre algo que en realidad
    es un menú de navegación, que es exactamente el error que
    `aria-current="page"` existe para no cometer.

    Acá es lo que es: un `<nav>` con enlaces, y el enlace de la página actual
    marcado con `aria-current="page"`.

    ## Por qué el rail vive en el marco y no en la pantalla

    Porque estaba en la pantalla y por eso había ocho copias. Montado en
    `redsat-public-shell.html`, navegar entre secciones no lo re-renderiza: el
    `<router-outlet>` cambia debajo y el rail permanece, con el foco donde
    estaba.

    ## Sólo íconos, y el nombre por tres vías

    El pedido pide íconos con el texto como tooltip. Un rail de íconos sin más
    es inaccesible, así que cada enlace lleva el mismo texto por tres caminos
    que no se pisan: `aria-label` (lo que anuncia el lector), `[appTooltip]`
    (globo en hover **y en foco de teclado** — la directiva ya escucha los dos)
    y un rótulo visible que aparece cuando el rail se acuesta en horizontal, que
    es como se dibuja por debajo de 900 px.
    ========================================================================== */

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';

import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import { Tooltip } from '../../atoms/tooltip/tooltip';

import { PUBLIC_NAV_RAIL_SECTIONS } from './public-nav-rail.types';

@Component({
  selector: 'app-public-nav-rail',
  imports: [NavIcon, RouterLink, Tooltip],
  templateUrl: './public-nav-rail.html',
  styleUrl: './public-nav-rail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicNavRail {
  private readonly router = inject(Router);

  protected readonly groups = PUBLIC_NAV_RAIL_SECTIONS;

  /** La última navegación terminada, o `null` si todavía no hubo ninguna. */
  private readonly lastNavigation = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event): string | null => event.urlAfterRedirects),
    ),
    { initialValue: null },
  );

  /**
   * La URL actual sin query ni fragmento. `?q=cardio` no cambia en qué sección
   * está uno, y el rail no debe parpadear al filtrar.
   *
   * Cae a `router.url` mientras no haya ocurrido ninguna navegación: el primer
   * render y el arnés de prueba que monta el componente antes de navegar.
   */
  private readonly currentUrl = computed(() => {
    const url = this.lastNavigation() ?? this.router.url;
    return url.split('?')[0]?.split('#')[0] ?? '';
  });

  /**
   * La entrada que corresponde a la página actual, o `null`.
   *
   * Gana la coincidencia **más específica**: la ruta más larga que sea prefijo
   * de la URL. Sin eso, estando en `/search/practitioners` quedarían activas
   * esa entrada **y** `/search`, y `aria-current="page"` se anunciaría dos
   * veces —que es decir «ésta es la página» de dos páginas distintas.
   *
   * Y es prefijo **de ruta**, no de texto: por eso el `${route}/`. Si no,
   * `/search` ganaría dentro de `/buscarcualquiercosa`.
   */
  protected readonly activeRoute = computed<string | null>(() => {
    const url = this.currentUrl();
    if (url === '') {
      return null;
    }

    return this.groups
      .flatMap((group) => group.entries)
      .map((entry) => entry.route)
      .filter((route) => url === route || url.startsWith(`${route}/`))
      .reduce<string | null>(
        (best, route) => (best === null || route.length > best.length ? route : best),
        null,
      );
  });
}
