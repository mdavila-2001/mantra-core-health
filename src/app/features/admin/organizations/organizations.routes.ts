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
export const ORGANIZATIONS_ROUTE = '/administration/organizations';

/** Alta de una organización raíz con su tipo (V04-01·F). */
export const ORGANIZATION_NEW_ROUTE = `${ORGANIZATIONS_ROUTE}/new`;

/**
 * Ficha de una organización (V04-06·L · V04-02·L · V04-07·L). Se arma con el
 * id porque las tres pestañas cuelgan de `/tenants/{id}`.
 */
export const organizationDetailRoute = (tenantId: string): string =>
  `${ORGANIZATIONS_ROUTE}/${tenantId}`;

/**
 * Verificación de la organización (V04-01·A, UC-04-02).
 *
 * Cuelga de la ficha y no del listado: verificar es mirar la documentación de
 * una organización concreta, no elegir entre varias.
 */
export const organizationVerifyRoute = (tenantId: string): string =>
  `${ORGANIZATIONS_ROUTE}/${tenantId}/verify`;

/** Alta de una sucursal dentro de la organización (V04-06·F, UC-04-04). */
export const branchNewRoute = (tenantId: string): string =>
  `${ORGANIZATIONS_ROUTE}/${tenantId}/branches/new`;

/** Incorporación de alguien a la organización (V04-02·F, UC-04-05). */
export const membershipNewRoute = (tenantId: string): string =>
  `${ORGANIZATIONS_ROUTE}/${tenantId}/memberships/new`;

/** Alta de una sub-organización (V04-07·F, UC-04-03). */
export const childOrganizationNewRoute = (tenantId: string): string =>
  `${ORGANIZATIONS_ROUTE}/${tenantId}/child-organizations/new`;
