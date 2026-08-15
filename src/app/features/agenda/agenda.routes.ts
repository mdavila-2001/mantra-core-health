/* ============================================================================
    Las rutas de la sección de agenda, en un solo lugar.

    Mismo criterio que `patients.routes.ts`: la agenda ofrece reservar y la
    reserva vuelve a la agenda, y una ruta escrita a mano en un `routerLink`
    es el enlace que sobrevive a un renombre y deja de funcionar.
    ========================================================================== */

/** La sección de agenda (M41). Coincide con la entrada del menú. */
export const AGENDA_ROUTE = '/schedule';

/**
 * El alta de agenda por fases (UC-41-01 → UC-41-04). Cuelga de la sección, no
 * del menú: se llega desde la propia agenda, como las demás pantallas de
 * operación.
 */
export const AGENDA_CREATE_ROUTE = `${AGENDA_ROUTE}/new`;

/**
 * La reserva de un cupo concreto (V41-09 → V41-05: hold → confirm).
 *
 * El cupo viaja en la ruta; el recurso y la franja van por query string
 * (`recurso`, `desde`, `hasta`) porque son lo que permite **volver a leer** el
 * cupo al recargar: no existe `GET /scheduling/slots/:id`, así que la pantalla
 * lo reencuentra con `GET /scheduling/slots?resourceId=…&from=…&to=…`.
 */
export function bookingNewRoute(slotId: string): string {
  return `${AGENDA_ROUTE}/book/${slotId}`;
}
