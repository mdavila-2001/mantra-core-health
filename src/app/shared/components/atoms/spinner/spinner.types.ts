/* ============================================================================
    Contratos del Spinner — sistema ALOVIDA v1.0.

    El spec del diseñador no declara un indicador de carga suelto: lo define
    DENTRO del botón (`ALOVIDA_Sistema_de_Diseno.html`, bloque Buttons). Este
    átomo extrae esa geometría para poder usarla en tablas y páginas.
    Extensión propia — pendiente de validación del diseñador.
    ========================================================================== */

/** Los tamaños se expresan en `em`: el spinner acompaña la tipografía del contenedor. */
export const SPINNER_SIZES = ['sm', 'md', 'lg'] as const;
export type SpinnerSize = (typeof SPINNER_SIZES)[number];
