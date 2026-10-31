/**
 * La disponibilidad cruzada de farmacia (`GET /pharmacy-inventory/availability`,
 * carril E2): qué sedes pueden surtir un conjunto de productos, con su
 * cobertura, su costo y la antigüedad de sus existencias. Se reexporta desde
 * `pharmacy.types.ts`, así que sus consumidores no cambian de import.
 */

import type { GeoPoint, PharmacyConcept } from './pharmacy.types';

/** El precio vigente con que una sede ofrece un producto disponible. */
export interface AvailabilityPrice {
  /** Precio unitario, como texto exacto. */
  readonly unitAmount: string;
  /** Lo que paga el paciente, si la lista lo distingue. */
  readonly patientAmount: string | null;
  readonly currency: PharmacyConcept | null;
  readonly priceListCode: string;
}

/** Un producto solicitado, tal como una sede lo puede servir. */
export interface AvailabilityProduct {
  readonly productId: string;
  readonly productCode: string;
  readonly brandName: string | null;
  readonly genericName: string | null;
  readonly strengthText: string | null;
  readonly packageSizeText: string | null;
  readonly medication: PharmacyConcept | null;
  /**
   * Unidades disponibles en la sede; `null` si la sede no lleva inventario por
   * lotes y la farmacia declaró «hay» sin conteo (regla única de existencias
   * por sede de la API, A1).
   */
  readonly availableQuantity: number | null;
  readonly price: AvailabilityPrice | null;
}

/** Una sede candidata para surtir el pedido, con su cobertura y su costo. */
export interface AvailabilitySite {
  readonly siteId: string;
  readonly siteName: string;
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly addressText: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  /**
   * Distancia Haversine en km al punto consultado, con un decimal. `null` si
   * la consulta no llevó coordenadas o la sede no tiene las suyas.
   */
  readonly distanceKm: number | null;
  readonly homeDeliveryAvailable: boolean | null;
  readonly pickupAvailable: boolean | null;
  /** `true` si la sede tiene disponible TODO lo solicitado. */
  readonly complete: boolean;
  readonly availableCount: number;
  /** Los solicitados que esta sede NO tiene disponibles. */
  readonly missingProductIds: readonly string[];
  /**
   * Suma de lo que paga el paciente por lo disponible. `null` si a algún
   * producto le falta precio publicado o si las listas mezclan monedas.
   */
  readonly totalAmount: string | null;
  readonly currency: PharmacyConcept | null;
  /**
   * Cuándo se actualizó la existencia más vieja que respalda lo disponible en
   * esta sede, ISO 8601. Opcional: una API anterior no la envía, y ausente o
   * `null` se lee como «sin fecha», nunca como «al día».
   */
  readonly stockUpdatedAt?: string | null;
  readonly products: readonly AvailabilityProduct[];
}

/**
 * La respuesta de disponibilidad: sedes candidatas ya ordenadas por el
 * backend — completas primero; después distancia, total y nombre.
 */
export interface AvailabilityResult {
  readonly requestedProductIds: readonly string[];
  readonly items: readonly AvailabilitySite[];
  readonly count: number;
}

/** La consulta de disponibilidad: qué productos, y desde dónde medir. */
export interface AvailabilityQuery {
  readonly productIds: readonly string[];
  /** `lat` y `lng` van juntos o no van: sin origen no hay distancias. */
  readonly origin?: GeoPoint;
  readonly limit?: number;
}

/**
 * El producto con que una sede surte un medicamento de la receta
 * (`GET /pharmacy-inventory/availability/medications`): es el que un pedido a
 * esa sede tiene que llevar, porque un producto de otra farmacia no se puede
 * pedir ahí.
 */
export interface MedicationAvailabilityProduct extends AvailabilityProduct {
  readonly medicationConceptId: string;
}

/**
 * Una sede de cualquier farmacia de la red, evaluada por medicamento: un
 * producto por medicamento que tiene, y los medicamentos que le faltan.
 * `complete` y `availableCount` hablan de medicamentos, no de productos.
 */
export interface MedicationAvailabilitySite extends Omit<
  AvailabilitySite,
  'missingProductIds' | 'products'
> {
  readonly missingMedicationConceptIds: readonly string[];
  readonly products: readonly MedicationAvailabilityProduct[];
}

/** La disponibilidad por medicamento: sedes de toda la red, ya ordenadas. */
export interface MedicationAvailabilityResult {
  readonly requestedMedicationConceptIds: readonly string[];
  /** Los pedidos para los que ninguna farmacia publica un producto vendible. */
  readonly unpublishedMedicationConceptIds: readonly string[];
  readonly items: readonly MedicationAvailabilitySite[];
  readonly count: number;
}

/** La consulta por medicamento: una sola por receta, no una por producto. */
export interface MedicationAvailabilityQuery {
  readonly medicationConceptIds: readonly string[];
  /** `lat` y `lng` van juntos o no van: sin origen no hay distancias. */
  readonly origin?: GeoPoint;
  readonly limit?: number;
}
