/* ============================================================================
    Contratos del Progress — sistema REDSAT v1.0.

    El spec no declara barra de progreso: extensión propia con la tinta de
    marca y los tríos de estado. Pendiente de validación del diseñador.

    Sin tono ámbar: el ámbar es el punto de acción único de la pantalla
    (identidad-visual.md) y una barra de subida lo repetiría en cada archivo.
    ========================================================================== */

export const PROGRESS_TONES = ['primary', 'success', 'error'] as const;
export type ProgressTone = (typeof PROGRESS_TONES)[number];

export const PROGRESS_SIZES = ['sm', 'md'] as const;
export type ProgressSize = (typeof PROGRESS_SIZES)[number];

export const PROGRESS_MIN = 0;
export const PROGRESS_MAX = 100;
