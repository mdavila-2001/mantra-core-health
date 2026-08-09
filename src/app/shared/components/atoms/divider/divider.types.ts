/* ============================================================================
    Contratos del Divider — sistema REDSAT v1.0.

    El spec no lo declara: es extensión propia con el token de borde decorativo
    (`--border-default`), que es exactamente para lo que existe — separar, no
    delimitar un control. Pendiente de validación del diseñador.
    ========================================================================== */

export const DIVIDER_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type DividerOrientation = (typeof DIVIDER_ORIENTATIONS)[number];
