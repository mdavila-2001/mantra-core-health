/**
 * El stock de una sede de farmacia, producto por producto (FAR-06).
 *
 * Una sede está en **modo catálogo** mientras no tiene ninguna posición de
 * stock: vale lo declarado en el catálogo de la farmacia para todas las sedes.
 * La primera escritura por sede la pasa a **modo libro**: desde ahí cada
 * producto vale lo que dice su posición en esa sede, y lo que se cambie en el
 * inventario de la farmacia («Todas») ya no la afecta.
 */

import type { PharmacyConcept } from './pharmacy.types';

/** Tope de la cantidad por sede: el mismo que valida la API. */
export const SITE_QUANTITY_MAX = 1_000_000;

/**
 * Cuerpo de `PUT /pharmacies/:pharmacyId/sites/:siteId/products/:productId/availability`.
 *
 * - `available: false` deja 0, traiga o no cantidad.
 * - `available: true` sin cantidad toma las existencias declaradas del
 *   producto, o 1 si no tiene conteo o está en 0.
 * - `available: true` con `quantity: 0` es un 400.
 */
export interface SiteAvailabilityDraft {
  readonly available: boolean;
  /** Entero de 0 a {@link SITE_QUANTITY_MAX}. */
  readonly quantity?: number;
}

/** Respuesta del `PUT`: la posición de la sede después de escribir. */
export interface SiteAvailability {
  readonly siteId: string;
  readonly productId: string;
  /** `quantity > 0`. */
  readonly available: boolean;
  /** Lo que se puede vender en la sede. */
  readonly quantity: number;
  /** ISO-8601. */
  readonly stockUpdatedAt: string;
}

/** El stock de un producto en la sede, sumado sobre sus ubicaciones. */
export interface SiteStockItem {
  readonly productId: string;
  readonly productCode: string;
  readonly brandName: string | null;
  readonly genericName: string | null;
  readonly strengthText: string | null;
  readonly packageSizeText: string | null;
  readonly medication: PharmacyConcept | null;
  /** Existencia física total en la sede. */
  readonly onHandQuantity: number;
  /** Reservado para pedidos en curso. */
  readonly reservedQuantity: number;
  /** Lo que se puede vender: descuenta reservas y cuarentena. */
  readonly availableQuantity: number;
  readonly locationCount: number;
}

/**
 * `GET /pharmacy-inventory/sites/:siteId/stock`. `items` vacío = la sede
 * todavía está en modo catálogo.
 */
export interface SiteStock {
  readonly siteId: string;
  readonly siteName: string;
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly items: readonly SiteStockItem[];
  readonly count: number;
}

/** Los motivos de un 422 del `PUT` (`details.reason`). */
export const SITE_AVAILABILITY_REJECTIONS = [
  'PRODUCT_OUT_OF_STOCK_DECLARED',
  'PRODUCT_NOT_PUBLISHED',
  'SITE_PRODUCT_KEPT_BY_LOTS',
] as const;

export type SiteAvailabilityRejection = (typeof SITE_AVAILABILITY_REJECTIONS)[number];
