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
  /*
   * Los cuatro de abajo son del catálogo que administra la farmacia y **sólo
   * los sirve el simulador** (P47 de PENDIENTES-BACKEND): la API real no los
   * manda, por eso son opcionales y cada pantalla tiene que tolerar que
   * falten.
   */
  /** Precio de venta vigente, como texto exacto. */
  readonly unitPrice?: string | null;
  /** `false` si la farmacia marcó que no lo tiene. */
  readonly inStock?: boolean;
  /** Categoría comercial de la vitrina. */
  readonly category?: string | null;
  /** Descripción para el paciente. */
  readonly description?: string | null;
  /*
   * Lo que sólo ve quien administra el catálogo (`managed=true`). Extensión
   * del simulador (P47), igual que lo de arriba.
   */
  /** Publicado, borrador o retirado. Sin él, es un producto publicado. */
  readonly status?: PharmacyProductStatus;
  /** Existencias declaradas. */
  readonly stock?: number;
  /** Debajo de este número el inventario avisa. */
  readonly minStock?: number;
  /** Hasta {@link MAX_PRODUCT_IMAGES} archivos de `common.files`. */
  readonly imageFileIds?: readonly string[];
}

/** El estado de un producto en el catálogo de la farmacia (P47). */
export type PharmacyProductStatus = 'PUBLISHED' | 'DRAFT' | 'WITHDRAWN';

/** Cuántas imágenes admite un producto (el mockup del cliente). */
export const MAX_PRODUCT_IMAGES = 3;

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
  /**
   * Con `true` lista **todo** el catálogo de la farmacia —borradores y
   * retirados incluidos— y agrega existencias y umbral. Sólo lo pide el portal
   * de la farmacia (P47).
   */
  readonly managed?: boolean;
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

/** Tipos de identificador que el alta de producto acepta. */
export type PharmacyProductIdentifierType = 'GTIN' | 'NDC';

/** Un identificador de producto: el código de barras (GTIN) o un NDC. */
export interface PharmacyProductIdentifier {
  readonly identifierType: PharmacyProductIdentifierType;
  readonly identifierValue: string;
}

/**
 * El alta de un producto, tal como la espera `POST
 * /pharmacies/:pharmacyId/products` (`PharmacyCreateProductDto`).
 *
 * Sólo lo que el catálogo de la farmacia carga. `medicationConceptId`,
 * `manufacturerTenantId` y `dosageFormConceptId` son conceptos del modelo que
 * la farmacia no elige desde un texto libre y quedan para cuando la pantalla
 * los pueda resolver contra terminología.
 *
 * Los opcionales **no viajan** cuando están vacíos: `IsOptional` deja pasar
 * un `''`, y el backend lo guardaría como un nombre vacío.
 */
export interface PharmacyProductDraft {
  /** Código único del producto dentro de la farmacia (el SKU). 1 a 100. */
  readonly productCode: string;
  readonly brandName?: string;
  readonly genericName?: string;
  readonly strengthText?: string;
  readonly packageSizeText?: string;
  readonly requiresPrescription?: boolean;
  readonly coldChainRequired?: boolean;
  readonly identifiers?: readonly PharmacyProductIdentifier[];
  /*
   * Extensión del simulador (P47): la API real rechaza estas claves con un
   * 400 (`forbidNonWhitelisted`) hasta que el DTO las declare.
   */
  /** Precio de venta, en bolivianos. */
  readonly unitPrice?: number;
  readonly category?: string;
  readonly description?: string;
  /** `false` = la farmacia lo carga pero hoy no lo tiene. */
  readonly inStock?: boolean;
  /** Sin él, nace publicado. */
  readonly status?: PharmacyProductStatus;
  readonly stock?: number;
  readonly minStock?: number;
  readonly imageFileIds?: readonly string[];
}

/**
 * Los cambios a un producto ya publicado (`PATCH`, P47). El código no se
 * edita: es la identidad del producto dentro de la farmacia. `null` borra el
 * dato; una clave ausente lo deja como está.
 */
export interface PharmacyProductChanges {
  readonly brandName?: string | null;
  readonly genericName?: string | null;
  readonly strengthText?: string | null;
  readonly packageSizeText?: string | null;
  readonly requiresPrescription?: boolean | null;
  readonly unitPrice?: number | null;
  readonly category?: string | null;
  readonly description?: string | null;
  readonly inStock?: boolean;
  readonly status?: PharmacyProductStatus;
  readonly stock?: number;
  readonly minStock?: number;
  readonly imageFileIds?: readonly string[];
}

/** Una categoría de la farmacia, con cuántos productos la usan (P47). */
export interface PharmacyCategory {
  readonly id: string;
  readonly name: string;
  readonly productCount: number;
}

/** La lista de categorías de una farmacia. */
export interface PharmacyCategoryPage {
  readonly items: readonly PharmacyCategory[];
}

/**
 * Una línea del inventario que se guarda junta con las demás (P47).
 *
 * Dos formas de llevar el inventario, y una línea usa **una** de las dos:
 * - **Con cantidades**: `stock` y/o `minStock`. Hay stock si `stock > 0`.
 * - **Hay / no hay**: sólo `inStock`, un booleano, sin conteo. Es lo que hace la
 *   farmacia que no lleva cantidades y sólo avisa lo que le falta.
 *
 * Mandar `inStock` junto con `stock` es un error: dirían dos cosas a la vez.
 */
export interface PharmacyInventoryLine {
  readonly productId: string;
  readonly stock?: number;
  readonly minStock?: number;
  readonly inStock?: boolean;
}

/** Un hecho reciente del catálogo, para «actividad reciente» del resumen. */
export interface PharmacyActivityEntry {
  readonly id: string;
  readonly at: string;
  readonly kind: 'ALTA' | 'EDICION' | 'RETIRO' | 'IMPORTACION' | 'INVENTARIO' | 'CATEGORIA';
  readonly text: string;
}

/** Lo que el resumen de la farmacia dibuja (P47). */
export interface PharmacySummary {
  readonly published: number;
  readonly drafts: number;
  readonly withdrawn: number;
  readonly outOfStock: number;
  readonly lowStock: number;
  /** Valor del inventario: existencias × precio, en bolivianos con dos decimales. */
  readonly inventoryValue: string;
  readonly byCategory: readonly { readonly category: string; readonly count: number }[];
  readonly recentActivity: readonly PharmacyActivityEntry[];
}

/** Lo que devuelve el alta de un producto (`ProductResponseDto`). */
export interface PharmacyProductCreated {
  readonly id: string;
  readonly pharmacyId: string;
  readonly productCode: string;
  /** Concepto de estado, como UUID crudo: el alta no lo resuelve. */
  readonly status: string;
  readonly identifierCount: number;
  readonly createdAt: string;
}

/** Lo que devuelve el retiro de un producto (`StatusResultDto`). */
export interface PharmacyStatusResult {
  /** `true` si la operación se aplicó. */
  readonly ok: boolean;
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

/**
 * Una sede dispensadora del perfil de una farmacia, tal como la lista `GET
 * /pharmacy/pharmacies/:id`.
 *
 * Sin `distanceKm`: acá no hay origen contra el que medir — a diferencia de
 * {@link PharmacySite}, que sí lo lleva porque nace de una lista suelta con
 * posible origen. Espeja `PharmacySiteReadDto` del backend campo por campo.
 */
export interface PharmacySiteRead {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly addressText: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

/**
 * El perfil de una farmacia, tal como lo trae `GET /pharmacy/pharmacies/:id`
 * (carril A, Ola 0). Extiende el ítem del directorio con lo que sólo aparece
 * al entrar a UNA farmacia: razón social, tipo resuelto, y sus sedes.
 */
export interface PharmacyDetail extends PharmacyDirectoryItem {
  readonly legalName: string;
  readonly type: PharmacyConcept | null;
  readonly homeDeliveryAvailable: boolean | null;
  readonly pickupAvailable: boolean | null;
  readonly sites: readonly PharmacySiteRead[];
  /**
   * La ficha legal, leída de la organización dueña de la farmacia: el NIT de
   * su alta institucional, su forma societaria (`SRL`, `SA`, `UNIPERSONAL`…,
   * que **no** es el `type` de farmacia), y su casa matriz. `null` cuando la
   * organización no lo registró, o cuando no es una organización de tipo
   * farmacia —sus datos serían de otra entidad—.
   */
  readonly taxId: string | null;
  readonly companyType: PharmacyConcept | null;
  readonly legalAddressText: string | null;
  readonly headquarters: { readonly latitude: number; readonly longitude: number } | null;
}

/**
 * Una licencia de la farmacia, tal como la lista `GET
 * /pharmacy/pharmacies/:id/licenses` (sólo para el personal de la farmacia).
 * Espeja `PharmacyLicenseDto` del backend campo por campo.
 */
export interface PharmacyLicense {
  readonly id: string;
  readonly type: PharmacyConcept | null;
  readonly number: string;
  /** La sede, si la licencia es de una sola; `null` si es de la farmacia. */
  readonly siteId: string | null;
  readonly siteName: string | null;
  readonly jurisdiction: PharmacyConcept | null;
  /** Fechas sin hora (`AAAA-MM-DD`). */
  readonly validFrom: string | null;
  readonly validTo: string | null;
  /** Días hasta el vencimiento, contados por el servidor; negativo si venció. */
  readonly daysToExpiry: number | null;
  readonly verificationStatus: PharmacyConcept | null;
  readonly evidenceFileId: string | null;
}

export interface PharmacyLicensePage {
  readonly items: readonly PharmacyLicense[];
  readonly count: number;
}

/** Una persona que representa o gestiona la organización de la farmacia. */
export interface PharmacyContactPerson {
  /** `LEGAL_REPRESENTATIVE`, `GENERAL_MANAGER`, `COMMERCIAL_MANAGER` o `MARKETING_MANAGER`. */
  readonly role: string;
  readonly fullName: string;
  readonly email: string | null;
  readonly phone: string | null;
}

/**
 * Quién responde por la farmacia, tal como lo trae `GET
 * /pharmacy/pharmacies/:id/contacts` (sólo para su personal).
 */
export interface PharmacyContacts {
  readonly legalRepresentative: PharmacyContactPerson | null;
  readonly executives: readonly PharmacyContactPerson[];
}

/**
 * Un precio publicado de una sede, tal como lo trae `GET
 * /pharmacy/sites/:siteId/prices` (carril A, Ola 0).
 *
 * A diferencia de {@link AvailabilityPrice} (que sólo lleva el precio, sin el
 * producto — vive anidado en `AvailabilityProduct`), acá el precio y el
 * producto viajan en el mismo objeto: es la lectura del catálogo de una sede,
 * no una evaluación de disponibilidad contra productos concretos.
 */
export interface PharmacySitePriceItem {
  readonly productId: string;
  readonly productCode: string;
  readonly brandName: string | null;
  readonly genericName: string | null;
  readonly strengthText: string | null;
  readonly packageSizeText: string | null;
  /** El medicamento del vademécum al que responde, resuelto. */
  readonly medication: PharmacyConcept | null;
  readonly requiresPrescription: boolean | null;
  /** Precio unitario, como texto exacto. */
  readonly unitAmount: string;
  /** Lo que paga el paciente, si difiere del unitario. */
  readonly patientAmount: string | null;
  readonly currency: PharmacyConcept | null;
  readonly priceListCode: string;
}

/** Los precios públicos vigentes de una sede, tal como los sirve la API. */
export interface PharmacySitePrices {
  readonly siteId: string;
  readonly siteName: string;
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly items: readonly PharmacySitePriceItem[];
  readonly count: number;
}
