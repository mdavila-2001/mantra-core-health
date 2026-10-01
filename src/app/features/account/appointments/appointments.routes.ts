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

/**
 * Query param con el perfil del profesional con quien se quiere pedir (v4.2.40).
 *
 * Lo pone la ficha del profesional —«Pedir turno» en uno de sus servicios— y lo lee
 * «Agendar una cita» para dejar elegido con quién, sin que el paciente tenga que
 * buscarlo de nuevo. Vive acá, en el archivo chico, por la misma razón que
 * {@link CAMPAIGN_PARAM}: la ficha no puede importar el componente entero.
 */
export const PROFESSIONAL_PARAM = 'profesional';

/** Query param con la oferta de servicio que se quiere pedir, junto con {@link PROFESSIONAL_PARAM}. */
export const SERVICE_PARAM = 'servicio';

/**
 * La ruta de «Agendar una cita» con el profesional —y, si se quiere, el servicio—
 * ya elegidos.
 *
 * @param practitionerProfileId - Con quién se pide.
 * @param offeringId - Qué servicio; ausente ≡ una consulta.
 */
export function pedirConProfesionalRoute(practitionerProfileId: string, offeringId?: string): {
  readonly path: string;
  readonly queryParams: Record<string, string>;
} {
  return {
    path: MIS_TURNOS_ROUTE,
    queryParams: {
      seccion: 'pedir',
      [PROFESSIONAL_PARAM]: practitionerProfileId,
      ...(offeringId === undefined ? {} : { [SERVICE_PARAM]: offeringId }),
    },
  };
}
