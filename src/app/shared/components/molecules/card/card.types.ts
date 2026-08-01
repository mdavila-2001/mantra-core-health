/* ============================================================================
    Contratos de la Card — sistema REDSAT v1.0.

    El spec del diseñador no declara tarjeta: es extensión propia armada con
    las superficies del tema (`--bg-surface`), el borde decorativo y las tres
    sombras del sistema. Pendiente de validación del diseñador.
    ========================================================================== */

/**
 * `elevated` levanta con sombra; `outlined` delimita con borde (el default:
 * una ficha clínica que convive con otras veinte no necesita relieve);
 * `flat` no hace ninguna de las dos y solo agrupa.
 */
export const CARD_VARIANTS = ['elevated', 'outlined', 'flat'] as const;
export type CardVariant = (typeof CARD_VARIANTS)[number];

export const CARD_PADDINGS = ['none', 'sm', 'md', 'lg'] as const;
export type CardPadding = (typeof CARD_PADDINGS)[number];

/** Lo que hace enfocable a un descendiente: una card interactiva no puede contenerlos. */
export const FOCUSABLE_SELECTOR =
  'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
