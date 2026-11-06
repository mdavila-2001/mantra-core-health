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

/** Query param holding the open sub-tab of «Encuestas». */
export const SURVEYS_SUBTAB_PARAM = 'encuestas';

/** Sub-tabs in order. The first is the default and is kept out of the URL. */
export const SURVEYS_SUBTABS = ['buzon', 'servicios'] as const;

/** Query params that open «Encuestas por servicio». */
export const SERVICE_SURVEYS_QUERY = { [SURVEYS_SUBTAB_PARAM]: 'servicios' } as const;
