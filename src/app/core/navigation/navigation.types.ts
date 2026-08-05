import type { NavIconName } from '../../shared/components/organisms/side-nav/side-nav.types';

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
 * Si los roles de una sesión alcanzan para ver la sección.
 *
 * Una sección sin `roles` la ve cualquier sesión; con `roles`, alcanza con
 * tener **uno** de ellos (son alternativas, no requisitos acumulativos: el
 * backend declara varios `@Roles(...)` sobre el mismo endpoint).
 */
export function isVisibleTo(section: AppSection, roles: readonly string[]): boolean {
  const required = section.roles;
  return required === undefined || required.some((role) => roles.includes(role));
}
