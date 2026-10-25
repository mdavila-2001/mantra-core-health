/* ============================================================================
    Las rutas de «Grupos médicos» (FT-21, carril 21), en un solo lugar.

    Mismo criterio que `quotations.routes.ts`: el listado, el alta y la
    consulta se enlazan entre sí, y una ruta escrita a mano en un `routerLink`
    es el enlace que sobrevive a un renombre y deja de funcionar.

    **La ruta es `medical-groups` y no choca con el proxy**: `/medical-groups`
    es también el prefijo del módulo en la API, y `proxy.conf.json` compara por
    inicio de ruta. Por eso el front la sirve bajo `my-medical-groups`.
    ========================================================================== */

/** El listado con sus tres pestañas. Coincide con la entrada del menú. */
export const MEDICAL_GROUPS_ROUTE = '/my-medical-groups';

/** El alta: «Crear grupo médico». */
export const MEDICAL_GROUP_NEW_ROUTE = `${MEDICAL_GROUPS_ROUTE}/new`;

/** La consulta de un grupo: el mismo formulario, lleno y sin editar. */
export function medicalGroupRoute(id: string): string {
  return `${MEDICAL_GROUPS_ROUTE}/${encodeURIComponent(id)}`;
}
