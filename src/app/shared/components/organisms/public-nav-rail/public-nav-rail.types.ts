/* ============================================================================
    Las entradas del rail público: la única declaración de qué secciones tiene
    la superficie sin sesión.

    ## Por qué acá y no en cada pantalla

    Estaban escritas **ocho veces**, dentro de ocho plantillas de
    `features/redsat/buscar/`, y las ocho listas eran distintas: el feed
    ofrecía cuatro pestañas y los verticales otras seis, con rótulos que ni
    siquiera coincidían entre sí. Quien entraba por `/posts` no podía
    llegar a `/search/medications` sin pasar por `/search`, y quien entraba
    por un vertical no sabía que existían las publicaciones.

    Una sola lista, en el marco, arregla las dos cosas y hace que la corrección
    de un rótulo sea un renglón y no ocho.
    ========================================================================== */

import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/** Una entrada del rail: su destino, su glifo y el texto que la nombra. */
export interface PublicNavRailEntry {
  /** Ruta absoluta. Es también la clave de la entrada: no se repite. */
  readonly route: string;
  /**
   * El texto en castellano. Cumple **tres** papeles a la vez: `aria-label` del
   * enlace, contenido del tooltip, y rótulo visible cuando el rail se despliega
   * en horizontal (móvil). Por eso es uno solo y no tres.
   */
  readonly label: string;
  /** Del set cerrado de `atoms/nav-icon`. Nunca un `<svg>` suelto. */
  readonly icon: NavIconName;
}

/** Un grupo de entradas, con su rótulo para el lector de pantalla. */
export interface PublicNavRailGroup {
  /** Identificador estable en inglés — se usa como `data-group` en el DOM. */
  readonly id: string;
  /** Rótulo en castellano. Visualmente oculto: el rail es de íconos. */
  readonly title: string;
  readonly entries: readonly PublicNavRailEntry[];
}

/**
 * Las cuatro secciones que el propietario nombra, en su orden.
 *
 * ## Por qué son un grupo aparte de los verticales
 *
 * El pedido dice literalmente «Publicaciones, Buscar, Profesionales y ¿A quién
 * consulto? deben estar agrupados en un menú lateral izquierdo». Son **estas
 * cuatro**, y son las de arriba.
 *
 * Los cuatro verticales —medicamentos, hospitales, laboratorios,
 * aseguradoras— no estaban en ese pedido, pero **eran** la navegación real de
 * seis de las ocho pantallas: si el rail se quedara sólo con las cuatro de
 * arriba, esas seis pantallas perderían la única forma de llegar unas a otras.
 * Van abajo, en su propio grupo, separadas por una línea y por su propio
 * rótulo para el lector de pantalla.
 */
export const PUBLIC_NAV_RAIL_SECTIONS: readonly PublicNavRailGroup[] = [
  {
    id: 'sections',
    title: 'Secciones',
    entries: [
      { route: '/posts', label: 'Publicaciones', icon: 'note' },
      { route: '/search', label: 'Buscar', icon: 'directory' },
      { route: '/search/practitioners', label: 'Profesionales', icon: 'stethoscope' },
      { route: '/search/symptoms', label: '¿A quién consulto?', icon: 'survey' },
    ],
  },
  {
    id: 'directories',
    title: 'Directorios',
    entries: [
      { route: '/search/medications', label: 'Medicamentos', icon: 'pill' },
      { route: '/search/hospitals', label: 'Hospitales y clínicas', icon: 'hospital' },
      { route: '/search/diagnostics', label: 'Laboratorios e imagen', icon: 'flask' },
      { route: '/search/insurers', label: 'Aseguradoras', icon: 'umbrella' },
    ],
  },
] as const;
