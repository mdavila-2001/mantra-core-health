/* ============================================================================
    Contratos de la navegación lateral.

    El nav NO conoce los 17 portales: recibe secciones e ítems ya resueltos por
    quien sí sabe qué rol tiene la persona. Acá solo hay forma, nunca permisos.
    ========================================================================== */

import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/** Un destino del menú. `route` es la ruta interna de Angular. */
export interface NavItem {
  readonly label: string;
  readonly route: string;
  /** Nombre del ícono del set propio; sin él, el ítem colapsado muestra la inicial. */
  readonly icon?: NavIconName;
  /** Conteo pendiente (tareas, avisos). Presentación, nunca dato clínico. */
  readonly badge?: number;
  readonly disabled?: boolean;
}

/**
 * Un desplegable dentro de un grupo: destinos parecidos bajo un rótulo propio.
 *
 * Quién va con quién no se decide acá —lo declara `core/navigation`, que es
 * quien conoce las secciones—: el nav sólo dibuja lo que recibe.
 */
export interface NavBlock {
  readonly label: string;
  readonly icon?: NavIconName;
  readonly items: readonly NavItem[];
}

/**
 * Un grupo rotulado de destinos.
 *
 * `items` es la lista plana de todo lo que el grupo ofrece; `blocks`, cuando
 * viene, es cómo se reparte en desplegables. Los dos campos del reparto son
 * **opcionales** porque el organismo sabe dibujar un grupo sin ellos —así lo
 * usa la vitrina del sistema de diseño, con sus grupos de tres ítems—; el
 * armazón del área con sesión sí los manda, y es el que tiene cincuenta y cinco
 * secciones que ordenar.
 */
export interface NavSection {
  readonly label: string;
  /** Ícono del grupo cerrado; sin él, el rótulo va solo. */
  readonly icon?: NavIconName;
  readonly items: readonly NavItem[];
  readonly blocks?: readonly NavBlock[];
}

/**
 * Set de íconos de trazo propio del nav.
 *
 * Se re-exporta: el dueño es `atoms/nav-icon`, que es quien los dibuja, desde
 * que «Tus accesos» del panel usa los mismos (carril 02). Sigue disponible acá
 * para quien ya lo importaba de este archivo.
 */
export { NAV_ICON_NAMES } from '../../atoms/nav-icon/nav-icon.types';
export type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/** Estados del panel de navegación. Los resuelve `ShellService`. */
export const NAV_MODES = ['expanded', 'collapsed', 'drawer-open', 'drawer-closed'] as const;
export type NavMode = (typeof NAV_MODES)[number];
