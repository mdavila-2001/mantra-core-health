/* ============================================================================
    Contratos del AppButton — sistema REDSAT v1.0.
    Fuente de las variantes: REDSAT_Sistema_de_Diseno.html (bloque Buttons).
    `outline` es una extensión propia pendiente de validación del diseñador
    (identidad-visual.md, pendientes) — el spec solo declara una variante con
    borde (`secondary`).
    ========================================================================== */

/**
 * `neutral` toma los colores que el spec le da a `btn-icon` (fondo `--bg-inset`,
 * tinta `--text-secondary`): promovidos a variante para que también puedan
 * llevar texto, no solo un ícono.
 */
export const BUTTON_VARIANTS = [
  'primary',
  'secondary',
  'outline',
  'danger',
  'ghost',
  'neutral',
] as const;
export type ButtonVariant = (typeof BUTTON_VARIANTS)[number];

/** sm 32 px · md 40 px · lg 48 px; en móvil (< 780 px) md/lg suben a 44 px. */
export const BUTTON_SIZES = ['sm', 'md', 'lg'] as const;
export type ButtonSize = (typeof BUTTON_SIZES)[number];

/** El host es un `<button>` nativo: sin esto el default HTML es `submit`. */
export type ButtonType = 'button' | 'submit' | 'reset';
