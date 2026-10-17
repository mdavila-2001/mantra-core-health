/* ============================================================================
    Catálogo de flujos (`/admin/qa/flows*`, módulo qa_lab).

    Espejo de lo que sirve la API. Un flujo es un recorrido del usuario como
    árbol de decisión; cada paso dice si el contrato lo declara (`DECLARED`) o
    no lo tiene (`MISSING`), y cada rama su caso de prueba y su último veredicto.
    La API no devuelve cuerpos ni cabeceras de los casos.
    ========================================================================== */

export type FlowNodeKind = 'SCREEN' | 'API_CALL' | 'DECISION' | 'OUTCOME';
/** Vocabulario de `qa_lab`: HAPPY_PATH = válido, EDGE = límite, NEGATIVE = inválido. */
export type FlowBranchKind = 'HAPPY_PATH' | 'EDGE' | 'NEGATIVE';
export type EndpointContract = 'DECLARED' | 'MISSING';
export type FlowCoverage = 'SEEDED' | 'NOT_SEEDED' | 'RAN' | 'NEVER_RAN';

export interface FlowsQuery {
  readonly module?: string;
  readonly search?: string;
  readonly coverage?: FlowCoverage;
}

export interface FlowSource {
  readonly document: string;
  readonly section: string;
}

export interface FlowCounts {
  readonly nodes: number;
  readonly apiCalls: number;
  readonly gaps: number;
  readonly branches: Readonly<Record<FlowBranchKind, number>>;
  readonly withCase: number;
  readonly withoutCase: number;
}

export interface FlowContractSummary {
  readonly endpoints: number;
  readonly declared: number;
  readonly missing: number;
  readonly gaps: number;
}

export interface FlowLastRun {
  readonly id: string;
  readonly runNumber: string;
  readonly status: string | null;
  readonly finishedAt: string | null;
}

export interface FlowQaSummary {
  readonly suiteCode: string;
  readonly suiteId: string | null;
  readonly seeded: boolean;
  readonly casesExpected: number;
  readonly casesLinked: number;
  readonly casesMissing: number;
  readonly branchesNotRunnable: number;
  readonly passed: number;
  readonly failed: number;
  readonly lastRun: FlowLastRun | null;
}

export interface FlowSummary {
  readonly id: string;
  readonly module: string;
  readonly title: string;
  readonly source: FlowSource;
  readonly actors: readonly string[];
  readonly frontRoutes: readonly string[];
  readonly counts: FlowCounts;
  readonly contract: FlowContractSummary;
  readonly qa: FlowQaSummary;
}

export interface FlowsPage {
  readonly items: readonly FlowSummary[];
  readonly modules: readonly string[];
}

export interface BranchResult {
  readonly runId: string;
  readonly runNumber: string;
  /** Código de concepto: `RESULT_PASSED`, `RESULT_FAILED`… */
  readonly status: string | null;
  /** Estado HTTP que la API devolvió en esa corrida. */
  readonly observedStatus: number | null;
  readonly message: string | null;
  readonly finishedAt: string | null;
}

export interface BranchQaCase {
  readonly code: string;
  readonly method: string;
  readonly path: string;
  readonly expectedStatus: number;
  /** Día en que el estado esperado se observó contra una API real. */
  readonly observedOn: string;
  /** `true` si el caso existe en `qa_lab` y está activo. */
  readonly seeded: boolean;
  readonly caseId: string | null;
  /** `true` si lo sembrado ya no coincide con el artefacto: hay que volver a sembrar. */
  readonly drifted: boolean;
  readonly lastResult: BranchResult | null;
}

export interface FlowBranch {
  readonly kind: FlowBranchKind;
  readonly condition: string;
  readonly expected: string;
  readonly next: string | null;
  readonly loopsTo: string | null;
  /** Por qué no hay caso de prueba; presente cuando `qaCase` es `null`. */
  readonly reason: string | null;
  readonly qaCase: BranchQaCase | null;
}

export interface FlowEndpoint {
  readonly method: string;
  readonly path: string;
  readonly operationId: string | null;
  readonly contract: EndpointContract;
}

export interface FlowNode {
  readonly id: string;
  readonly parentId: string | null;
  readonly kind: FlowNodeKind;
  readonly title: string;
  readonly actor: string;
  readonly uiRoute: string | null;
  readonly endpoint: FlowEndpoint | null;
  /** Lo que la fuente pide y el contrato no tiene. */
  readonly gap: string | null;
  readonly effects: readonly string[];
  readonly sourceRef: string;
  readonly branches: readonly FlowBranch[];
}

export interface FlowDetail {
  readonly id: string;
  readonly module: string;
  readonly title: string;
  readonly source: FlowSource;
  readonly actors: readonly string[];
  readonly frontRoutes: readonly string[];
  readonly root: string;
  readonly openQuestions: readonly string[];
  readonly counts: FlowCounts;
  readonly contract: FlowContractSummary;
  readonly qa: FlowQaSummary;
  /** En orden de recorrido (profundidad primero). */
  readonly nodes: readonly FlowNode[];
}
