/**
 * Las rutas de «Mis cuestionarios».
 *
 * Viven acá y no como literales en las plantillas por el mismo motivo que en
 * turnos: la ruta la declara `navigation.map.ts` y cualquier pantalla que
 * enlace a ella tiene que salir de una sola definición, o el día que cambie
 * quedan enlaces muertos que nada detecta.
 *
 * **No pueden empezar con `surveys`**: `/surveys` es el prefijo del módulo en la
 * API y el proxy compara por inicio de ruta. Lo verifica
 * `scripts/check-route-prefixes.mjs`.
 */

/** La sección: el listado de cuestionarios del paciente. */
export const MIS_CUESTIONARIOS_ROUTE = '/my-account/questionnaires';

/** La pantalla para responder un cuestionario concreto. */
export function responderCuestionarioRoute(invitationId: string): string {
  return `${MIS_CUESTIONARIOS_ROUTE}/${invitationId}`;
}
