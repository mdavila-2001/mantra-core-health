/**
 * Las rutas de «Encuestas» (lado profesional).
 *
 * **No pueden empezar con `surveys`**: `/surveys` es el prefijo del módulo en la
 * API y el proxy compara por inicio de ruta sin límite de segmento, así que una
 * sección llamada `surveys` se iría entera al backend. Es el mismo motivo por el
 * que M13 vive en `administration/geolocation`. Lo verifica
 * `scripts/check-route-prefixes.mjs`.
 */

/** La sección: el listado de encuestas del profesional. */
export const ENCUESTAS_ROUTE = '/questionnaires';

/** La ficha de una encuesta: cuestionario, vigencia y respuestas. */
export function encuestaRoute(surveyId: string): string {
  return `${ENCUESTAS_ROUTE}/${surveyId}`;
}
