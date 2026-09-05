/* ============================================================================
    Contratos del Textarea — sistema ALOVIDA v1.0.

    El spec del diseñador declara el campo de texto de una línea; el de varias
    líneas es extensión propia con los MISMOS estados y bordes del input
    (`input.css`), porque una nota de evolución no puede parecer otro control.
    Pendiente de validación del diseñador.
    ========================================================================== */

/**
 * Bandas de aviso del contador. El anuncio se dispara al CAMBIAR de banda, no
 * en cada tecla: un lector de pantalla que dice el conteo letra por letra hace
 * inservible el campo.
 */
export const TEXTAREA_LIMIT_BANDS = ['none', 'near', 'reached'] as const;
export type TextareaLimitBand = (typeof TEXTAREA_LIMIT_BANDS)[number];

/** Proporción del límite a partir de la cual se avisa que queda poco espacio. */
export const TEXTAREA_NEAR_LIMIT_RATIO = 0.9;
