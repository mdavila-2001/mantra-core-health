import type {
  ActionConditions,
  ApproverKind,
  FieldMask,
  SupportCondition,
} from './conditions.types';
import type {
  AtomApprovalMode,
  AtomCategoryCode,
  AtomLegalBasis,
  AtomPurpose,
  AtomSensitivity,
  DecisionObligations,
  GrantEffect,
  GrantOrigin,
  SupportAccessDecisionView,
  SupportAtom,
} from '../support-access/support-access.types';
import type { SupportActionInput } from '../support-access/support-atom-grants.types';

/* ============================================================================
    Explicar, simular y catálogo (CONTRATO-GOBIERNO §5, §8.3 bloque A).

    La autoridad es la API: `explain` evalúa lo guardado, `simulate` evalúa un borrador sin
    guardarlo. El front no replica la semántica de las condiciones; solo pinta la
    respuesta. Formas tomadas de `access-explain.dto.ts` y del §5.2/§5.3.
   ========================================================================== */

/* ---- traza de una decisión ---------------------------------------------------- */

export type PolicyTraceLayer =
  | 'ENGAGEMENT'
  | 'GUARDRAIL'
  | 'ORG_RULE'
  | 'EXPLICIT_DENY'
  | 'GRANT_COVERAGE'
  | 'CONDITION'
  | 'OBLIGATION';

/** Un paso de la evaluación, en el orden real. `message` ya viene en lenguaje simple y de usted. */
export interface PolicyTraceStep {
  readonly order: number;
  readonly layer: PolicyTraceLayer;
  readonly passed: boolean;
  readonly code: string;
  readonly message: string;
  readonly grantId?: string;
  readonly ruleId?: string;
  readonly atom?: string;
  readonly conditionPath?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** Qué puede hacer la propia persona para pasar (`missing`). */
export type MissingFix =
  | { readonly type: 'REQUEST_APPROVAL'; readonly approverKind: ApproverKind }
  | { readonly type: 'PROVIDE_REASON'; readonly minLength: number }
  | { readonly type: 'STEP_UP' }
  | { readonly type: 'WAIT'; readonly until?: string }
  | { readonly type: 'USE_ORG_NETWORK' }
  | { readonly type: string; readonly [key: string]: unknown };

export interface ExplainMissing {
  readonly kind: 'APPROVAL' | 'REASON' | 'STEP_UP' | 'WAIT' | 'NETWORK' | 'DEVICE' | string;
  readonly by?: ApproverKind;
  readonly message: string;
  readonly fix: MissingFix;
}

/** Qué puede cambiar un administrador (`adminFixes`). */
export interface ExplainAdminFix {
  readonly type: 'ADD_ATOM' | 'WIDEN_COVERAGE' | 'RELAX_CONDITION' | 'ACCEPT_DOCTOR' | string;
  readonly grantId?: string;
  readonly conditionPath?: string;
  readonly message: string;
}

export interface ExplainUsage {
  readonly key: string;
  readonly used: number;
  readonly max: number;
  readonly resetsAt?: string;
}

/** «¿Y si…?»: cada bandera reemplaza el atributo real solo en este cálculo. */
export interface ExplainAssume {
  readonly stepUpFresh?: boolean;
  readonly doctorOnline?: boolean;
  readonly reasonProvided?: boolean;
  readonly approvalGranted?: boolean;
  readonly forceFull?: boolean;
}

/** Entrada de `POST /org/access/explain`: `engagementId` o `userId` (uno de los dos). */
export interface ExplainAccessRequest {
  readonly engagementId?: string;
  readonly userId?: string;
  readonly action: SupportActionInput;
  readonly practitionerRoleAssignmentId?: string | null;
  readonly healthcareServiceId?: string | null;
  readonly careSpaceId?: string | null;
  readonly patientProfileId?: string;
  readonly appointmentStartAt?: string;
  readonly at?: string;
  readonly assume?: ExplainAssume;
}

/** `POST /me/support-access/explain`: lo mismo sin `userId`/`engagementId`, y con la organización. */
export interface ExplainMyAccessRequest extends Omit<
  ExplainAccessRequest,
  'engagementId' | 'userId'
> {
  readonly tenantId: string;
}

/** `POST /me/practitioner/support-team/explain`: el doctor, sobre alguien de su equipo y de su agenda. */
export type ExplainTeamAccessRequest = ExplainAccessRequest;

export interface ExplainAccessResponse {
  readonly decision: SupportAccessDecisionView;
  readonly summary: string;
  readonly decidedBy: {
    readonly layer: PolicyTraceLayer;
    readonly step: number;
    readonly grantId?: string;
    readonly atom?: string;
    readonly conditionPath?: string;
  };
  readonly reasons: readonly PolicyTraceStep[];
  readonly missing: readonly ExplainMissing[];
  /** Ausente en el autoservicio: ahí viene `askAdmin`. */
  readonly adminFixes?: readonly ExplainAdminFix[];
  /** Autoservicio: «Pida a su administrador que …». */
  readonly askAdmin?: string;
  readonly tenantId?: string;
  readonly obligations: DecisionObligations;
  readonly visibleFields: Readonly<Record<string, FieldMask>>;
  readonly usage?: readonly ExplainUsage[];
  readonly evaluatedAt: string;
  readonly correlationId?: string;
}

/* ---- simular ------------------------------------------------------------------ */

export interface SimulationScenario {
  /** Obligatorio en la API real (`SimulationScenarioDto.label`, máx. 120): sin él es 400. */
  readonly label: string;
  readonly action: SupportActionInput;
  readonly practitionerRoleAssignmentId?: string | null;
  readonly healthcareServiceId?: string | null;
  readonly careSpaceId?: string | null;
  readonly patientProfileId?: string;
  readonly appointmentStartAt?: string;
  readonly at?: string;
  /** `minorUnits` es obligatorio en la API real (`SimulationMoneyDto`). */
  readonly amount?: {
    readonly currency: 'BOB';
    readonly minorUnits: number;
    readonly discountPercent?: number;
  };
}

/** Un permiso del borrador: con `id` reemplaza esa concesión; sin `id` es nuevo. */
export interface SimulationDraftGrant {
  readonly id?: string;
  readonly effect: GrantEffect;
  readonly actions: readonly SupportActionInput[];
  readonly condition?: SupportCondition;
  readonly actionConditions?: ActionConditions;
  /** Tipo de objetivo (`PRACTITIONER`, `ALL_SERVICES`, …). Si falta, el servidor lo infiere de las referencias, y `ALL_*` se confunde con `ALL`: la huella de guardado no coincidiría. */
  readonly targetKind?: string;
  readonly practitionerRoleAssignmentId?: string;
  readonly healthcareServiceId?: string;
  readonly careSpaceId?: string;
  readonly practiceSiteId?: string;
  readonly expansionMode?: 'DYNAMIC' | 'FIXED';
  readonly validTo?: string;
}

export interface SimulationDraft {
  /** `PATCH` mezcla con lo actual; `REPLACE` es el conjunto entero. */
  readonly mode: 'PATCH' | 'REPLACE';
  /** Simula el cambio de plantilla (mover). */
  readonly templateCode?: string | null;
  readonly grants: readonly SimulationDraftGrant[];
  readonly removeGrantIds?: readonly string[];
}

/**
 * `POST /org/access/simulate`. A diferencia de `explain`, la API real exige `engagementId` y **rechaza `userId`**
 * (`SimulateAccessDto`: 400 «property userId should not exist»): se comprobó contra la API del piloto (B7c).
 */
export interface SimulateAccessRequest {
  readonly engagementId: string;
  readonly draft: SimulationDraft;
  readonly scenarios?: readonly SimulationScenario[];
  /** Por omisión `true`: el servidor agrega hasta 200 escenarios representativos. */
  readonly autoScenarios?: boolean;
}

export interface ValidationIssue {
  /** `GUARDRAIL_CEILING_EXCEEDED`, `CONDITION_UNKNOWN_KEY`, `SOD_WARN`, … */
  readonly code: string;
  /** Ruta al control del editor: `grants[0].actions[3]`. */
  readonly path: string;
  readonly message: string;
}

export interface SodFindingPreview {
  readonly ruleCode: string;
  readonly action: 'BLOCK' | 'REQUIRE_APPROVAL' | 'WARN';
  readonly atoms: readonly string[];
  readonly message: string;
}

/** Lo que devuelve la API real (`support-explain.ts`, comprobado en B7c): no existe `CHANGED`, y `NEWLY_PERMITTED` del contrato es `NEWLY_ALLOWED`. */
export type ScenarioChange = 'SAME' | 'NEWLY_ALLOWED' | 'NEWLY_DENIED' | 'NEWLY_CHALLENGED';

export interface SimulationScenarioResult {
  readonly label?: string;
  readonly change: ScenarioChange;
  readonly before: SupportAccessDecisionView;
  readonly after: SupportAccessDecisionView;
}

export interface SimulateAccessResponse {
  /** `false` si hay cualquier error: la pantalla no deja guardar. */
  readonly valid: boolean;
  readonly validation: {
    readonly errors: readonly ValidationIssue[];
    readonly warnings: readonly ValidationIssue[];
  };
  readonly governance: {
    readonly sodFindings: readonly SodFindingPreview[];
    readonly needsFourEyes: { readonly required: boolean; readonly reasons: readonly string[] };
    readonly privilegeScore: {
      readonly before: number;
      readonly after: number;
      readonly delta: number;
    };
  };
  readonly summary: { readonly plain: readonly string[]; readonly changes: readonly string[] };
  readonly scenarios: readonly SimulationScenarioResult[];
  readonly impact: {
    readonly newlyAllowed: number;
    readonly newlyDenied: number;
    readonly unchanged: number;
    readonly challengesNew: number;
    readonly doctorsCovered: { readonly before: number; readonly after: number };
    readonly servicesCovered: { readonly before: number; readonly after: number };
    readonly spacesCovered: { readonly before: number; readonly after: number };
    readonly effectiveAtoms: {
      readonly added: readonly string[];
      readonly removed: readonly string[];
    };
  };
  /** Huella opaca (10 min) del borrador validado: se envía al guardar. */
  readonly simulationToken?: string;
  readonly limits?: { readonly scenarioCount: number; readonly truncated: boolean };
  readonly evaluatedAt: string;
}

/* ---- catálogo, resumen y efectivo ---------------------------------------------- */

export interface PermissionAtomView {
  readonly code: SupportAtom | string;
  readonly name: string;
  readonly category: AtomCategoryCode | string;
  readonly sensitivity: AtomSensitivity;
  readonly requiresReason: boolean;
  readonly requiresStepUp: boolean;
  readonly approvalMode: AtomApprovalMode | null;
  readonly purposeOfUse: AtomPurpose;
  readonly legalBasis: AtomLegalBasis;
  readonly touchesClinicalData: boolean;
  readonly isFieldLevel: boolean;
  readonly supportAssignable: boolean;
  readonly isDangerous: boolean;
}

export interface PermissionCategoryView {
  readonly code: AtomCategoryCode | string;
  readonly name: string;
}

export interface LegacyAliasView {
  readonly code: string;
  readonly atoms: readonly string[];
  readonly primary: string;
}

/** `GET /org/permission-catalog`: 73 átomos, 7 categorías y los 15 alias. */
export interface PermissionCatalog {
  readonly atoms: readonly PermissionAtomView[];
  readonly categories: readonly PermissionCategoryView[];
  readonly aliases: readonly LegacyAliasView[];
}

export interface GrantSummaryView {
  readonly grantId: string;
  readonly effect: GrantEffect;
  readonly targetKind: string;
  readonly summary: string;
  readonly atoms: readonly string[];
}

/** `GET /org/support-engagements/:id/summary`: lo que la persona puede hacer, en oraciones. */
export interface EngagementSummary {
  readonly engagementId: string;
  readonly grants: readonly GrantSummaryView[];
  readonly plain: readonly string[];
}

export interface EffectiveAtomView {
  readonly atom: string;
  readonly name: string;
  readonly sensitivity: AtomSensitivity;
  readonly origin: GrantOrigin;
  readonly grantIds: readonly string[];
  readonly conditional: boolean;
}

/** `GET /org/support-engagements/:id/effective`: átomos efectivos, condiciones y origen. */
export interface EngagementEffective {
  readonly engagementId: string;
  readonly atoms: readonly EffectiveAtomView[];
  readonly denied: readonly { readonly atom: string; readonly grantId: string }[];
}
