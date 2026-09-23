import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';

import { AuthService } from '../auth/auth.service';
import { APP_SECTIONS } from './navigation.map';
import { GRUPOS_APLANADOS, NAV_GROUP_ICONS, SUBGROUP_BY_PATH } from './navigation.subgroups';
import {
  apareceEnElMenu,
  isVisibleTo,
  NAV_GROUPS,
  routeOf,
  type AppSection,
  type NavBreadcrumbItem,
  type NavIconName,
  type NavMenuBlock,
  type NavMenuItem,
  type NavMenuSection,
} from './navigation.types';

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
   * `/` redirige a `/dashboard`, y el menú tiene que marcar el panel.
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
    const tenants = this.auth.tenants();
    return APP_SECTIONS.filter((section) => isVisibleTo(section, roles, tenants));
  });

  /**
   * El menú ya armado: un grupo por dominio funcional, en el orden de
   * {@link NAV_GROUPS}, y **sin grupos vacíos** — un rótulo sin ítems debajo le
   * dice a la persona que hay algo que no puede ver, que es justo lo que el
   * filtrado quería evitar.
   *
   * Cada grupo viene además repartido en {@link NavMenuBlock}s de cosas
   * parecidas, que es lo que la barra dibuja como desplegables. El reparto no
   * filtra nada: `items` y la suma de los `blocks` son siempre los mismos
   * destinos, y eso lo fija una prueba.
   */
  readonly menu = computed<readonly NavMenuSection[]>(() => {
    // **No sale de `visibleSections`**: aparecer en el menú y poder entrar
    // dejaron de ser la misma pregunta cuando el panel del médico tuvo que
    // quedar en ocho renglones (§4.H del plan de UX). Una sección con
    // `fueraDelMenuPara` sigue en `visibleSections` —el guard la deja pasar,
    // «Tus accesos» la lista— y no ocupa un renglón acá.
    const roles = this.auth.roles();
    const tenants = this.auth.tenants();
    // Las fijas salen **antes** de repartir, no después: si se descontaran al
    // final, `items` y la suma de los `blocks` dejarían de coincidir, que es
    // justo el invariante que fija la prueba de este servicio.
    const enElMenu = APP_SECTIONS.filter(
      (section) => apareceEnElMenu(section, roles, tenants) && section.pinnedTop !== true,
    );

    return NAV_GROUPS.map((group) => {
      const delGrupo = enElMenu.filter((section) => section.group === group);
      return {
        label: group,
        icon: NAV_GROUP_ICONS[group],
        items: delGrupo.map(menuItemOf),
        blocks: repartirEnBloques(delGrupo),
        // Un grupo aplanado igual se reparte en bloques: `blocks` es la única
        // vista que conserva el orden de dibujo, y el día que alguien lo saque
        // de la lista tiene que volver a plegarse sin recalcular nada.
        aplanado: GRUPOS_APLANADOS.has(group),
      };
    }).filter((section) => section.items.length > 0);
  });

  /**
   * Los destinos que van sueltos y arriba de todo, fuera de los desplegables.
   *
   * Hoy son «Mi perfil» y «Notificaciones»: lo que cualquiera abre sin pensar a
   * qué dominio pertenece. Salen en el orden del registro, no en el de nadie
   * más, y respetan el mismo filtro por rol que el resto del menú — lo que un
   * rol no puede ver, tampoco se le fija arriba.
   */
  readonly pinnedItems = computed<readonly NavMenuItem[]>(() => {
    const roles = this.auth.roles();
    const tenants = this.auth.tenants();
    return APP_SECTIONS.filter(
      (section) => section.pinnedTop === true && apareceEnElMenu(section, roles, tenants),
    ).map(menuItemOf);
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
  readonly breadcrumbs = computed<readonly NavBreadcrumbItem[]>(() => {
    const section = this.currentSection();
    if (section === null) {
      return [];
    }

    const home = APP_SECTIONS[0];
    if (home === undefined || section.path === home.path) {
      return [{ label: section.label }];
    }

    // Un destino fijo no muestra su grupo: en la barra no cuelga de ninguno, y
    // nombrarlo acá sería mandar a buscar un desplegable que —cuando el grupo
    // se queda sin más secciones, como le pasa al médico con «Mi cuenta»— ni
    // siquiera se dibuja. El `group` sigue declarado en el registro, que es lo
    // que lo mantiene repartido; lo que no hace es aparecer en el camino.
    if (section.pinnedTop === true) {
      return [{ label: home.label, routerLink: routeOf(home) }, { label: section.label }];
    }

    return [
      { label: home.label, routerLink: routeOf(home) },
      { label: section.group },
      { label: section.label },
    ];
  });
}

/** Una sección del registro, vista como el destino que el menú dibuja. */
function menuItemOf(section: AppSection): NavMenuItem {
  const item: NavMenuItem = { label: section.label, route: routeOf(section), icon: section.icon };
  const representa = section.representaEnElMenu;
  if (representa === undefined) {
    return item;
  }
  // Las rutas viajan ya normalizadas —con su barra inicial— porque quien las
  // consume compara contra una URL, no contra un `path` del registro.
  return { ...item, representa: representa.map((path) => `/${path}`) };
}

/**
 * Las secciones visibles de un grupo, repartidas en los bloques que declara
 * `navigation.subgroups.ts`.
 *
 * ## El orden sale de las secciones, no del reparto
 *
 * Un bloque se dibuja donde aparece **su primera sección visible**, y adentro
 * los destinos conservan el orden del registro. Es lo que hace que el menú
 * mantenga la secuencia que ya tenía y que dos sesiones distintas no vean los
 * bloques bailar: quien no ve la primera sección de un bloque tampoco lo ve
 * saltar de lugar, porque el ancla es la primera que sí ve.
 *
 * ## Una sección sin bloque no desaparece
 *
 * Cae en un bloque propio, con su rótulo y su ícono. Es el caso que una prueba
 * de `navigation.subgroups.spec` impide que ocurra —el reparto tiene que
 * cubrir el registro entero—, y aun así se resuelve así y no con un descarte:
 * el precio de olvidarse de repartir una sección nueva tiene que ser un
 * renglón suelto en la barra, nunca un destino que dejó de ofrecerse.
 */
function repartirEnBloques(sections: readonly AppSection[]): readonly NavMenuBlock[] {
  const bloques = new Map<string, { label: string; icon: NavIconName; items: NavMenuItem[] }>();

  for (const section of sections) {
    const subgrupo = SUBGROUP_BY_PATH.get(section.path);
    const clave = subgrupo?.label ?? ` ${section.path}`;
    const bloque = bloques.get(clave);
    if (bloque === undefined) {
      bloques.set(clave, {
        label: subgrupo?.label ?? section.label,
        icon: subgrupo?.icon ?? section.icon,
        items: [menuItemOf(section)],
      });
      continue;
    }
    bloque.items.push(menuItemOf(section));
  }

  return [...bloques.values()];
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
