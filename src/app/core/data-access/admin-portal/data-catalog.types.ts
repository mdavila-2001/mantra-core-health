/* ============================================================================
    Catálogo de datos del portal administrativo (API: `/admin/catalog/*`,
    módulo 67 del backend).

    La cobertura, los estados y la procedencia los calcula el servidor. Esta
    capa sólo convierte el transporte (ISO, `null`) a la forma de la vista;
    nunca recalcula un porcentaje ni decide si algo está aprobado.
    ========================================================================== */

export type ObjectKind =
  | 'TABLE'
  | 'PARTITIONED_TABLE'
  | 'VIEW'
  | 'MATERIALIZED_VIEW'
  | 'FOREIGN_TABLE';
export type ObservationStatus = 'OBSERVED' | 'NOT_OBSERVED' | 'RETIRED';
export type ReviewStatus = 'DRAFT' | 'NEEDS_REVIEW' | 'APPROVED' | 'REJECTED';
export type Sensitivity = 'UNKNOWN' | 'NONE' | 'INTERNAL' | 'PII' | 'PHI' | 'SECRET';
export type ScanStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type EvidenceKind =
  | 'SCHEMA_COMMENT'
  | 'VAULT_NOTE'
  | 'MIGRATION'
  | 'CODE_REFERENCE'
  | 'OPENAPI'
  | 'OWNER_STATEMENT'
  | 'DOCUMENT';
export type MissingFilter = 'purpose' | 'existenceRationale' | 'rowGrain' | 'businessOwner';

export interface OpenQuestion {
  readonly field?: string;
  readonly question: string;
  readonly owner?: string;
  readonly dueDate?: string;
}

/** Contenido completo de una ficha. `null` = nadie lo respondió todavía. */
export interface AnnotationContent {
  readonly businessName: string | null;
  readonly definition: string | null;
  readonly purpose: string | null;
  readonly existenceRationale: string | null;
  readonly rowGrain: string | null;
  readonly alternativesRationale: string | null;
  readonly processSupported: string | null;
  readonly sourceOfTruth: string | null;
  readonly producers: readonly string[];
  readonly consumers: readonly string[];
  readonly deletionImpact: string | null;
  readonly businessOwner: string | null;
  readonly dataSteward: string | null;
  readonly technicalOwner: string | null;
  readonly unit: string | null;
  readonly valueDomain: string | null;
  readonly nullSemantics: string | null;
  readonly sensitivity: Sensitivity;
  readonly openQuestions: readonly OpenQuestion[];
}

export interface Annotation {
  readonly id: string;
  readonly targetKind: 'OBJECT' | 'COLUMN';
  /** Lo que se devuelve como `expectedVersion` al editar. */
  readonly version: number;
  readonly reviewStatus: ReviewStatus;
  readonly origin: string;
  readonly currentRevisionNo: number;
  readonly approvedRevisionNo: number | null;
  readonly approvedAt?: Date;
  readonly approvalIsCurrent: boolean;
  readonly content: AnnotationContent;
  readonly updatedAt?: Date;
}

export interface Statistics {
  readonly estimatedRows: string | null;
  readonly totalBytes: string | null;
  readonly isEstimate: boolean;
  readonly observedAt?: Date;
}

export interface CatalogObjectSummary {
  readonly id: string;
  readonly schemaName: string;
  readonly objectName: string;
  readonly objectKind: ObjectKind;
  readonly observationStatus: ObservationStatus;
  readonly columnCount: number;
  readonly statistics: Statistics;
  readonly lastSeenAt?: Date;
  readonly annotation: {
    readonly id: string;
    readonly businessName: string | null;
    readonly reviewStatus: ReviewStatus;
    readonly hasPurpose: boolean;
    readonly hasExistenceRationale: boolean;
    readonly hasRowGrain: boolean;
    readonly owner: string | null;
    readonly sensitivity: Sensitivity;
  } | null;
}

export interface CatalogPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly limit: number;
}

export interface CatalogObjectsQuery {
  readonly schema?: string;
  readonly kind?: ObjectKind;
  readonly observationStatus?: ObservationStatus;
  readonly reviewStatus?: ReviewStatus | 'NONE';
  readonly q?: string;
  readonly missing?: MissingFilter;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface SchemaSummary {
  readonly schemaName: string;
  readonly objects: number;
  readonly notObserved: number;
  readonly annotated: number;
  readonly approved: number;
}

export interface Governance {
  readonly entityRegistryId: string;
  readonly ownerTeam: string | null;
  readonly containsPii: boolean | null;
  readonly containsPhi: boolean | null;
  readonly isAppendOnly: boolean;
  readonly isSoftDelete: boolean;
  readonly hasHistory: boolean;
}

export interface CatalogObjectDetail {
  readonly id: string;
  readonly technical: {
    readonly schemaName: string;
    readonly objectName: string;
    readonly objectKind: ObjectKind;
    readonly comment: string | null;
    readonly columnCount: number;
    readonly primaryKey: readonly string[];
    readonly statistics: Statistics & { readonly method: string };
  };
  readonly observation: {
    readonly status: ObservationStatus;
    readonly lastSeenAt?: Date;
    readonly notObservedSince?: Date;
    readonly lastScanEngineVersion: string | null;
  };
  readonly annotation: Annotation | null;
  readonly coverage: {
    readonly technical: 'COMPLETE' | 'INCOMPLETE';
    readonly semantic: 'COMPLETE' | 'DECLARED_DEBT' | 'MISSING';
    readonly ownership: 'COMPLETE' | 'MISSING';
    readonly sensitivity: 'KNOWN' | 'UNKNOWN';
    readonly review: 'APPROVED_CURRENT' | 'NOT_APPROVED';
    readonly missingFields: readonly string[];
  };
  readonly governance: Governance | null;
  readonly evidenceCount: number;
}

export interface ForeignKey {
  readonly constraintName: string;
  readonly sourceColumns: readonly string[];
  readonly targetSchema: string;
  readonly targetTable: string;
  readonly targetColumns: readonly string[];
}

export interface CatalogColumn {
  readonly id: string;
  readonly columnName: string;
  readonly ordinal: number;
  readonly nativeType: string;
  readonly isNullable: boolean;
  readonly defaultExpression: string | null;
  readonly isPrimaryKey: boolean;
  readonly isUnique: boolean;
  readonly foreignKey: ForeignKey | null;
  readonly comment: string | null;
  readonly observationStatus: ObservationStatus;
  readonly annotation: Annotation | null;
}

export interface Evidence {
  readonly id: string;
  readonly kind: EvidenceKind;
  readonly reference: string;
  readonly excerpt: string | null;
  readonly sourceRevision: string | null;
  readonly createdAt?: Date;
}

export interface Revision {
  readonly revisionNo: number;
  readonly origin: string;
  readonly submittedStatus: string;
  readonly changeReason: string | null;
  readonly authorUserId: string | null;
  readonly createdAt?: Date;
}

export interface ReviewDecision {
  readonly revisionNo: number;
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly comment: string | null;
  readonly reviewerUserId: string;
  readonly decidedAt?: Date;
}

export interface AnnotationHistory {
  readonly revisions: readonly Revision[];
  readonly decisions: readonly ReviewDecision[];
}

export interface ChangeEvent {
  readonly id: string;
  readonly object: string | null;
  readonly column: string | null;
  readonly changeKind: 'ADDED' | 'CHANGED' | 'NOT_OBSERVED' | 'REAPPEARED';
  readonly before: Readonly<Record<string, unknown>> | null;
  readonly after: Readonly<Record<string, unknown>> | null;
  readonly detectedAt?: Date;
}

export interface ImpactNode {
  readonly objectId: string;
  readonly depth: number;
  readonly schemaName: string | null;
  readonly objectName: string | null;
  readonly reviewStatus: ReviewStatus | null;
  readonly owner: string | null;
}

export interface ImpactEdge {
  readonly fromObjectId: string;
  readonly toObjectId: string;
  readonly constraintName: string;
  readonly fromColumns: readonly string[];
  readonly toColumns: readonly string[];
}

export interface Impact {
  readonly direction: 'downstream' | 'upstream' | 'both';
  readonly maxDepth: number;
  readonly nodes: readonly ImpactNode[];
  readonly edges: readonly ImpactEdge[];
  readonly truncated: boolean;
  readonly truncatedReason: 'MAX_DEPTH' | 'MAX_NODES' | null;
  readonly scope: string;
}

export type DimensionStatus = 'MEASURED' | 'NOT_APPLICABLE' | 'UNKNOWN';

export interface DimensionSummary {
  readonly status: DimensionStatus;
  readonly covered: number;
  readonly denominator: number;
  /** `null` cuando no hay nada que dividir: nunca un 0 % ni un 100 % inventado. */
  readonly ratio: number | null;
}

export interface Coverage {
  readonly modelVersion: string;
  readonly denominator: number;
  readonly declaredDebt: number;
  readonly dimensions: {
    readonly technical: DimensionSummary;
    readonly semantic: DimensionSummary;
    readonly ownership: DimensionSummary;
    readonly sensitivity: DimensionSummary;
    readonly review: DimensionSummary;
  };
  readonly lastScan: { readonly scanId: string; readonly finishedAt?: Date } | null;
}

export interface Scan {
  readonly id: string;
  readonly status: ScanStatus;
  readonly requestedAt?: Date;
  readonly startedAt?: Date;
  readonly finishedAt?: Date;
  readonly attempt: number;
  readonly engineVersion: string | null;
  readonly snapshotHash: string | null;
  readonly counters: Readonly<Record<string, number>> | null;
  readonly limitations: readonly { readonly code: string; readonly detail: string; readonly count?: number }[];
  readonly error: { readonly code: string; readonly message: string } | null;
}

export interface ScanAccepted {
  readonly scanId: string;
  readonly status: ScanStatus;
  readonly created: boolean;
}

/** Edición: todos opcionales; `null` borra. `expectedVersion` 0 crea la ficha. */
export interface AnnotationPatch {
  readonly expectedVersion: number;
  readonly submit?: boolean;
  readonly changeReason?: string;
  readonly businessName?: string | null;
  readonly definition?: string | null;
  readonly purpose?: string | null;
  readonly existenceRationale?: string | null;
  readonly rowGrain?: string | null;
  readonly alternativesRationale?: string | null;
  readonly deletionImpact?: string | null;
  readonly businessOwner?: string | null;
  readonly dataSteward?: string | null;
  readonly technicalOwner?: string | null;
  readonly unit?: string | null;
  readonly valueDomain?: string | null;
  readonly nullSemantics?: string | null;
  readonly sensitivity?: Sensitivity;
  readonly consumers?: readonly string[];
  readonly openQuestions?: readonly OpenQuestion[];
}

export interface EvidenceInput {
  readonly kind: EvidenceKind;
  readonly reference: string;
  readonly excerpt?: string;
  readonly sourceRevision?: string;
}

export interface ReviewInput {
  readonly decision: 'APPROVED' | 'REJECTED';
  readonly expectedRevisionNo: number;
  readonly comment?: string;
}
