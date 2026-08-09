/* ============================================================================
    Contratos de la Pagination — sistema REDSAT v1.0.

    Extensión propia: el spec del diseñador no declara paginador. Se arma con
    el AppButton y el app-select del sistema, sin color propio.
    Pendiente de validación del diseñador.
    ========================================================================== */

/** Marca del hueco entre dos tramos de páginas. No es una página: no se puede pulsar. */
export const PAGE_GAP = 'gap' as const;
export type PageGap = typeof PAGE_GAP;

/** Lo que la barra dibuja: un número de página o un salto. */
export type PageSlot = number | PageGap;

/**
 * Tope de botones numéricos a la vista. Con 7 entran primera, última, la
 * actual con sus dos vecinas y los dos saltos, que es lo mínimo para no
 * perder el contexto de dónde se está.
 */
export const MAX_PAGE_SLOTS = 7;

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_PAGE_SIZE_OPTIONS: readonly number[] = Object.freeze([10, 20, 50, 100]);
