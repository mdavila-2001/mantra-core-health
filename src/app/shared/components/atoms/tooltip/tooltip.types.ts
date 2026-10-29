/* ============================================================================
    Contratos del Tooltip — sistema ALOVIDA v1.0.

    El spec del diseñador no declara globo de ayuda; es extensión propia,
    armada solo con tokens (superficie invertida = petróleo 900, la misma que
    el sistema usa como fondo base en modo oscuro).
    Pendiente de validación del diseñador.
    ========================================================================== */

export const TOOLTIP_POSITIONS = ['top', 'bottom', 'left', 'right'] as const;
export type TooltipPosition = (typeof TOOLTIP_POSITIONS)[number];

/** A dónde voltea el globo cuando el lado pedido no entra en el viewport. */
export const TOOLTIP_OPPOSITE: Readonly<Record<TooltipPosition, TooltipPosition>> = Object.freeze({
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
});

/** Puente al salir del control hacia un globo `hoverable` (CONTRATO-PLANO §5.6: `PLAN_HOVER_CLOSE_MS`). */
export const TOOLTIP_CLOSE_DELAY_MS = 200;

/** Margen interior con el que el modo `shift` mantiene el globo dentro del viewport. Espeja `--sp-2`. */
export const TOOLTIP_VIEWPORT_MARGIN_PX = 8;

/**
 * Espera del puntero antes de mostrar: sin ella, cruzar una barra de íconos
 * densa dispara una ráfaga de globos. Con el teclado la espera es 0 — quien
 * navega tabulando ya declaró su intención al llegar al control.
 */
export const TOOLTIP_HOVER_DELAY_MS = 300;

/** Separación entre el control y el globo. Espeja `--sp-2` (8 px) del sistema. */
export const TOOLTIP_GAP_PX = 8;
