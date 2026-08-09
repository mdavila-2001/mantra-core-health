/* ============================================================================
    Contratos del armazón interior — la navegación del área con sesión.

    La forma de la navegación NO se inventó acá: la declara el vault en
    `SALUD/Vistas/👥 Actores y navegación.md`, y de ahí salen las tres reglas
    que este archivo codifica:

    1. «Primer nivel = dominio funcional, segundo nivel = vista.»
    2. «El menú se construye a partir de los roles del token; nunca se muestra
        una entrada que el rol no puede ejecutar.»
    3. «Autoservicio aparte»: lo que la persona hace sobre sus propios datos no
        comparte navegación con las pantallas de gestión.
    ========================================================================== */

/**
 * Nombres de ícono que el registro puede usar.
 *
 * **Está declarado acá y no importado del nav a propósito.** `core/` no importa
 * de `shared/` —la dirección de las capas es `features → shared → core`, y
 * `scripts/check-architecture.mjs` la hace cumplir—, así que el registro declara
 * lo que necesita y el componente declara lo que dibuja. Que las dos listas
 * coincidan lo fija una prueba en el punto donde se encuentran
 * (`features/shell-layout`), que es la única capa que puede ver a las dos.
 *
 * Es un set cerrado por la misma razón que del otro lado: un nombre libre
 * terminaría en un ícono mudo.
 */
export const NAV_ICON_NAMES = [
  'home',
  'patients',
  'calendar',
  'orders',
  'results',
  'billing',
  'settings',
] as const;
export type NavIconName = (typeof NAV_ICON_NAMES)[number];

/**
 * Un destino del menú, tal como el registro lo declara.
 *
 * Coincide **estructuralmente** con lo que el nav lateral consume, así que no
 * hace falta ningún adaptador: el tipado estructural de TypeScript se encarga.
 * Son dos contratos distintos con la misma forma, y eso es correcto — uno dice
 * *qué secciones tiene la aplicación* y el otro *qué sabe dibujar el componente*.
 */
export interface NavMenuItem {
  readonly label: string;
  readonly route: string;
  readonly icon: NavIconName;
}

/** Un grupo rotulado de destinos. */
export interface NavMenuSection {
  readonly label: string;
  readonly items: readonly NavMenuItem[];
}

/**
 * Un escalón de la ruta de navegación. Sin `routerLink` es texto, no enlace.
 *
 * Más angosto que el del breadcrumb —que admite además un array de comandos—
 * porque el armazón sólo produce rutas absolutas. Angosto sigue siendo
 * asignable a ancho, que es lo que importa en el punto de encuentro.
 */
export interface NavBreadcrumbItem {
  readonly label: string;
  readonly routerLink?: string;
}

/**
 * Grupos de primer nivel del menú. Son **dominios funcionales**, no pantallas.
 *
 * El orden del array es el orden en que se dibujan: lo que se usa todos los
 * días arriba, lo administrativo después, lo propio al final. `Mi cuenta` va
 * último y separado porque el vault lo exige explícitamente — mezclar «mis
 * datos» con «los datos que administro» es lo que hace que alguien edite el
 * registro equivocado.
 */
export const NAV_GROUPS = [
  'General',
  'Atención',
  'Administración',
  'Facturación',
  'Mi cuenta',
] as const;
export type NavGroup = (typeof NAV_GROUPS)[number];

/**
 * Si la sección tiene pantalla propia o todavía no.
 *
 * `planificada` no es un adorno: es lo que hace que el armazón se pueda
 * recorrer entero antes de que las 693 vistas existan, y lo que le da a cada
 * quien un lugar declarado donde montar la suya. Pasar una sección a
 * `disponible` es agregar su componente en `app.routes.ts`; nada más.
 */
export type SectionAvailability = 'disponible' | 'planificada';

/**
 * Una sección del área autenticada.
 *
 * Es la **única fuente** de la que salen a la vez la ruta hija del armazón, la
 * entrada del menú, el título de la pestaña y la ruta de navegación
 * (breadcrumb). Tenerlas separadas es lo que produce el defecto clásico —un
 * ítem de menú que apunta a una ruta que nadie declaró—, y por eso el registro
 * es uno solo: si la sección no está acá, no existe en ningún lado.
 */
export interface AppSection {
  /** Ruta hija del armazón, sin barra inicial (`agenda`, `administracion/usuarios`). */
  readonly path: string;

  /** Cómo se llama en el menú y en el breadcrumb. Lenguaje del dominio, no de la base. */
  readonly label: string;

  readonly group: NavGroup;

  /** Del set cerrado del nav: un nombre libre terminaría en un ícono mudo. */
  readonly icon: NavIconName;

  /**
   * Roles del token que pueden verla. **Omitirlo significa «cualquier sesión»**,
   * no «nadie».
   *
   * Esconder un ítem no protege nada —la autoridad es la API, que valida en
   * cada petición—: es no ofrecer una puerta que va a estar cerrada.
   */
  readonly roles?: readonly string[];

  readonly availability: SectionAvailability;

  /**
   * Qué es la sección, en una línea y en segunda persona. Se muestra en el
   * estado vacío mientras la pantalla no exista: un vacío que no explica de qué
   * era la pantalla no le sirve a nadie.
   */
  readonly summary: string;

  /**
   * Módulo del modelo canónico que la respalda (`M41 scheduling`).
   *
   * Es trazabilidad, no decoración: cuando alguien vaya a construir la
   * pantalla, esto le dice qué ficha de `SALUD/Vistas/` abrir y contra qué
   * endpoints se implementa.
   */
  readonly module: string;
}

/** Prefijo de todos los títulos de pestaña, tal como ya lo usaban las rutas. */
export const APP_TITLE = 'Mantra Core Health';

/**
 * Clave con la que cada ruta lleva su sección en `data`.
 *
 * Es una constante y no el literal suelto para que quien la lee y quien la
 * escribe no puedan desincronizarse con un error de tipeo que el compilador no
 * vería.
 */
export const SECTION_ROUTE_DATA = 'seccion';

/** Ruta absoluta de una sección, que es como la consumen el router y el menú. */
export function routeOf(section: AppSection): string {
  return `/${section.path}`;
}

/** Título de pestaña de una sección. Deriva del rótulo para que no se separen. */
export function titleOf(section: AppSection): string {
  return `${APP_TITLE} - ${section.label}`;
}

/**
 * Rol comodín: quien lo tiene ve todas las secciones.
 *
 * No es una licencia que se tome el menú: es **la regla del backend**. Su
 * `RolesGuard` corta con `if (roles.includes('SUPERADMIN')) return true` antes
 * de mirar los `@Roles(...)` del endpoint, así que sin esto el menú escondería
 * secciones que la API sí le responde a esa sesión — y una sección que existe,
 * funciona y no aparece es peor que una que aparece y da 403: no hay forma de
 * descubrir que estaba.
 */
const WILDCARD_ROLE = 'SUPERADMIN';

/**
 * Si los roles de una sesión alcanzan para ver la sección.
 *
 * Una sección sin `roles` la ve cualquier sesión; con `roles`, alcanza con
 * tener **uno** de ellos (son alternativas, no requisitos acumulativos: el
 * backend declara varios `@Roles(...)` sobre el mismo endpoint).
 *
 * **No autoriza nada.** Filtrar el menú es cortesía: quien escriba la ruta a
 * mano llega igual, y quien la autoriza de verdad es el backend.
 */
export function isVisibleTo(section: AppSection, roles: readonly string[]): boolean {
  if (roles.includes(WILDCARD_ROLE)) {
    return true;
  }
  const required = section.roles;
  return required === undefined || required.some((role) => roles.includes(role));
}
