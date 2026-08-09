/* ============================================================================
    Contratos del Search field — sistema REDSAT v1.0.

    Extensión propia: el spec declara el input `type="search"` (con su lupa y
    su botón de limpiar, ya implementados en `atoms/input`), pero no el campo
    con debounce y estado de carga. Pendiente de validación del diseñador.
    ========================================================================== */

/**
 * Espera por defecto antes de avisar que hay que buscar. 300 ms es el punto
 * donde una búsqueda deja de dispararse por cada tecla sin que se sienta
 * lenta; con listados grandes el consumidor puede subirla.
 */
export const SEARCH_DEBOUNCE_MS = 300;
