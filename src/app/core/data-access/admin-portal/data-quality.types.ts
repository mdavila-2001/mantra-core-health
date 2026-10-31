/* ============================================================================
    Calidad de datos clínicos, esquema `health_data` (`/admin/governance/data-quality/*`).

    Lo que decide la API —qué estados existen, quién puede cerrar una incidencia,
    qué pasa si dos personas la cierran a la vez— no se reproduce aquí. Un código
    que la API no pudo reconocer llega como `null` y la vista lo dice: no se
    adivina ni se rellena.
    ========================================================================== */

export const QUALITY_ISSUE_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const;
export type QualityIssueStatus = (typeof QUALITY_ISSUE_STATUSES)[number];

export const QUALITY_SEVERITIES = ['FATAL', 'ERROR', 'WARNING', 'INFORMATION'] as const;
export type QualitySeverity = (typeof QUALITY_SEVERITIES)[number];

export const QUALITY_RESOLUTION_ACTIONS = ['RESOLVE', 'DISMISS'] as const;
export type QualityResolutionAction = (typeof QUALITY_RESOLUTION_ACTIONS)[number];

/** Largo mínimo y máximo del motivo; los mismos que valida la API. */
export const QUALITY_NOTE_MIN_LENGTH = 10;
export const QUALITY_NOTE_MAX_LENGTH = 2000;

export interface QualityPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly limit: number;
  /** Cuántas filas cumplen los filtros (no sólo las de esta página). */
  readonly total: number;
}

export interface QualityIssue {
  readonly id: string;
  readonly ruleId: string;
  readonly ruleCode: string;
  readonly ruleName: string;
  /** `null`: la API no reconoció el concepto de severidad. */
  readonly severity: QualitySeverity | null;
  readonly status: QualityIssueStatus | null;
  /** Ruta del campo afectado; `$` es el recurso entero. */
  readonly fieldPath: string;
  readonly resourceId: string | null;
  readonly assignedUserId: string | null;
  readonly tenantId: string;
  readonly runId: string;
  readonly createdAt: Date;
  readonly resolvedAt?: Date;
  readonly resolutionText: string | null;
}

export interface QualityIssuesQuery {
  readonly status?: QualityIssueStatus;
  readonly severity?: QualitySeverity;
  readonly ruleId?: string;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ResolveIssueInput {
  readonly action: QualityResolutionAction;
  readonly note: string;
}

export interface ResolveIssueResult {
  readonly issue: QualityIssue;
  /** `true`: ya estaba en ese estado y la repetición no cambió nada. */
  readonly alreadyApplied: boolean;
}

export interface ConceptLabel {
  readonly code: string | null;
  readonly display: string | null;
}

export interface QualityRule {
  readonly id: string;
  readonly ruleCode: string;
  readonly name: string;
  readonly severity: QualitySeverity | null;
  readonly state: ConceptLabel;
  readonly dimension: ConceptLabel;
  readonly ruleSet: {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly version: string;
  };
  readonly openIssues: number;
  readonly totalIssues: number;
  readonly updatedAt: Date;
}

export interface QualityRulesQuery {
  readonly severity?: QualitySeverity;
  readonly dimension?: string;
  readonly q?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface QualityRun {
  readonly id: string;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly result: ConceptLabel;
  /** `null`: la corrida no informó cuántos registros evaluó. No es cero. */
  readonly recordsEvaluated: number | null;
  readonly issuesDetected: number | null;
}

export interface QualityRuleDetail extends QualityRule {
  readonly ruleExpression: string;
  readonly expressionLanguage: string | null;
  readonly remediationGuidance: string | null;
  readonly issuesByStatus: Readonly<Record<QualityIssueStatus, number>> & { readonly other: number };
  readonly recentRuns: readonly QualityRun[];
}
