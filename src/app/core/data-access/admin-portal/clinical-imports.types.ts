/* ============================================================================
    Carga masiva especial de historias clínicas (`/admin/clinical-imports`,
    módulo `clinical_import` de la API, H7).

    Espejo de lo que sirve la API. Reglas del servidor que la pantalla no puede
    torcer:
    - La vista previa, el informe y la lista de lo cargado **nunca traen el valor
      de una celda**: dicen fila, columna y motivo (y, de lo cargado, qué entidad
      y qué identificador). Eso es lo que permite mostrarlos sin exponer a nadie.
    - El lote lleva una declaración obligatoria —organización de origen, base
      legal y fecha—; sin ella no se crea ni se confirma.
    - Sólo se agrega: un registro idéntico se omite y uno distinto se informa como
      conflicto; nunca se sobrescribe.
    - Lo que el motor no hace en esta instalación lo declara `engine`: «creadas» es
      lo que dice el informe, no lo que se confirmó.

    Reutiliza los tipos de la carga de usuarios (`bulk-imports.types.ts`) donde el
    contrato es idéntico, para que las dos pantallas compartan rótulos.
    ========================================================================== */

import type {
  BulkImportDownload,
  BulkImportFieldIssue,
  BulkImportFormat,
  BulkImportLimits,
  BulkImportReportRow,
  BulkImportRowIssue,
  BulkImportRowOutcome,
  BulkImportStatus,
} from './bulk-imports.types';

export type ClinicalImportFormat = BulkImportFormat;
export type ClinicalImportStatus = BulkImportStatus;
export type ClinicalImportRowOutcome = BulkImportRowOutcome;
export type ClinicalImportFieldIssue = BulkImportFieldIssue;
export type ClinicalImportRowIssue = BulkImportRowIssue;
export type ClinicalImportReportRow = BulkImportReportRow;
export type ClinicalImportLimits = BulkImportLimits;
export type ClinicalImportDownload = BulkImportDownload;

/** Un tipo de registro (`GET /catalog`). */
export interface ClinicalImportKind {
  /** `hc-encuentro`, `hc-diagnostico`, `hc-medicacion`, `hc-alergia`, `hc-signo-vital`, `hc-resultado`, `hc-nota`. */
  readonly kind: string;
  readonly version: string;
  readonly group: 'CLINICAL';
  readonly title: string;
  readonly description: string;
  /** Entidad de la API a la que va (`clinical.encounters`…). */
  readonly target: string;
  readonly columnCount: number;
  readonly formats: readonly ClinicalImportFormat[];
}

/** Un colaborador del motor: conectado o no, y con qué adaptador. */
export interface ClinicalImportCollaborator {
  readonly connected: boolean;
  readonly adapter: string;
  readonly note?: string;
}

/** Estado declarado del motor en esta instalación: nada se supone conectado. */
export interface ClinicalImportEngineStatus {
  readonly persistence: ClinicalImportCollaborator;
  readonly writer: ClinicalImportCollaborator;
  readonly audit: ClinicalImportCollaborator;
  readonly resolvers: {
    readonly patients: ClinicalImportCollaborator;
    readonly codes: ClinicalImportCollaborator;
    readonly practitioners: ClinicalImportCollaborator;
  };
}

/** `GET /admin/clinical-imports/catalog`. */
export interface ClinicalImportCatalog {
  readonly kinds: readonly ClinicalImportKind[];
  readonly limits: ClinicalImportLimits;
  readonly formats: readonly ClinicalImportFormat[];
  readonly engine: ClinicalImportEngineStatus;
}

/** Lo que el lote declara sobre sí mismo. Las tres son obligatorias. */
export interface ClinicalImportDeclaration {
  readonly sourceOrganization: string;
  readonly legalBasis: string;
  /** `AAAA-MM-DD`, de hoy o anterior. */
  readonly loadedAt: string;
}

/** Un lote, con su vista previa y su avance. */
export interface ClinicalImportBatch {
  readonly id: string;
  readonly kind: string;
  readonly kindVersion: string;
  readonly group: 'CLINICAL';
  readonly status: ClinicalImportStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly declaration: ClinicalImportDeclaration;
  readonly source: { readonly format: ClinicalImportFormat; readonly byteSize: number };
  readonly counts: { readonly total: number; readonly valid: number; readonly rejected: number };
  readonly fileIssues: readonly ClinicalImportFieldIssue[];
  readonly issues: {
    readonly total: number;
    readonly truncated: boolean;
    readonly items: readonly ClinicalImportRowIssue[];
  };
  readonly progress: { readonly processed: number; readonly total: number };
  readonly confirmedAt?: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  /** Motivo del fallo del lote entero (`BATCH_TIMEOUT`, `AUDIT_UNAVAILABLE`…). */
  readonly failureReason?: string;
}

/** `GET /admin/clinical-imports/:id/report`. */
export interface ClinicalImportReport {
  readonly batchId: string;
  readonly kind: string;
  readonly status: ClinicalImportStatus;
  readonly generatedAt: string;
  /** `total` más una cuenta por cada {@link ClinicalImportRowOutcome}. */
  readonly totals: Readonly<Record<string, number>>;
  readonly fileIssues: readonly ClinicalImportFieldIssue[];
  readonly rows: readonly ClinicalImportReportRow[];
}

/** Un registro agregado: sólo identificadores, nunca contenido clínico. */
export interface ClinicalImportLoadedRecord {
  readonly row: number;
  readonly kind: string;
  readonly entity: string;
  readonly targetId: string;
}

/** `GET /admin/clinical-imports/:id/loaded`. */
export interface ClinicalImportLoaded {
  readonly batchId: string;
  readonly records: readonly ClinicalImportLoadedRecord[];
}

/** Lo que hace falta para crear un lote: el tipo, la declaración y el archivo. */
export interface CreateClinicalImportInput {
  readonly kind: string;
  readonly declaration: ClinicalImportDeclaration;
  readonly file: File;
}
