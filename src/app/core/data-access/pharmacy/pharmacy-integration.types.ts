/**
 * Contratos de la integración con el sistema de la farmacia (FAR-07).
 *
 * Copian las respuestas de `/pharmacies/:pharmacyId/integration-connections`
 * de la API: dos altas que ya existían (la conexión y el vínculo de un
 * producto) y las lecturas y la sincronización que agregó FAR-07. Los nombres
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
  readonly createdAt: string;
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

/** Un producto tal como lo nombra el sistema de la farmacia. */
export interface ExternalProduct {
  readonly code: string;
  readonly name: string;
  readonly presentation: string | null;
  readonly unitCode: string | null;
  /** El producto del catálogo al que ya está vinculado, o `null`. */
  readonly mappedProductId: string | null;
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
}

/** `POST …/:connectionId/sync` (200). */
export interface SyncResult {
  readonly batchId: string;
  /** Ítems que mandó el sistema de la farmacia. */
  readonly received: number;
  /** Ítems con producto vinculado. */
  readonly mapped: number;
  readonly unmapped: readonly UnmappedExternalProduct[];
  /** Existencias que cambiaron de verdad; `0` si ya estaban al día. */
  readonly applied: number;
}

/** Los `reason` de la API que la pestaña sabe decir. */
export const INTEGRATION_ERROR_REASONS = [
  'PHARMACY_INTEGRATION_NOT_CONFIGURED',
  'PHARMACY_INTEGRATION_CONNECTION_INACTIVE',
  'PHARMACY_INTEGRATION_UNAVAILABLE',
] as const;

export type IntegrationErrorReason = (typeof INTEGRATION_ERROR_REASONS)[number];

/** Tope de lotes que acepta `GET …/sync-batches?limit=`. */
export const SYNC_BATCH_LIMIT_MAX = 20;
