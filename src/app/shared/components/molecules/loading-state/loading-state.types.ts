/* ============================================================================
    Contratos del LoadingState — estado UX **S2** (cargando) con mensaje.

    El sistema ya tenía las dos piezas sueltas: `app-spinner` (el aro) y
    `app-skeleton` (la silueta). Lo que faltaba era la frase que dice QUÉ se
    está trayendo, y cada pantalla la escribía como un `<p>` gris sin nada al
    lado: se leía como un texto más del formulario, no como una espera.
    ========================================================================== */

/** `inline` acompaña a un bloque; `block` ocupa el hueco de una sección entera. */
export const LOADING_STATE_SIZES = ['inline', 'block'] as const;
export type LoadingStateSize = (typeof LOADING_STATE_SIZES)[number];
