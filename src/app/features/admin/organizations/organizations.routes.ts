/* ============================================================================
    Las rutas de la sección de organizaciones, en un solo lugar.

    Mismo criterio que `patients.routes.ts`: las pantallas se enlazan entre sí
    —el listado ofrece el alta y el alta vuelve al listado— y una ruta escrita
    a mano en un `routerLink` es el enlace que sobrevive a un renombre y deja
    de funcionar.

    La sección padre la declara `core/navigation/navigation.map.ts`; estas son
    sus pantallas hijas, que no son entradas de menú.
    ========================================================================== */

/** Listado de organizaciones (V04-01·L). Coincide con la sección del menú. */
export const ORGANIZATIONS_ROUTE = '/administracion/organizaciones';

/** Alta de una organización raíz con su tipo (V04-01·F). */
export const ORGANIZATION_NEW_ROUTE = `${ORGANIZATIONS_ROUTE}/nueva`;
