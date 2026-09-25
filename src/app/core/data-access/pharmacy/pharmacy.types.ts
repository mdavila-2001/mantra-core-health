/**
 * Tipos del directorio de farmacias y su disponibilidad (carril E3, sobre el
 * contrato E2 del backend: `/pharmacy` y `/pharmacy-inventory`).
 *
 * Espejan los DTOs de lectura del backend tal cual viajan: los conceptos
 * llegan **resueltos** a `{ code, display }` —a diferencia del resumen
 * clínico, acá no hay nada que traducir con terminología— y los montos son
 * texto exacto (el `numeric` de la base no cabe sin pérdida en un `number`).
 */

/** Un concepto ya resuelto a su forma legible. */
export interface PharmacyConcept {
  readonly code: string;
  readonly display: string;
}

/** Un punto WGS84 desde donde medir distancias. */
export interface GeoPoint {
  readonly lat: number;
  readonly lng: number;
}

/**
 * Una farmacia del directorio publicado, tal como la lista `GET
 * /pharmacy/pharmacies`.
 *
 * Sólo los campos que alguna pantalla consume: el resto del DTO (`legalName`,
 * `type`, `homeDeliveryAvailable`, `pickupAvailable`) se agrega cuando alguien
 * lo pida, que es la regla que este cliente ya venía siguiendo.
 */
export interface PharmacyDirectoryItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly siteCount: number;
  readonly productCount: number;
}

/** El directorio de farmacias publicadas del tenant activo. */
export interface PharmacyDirectoryPage {
  readonly items: readonly PharmacyDirectoryItem[];
  readonly count: number;
}

/** Un producto publicado del directorio, tal como lo lista la búsqueda. */
export interface PharmacyProduct {
  readonly id: string;
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly productCode: string;
  readonly brandName: string | null;
  readonly genericName: string | null;
  readonly strengthText: string | null;
  readonly packageSizeText: string | null;
  readonly dosageForm: PharmacyConcept | null;
  /** El medicamento del vademécum al que responde, resuelto. */
  readonly medication: PharmacyConcept | null;
  readonly requiresPrescription: boolean | null;
}

/** La página de la búsqueda de productos. */
export interface PharmacyProductSearchPage {
  readonly items: readonly PharmacyProduct[];
  readonly limit: number;
  /** `true` si quedaron productos afuera del tope. */
  readonly truncated: boolean;
}

/** Los filtros de la búsqueda de productos. Sin ninguno, lista lo publicado. */
export interface PharmacyProductSearchQuery {
  /** Texto a buscar en marca, genérico o código de producto. */
  readonly search?: string;
  /** Medicamento del vademécum (`medication_concept_id`). */
  readonly conceptId?: string;
  /**
   * Sólo lo publicado por esta farmacia. Lo agrega «Farmacia» (pestaña
   * Comprar, 25/09/2026) para mostrar el catálogo de una sede elegida — sin
   * este filtro la búsqueda mezcla las de todas.
   */
  readonly pharmacyId?: string;
  readonly limit?: number;
}

/**
 * Una sede publicada, con su ubicación — a diferencia de
 * {@link AvailabilitySite}, que sólo existe evaluada contra productos
 * concretos, ésta se lista suelta: es lo que «elegir farmacia» necesita
 * antes de que la persona haya buscado nada.
 */
export interface PharmacySite {
  readonly siteId: string;
  readonly siteName: string;
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly addressText: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  /** Distancia Haversine en km al origen consultado; `null` sin origen. */
  readonly distanceKm: number | null;
  readonly homeDeliveryAvailable: boolean | null;
  readonly pickupAvailable: boolean | null;
  readonly productCount: number;
}

/** La página de la lista de sedes. */
export interface PharmacySitePage {
  readonly items: readonly PharmacySite[];
  readonly count: number;
}

/** Los filtros de la lista de sedes. Sin ninguno, lista todas por nombre. */
export interface PharmacySiteQuery {
  /** Texto a buscar en el nombre de la farmacia o la sede. */
  readonly search?: string;
  /** Con origen, la lista sale ordenada por cercanía. */
  readonly origin?: GeoPoint;
  readonly limit?: number;
}

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
  readonly availableQuantity: number;
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
