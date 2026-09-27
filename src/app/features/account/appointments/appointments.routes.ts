/* ============================================================================
    Las rutas del portal de turnos del paciente, en un solo lugar.

    Mismo criterio que `agenda.routes.ts`: una ruta escrita a mano en un
    `routerLink` es el enlace que sobrevive a un renombre y deja de funcionar.
    ========================================================================== */

/** Los turnos de quien está adentro: los suyos, no los de la organización. */
export const MIS_TURNOS_ROUTE = '/my-account/appointments';

/**
 * La reserva de un cupo concreto **desde el portal** (canal `PORTAL`).
 *
 * Es la misma pantalla que usa el mostrador —`agenda/reservar/:slotId`—, con la
 * misma revalidación del cupo y el mismo ciclo retener → confirmar. Lo único
 * que cambia es quién es el paciente: acá lo resuelve la sesión, y por eso la
 * ruta es distinta aunque el componente sea el mismo.
 *
 * El cupo viaja en la ruta; el recurso y la franja van por query string
 * (`recurso`, `desde`, `hasta`) porque son lo que permite **volver a leer** el
 * cupo al recargar: no existe `GET /scheduling/slots/:id`.
 */
export function reservaDelPortalRoute(slotId: string): string {
  return `${MIS_TURNOS_ROUTE}/book/${slotId}`;
}

/**
 * Query param con el código de una campaña preventiva del seguro (Tarea 4).
 *
 * Lo pone el widget de beneficios (`patient-campaigns-widget`) y lo lee
 * «Agendar una cita» para decir por qué se está agendando. Vive acá, en el
 * archivo chico, y no en `appointments.ts`: el widget viaja en el bundle inicial
 * del panel del paciente e importar el componente lo metería adentro.
 */
export const CAMPAIGN_PARAM = 'campaign';

/** El título de esa campaña, sólo para mostrarlo: el código solo no le dice nada a quien agenda. */
export const CAMPAIGN_TITLE_PARAM = 'campaignTitle';
