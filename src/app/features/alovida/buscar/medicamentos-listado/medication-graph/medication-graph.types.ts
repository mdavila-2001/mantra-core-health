/* ============================================================================
    Tipos del Grafo de Medicamentos (compuesto → para qué se usa → marcas → farmacias).
    ========================================================================== */

export type MedicationNodeType = 'compound' | 'use' | 'brand' | 'pharmacy';

/**
 * Ficha detallada del nodo seleccionado en el grafo, explicada en lenguaje
 * claro y visual para el paciente.
 */
export interface SelectedMedicationNodeDetail {
  readonly type: MedicationNodeType;
  readonly title: string;
  readonly subtitle?: string;
  readonly genericName: string;
  readonly atcCode?: string;
  readonly therapeuticGroup?: string;
  readonly brandName?: string;
  readonly pharmacyName?: string;
  readonly pharmacySlug?: string;
  readonly city?: string | null;
  readonly address?: string | null;
  readonly price?: string | null;
  readonly currency?: string | null;
  readonly inStock?: boolean | null;
  readonly requiresPrescription?: boolean | null;
  readonly brands?: readonly string[];
  readonly pharmacyCount?: number;
  /** Explicación didáctica y comprensible para el paciente. */
  readonly explanation: string;
}

export type MedicationGraphMode = 'graph' | 'list';
