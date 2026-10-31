/* Ver `access-governance.types.ts` (barril) para el contexto: formas tomadas del código de la API. */
import type { ApproverKind, SupportCondition } from './conditions.types';
import type { AtomSensitivity } from '../support-access/support-atoms';

/* ---- cuatro ojos (aprobaciones) ---------------------------------------------------- */

export type ApprovalStatus =
  'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED' | 'CONSUMED' | string;
export type ApprovalKind =
  'ACTION' | 'GRANT_CHANGE' | 'SOD_EXCEPTION' | 'ENGAGEMENT_MOVE' | 'REACTIVATION' | string;

/** Un permiso de un cambio de permisos, con su nombre y si es crítico (`GrantChangeAtomViewDto`). */
export interface GrantChangeAtomView {
  readonly code: string;
  readonly name: string;
  /** Sensibilidad CRÍTICA (cuatro ojos). */
  readonly critical: boolean;
}

/** A quién o a qué alcanza el permiso, por nombre (`GrantChangeTargetViewDto`). */
export interface GrantChangeTargetView {
  readonly kind:
    | 'PRACTITIONER'
    | 'SERVICE'
    | 'LOCATION'
    | 'PRACTITIONER_SERVICE'
    | 'PRACTITIONER_LOCATION'
    | 'SERVICE_LOCATION'
    | 'ALL_PRACTITIONERS'
    | 'ALL_SERVICES'
    | 'ALL_LOCATIONS'
    | 'ALL'
    | string;
  readonly expansionMode: 'DYNAMIC' | 'FIXED';
  readonly practitionerName?: string;
  readonly serviceName?: string;
  readonly locationName?: string;
}

/**
 * El permiso completo que se otorgaría al aprobar (`GrantChangeDetailsDto`). Solo viene en `GET /approvals/pending`
 * y solo para `GRANT_CHANGE`.
 */
export interface GrantChangeDetails {
  readonly op: 'ADD' | 'UPDATE';
  /** Por qué pide aprobación: `NEW_CRITICAL_ATOMS`, `SCOPE_WIDENED` o `VALIDITY_EXTENDED`. */
  readonly reasons: readonly string[];
  /** Todos los permisos del cambio, con los críticos marcados. */
  readonly atoms: readonly GrantChangeAtomView[];
  readonly criticalAtoms: readonly GrantChangeAtomView[];
  readonly target: GrantChangeTargetView;
  readonly validFrom?: string;
  /** Ausente = sin fin de vigencia. */
  readonly validTo?: string;
  /** Condiciones en lenguaje simple; vacío = sin condiciones. */
  readonly conditions: readonly string[];
  /** Solo en `UPDATE`: qué campos cambia (`actions`, `validTo`, `expansionMode`, `condition`, `actionConditions`). */
  readonly changes?: readonly string[];
}

export interface SupportApproval {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: ApprovalKind;
  readonly status: ApprovalStatus;
  readonly approverKind: ApproverKind | string;
  readonly atom?: string;
  readonly requesterUserId?: string;
  readonly subjectUserId?: string;
  readonly reasonText?: string;
  readonly decisionComment?: string;
  readonly createdAt: string;
  readonly expiresAt: string;
  /** Hasta cuándo vale la aprobación ya dada. */
  readonly approvedUntil?: string;
  readonly decidedAt?: string;
  readonly consumedAt?: string;
  /** Qué se pide y qué pasa si se aprueba, en lenguaje simple. */
  readonly summary: string;
  /** Solo en `GET /approvals/pending` y solo para `GRANT_CHANGE`: el permiso completo que se otorgaría al aprobar. */
  readonly details?: GrantChangeDetails;
}

export interface SupportApprovalList {
  readonly items: readonly SupportApproval[];
  readonly count: number;
  /** `GET /approvals/pending` pagina: con `nextCursor` hay otra página. */
  readonly nextCursor?: string | null;
}

/** La persona de apoyo pide aprobación para una acción concreta (`POST /me/support-approvals`). */
export interface NewSupportApproval {
  readonly tenantId: string;
  readonly atom: string;
  readonly practitionerRoleAssignmentId?: string;
  readonly healthcareServiceId?: string;
  readonly careSpaceId?: string;
  readonly patientProfileId?: string;
  readonly appointmentStartAt?: string;
  readonly reasonText: string;
}

export interface ApprovalDecision {
  readonly decision: 'APPROVE' | 'REJECT';
  /** Obligatorio al rechazar. */
  readonly comment?: string;
}

export interface ApprovalDecisionResult {
  readonly approval: SupportApproval;
  readonly execution?: Readonly<Record<string, unknown>>;
}

/* ---- campañas de certificación ----------------------------------------------------- */

export const REVIEW_KINDS = [
  'PERIODIC',
  'RECERTIFICATION',
  'MOVER',
  'TARGETED',
  'REMEDIATION',
] as const;
export type ReviewKind = (typeof REVIEW_KINDS)[number];
export const REVIEW_KIND_LABELS: Readonly<Record<ReviewKind, string>> = {
  PERIODIC: 'Periódica',
  RECERTIFICATION: 'Recertificación',
  MOVER: 'Cambio de rol',
  TARGETED: 'Dirigida',
  REMEDIATION: 'Remediación',
};
export type CampaignScopeKind =
  'ORGANIZATION' | 'PRACTITIONER' | 'SERVICE' | 'LOCATION' | 'TEMPLATE';
export type CampaignStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'CANCELLED';
export type UncertifiedAction = 'UNCERTIFIED_REVOKE' | 'UNCERTIFIED_ESCALATE';
export type ReviewDecisionKind = 'CERTIFY' | 'REVOKE' | 'ADJUST';
/** Los estados de un ítem tal como los devuelve la API (`ITEM_STATE_BY_CONCEPT`): lo escalado al cierre queda `SKIPPED`, no `ESCALATED`. */
export type ReviewItemState =
  'PENDING' | 'CERTIFIED' | 'REVOKED' | 'ADJUSTED' | 'AUTO_REVOKED' | 'SKIPPED' | string;
/** Quién revisa, tal como lo devuelve la API: el responsable de la cuenta es `SUPERVISOR` (no existe `ACCOUNT_OWNER`). */
export type ReviewerKind = 'ADMIN' | 'DOCTOR_OWNER' | 'SERVICE_HEAD' | 'SUPERVISOR' | string;

export interface CampaignScope {
  readonly kind: CampaignScopeKind;
  readonly practitionerRoleAssignmentIds?: readonly string[];
  readonly healthcareServiceIds?: readonly string[];
  readonly careSpaceIds?: readonly string[];
  readonly practiceSiteIds?: readonly string[];
  readonly templateCodes?: readonly string[];
}

export interface CampaignFilters {
  readonly minSensitivity?: AtomSensitivity;
  readonly unusedDays?: number;
  readonly onlyAboveCeiling?: boolean;
  readonly onlySodFindings?: boolean;
  readonly includeSuspended?: boolean;
}

export interface CampaignDraft {
  readonly name: string;
  readonly kind: ReviewKind;
  readonly scope: CampaignScope;
  readonly filters?: CampaignFilters;
  readonly dueAt: string;
  readonly graceDays?: number;
  readonly reminderDaysBefore?: readonly number[];
  readonly escalateAfterDays?: number;
  readonly uncertifiedAction?: UncertifiedAction;
}

export type NewCampaign = CampaignDraft;

/** `POST /org/access-reviews/campaigns` contesta solo el id (`ResourceCreatedDto`); el detalle se pide con `GET …/:id`. */
export interface CreatedCampaign {
  readonly id: string;
}
export type CampaignChange = Partial<CampaignDraft>;

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly kind: ReviewKind;
  readonly status: CampaignStatus;
  readonly scope: CampaignScope;
  readonly filters?: CampaignFilters;
  readonly dueAt: string;
  readonly graceDays: number;
  readonly reminderDaysBefore: readonly number[];
  readonly escalateAfterDays: number;
  readonly uncertifiedAction: UncertifiedAction;
  readonly ownerUserId?: string;
  readonly launchedAt?: string;
  readonly closedAt?: string;
  readonly cancelledAt?: string;
}

export interface CampaignList {
  readonly items: readonly Campaign[];
  readonly count: number;
}

export interface CampaignPreviewItem {
  readonly engagementId: string;
  readonly subjectUserId: string;
  readonly grantId?: string;
  readonly reviewerKind: ReviewerKind;
  readonly reviewerUserIds: readonly string[];
  readonly maxSensitivity?: AtomSensitivity;
  readonly suggestRevoke: boolean;
}

export interface CampaignPreview {
  readonly total: number;
  readonly byReviewerKind: Readonly<Record<string, number>>;
  /** Ítems sin revisor elegible (`SOD-GOV-02`). */
  readonly withoutReviewer: number;
  readonly items: readonly CampaignPreviewItem[];
}

export interface LaunchCampaignResult {
  readonly ok: boolean;
  readonly items: number;
  readonly withoutReviewer: number;
}

export interface CloseCampaignResult {
  readonly ok: boolean;
  readonly autoRevoked: number;
  readonly skipped: number;
}

/** La evidencia que ve quien revisa (`evidence_json` mostrado). */
export interface ReviewEvidence {
  readonly schemaVersion?: number;
  readonly kind?: 'ENGAGEMENT';
  readonly generatedAt?: string;
  /** La oración que resume qué puede hacer la persona. */
  readonly summary?: string;
  readonly engagement?: {
    readonly engagementId: string;
    readonly templateCode: string | null;
    readonly state: string;
    readonly createdAt: string;
    readonly nextRecertificationAt: string | null;
    readonly recertifyEveryMonths: number | null;
  };
  readonly grants?: readonly {
    readonly grantId: string;
    readonly atoms: readonly string[];
    readonly validTo: string | null;
  }[];
  readonly atoms?: readonly {
    readonly code: string;
    readonly name: string;
    readonly sensitivity: AtomSensitivity;
  }[];
  readonly usage90d?: readonly {
    readonly atom: string;
    readonly permit: number;
    readonly deny: number;
    readonly lastUsedAt: string | null;
  }[];
  readonly openAlerts?: number;
  readonly sodFindings?: readonly { readonly ruleCode: string; readonly action: string }[];
  readonly aboveCeiling?: boolean;
  readonly lastCertifiedAt?: string | null;
}

export interface ReviewItem {
  readonly id: string;
  readonly campaignId: string;
  readonly campaignName?: string;
  readonly engagementId: string;
  readonly grantId?: string;
  readonly subjectUserId: string;
  readonly subjectName?: string;
  readonly reviewerKind: ReviewerKind;
  readonly state: ReviewItemState;
  readonly dueAt: string;
  readonly decidedAt?: string;
  readonly comment?: string;
  readonly escalated: boolean;
  readonly reminderCount: number;
  readonly maxSensitivity?: AtomSensitivity;
  /** Solo en el detalle (`GET /me/access-reviews/items/:id`). */
  readonly evidence?: ReviewEvidence;
  readonly evidenceHash?: string;
}

export interface ReviewItemList {
  readonly items: readonly ReviewItem[];
  readonly count: number;
}

export interface ReviewAdjustment {
  /** Solo puede **reducir**: ampliar es 422 `REVIEW_ADJUST_CANNOT_BROADEN`. */
  readonly atoms?: readonly string[];
  readonly validTo?: string | null;
  readonly condition?: SupportCondition;
}

export interface ReviewDecision {
  readonly decision: ReviewDecisionKind;
  /** Obligatorio en ALTA y CRÍTICA y al revocar (422 `REVIEW_COMMENT_REQUIRED`). */
  readonly comment?: string;
  readonly adjustment?: ReviewAdjustment;
}

export interface BulkReviewDecision {
  readonly itemIds: readonly string[];
  readonly decision: ReviewDecisionKind;
  readonly comment?: string;
}

export interface ReviewDecisionResult {
  readonly ok: boolean;
  readonly state: ReviewItemState;
}

export interface BulkReviewResult {
  readonly ok: boolean;
  readonly decided: number;
}

export type MyReviewsStatus = 'PENDING' | 'DECIDED' | 'ALL';

export interface CampaignResults {
  readonly total: number;
  readonly byDecision: Readonly<Record<string, number>>;
  readonly byReviewerKind: Readonly<Record<string, number>>;
  readonly bySensitivity: Readonly<Record<string, number>>;
  readonly pending: number;
  readonly coveragePercent: number;
  readonly meanResponseHours: number | null;
  readonly autoRevokedItemIds: readonly string[];
}

/** Archivo exportado (campaña o informe): el contenido viaja como texto con su `sha256`. */
export interface ExportedFile {
  readonly format: 'csv' | 'json';
  readonly kind: string;
  readonly generatedAt: string;
  readonly generatedBy: string;
  readonly filters: Readonly<Record<string, unknown>>;
  readonly rowCount: number;
  readonly sha256: string;
  readonly content: string;
}
