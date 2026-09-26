/**
 * Rutas de la sección Farmacia del paciente (Ola 0, contrato congelado en
 * `04-farmacia-ecommerce-2026-09-25/README.md` §4.1).
 *
 * `PHARMACY_ROUTE` es la sección existente («Farmacia», `roles: ['PATIENT']`),
 * hoy servida por `pharmacy-hub` y reemplazada por la tienda de Justin (H3);
 * `cart`, `stores/:pharmacyId` y `prescriptions` son sus pantallas hijas.
 * `MIS_PEDIDOS_ROUTE` ya existe en `pharmacy-orders.routes.ts` y no se toca.
 */
export const PHARMACY_ROUTE = '/my-account/pharmacy';
export const PHARMACY_CART_ROUTE = `${PHARMACY_ROUTE}/cart`;
export const PHARMACY_PRESCRIPTIONS_ROUTE = `${PHARMACY_ROUTE}/prescriptions`;

/** `siteId` es opcional: sin él, la tienda se abre en la primera sede. */
export function pharmacyStoreRoute(pharmacyId: string, siteId?: string): string {
  return siteId
    ? `${PHARMACY_ROUTE}/stores/${pharmacyId}?site=${siteId}`
    : `${PHARMACY_ROUTE}/stores/${pharmacyId}`;
}
