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

/** Un grupo rotulado de destinos. */
export interface NavSection {
  readonly label: string;
  readonly items: readonly NavItem[];
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
