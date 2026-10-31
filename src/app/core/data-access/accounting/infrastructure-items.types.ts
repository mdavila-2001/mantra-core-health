/* ============================================================================
    Contabilidad por espacio — franja F5f (`CONTRATO-F2-F5.md` §F5f): los
    activos de infraestructura ubicados en un espacio de F1 y los centros de
    costo ligados a una unidad clínica.
    ========================================================================== */

/** Un activo de infraestructura (`accounting.infrastructure_items`). */
export interface InfrastructureItem {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly category: string;
  /** El espacio, con la ruta del árbol; `null` si todavía no se ubicó. */
  readonly careSpace: { readonly id: string; readonly code: string; readonly name: string; readonly path: string } | null;
  /** Lo que había antes de F5f, en texto libre: sólo lectura heredada. */
  readonly locationText: string | null;
  readonly bookValue: string;
  readonly currencyCode: string;
}

/** Un centro de costo con su unidad (`accounting.cost_centers`). */
export interface CostCenter {
  readonly id: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly clinicalUnit: { readonly id: string; readonly name: string } | null;
  readonly status: { readonly code: string; readonly display: string };
}
