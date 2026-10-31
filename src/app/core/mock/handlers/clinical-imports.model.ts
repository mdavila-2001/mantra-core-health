/* ============================================================================
    ESPEJO DE LA API (subconjunto de `clinical_import/clinical-import.types.ts`).

    Sólo los tipos que usan las copias de esquema, lector, validador y
    plantillas. Los tipos del CONTRATO HTTP viven en
    `data-access/admin-portal/clinical-imports.types.ts`. Si cambia en la API,
    se vuelve a copiar.
    ========================================================================== */

export type ImportFormat = 'csv' | 'json';

/** Un hallazgo del archivo o de una columna. Nunca repite el valor recibido. */
export interface FieldIssue {
  /** Columna afectada; `*` si es del archivo o de la fila entera. */
  readonly field: string;
  /** Motivo estable (`REQUIRED`, `INVALID_FORMAT`, `PATIENT_NOT_FOUND`…). */
  readonly code: string;
  readonly message: string;
}

export interface RowIssue extends FieldIssue {
  /** Fila de datos, desde 1. */
  readonly row: number;
}

/** Lo que el lote declara sobre sí mismo; sin las tres, no se confirma. */
export interface ImportDeclaration {
  readonly sourceOrganization: string;
  readonly legalBasis: string;
  /** `AAAA-MM-DD`, de hoy o anterior. */
  readonly loadedAt: string;
}

/** Una fila ya leída del archivo: valores como texto, tal cual vinieron. */
export interface ParsedRow {
  /** Fila de datos, desde 1. */
  readonly row: number;
  readonly values: Readonly<Record<string, string>>;
  /** Columnas cuyo valor no era un escalar (JSON anidado). */
  readonly malformed: readonly string[];
}
