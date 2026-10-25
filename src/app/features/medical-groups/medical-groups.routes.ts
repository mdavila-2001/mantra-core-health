/* ============================================================================
    Las rutas de grupos médicos (FT-21), en un solo lugar.

    ## Por qué cuelgan de `schedule/` y no se llaman `medical-groups`

    La API expone sus rutas bajo `/medical-groups`. El proxy de `ng serve`, el
    de Docker y el nginx comparan por **inicio de ruta**: una pantalla llamada
    `medical-groups` a nivel raíz se iría entera a la API al recargar la
    página (ver `scripts/check-route-prefixes.mjs`). Colgar de `schedule/` evita
    la colisión y además dice lo que es: un evento de equipo con fecha y lugar.
    ========================================================================== */

/** El listado de grupos. Coincide con la sección del registro. */
export const MEDICAL_GROUPS_ROUTE = '/schedule/medical-groups';

/** El alta de un grupo. */
export const MEDICAL_GROUP_NEW_ROUTE = `${MEDICAL_GROUPS_ROUTE}/new`;

/** La ficha de un grupo. */
export function medicalGroupRoute(groupId: string): string {
  return `${MEDICAL_GROUPS_ROUTE}/${encodeURIComponent(groupId)}`;
}

/** La pestaña de la ficha a la que se abre (ver `MEDICAL_GROUP_TABS_ORDER`). */
export const MEDICAL_GROUP_TAB_QUERY_PARAM = 'pestana';
