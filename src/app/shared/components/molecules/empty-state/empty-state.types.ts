/* ============================================================================
    Contratos del Empty state — estado UX **S7** del [[M34 portal_catalog]].

    Las tres variantes NO son decoración: son tres situaciones distintas para
    el usuario. «No hay nada todavía» invita a crear; «tu búsqueda no encontró
    nada» invita a cambiar el filtro; «algo falló» invita a reintentar.
    Extensión propia — pendiente de validación del diseñador.
    ========================================================================== */

export const EMPTY_STATE_VARIANTS = ['empty', 'no-results', 'error'] as const;
export type EmptyStateVariant = (typeof EMPTY_STATE_VARIANTS)[number];
