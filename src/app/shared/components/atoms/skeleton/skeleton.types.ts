/* ============================================================================
    Contratos del Skeleton — sistema REDSAT v1.0.

    El spec no lo declara: extensión propia armada con las superficies del tema
    (`--bg-inset` / `--bg-surface-alt`), así que el modo oscuro sale solo.
    Pendiente de validación del diseñador.
    ========================================================================== */

export const SKELETON_VARIANTS = ['text', 'circle', 'rect'] as const;
export type SkeletonVariant = (typeof SKELETON_VARIANTS)[number];

/**
 * La última línea de un párrafo simulado va más corta: un bloque de líneas
 * todas iguales se lee como una tabla, no como texto.
 */
export const SKELETON_LAST_LINE_WIDTH = '60%';
