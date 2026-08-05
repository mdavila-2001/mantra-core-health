import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import type { BreadcrumbItem } from '../../shared/components/molecules/breadcrumb/breadcrumb.types';
import type { NavSection } from '../../shared/components/organisms/side-nav/side-nav.types';
import { AuthService } from '../auth/auth.service';
import { APP_SECTIONS } from './navigation.map';
import { isVisibleTo, NAV_GROUPS, routeOf, type AppSection } from './navigation.types';

/**
 * Quién ve qué del armazón, y dónde está parado.
 *
 * Traduce el registro de {@link APP_SECTIONS} a las dos cosas que la interfaz
 * necesita: el **menú** que corresponde a los roles de la sesión y la **ruta de
 * navegación** de la pantalla actual. Nada de esto se calcula en un componente
 * porque lo consumen varios —el armazón, cada sección— y duplicarlo es cómo
 * empiezan a divergir el menú y el breadcrumb.
 *
 * ## Lo que este servicio NO hace
 *
 * **No autoriza.** Filtrar el menú por roles es cortesía, no seguridad: quien
 * escriba la URL a mano llega igual, se topa con el guard y después con el 403
 * de la API, que es la única autoridad. La razón de filtrar es la del vault —
 * «descubrir la interfaz a base de 403 es mal diseño»—, no protegerse.
 */
@Injectable({
  providedIn: 'root',
})
export class NavigationService {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /**
   * La URL actual como señal.
   *
   * Se escucha `NavigationEnd` y no `router.url` a secas porque `router.url` no
   * es reactivo: leerlo dentro de un `computed` daría el valor del primer
   * cálculo para siempre. `urlAfterRedirects` es la que corresponde — entrar a
   * `/` redirige a `/panel`, y el menú tiene que marcar el panel.
   */
  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Las secciones que esta sesión puede ver, sin agrupar. */
  readonly visibleSections = computed<readonly AppSection[]>(() => {
    const roles = this.auth.roles();
    return APP_SECTIONS.filter((section) => isVisibleTo(section, roles));
  });

  /**
   * El menú ya armado: un grupo por dominio funcional, en el orden de
   * {@link NAV_GROUPS}, y **sin grupos vacíos** — un rótulo sin ítems debajo le
   * dice a la persona que hay algo que no puede ver, que es justo lo que el
   * filtrado quería evitar.
   */
  readonly menu = computed<readonly NavSection[]>(() => {
    const visible = this.visibleSections();

    return NAV_GROUPS.map((group) => ({
      label: group,
      items: visible
        .filter((section) => section.group === group)
        .map((section) => ({
          label: section.label,
          route: routeOf(section),
          icon: section.icon,
        })),
    })).filter((section) => section.items.length > 0);
  });

  /** La sección en la que está parada la persona, o `null` fuera del armazón. */
  readonly currentSection = computed<AppSection | null>(() => sectionForUrl(this.currentUrl()));

  /**
   * La ruta de navegación de la pantalla actual.
   *
   * Tres escalones como mucho: el panel, el dominio funcional y la sección. El
   * dominio va **sin enlace a propósito** — es un rótulo de agrupación, no una
   * pantalla— y el último escalón tampoco lleva enlace porque es donde estás.
   */
  readonly breadcrumbs = computed<readonly BreadcrumbItem[]>(() => {
    const section = this.currentSection();
    if (section === null) {
      return [];
    }

    const home = APP_SECTIONS[0];
    if (home === undefined || section.path === home.path) {
      return [{ label: section.label }];
    }

    return [
      { label: home.label, routerLink: routeOf(home) },
      { label: section.group },
      { label: section.label },
    ];
  });
}

/**
 * Qué sección corresponde a una URL.
 *
 * Gana la coincidencia **más larga** para que las pantallas hijas que todavía
 * no existen —el detalle de un paciente, el alta dentro de una sección— sigan
 * resolviendo a su sección padre en vez de quedarse sin menú marcado ni
 * breadcrumb.
 */
function sectionForUrl(url: string): AppSection | null {
  const path = url.split('?')[0]?.split('#')[0] ?? '';

  const matches = APP_SECTIONS.filter((section) => {
    const route = routeOf(section);
    return path === route || path.startsWith(`${route}/`);
  });

  return [...matches].sort((a, b) => b.path.length - a.path.length)[0] ?? null;
}
