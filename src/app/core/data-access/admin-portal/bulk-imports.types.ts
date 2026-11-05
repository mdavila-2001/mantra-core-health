/* ============================================================================
    Cargas masivas (`/admin/bulk-imports`, módulo `bulk_import` de la API).

    Espejo de lo que sirve la API. Reglas del servidor que la pantalla no puede
    torcer:
    - La vista previa y el informe **nunca traen el valor de una celda**: dicen
      fila, columna y motivo. Eso es lo que permite mostrarlos sin exponer a
      las personas del archivo.
    - Lo que el motor no hace en esta instalación lo declara `engine`: un
      colaborador «no conectado» deja las filas válidas como `RECHAZADA` con
      motivo `EXECUTOR_NOT_CONNECTED`. «Creadas» es lo que dice el informe, no
      lo que se confirmó.
    - Los instantes viajan como ISO 8601 y se dejan como texto.
    ========================================================================== */

/** Familia de una carga: altas de usuarios o historia clínica. */
export type BulkImportGroup = 'USERS' | 'CLINICAL';

/** Formatos de plantilla y de archivo. */
export type BulkImportFormat = 'csv' | 'json';

/** Estados de un lote. `RECHAZADO` es terminal; el curso normal es `VALIDADO → EN_COLA → PROCESANDO → COMPLETADO`. */
export type BulkImportStatus =
  | 'VALIDADO'
  | 'RECHAZADO'
  | 'EN_COLA'
  | 'PROCESANDO'
  | 'COMPLETADO'
  | 'FALLIDO';

/** Qué pasó con una fila en el informe. */
export type BulkImportRowOutcome =
  | 'CREADA'
  | 'OMITIDA'
  | 'CONFLICTO'
  | 'RECHAZADA'
  | 'FALLIDA'
  | 'NO_PROCESADA';

/** Una entrada del catálogo de plantillas (`GET /templates`). */
export interface BulkImportTemplate {
  readonly kind: string;
  readonly version: string;
  readonly group: BulkImportGroup;
  readonly title: string;
  readonly description: string;
  /** Permiso fino que exige el tipo: `bulk_import.users` o `bulk_import.clinical`. */
  readonly permission: string;
  readonly columnCount: number;
  readonly formats: readonly BulkImportFormat[];
}

/** Topes de una carga. */
export interface BulkImportLimits {
  readonly maxBytes: number;
  readonly maxRows: number;
  readonly maxPreviewIssues: number;
  readonly maxIdempotencyKeyLength: number;
}

/** Un colaborador del motor: conectado o no, y con qué adaptador. */
export interface BulkImportCollaborator {
  readonly connected: boolean;
  readonly adapter: string;
}

/**
 * Estado declarado del motor en esta instalación. Es la fuente de lo que la
 * pantalla dice que **no** hace: nada se supone conectado.
 */
export interface BulkImportEngineStatus {
  readonly persistence: {
    readonly durable: boolean;
    readonly adapter: string;
    readonly note?: string;
  };
  readonly executors: {
    readonly users: BulkImportCollaborator;
    readonly clinical: BulkImportCollaborator;
  };
  readonly resolvers: {
    readonly patients: BulkImportCollaborator;
    readonly codes: BulkImportCollaborator;
  };
}

/** `GET /admin/bulk-imports/templates`. */
export interface BulkImportCatalog {
  readonly templates: readonly BulkImportTemplate[];
  readonly limits: BulkImportLimits;
  readonly formats: readonly BulkImportFormat[];
  readonly engine: BulkImportEngineStatus;
}

/** Lo que el lote declara sobre sí mismo. */
export interface BulkImportDeclaration {
  /** Motivo del alta (cargas de usuarios). */
  readonly reason?: string;
  /** Organización de origen de los datos (historia clínica). */
  readonly sourceOrganization?: string;
  /** Base legal que habilita la carga (historia clínica). */
  readonly legalBasis?: string;
  /** Fecha de la carga, `AAAA-MM-DD` (historia clínica). */
  readonly loadedAt?: string;
}

/** Un hallazgo del archivo entero o de una columna: sin el valor recibido. */
export interface BulkImportFieldIssue {
  /** Columna afectada; `*` si es de la fila entera. */
  readonly field: string;
  /** Motivo estable (`REQUIRED`, `INVALID_FORMAT`, `COLUMN_MISSING`…). */
  readonly code: string;
  readonly message: string;
}

/** Un hallazgo ubicado en una fila de datos (desde 1). */
export interface BulkImportRowIssue extends BulkImportFieldIssue {
  readonly row: number;
}

/** Un lote, con su vista previa y su avance. */
export interface BulkImportBatch {
  readonly id: string;
  readonly kind: string;
  readonly kindVersion: string;
  readonly group: BulkImportGroup;
  readonly status: BulkImportStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly declaration: BulkImportDeclaration;
  readonly source: { readonly format: BulkImportFormat; readonly byteSize: number };
  readonly counts: {
    readonly total: number;
    readonly valid: number;
    readonly rejected: number;
  };
  readonly fileIssues: readonly BulkImportFieldIssue[];
  readonly issues: {
    readonly total: number;
    readonly truncated: boolean;
    readonly items: readonly BulkImportRowIssue[];
  };
  readonly progress: { readonly processed: number; readonly total: number };
  readonly confirmedAt?: string;
  readonly startedAt?: string;
  readonly finishedAt?: string;
  /** Motivo del fallo del lote entero (`BATCH_TIMEOUT`…). */
  readonly failureReason?: string;
}

/** Una fila del informe. Sin datos de la fila: sólo número, resultado y motivo. */
export interface BulkImportReportRow {
  readonly row: number;
  readonly outcome: BulkImportRowOutcome;
  readonly reason?: string;
  readonly field?: string;
  readonly message?: string;
}

/** `GET /admin/bulk-imports/:id/report`. */
export interface BulkImportReport {
  readonly batchId: string;
  readonly kind: string;
  readonly status: BulkImportStatus;
  readonly generatedAt: string;
  /** `total` más una cuenta por cada {@link BulkImportRowOutcome}. */
  readonly totals: Readonly<Record<string, number>>;
  readonly fileIssues: readonly BulkImportFieldIssue[];
  readonly rows: readonly BulkImportReportRow[];
}

/** Lo que hace falta para crear un lote: el tipo, la declaración y el archivo. */
export interface CreateBulkImportInput {
  readonly kind: string;
  readonly declaration: BulkImportDeclaration;
  readonly file: File;
}

/** Un archivo descargado (plantilla o informe) con el nombre que dio el servidor. */
export interface BulkImportDownload {
  readonly blob: Blob;
  readonly fileName: string;
}
