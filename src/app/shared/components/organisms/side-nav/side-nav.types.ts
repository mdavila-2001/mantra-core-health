/* ============================================================================
    Contratos de la navegación lateral.

    El nav NO conoce los 17 portales: recibe secciones e ítems ya resueltos por
    quien sí sabe qué rol tiene la persona. Acá solo hay forma, nunca permisos.
    ========================================================================== */

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
 * Set de íconos de trazo propio del nav. Cerrado a propósito: un string libre
 * terminaría en nombres que no existen y en íconos mudos.
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

/** Estados del panel de navegación. Los resuelve `ShellService`. */
export const NAV_MODES = ['expanded', 'collapsed', 'drawer-open', 'drawer-closed'] as const;
export type NavMode = (typeof NAV_MODES)[number];
