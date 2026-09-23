/* ============================================================================
    Tonos compartidos por las piezas de etiquetado (Badge, Chip).

    La receta la fija el spec ALOVIDA: **fondo claro + texto oscuro del mismo
    tono**, nunca color sólido con texto blanco. Los VALORES viven en los tríos
    `--st-*` de src/styles.css; el mapeo tono → trío vive UNA sola vez, en
    `tone.css`, que ambos componentes importan.

    `primary`, `secondary` y `neutral` son extensión propia sobre el spec
    (que declara solo los cuatro estados) — pendientes de validación del
    diseñador, igual que `outline`/`neutral` del botón.
    ========================================================================== */

/** Tonos con trío `--st-*` propio: los 4 estados del spec + los 2 de marca. */
export const TONES = ['primary', 'secondary', 'success', 'warning', 'error', 'info'] as const;
export type Tone = (typeof TONES)[number];

/**
 * `neutral` no tiene trío `--st-*`: se arma con superficie hundida, texto
 * secundario y borde por defecto. Solo lo usan las piezas que necesitan un
 * tono «sin significado» — un chip de faceta que no es un estado clínico.
 */
export const NEUTRAL_TONE = 'neutral';
export type NeutralTone = typeof NEUTRAL_TONE;
