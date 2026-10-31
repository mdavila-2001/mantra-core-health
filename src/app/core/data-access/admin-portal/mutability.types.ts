/* ============================================================================
    Mutabilidad de datos del portal administrativo (API:
    `GET /admin/governance/mutability`, `/mutability/summary` y
    `/mutability/:schema/:table`, módulo `system_ops`).

    Qué tablas son append-only, cuáles se pueden borrar, cuáles se purgan por
    retención y cuáles aceptan un legal hold. **Cada valor viaja con su nivel de
    evidencia**: sin evidencia es `UNKNOWN`, y `UNKNOWN` no es «No».

    Esta capa sólo convierte el transporte; nunca decide qué modo tiene una tabla
    ni resuelve una contradicción entre fuentes.
    ========================================================================== */

export const WRITE_MODES = [
  'APPEND_ONLY',
  'APPEND_ONLY_PURGEABLE',
  'LIFECYCLE_ONLY',
  'UPDATABLE',
  'UPDATABLE_DELETABLE',
  'SOFT_DELETE',
  'UNKNOWN',
] as const;
export type WriteMode = (typeof WRITE_MODES)[number];

/** Del más fuerte al más débil: el orden del arreglo es el orden de fuerza. */
export const EVIDENCE_LEVELS = [
  'ENFORCED_DB',
  'ENFORCED_CODE',
  'DECLARED_MODEL',
  'DECLARED_DOC',
  'INFERRED',
  'UNKNOWN',
] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const DISPOSITIONS = [
  'KEEP',
  'PURGE_BY_RETENTION',
  'ANONYMIZE',
  'ARCHIVE',
  'UNKNOWN',
] as const;
export type Disposition = (typeof DISPOSITIONS)[number];

export const LEGAL_HOLD_STATES = ['HOLD_AWARE', 'HOLD_CAPABLE_NOT_ENFORCED', 'UNKNOWN'] as const;
export type LegalHoldState = (typeof LEGAL_HOLD_STATES)[number];

export const FINDING_FILTERS = ['ANY', 'NONE', 'CONTRADICTION', 'GAP'] as const;
export type FindingFilter = (typeof FINDING_FILTERS)[number];

export type MutabilityDatabase = 'main' | 'pay';

/** Retención declarada por una fuente; la base legal y el cumplimiento siempre están pendientes. */
export interface MutabilityRetention {
  readonly days: number | null;
  readonly source: string | null;
  readonly status: 'PENDIENTE_DE_CUMPLIMIENTO';
}

export interface MutabilityItem {
  readonly schema: string;
  readonly table: string;
  readonly database: MutabilityDatabase;
  readonly writeMode: WriteMode;
  readonly writeModeLevel: EvidenceLevel;
  readonly disposition: Disposition;
  readonly dispositionLevel: EvidenceLevel;
  readonly retention: MutabilityRetention | null;
  readonly legalHold: LegalHoldState;
  readonly legalHoldLevel: EvidenceLevel;
  readonly contradictions: number;
  readonly gaps: number;
  /** `null`: no se pudo consultar el registro (no es «no registrada»). */
  readonly registered: boolean | null;
}

export interface MutabilityPage {
  readonly items: readonly MutabilityItem[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly total: number;
}

export interface MutabilityQuery {
  readonly schema?: string;
  readonly writeMode?: WriteMode;
  readonly evidence?: EvidenceLevel;
  readonly finding?: FindingFilter;
  readonly disposition?: Disposition;
  readonly legalHold?: LegalHoldState;
  readonly database?: MutabilityDatabase;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Cuenta con su denominador: nunca un porcentaje suelto. */
export interface MutabilityRatio {
  readonly numerator: number;
  readonly denominator: number;
}

export interface MutabilityModeCount extends MutabilityRatio {
  readonly writeMode: WriteMode;
  readonly byEvidence: Readonly<Record<string, number>>;
}

export interface MutabilityLevelCount extends MutabilityRatio {
  readonly level: EvidenceLevel;
}

export interface MutabilityFindingCode {
  readonly code: string;
  readonly kind: 'CONTRADICTION' | 'GAP';
  readonly findings: number;
  readonly tables: number;
}

export interface MutabilitySummary {
  readonly totalTables: number;
  readonly byWriteMode: readonly MutabilityModeCount[];
  readonly byEvidence: readonly MutabilityLevelCount[];
  readonly decided: MutabilityRatio;
  readonly enforcedByDatabase: MutabilityRatio;
  readonly withContradictions: MutabilityRatio;
  readonly withGaps: MutabilityRatio;
  readonly findingCodes: readonly MutabilityFindingCode[];
  readonly disposition: readonly (MutabilityRatio & { readonly disposition: Disposition })[];
  readonly legalHold: readonly (MutabilityRatio & { readonly legalHold: LegalHoldState })[];
  readonly withDeclaredPeriod: number;
  readonly pendingCompliance: number;
  readonly registered: MutabilityRatio | null;
  readonly sources: Readonly<Record<string, number>>;
  readonly generatedFrom: {
    readonly modelRoot: string;
    readonly inventoryRoot: string;
    readonly modelVersion?: string | null;
    readonly note: string;
  };
}

export interface MutabilityEvidence {
  readonly kind: string;
  readonly level: EvidenceLevel;
  readonly supports: 'WRITE_MODE' | 'DISPOSITION' | 'LEGAL_HOLD' | 'CONTEXT';
  /** `archivo:línea`, disparador, REVOKE o estereotipo. */
  readonly source: string;
  readonly claim: string;
}

export interface MutabilityFinding {
  readonly kind: 'CONTRADICTION' | 'GAP';
  readonly code: string;
  readonly severity: 'HIGH' | 'MEDIUM' | 'LOW';
  readonly summary: string;
  readonly a: MutabilityEvidence;
  readonly b?: MutabilityEvidence;
}

export interface MutabilityDetail extends MutabilityItem {
  readonly evidence: readonly MutabilityEvidence[];
  readonly findings: readonly MutabilityFinding[];
}
