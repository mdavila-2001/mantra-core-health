/* ============================================================================
    Las rutas de «Consulta médica», en un solo lugar.

    Mismo criterio que `agenda.routes.ts`: la pantalla ofrece «atender sin
    turno» y el asistente vuelve a la consulta, y una ruta escrita a mano en un
    `routerLink` es el enlace que sobrevive a un renombre y deja de funcionar.
    ========================================================================== */

export const CONSULTATION_ROUTE = '/consultation';

/** El asistente por fases para atender a alguien que no tiene turno. */
export const CONSULTATION_WALK_IN_ROUTE = `${CONSULTATION_ROUTE}/walk-in`;
