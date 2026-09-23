/* ============================================================================
    Tipos de analítica (`/admin/analytics`), QA (`/admin/qa`) y operación
    (`/admin/ops`) del portal administrativo.

    Las marcas de tiempo quedan como ISO (`string | null`): estas vistas sólo
    las muestran con `DatePipe`, que trata `null` como ausencia, y nunca operan
    con ellas. Ningún porcentaje ni veredicto se recalcula en el frontend.
    ========================================================================== */

// ---------------------------------------------------------------- analítica

export type Portal = 'WEB' | 'MOBILE';
export type Interval = 'hour' | 'day';

export interface AnalyticsWindowQuery {
  readonly from?: string;
  readonly to?: string;
  readonly interval?: Interval;
  readonly portal?: Portal;
}

export interface AnalyticsWindow {
  readonly from: string;
  readonly to: string;
  readonly interval: Interval;
  readonly timezone: 'UTC';
  readonly portal: Portal | null;
}

export interface AnalyticsOverview {
  readonly window: AnalyticsWindow;
  readonly totals: {
    readonly events: number;
    readonly sessions: number;
    readonly pseudonymousSubjects: number;
    readonly pageViews: number;
    readonly lastEventAt: string | null;
  };
  readonly definitions: Readonly<Record<string, string>>;
  readonly topRoutes: readonly { readonly route: string; readonly events: number; readonly sessions: number }[];
  readonly topEvents: readonly { readonly eventName: string; readonly events: number; readonly sessions: number }[];
}

export interface Timeseries {
  readonly window: AnalyticsWindow;
  readonly points: readonly { readonly bucket: string; readonly events: number; readonly sessions: number }[];
  readonly note: string;
}

export interface VitalMetric {
  readonly metric: string;
  readonly unit: 'ms' | 'score' | null;
  readonly samples: number;
  readonly p50: number | null;
  readonly p75: number | null;
  readonly p95: number | null;
  readonly ratings: Readonly<Partial<Record<string, number>>>;
  readonly deprecated: string | null;
}

export interface WebVitals {
  readonly window: AnalyticsWindow;
  readonly method: string;
  readonly metrics: readonly VitalMetric[];
}

export interface FunnelDefinition {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly version: number;
  readonly steps: readonly { readonly stepNumber: number; readonly eventName: string }[];
}

export interface FunnelReport {
  readonly funnel: { readonly id: string; readonly code: string; readonly name: string; readonly version: number };
  readonly window: AnalyticsWindow;
  readonly unit: 'session';
  readonly denominator: number;
  readonly completed: number;
  readonly overallConversion: number | null;
  readonly steps: readonly {
    readonly stepNumber: number;
    readonly eventName: string;
    readonly reached: number;
    readonly conversionFromStart: number | null;
    readonly conversionFromPrevious: number | null;
    readonly droppedFromPrevious: number | null;
  }[];
  readonly rules: Readonly<Record<string, string>>;
  readonly serverConfirmedConversions: number;
}

export interface PipelineHealth {
  readonly window: AnalyticsWindow;
  readonly measured: {
    readonly accepted: number;
    readonly lastReceivedAt: string | null;
    readonly freshnessSeconds: number | null;
    readonly ingestLagSeconds: { readonly p50: number | null; readonly p95: number | null };
    readonly clockSkewFuture: number;
    readonly lateOver24h: number;
    readonly withoutSession: number;
    readonly clientContexts: number;
    readonly bots: number;
    readonly botUnknown: number;
  };
  readonly notMeasured: readonly { readonly metric: string; readonly reason: string }[];
}

export interface SessionSummary {
  readonly id: string;
  readonly portal: string;
  readonly status: string;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly durationSeconds: number | null;
  readonly eventCount: number;
  readonly hasPseudonymousSubject: boolean;
}

export interface SessionDetail extends SessionSummary {
  readonly events: readonly {
    readonly id: string;
    readonly eventName: string;
    readonly routeTemplate: string | null;
    readonly occurredAt: string | null;
    readonly propertyNames: readonly string[];
  }[];
  readonly truncated: boolean;
}

export interface SessionsPage {
  readonly items: readonly SessionSummary[];
  readonly nextCursor: string | null;
  readonly limit: number;
}

// ----------------------------------------------------------------------- QA

export type PlanStatus =
  | 'PENDING_APPROVAL'
  | 'QUEUED'
  | 'RUNNING'
  | 'PASSED'
  | 'FAILED'
  | 'TIMED_OUT'
  | 'CANCELLED'
  | 'INFRA_ERROR'
  | 'REJECTED';

export interface QaEnvironment {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: string | null;
  readonly baseUrl: string | null;
  readonly state: string | null;
}

export interface QaSuite {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly version: number;
  readonly state: string | null;
  readonly ownerTeam: string | null;
  readonly cases: number;
  readonly activeCases: number;
  readonly lastRun: { readonly id: string; readonly runNumber: string; readonly status: string | null; readonly finishedAt: string | null } | null;
}

export interface QaSuiteDetail {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly version: number;
  readonly state: string | null;
  readonly cases: readonly {
    readonly id: string;
    readonly code: string;
    readonly name: string;
    readonly method: string | null;
    readonly requestPath: string | null;
    readonly state: string | null;
    readonly assertions: readonly {
      readonly id: string;
      readonly type: string | null;
      readonly path: string | null;
      readonly operator: string | null;
      readonly expected: string | null;
    }[];
  }[];
}

export interface QaTarget {
  readonly id: string;
  readonly environmentId: string;
  readonly scheme: string;
  readonly host: string;
  readonly port: number;
  readonly allowedPathPrefixes: readonly string[];
  readonly allowPrivateNetwork: boolean;
  readonly allowMutations: boolean;
  readonly authSecretRef: string | null;
  readonly authSecretConfigured: boolean | null;
  readonly limits: PlanLimits;
  readonly status: string;
}

export interface PlanLimits {
  readonly maxRequests: number;
  readonly maxDurationSeconds: number;
  readonly requestTimeoutMs: number;
  readonly minIntervalMs: number;
}

export interface PlanStep {
  readonly caseId: string;
  readonly code: string;
  readonly method: string;
  readonly url: string;
  readonly mutating: boolean;
}

export interface PlanViolation {
  readonly code: string;
  readonly message: string;
  readonly caseCode?: string;
}

export interface Preflight {
  readonly executable: boolean;
  readonly steps: readonly PlanStep[];
  readonly limits: PlanLimits;
  readonly hash: string;
  readonly requiresApproval: boolean;
  readonly approvalReasons: readonly string[];
  readonly violations: readonly PlanViolation[];
  readonly clamped: readonly string[];
  readonly loadTesting: string;
}

export interface PlanSummary {
  readonly id: string;
  readonly runId: string;
  readonly suiteId: string;
  readonly environmentId: string;
  readonly planHash: string;
  readonly status: PlanStatus;
  readonly requiresApproval: boolean;
  readonly approvalReasons: readonly string[];
  readonly requestedByUserId: string | null;
  readonly createdAt: string | null;
  readonly finishedAt: string | null;
  readonly counters: {
    readonly requestsSent: number;
    readonly casesPassed: number;
    readonly casesFailed: number;
    readonly casesNotRun: number;
  };
  readonly error: { readonly code: string; readonly message: string } | null;
}

export interface PlanDetail extends PlanSummary {
  readonly steps: readonly PlanStep[];
  readonly limits: PlanLimits;
  readonly approvals: readonly {
    readonly decision: 'APPROVED' | 'REJECTED';
    readonly reason: string;
    readonly approverUserId: string;
    readonly expiresAt: string | null;
    readonly createdAt: string | null;
  }[];
  readonly events: readonly {
    readonly seq: number;
    readonly kind: string;
    readonly caseId: string | null;
    readonly detail: Readonly<Record<string, unknown>> | null;
    readonly at: string | null;
  }[];
}

export interface QaRunSummary {
  readonly id: string;
  readonly runNumber: string;
  readonly suiteId: string;
  readonly status: string | null;
  readonly finishedAt: string | null;
  readonly totals: { readonly cases: number; readonly passed: number; readonly failed: number; readonly skipped: number };
}

export interface QaRunDetail extends QaRunSummary {
  readonly results: readonly {
    readonly id: string;
    readonly caseCode: string | null;
    readonly status: string | null;
    readonly errorText: string | null;
    readonly assertions: readonly {
      readonly passed: boolean;
      readonly actualValue: string | null;
      readonly message: string | null;
    }[];
  }[];
}

export interface QaDefect {
  readonly id: string;
  readonly defectNumber: string;
  readonly severity: string | null;
  readonly status: string | null;
  readonly isFlaky: boolean;
  readonly occurrences: number;
  readonly lastSeenAt: string | null;
}

// ---------------------------------------------------------------- operación

export type ControlStatus = 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE';

export interface ReadinessControl {
  readonly code: string;
  readonly title: string;
  readonly blocking: boolean;
  readonly status: ControlStatus;
  readonly reason: string;
  readonly evidence: readonly { readonly ref: string; readonly detail: string; readonly at: string | null }[];
  readonly observedAt: string | null;
  readonly staleAfterDays: number | null;
}

export interface Readiness {
  readonly modelVersion: string;
  readonly evaluatedAt: string;
  readonly status: 'READY' | 'NOT_READY' | 'BLOCKED_BY_UNKNOWN';
  readonly blockingFailures: readonly string[];
  readonly blockingUnknown: readonly string[];
  readonly controls: readonly ReadinessControl[];
  readonly notImplemented: readonly string[];
}

export interface Incident {
  readonly id: string;
  readonly number: string;
  readonly title: string | null;
  readonly severity: string | null;
  readonly status: string | null;
  readonly component: { readonly code: string; readonly name: string | null } | null;
  readonly openedAt: string | null;
  readonly resolvedAt: string | null;
}

export interface Deployment {
  readonly id: string;
  readonly number: string;
  readonly environment: string | null;
  readonly status: string | null;
  readonly gitRef: string | null;
  readonly component: string | null;
  readonly finishedAt: string | null;
  readonly isCurrent: boolean;
}

export interface SloStatus {
  readonly id: string;
  readonly indicator: { readonly code: string; readonly name: string | null } | null;
  readonly target: number;
  readonly lastMeasurement: {
    readonly measuredAt: string | null;
    readonly status: string | null;
    readonly attained: number | null;
    readonly goodEvents: number | null;
    readonly totalEvents: number | null;
  } | null;
}

export interface BackupPolicy {
  readonly policyId: string;
  readonly rpoSeconds: number;
  readonly rtoSeconds: number;
  readonly restoreTestFrequencyDays: number | null;
  readonly lastRestoreTest: {
    readonly id: string;
    readonly finishedAt: string | null;
    readonly outcome: 'PASS' | 'FAIL';
    readonly integrityCheckPassed: boolean | null;
    readonly measuredRpoSeconds: number | null;
    readonly measuredRtoSeconds: number | null;
  } | null;
}
