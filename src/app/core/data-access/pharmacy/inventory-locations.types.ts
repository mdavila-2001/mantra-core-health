/* ============================================================================
    Botiquín por unidad — franja F5c (`CONTRATO-F2-F5.md` §F5c): las ubicaciones
    de inventario ligadas a un espacio de F1 y sus existencias.
    ========================================================================== */

export interface StockConcept {
  readonly code: string;
  readonly display: string;
}

/** Una existencia de la ubicación, en lectura. */
export interface StockLine {
  readonly productName: string;
  readonly lotNumber: string | null;
  readonly expiryDate: string | null;
  readonly onHandQuantity: string;
  readonly availableQuantity: string;
  readonly unit: string;
}

/** Una ubicación de inventario con su espacio. */
export interface InventoryLocation {
  readonly id: string;
  readonly pharmacySiteId: string;
  readonly code: string;
  readonly name: string;
  readonly locationType: StockConcept;
  readonly careSpace: { readonly id: string; readonly code: string; readonly name: string } | null;
  readonly clinicalUnit: { readonly id: string; readonly name: string } | null;
  readonly status: StockConcept;
  readonly lines: readonly StockLine[];
}

/** Lo que la ficha de un espacio muestra en «Stock». */
export interface SpaceStock {
  /** Las farmacias de la sede del espacio: dónde se puede dar de alta un botiquín. */
  readonly pharmacySites: readonly { readonly id: string; readonly name: string }[];
  readonly locations: readonly InventoryLocation[];
}

/** `POST /pharmacy/:siteId/inventory-locations` con las claves de F5c. */
export interface CreateInventoryLocationRequest {
  readonly code: string;
  readonly name: string;
  readonly locationTypeCode: 'WARD_STOCK' | 'SHELF';
  readonly careSpaceId?: string;
  readonly clinicalUnitId?: string;
}

/** Claves que el DTO publicado todavía no declara (se mandan a la API real). */
export const INVENTORY_LOCATION_CONTRACT_PENDING_KEYS = ['careSpaceId', 'clinicalUnitId', 'locationTypeCode'] as const;

/** Lo que devuelve el alta (`POST /pharmacy/:siteId/inventory-locations`): sólo el id. La pestaña relee. */
export interface CreatedInventoryLocation {
  readonly id: string;
}

/** Lo que devuelve `relocate`: el id y los dos espacios. La pestaña relee. */
export interface RelocatedInventoryLocation {
  readonly id: string;
  readonly careSpaceId: string;
  readonly previousCareSpaceId: string | null;
}
