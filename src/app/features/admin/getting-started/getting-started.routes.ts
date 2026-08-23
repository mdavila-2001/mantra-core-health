/* ============================================================================
    La ruta del recorrido de puesta en marcha, en un solo lugar.

    Vive aparte porque la enlazan pantallas de otras secciones —el panel, el
    ingreso— y una ruta escrita a mano en un `routerLink` es el enlace que
    sobrevive a un renombre y deja de funcionar.

    No es una entrada del menú: se llega desde el aviso del panel o desde el
    ingreso, y es un destino, no un lugar donde quedarse.
    ========================================================================== */

/** Recorrido de puesta en marcha de la plataforma. */
export const GETTING_STARTED_ROUTE = '/administration/getting-started';
