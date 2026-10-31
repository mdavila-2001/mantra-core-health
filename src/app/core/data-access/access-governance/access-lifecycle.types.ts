/* Ver `access-governance.types.ts` (barril) para el contexto: formas tomadas del código de la API. */
import type { SupportCondition } from './conditions.types';
import type { SupportEngagementRequest, SupportRoleTemplateCode, SupportScopeTarget } from '../support-access/support-access.types';
import type { SupportActionInput } from '../support-access/support-atom-grants.types';

/* ---- ciclo de vida ----------------------------------------------------------------------- */

export type LifecycleCaseKind = 'JOINER' | 'MOVER' | 'LEAVER' | 'SUSPENSION' | 'REACTIVATION';
export const LIFECYCLE_KIND_LABELS: Readonly<Record<LifecycleCaseKind, string>> = {
  JOINER: 'Ingreso',
  MOVER: 'Cambio de rol o alcance',
  LEAVER: 'Baja',
  SUSPENSION: 'Suspensión',
  REACTIVATION: 'Reactivación',
};
export type LifecycleCaseStatus = 'OPEN' | 'COMPLETED' | 'CANCELLED';
export type SuspensionReasonCode = 'MANUAL' | 'LEAVE' | 'INVESTIGATION' | 'INACTIVITY';
export type IdentityVerificationMethod = 'IN_PERSON' | 'DOCUMENT_UPLOAD';

export interface LifecycleCaseQuery {
  readonly kind?: LifecycleCaseKind;
  readonly status?: LifecycleCaseStatus;
}

export interface LifecycleCaseSummary {
  readonly id: string;
  readonly kind: LifecycleCaseKind | string;
  readonly status: LifecycleCaseStatus | string;
  readonly engagementId: string;
  readonly subjectUserId: string;
  readonly openedByUserId?: string;
  readonly openedAt: string;
  readonly dueAt?: string;
  readonly completedAt?: string;
}

export interface ChecklistItem {
  readonly code: string;
  readonly label: string;
  readonly required: boolean;
  /** `AUTOMATIC` (lo completa el sistema) o `MANUAL`. */
  readonly completion: string;
  readonly status: string;
  readonly completedAt?: string;
  readonly pendingCount?: number;
}

export interface HandoverItem {
  readonly id: string;
  /** `CONVERSATION`, `TASK`, `PENDING_APPOINTMENT`, `SUPERVISED_ACCOUNT`. */
  readonly kind: string;
  readonly sourceId: string;
  readonly fromUserId: string;
  readonly toUserId?: string;
  readonly status: string;
  readonly reassignedAt?: string;
  readonly reassignedByUserId?: string;
}

export interface LifecycleCaseDetail extends LifecycleCaseSummary {
  readonly reason?: string;
  readonly checklist: readonly ChecklistItem[];
  readonly handover: readonly HandoverItem[];
}

export interface LifecycleCaseList {
  readonly items: readonly LifecycleCaseSummary[];
  readonly count: number;
}

export interface LifecycleCaseExport {
  readonly case: LifecycleCaseDetail;
  readonly exportedAt: string;
  readonly sha256: string;
}

export interface HandoverPreview {
  readonly engagementId: string;
  readonly items: readonly { readonly id: string; readonly kind: string }[];
  readonly counts: Readonly<Record<string, number>>;
}

export interface HandoverItemTarget {
  readonly id: string;
  readonly toUserId: string;
}

export interface Handover {
  readonly defaultToUserId?: string;
  readonly items?: readonly HandoverItemTarget[];
  /** Nuevo dueño de las cuentas que supervisaba (422 `HANDOVER_SUPERVISOR_REQUIRED` si faltan). */
  readonly supervisedTo?: string;
}

export interface OffboardRequest {
  readonly reason: string;
  /** `null`: cortar primero y traspasar después (el caso queda abierto). */
  readonly handover?: Handover | null;
}

export interface OffboardResult {
  readonly ok: boolean;
  readonly engagementId: string;
  readonly revokedAt: string;
  readonly caseId?: string;
  readonly handover: { readonly status: string; readonly pending: number };
}

export interface AssignHandoverResult {
  readonly caseId: string;
  readonly handover: { readonly status: string; readonly pending: number };
}

export interface MoveGrant extends SupportScopeTarget {
  readonly actions: readonly SupportActionInput[];
  readonly effect?: 'ALLOW' | 'DENY';
  readonly condition?: SupportCondition;
  readonly expansionMode?: 'DYNAMIC' | 'FIXED';
  readonly validFrom?: string;
  readonly validTo?: string;
}

export interface MoveEngagementRequest {
  readonly reason: string;
  readonly effectiveAt?: string;
  readonly newTemplateCode?: SupportRoleTemplateCode | string;
  readonly supervisorUserId?: string;
  readonly grants: readonly MoveGrant[];
  readonly simulationToken?: string;
}

/** `200` si se ejecutó o `202` si exige cuatro ojos (`status`, `approvalId`). */
export interface MoveResult {
  readonly status: string;
  readonly approvalId?: string;
  readonly expiresAt?: string;
  readonly scoreBefore: number;
  readonly scoreAfter: number;
  readonly delta: number;
  readonly fourEyesReasons: readonly string[];
  readonly grantIds?: readonly string[];
  readonly revokedGrantIds?: readonly string[];
  readonly campaignId?: string;
  readonly caseId?: string;
}

export interface SuspendRequest {
  readonly reasonCode: SuspensionReasonCode;
  readonly note?: string;
}

export interface ReactivateRequest {
  readonly reason: string;
}

export interface SuspensionResult {
  readonly ok?: boolean;
  readonly status?: string;
  readonly approvalId?: string;
  readonly expiresAt?: string;
  readonly caseId?: string;
}

export interface IdentityVerificationRequest {
  readonly method: IdentityVerificationMethod;
  readonly note?: string;
}

export interface OwnerChange {
  readonly supervisorUserId: string;
  readonly note?: string;
}

export interface ConfidentialityAckResult {
  readonly ok: boolean;
  readonly tenantId: string;
  readonly acknowledgedAt: string;
}

/* ---- administración delegada (/org/team/*) ----------------------------------------------- */

export interface TeamCapabilities {
  /** `FULL` = administrador de seguridad; `DELEGATED` = jefe de servicio o de piso. */
  readonly mode: 'FULL' | 'DELEGATED';
  readonly atoms: readonly string[];
  readonly assignScopes: readonly { readonly target: Readonly<Record<string, unknown>>; readonly ceiling: Readonly<Record<string, unknown>> }[];
}

export interface TeamGrant {
  readonly id: string;
  readonly targetKind: string;
  readonly practitionerRoleAssignmentId?: string;
  readonly healthcareServiceId?: string;
  readonly careSpaceId?: string;
  readonly practiceSiteId?: string;
  readonly atoms: readonly string[];
  readonly validTo?: string;
}

export interface TeamMember {
  readonly engagementId: string;
  readonly userId: string;
  readonly personName?: string;
  readonly roleTemplateCode?: string;
  readonly status: string;
  /** Solo las concesiones dentro del alcance de quien administra. */
  readonly grants: readonly TeamGrant[];
  /** Cuántas funciones quedan fuera de su alcance («otras funciones: 1»). */
  readonly otherFunctions: number;
}

export interface TeamMemberList {
  readonly items: readonly TeamMember[];
  readonly count: number;
}

/** Solicitud con los ítems dentro del alcance de quien administra. */
export type TeamRequest = Omit<SupportEngagementRequest, 'items'> & {
  readonly items: SupportEngagementRequest['items'];
  /** Ítems pendientes fuera de su alcance: los decide el administrador de seguridad. */
  readonly otherItems: number;
};

export interface TeamRequestList {
  readonly items: readonly TeamRequest[];
  readonly count: number;
}

/* ---- paso extra (MFA fresco) -------------------------------------------------------------- */

export interface StepUpRequest {
  /** Código de 6 a 8 dígitos de la app autenticadora. */
  readonly code: string;
}

export interface StepUpResult {
  readonly verifiedAt: string;
  readonly validForMinutes: number;
}

export interface StepUpStatus {
  readonly fresh: boolean;
  readonly ageMinutes: number | null;
}
