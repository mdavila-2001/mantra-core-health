/**
 * Contratos de la integración con el sistema de la farmacia (FAR-07).
 *
 * Copian las respuestas de `/pharmacies/:pharmacyId/integration-connections`
 * de la API: dos altas que ya existían (la conexión y el vínculo de un
 * producto), las lecturas y la sincronización que agregó FAR-07, y corregir y
 * deshacer un vínculo con el detalle por sede de FAR-C8. Los nombres
 * de campo son los de la API, sin traducir.
 */

/** Cómo se habla con el sistema de la farmacia. La pestaña sólo da de alta `BATCH`. */
export type IntegrationMode = 'REALTIME' | 'BATCH';

/** Estado de una conexión: sólo una activa sincroniza. */
export type IntegrationConnectionStatus = 'ACTIVE' | 'INACTIVE';

/** Una conexión de la farmacia con su sistema. */
export interface IntegrationConnection {
  readonly id: string;
  /** La sucursal a la que aplica; `null` = todas las sucursales activas. */
  readonly pharmacySiteId: string | null;
  readonly siteName: string | null;
  readonly integrationMode: IntegrationMode;
  readonly supportsStockQuery: boolean;
  readonly status: IntegrationConnectionStatus;
  /** Si la API sabe dónde está el sistema de la farmacia. */
  readonly providerConfigured: boolean;
  readonly createdAt: string;
}

/** `GET /pharmacies/:pharmacyId/integration-connections`. */
export interface IntegrationConnectionList {
  readonly providerConfigured: boolean;
  readonly items: readonly IntegrationConnection[];
}

/** El alta de una conexión, tal como la acepta la API. */
export interface IntegrationConnectionDraft {
  readonly integrationMode: IntegrationMode;
  readonly supportsStockQuery: boolean;
  /** Sin sucursal, la conexión vale para todas las activas. */
  readonly pharmacySiteId?: string;
}

/** Lo que devuelve el alta de una conexión (201). */
export interface IntegrationConnectionCreated {
  readonly id: string;
  readonly status?: string;
  readonly createdAt?: string;
}

/** Un producto del catálogo vinculado a un código del sistema de la farmacia. */
export interface ProductMapping {
  readonly id: string;
  readonly externalProductCode: string;
  readonly pharmacyProductId: string;
  readonly productCode: string;
  readonly productName: string;
  /**
   * La unidad del sistema de la farmacia que equivale a una del producto, o
   * `null` si el vínculo no la declara (entonces la sincronización no la mira).
   * Opcional: una API anterior a FAR-C8 no la manda.
   */
  readonly externalUnitCode?: string | null;
  readonly createdAt: string;
}

/**
 * La corrección de un vínculo (`PATCH …/product-mappings/:mappingId`): lo que
 * no viaja no cambia, y al menos un campo. `externalUnitCode: null` borra la
 * unidad. El vínculo vuelve a quedar sin verificar.
 */
export interface ProductMappingUpdate {
  readonly pharmacyProductId?: string;
  readonly externalProductCode?: string;
  readonly externalUnitCode?: string | null;
}

/** Un vínculo tal como lo devuelve la API al corregirlo o deshacerlo (200). */
export interface ProductMappingChanged {
  readonly id: string;
  readonly pharmacyProductId: string;
  readonly externalProductCode: string;
  readonly externalUnitCode?: string | null;
}

/** `GET …/:connectionId/product-mappings`. */
export interface ProductMappingList {
  readonly items: readonly ProductMapping[];
}

/** El alta de un vínculo, tal como la acepta la API. */
export interface ProductMappingDraft {
  readonly pharmacyProductId: string;
  readonly externalProductCode: string;
  readonly externalUnitCode?: string;
  readonly mappingVersion?: string;
}

/** Lo que devuelve el alta de un vínculo (201). */
export interface ProductMappingCreated {
  readonly id: string;
  readonly pharmacyProductId: string;
  readonly externalProductCode: string;
}

/**
 * Cómo está vinculado un código del sistema de la farmacia: a un solo producto,
 * a ninguno o a más de uno (`AMBIGUOUS`: la sincronización no lo aplica).
 */
export type ExternalMappingStatus = 'MAPPED' | 'UNMAPPED' | 'AMBIGUOUS';

/** Un producto tal como lo nombra el sistema de la farmacia. */
export interface ExternalProduct {
  readonly code: string;
  readonly name: string;
  readonly presentation: string | null;
  readonly unitCode: string | null;
  /** El producto del catálogo al que ya está vinculado, o `null`. */
  readonly mappedProductId: string | null;
  /** Opcional: una API anterior a FAR-C8 sólo manda `mappedProductId`. */
  readonly mappingStatus?: ExternalMappingStatus;
  /** Todos los productos que nombran este código; más de uno con `AMBIGUOUS`. */
  readonly mappedProductIds?: readonly string[];
}

/** `GET …/:connectionId/external-products`. */
export interface ExternalProductList {
  readonly items: readonly ExternalProduct[];
}

/** Estado de un lote de sincronización. */
export type SyncBatchStatus = 'RECEIVED' | 'COMPLETED';

/** Un lote de sincronización ya registrado. */
export interface SyncBatch {
  readonly id: string;
  readonly status: SyncBatchStatus;
  readonly receivedAt: string;
  readonly completedAt: string | null;
  readonly itemCount: number;
  /** Ítems que no se pudieron aplicar (sin vínculo, sobre todo). */
  readonly discrepancies: number;
}

/** `GET …/:connectionId/sync-batches`. */
export interface SyncBatchList {
  readonly items: readonly SyncBatch[];
}

/** Un código del sistema de la farmacia que no tiene producto vinculado. */
export interface UnmappedExternalProduct {
  readonly externalCode: string;
  readonly name: string;
  /**
   * `NO_MAPPING`: ningún vínculo lo nombra (se vincula). `AMBIGUOUS_MAPPING`:
   * lo nombran vínculos a más de un producto (se deshacen los que sobran).
   */
  readonly reason?: UnmappedReason;
  /** Los productos que se disputan el código; vacío con `NO_MAPPING`. */
  readonly productIds?: readonly string[];
}

export type UnmappedReason = 'NO_MAPPING' | 'AMBIGUOUS_MAPPING';

/** Las cuentas de una sede en una sincronización: `received = mapped + unmapped`. */
export interface SyncSiteSummary {
  readonly siteId: string;
  readonly siteCode: string;
  readonly siteName: string;
  readonly received: number;
  /** `applied + unchanged + skipped`. */
  readonly mapped: number;
  readonly unmapped: number;
  readonly applied: number;
  /** Líneas que llegaron con el mismo stock que ya había. */
  readonly unchanged: number;
  /** Líneas con vínculo que no se aplicaron (detalle en `skipped`). */
  readonly skipped: number;
}

/** Por qué una línea con vínculo no se aplicó al stock de la sede. */
export const SYNC_SKIP_REASONS = [
  'PRODUCT_NOT_AVAILABLE',
  'PRODUCT_NOT_PUBLISHED',
  'PRODUCT_OUT_OF_STOCK_DECLARED',
  'SITE_PRODUCT_KEPT_BY_LOTS',
  'SITE_MARKED_NOT_AVAILABLE',
  'UNIT_MISMATCH',
  'UNIT_NOT_REPORTED',
] as const;

export type SyncSkipReason = (typeof SYNC_SKIP_REASONS)[number];

/** Una línea con vínculo que no se aplicó: la sede conserva lo que tenía. */
export interface SyncSkippedLine {
  readonly siteId: string;
  readonly siteCode: string;
  readonly externalCode: string;
  readonly productId: string;
  readonly quantity: number;
  readonly reason: SyncSkipReason;
  /** Sólo con los motivos de unidad. */
  readonly mappingUnitCode?: string | null;
  readonly externalUnitCode?: string | null;
}

/** Un código vinculado que el sistema de la farmacia no mandó para una sede. */
export interface SyncNotSentLine {
  readonly siteId: string;
  readonly siteCode: string;
  readonly externalCode: string;
  readonly productId: string;
}

/**
 * `POST …/:connectionId/sync` (200).
 *
 * Las cuentas son **líneas**: un código en una sede. Con dos sedes, un producto
 * cuenta dos veces, y `received = mapped + unmappedLines`. Los campos por sede
 * son de FAR-C8 y opcionales: una API anterior no los manda.
 */
export interface SyncResult {
  readonly batchId: string;
  /** Líneas que mandó el sistema de la farmacia. */
  readonly received: number;
  /** Líneas con un producto vinculado. */
  readonly mapped: number;
  /** Líneas sin un vínculo único: `received - mapped`. */
  readonly unmappedLines?: number;
  /** Los códigos sin vínculo único, una vez cada uno. */
  readonly unmapped: readonly UnmappedExternalProduct[];
  /** Líneas que cambiaron el stock; `0` si ya estaban al día. */
  readonly applied: number;
  readonly sites?: readonly SyncSiteSummary[];
  readonly skipped?: readonly SyncSkippedLine[];
  readonly notSent?: readonly SyncNotSentLine[];
}

/** Los `reason` de la API que la pestaña sabe decir. */
export const INTEGRATION_ERROR_REASONS = [
  'PHARMACY_INTEGRATION_NOT_CONFIGURED',
  'PHARMACY_INTEGRATION_CONNECTION_INACTIVE',
  'PHARMACY_INTEGRATION_UNAVAILABLE',
  'EXTERNAL_MAPPING_NOT_AVAILABLE',
  'EXTERNAL_MAPPING_PRODUCT_TAKEN',
  'EXTERNAL_MAPPING_EMPTY_UPDATE',
] as const;

export type IntegrationErrorReason = (typeof INTEGRATION_ERROR_REASONS)[number];

/** Tope de lotes que acepta `GET …/sync-batches?limit=`. */
export const SYNC_BATCH_LIMIT_MAX = 20;
