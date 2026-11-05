/* Ver `access-governance.types.ts` (barril) para el contexto: formas tomadas del código de la API. */

/* ---- informes y tableros ------------------------------------------------------------ */

/** Los diez mosaicos del tablero (`GET /org/governance/summary` → `tiles`). */
export interface GovernanceTiles {
  readonly peopleWithLiveAccess: number;
  readonly highRiskGrants: number;
  readonly overdueCertifications: number;
  readonly ownerlessAccounts: number;
  readonly inactiveAccounts: number;
  readonly activeSodExceptions: number;
  readonly pendingApprovalsOver24h: number;
  readonly openAnomalies: number;
  readonly grantsAboveCeiling: number;
  readonly breakGlassUnreviewed: number;
}

export interface GovernanceSummary {
  readonly generatedAt: string;
  readonly tiles: GovernanceTiles;
}

export type MatrixDimension = 'person' | 'doctor' | 'service' | 'location';
export type MatrixCellStatus = 'FULL' | 'CONDITIONAL' | 'PARTIAL' | 'NONE';

export interface MatrixQuery {
  readonly by: MatrixDimension;
  /** Solo con `by: 'person'`: agrupar por categoría o por átomo. */
  readonly group?: 'category' | 'atom';
  /** Obligatorio con `doctor`, `service` o `location`. */
  readonly id?: string;
}

export interface MatrixCell {
  readonly status: MatrixCellStatus;
  readonly grantIds: readonly string[];
  readonly conditions: readonly string[];
}

export interface PersonMatrixRow {
  readonly userId: string;
  readonly name?: string;
  readonly engagementId: string;
  readonly templateCode?: string;
  readonly state: string;
  readonly cells: Readonly<Record<string, MatrixCell>>;
}

export interface PersonMatrix {
  readonly generatedAt: string;
  readonly by: 'person';
  readonly group: 'category' | 'atom';
  readonly columns: readonly string[];
  readonly rows: readonly PersonMatrixRow[];
}

export interface TargetMatrixRow {
  readonly userId: string;
  readonly name?: string;
  readonly engagementId: string;
  readonly templateCode?: string;
  readonly state: string;
  /** `false` si la persona tiene el permiso pero hoy está bloqueada (`reason`). */
  readonly effective: boolean;
  readonly reason?: string;
  readonly atoms: readonly string[];
  readonly grantIds: readonly string[];
  readonly conditions: readonly string[];
}

export interface TargetMatrix {
  readonly generatedAt: string;
  readonly by: 'doctor' | 'service' | 'location';
  readonly id: string;
  readonly rows: readonly TargetMatrixRow[];
}

export type AccessMatrix = PersonMatrix | TargetMatrix;

export interface PrivilegeCreepRow {
  readonly userId: string;
  readonly name?: string;
  readonly engagementId: string;
  readonly templateCode?: string;
  readonly score: number;
  readonly baseline: number;
  readonly drift: number;
  readonly flagged: boolean;
  readonly reasons: readonly string[];
  readonly grantsSinceCertification: number;
}

export interface PrivilegeCreepReport {
  readonly generatedAt: string;
  readonly threshold: number;
  readonly items: readonly PrivilegeCreepRow[];
}

export interface UnusedAccessRow {
  readonly userId: string;
  readonly engagementId: string;
  readonly grantId: string;
  readonly atoms: readonly string[];
  readonly lastUsedAt?: string;
  readonly daysSinceUse: number | null;
}

export interface UnusedAccessReport {
  readonly generatedAt: string;
  readonly days: number;
  readonly items: readonly UnusedAccessRow[];
}

export interface OwnerlessRow {
  readonly userId: string;
  readonly engagementId: string;
  readonly templateCode?: string;
  readonly reasons: readonly string[];
}

export interface OwnerlessReport {
  readonly generatedAt: string;
  readonly items: readonly OwnerlessRow[];
}

export interface ExceptionsReport {
  readonly generatedAt: string;
  readonly sodExceptions: readonly {
    readonly exceptionId: string;
    readonly ruleCode: string;
    readonly userId: string;
    readonly validTo?: string;
  }[];
  readonly approvalsNotExecuted: readonly {
    readonly id: string;
    readonly requesterUserId?: string;
    readonly approvedUntil?: string;
  }[];
  readonly temporaryClinicalAccess: readonly {
    readonly id: string;
    readonly userId: string;
    readonly validTo: string;
  }[];
  readonly expiringGrants: readonly {
    readonly grantId: string;
    readonly userId: string;
    readonly validTo?: string;
  }[];
}

export const ANOMALY_KINDS = [
  'ANOMALY_SEARCH_SPIKE',
  'ANOMALY_CANCEL_SPIKE',
  'ANOMALY_OFF_HOURS',
  'ANOMALY_DENIED_BURST',
  'ANOMALY_BROWSE_PATIENTS',
  'ANOMALY_INACTIVE_ACCOUNT',
  'ANOMALY_PRIVILEGE_CREEP',
] as const;
export type AnomalyKind = (typeof ANOMALY_KINDS)[number];
export const ANOMALY_KIND_LABELS: Readonly<Record<AnomalyKind, string>> = {
  ANOMALY_SEARCH_SPIKE: 'Muchas búsquedas de pacientes',
  ANOMALY_CANCEL_SPIKE: 'Muchas cancelaciones',
  ANOMALY_OFF_HOURS: 'Actividad fuera de horario',
  ANOMALY_DENIED_BURST: 'Muchos intentos negados',
  ANOMALY_BROWSE_PATIENTS: 'Revisó demasiados pacientes distintos',
  ANOMALY_INACTIVE_ACCOUNT: 'Cuenta sin uso',
  ANOMALY_PRIVILEGE_CREEP: 'Acumuló permisos',
};
export type AnomalyStatus = 'OPEN' | 'ACKNOWLEDGED' | 'DISMISSED' | 'ESCALATED';

export interface AnomalyQuery {
  readonly status?: AnomalyStatus;
  readonly kind?: AnomalyKind;
}

export interface Anomaly {
  readonly id: string;
  readonly userId: string;
  readonly userName?: string;
  readonly kind: AnomalyKind | string;
  readonly status: AnomalyStatus | string;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly observed: number;
  readonly baseline: number | null;
  readonly threshold: number;
  /** Datos para el gráfico: por hora o por día, con la línea base. */
  readonly evidence: Readonly<Record<string, unknown>>;
  readonly acknowledgedAt?: string;
  readonly resolutionComment?: string;
}

export interface AnomalyList {
  readonly items: readonly Anomaly[];
  readonly count: number;
}

export interface AnomalyResolution {
  readonly status: 'ACKNOWLEDGED' | 'DISMISSED' | 'ESCALATED';
  /** Obligatorio al descartar o escalar. */
  readonly comment?: string;
}

export interface AnomalyResolutionResult {
  readonly ok: boolean;
  readonly status: string;
}

/** Tipos de informe exportables (`POST /org/governance/reports/:kind/export`). */
export const GOVERNANCE_REPORT_KINDS = [
  'summary',
  'access-matrix',
  'privilege-creep',
  'unused-access',
  'ownerless',
  'exceptions',
  'anomalies',
  'sod-findings',
  'fhir-audit-event',
] as const;
export type GovernanceReportKind = (typeof GOVERNANCE_REPORT_KINDS)[number] | (string & {});

/** Para qué se exporta: la clase del motivo (la API solo asienta esto, el largo y la huella del texto). */
export const EXPORT_REASON_CODES = [
  'AUDIT_REVIEW',
  'REGULATORY',
  'INTERNAL_CONTROL',
  'INCIDENT',
  'OTHER',
] as const;
export type ExportReasonCode = (typeof EXPORT_REASON_CODES)[number];
export const EXPORT_REASON_LABELS: Readonly<Record<ExportReasonCode, string>> = {
  AUDIT_REVIEW: 'Revisión de auditoría',
  REGULATORY: 'Requisito de una autoridad',
  INTERNAL_CONTROL: 'Control interno',
  INCIDENT: 'Investigación de un incidente',
  OTHER: 'Otro motivo',
};

export interface GovernanceReportExport {
  readonly format: 'csv' | 'json';
  /** Mínimo 10 caracteres (422 `EXPORT_REASON_REQUIRED`). Pide paso extra. */
  readonly reason: string;
  /** Clase del motivo: lo único del texto que se asienta (con su largo y su huella). La API lo acepta; sin él es `OTHER`. */
  readonly reasonCode?: ExportReasonCode;
  readonly filters?: Readonly<Record<string, unknown>>;
}

/** Panel «Mi equipo» del doctor (`GET /me/practitioner/governance-panel`). */
export interface GovernancePanel {
  readonly generatedAt: string;
  readonly team: readonly {
    readonly userId: string;
    readonly engagementId: string;
    readonly templateCode: string | null;
    readonly liveGrants: number;
  }[];
  readonly pendingReviews: number;
  readonly openAnomalies: readonly {
    readonly id: string;
    readonly userId: string;
    readonly kindConceptId: string;
    readonly windowStart: string;
    readonly observed: number;
    readonly threshold: number;
  }[];
}
