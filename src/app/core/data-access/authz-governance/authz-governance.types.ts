/* ============================================================================
    Gobierno de acceso de la consola (API: `/authz`, todo `SECURITY_ADMIN`).

    Edición de permisos por rol, permisos por campo y por alcance de recurso, la
    simulación de una decisión del PDP, el ciclo de vida de las cuentas internas
    y la revisión periódica de accesos. La autoridad es la API: esta capa
    transporta lo que responde, incluido el `reason` de un rechazo.
    ========================================================================== */

export type PermissionEffectInput = 'ALLOW' | 'DENY';
export type PermissionScopeInput = 'SELF' | 'BRANCH' | 'TENANT' | 'GLOBAL';

export const PERMISSION_SCOPES: readonly PermissionScopeInput[] = ['SELF', 'BRANCH', 'TENANT', 'GLOBAL'];
export const PERMISSION_ACTIONS = ['READ', 'WRITE', 'CREATE', 'DELETE', 'EXECUTE', 'APPROVE'] as const;
export type PermissionActionInput = (typeof PERMISSION_ACTIONS)[number];

/** Un permiso de un rol, como lo manda `PUT /authz/roles/:id/permissions`. */
export interface RolePermissionBinding {
  readonly permissionId: string;
  readonly effect: PermissionEffectInput;
  readonly scope?: PermissionScopeInput;
}

export interface SetRolePermissionsInput {
  /** Reemplaza todos los permisos activos del rol (la API exige al menos uno). */
  readonly permissions: readonly RolePermissionBinding[];
}

export interface RoleSaved {
  readonly id: string;
  readonly code: string;
  readonly status: string;
  readonly permissionCount: number;
}

/* ---- permisos por campo -------------------------------------------------- */

export type MaskStrategy = 'REDACT' | 'HASH' | 'PARTIAL' | 'NULLIFY';
export const MASK_STRATEGIES: readonly MaskStrategy[] = ['REDACT', 'HASH', 'PARTIAL', 'NULLIFY'];

export interface FieldPermission {
  readonly entity: string;
  readonly columnName: string;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly maskStrategy: MaskStrategy | string | null;
  readonly conditionJson: Readonly<Record<string, unknown>> | null;
}

export interface RoleFieldPermissions {
  readonly roleId: string;
  readonly items: readonly FieldPermission[];
}

export interface FieldPermissionInput {
  readonly entity: string;
  readonly columnName: string;
  readonly canRead: boolean;
  readonly canWrite: boolean;
  readonly maskStrategy?: MaskStrategy;
}

/* ---- alcance de recurso -------------------------------------------------- */

export type ScopeSubjectType = 'USER' | 'ROLE' | 'SERVICE';
export type ScopeResourceType = 'PATIENT' | 'ENCOUNTER' | 'DOCUMENT' | 'RECORD';
export const SCOPE_SUBJECT_TYPES: readonly ScopeSubjectType[] = ['USER', 'ROLE', 'SERVICE'];
export const SCOPE_RESOURCE_TYPES: readonly ScopeResourceType[] = ['PATIENT', 'ENCOUNTER', 'DOCUMENT', 'RECORD'];

export interface ResourceScopeGrantsQuery {
  readonly subjectId?: string;
  readonly resourceId?: string;
  readonly permissionId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface ResourceScopeGrant {
  readonly id: string;
  readonly subjectId: string;
  readonly permissionId: string;
  readonly resourceId: string;
  readonly tenantId: string | null;
  readonly subjectType: ScopeSubjectType | 'OTHER' | string;
  readonly resourceType: ScopeResourceType | 'OTHER' | string;
  readonly effect: PermissionEffectInput | 'OTHER' | string;
  readonly validFrom?: Date;
  readonly validTo?: Date;
  /** Vigente en el instante de la consulta. */
  readonly isEffective: boolean;
  readonly createdAt: Date;
}

export interface ResourceScopeGrantInput {
  readonly subjectType: ScopeSubjectType;
  readonly subjectId: string;
  readonly permissionId: string;
  readonly resourceType: ScopeResourceType;
  readonly resourceId: string;
  readonly effect: PermissionEffectInput;
  readonly tenantId?: string;
  readonly validFrom?: string;
  readonly validTo?: string;
}

export interface EndedResourceScopeGrant {
  readonly id: string;
  readonly validTo: Date;
}

/* ---- simulación del PDP -------------------------------------------------- */

export type DecisionPurpose = 'TREATMENT' | 'PAYMENT' | 'OPERATIONS' | 'EMERGENCY';
export const DECISION_PURPOSES: readonly DecisionPurpose[] = ['TREATMENT', 'PAYMENT', 'OPERATIONS', 'EMERGENCY'];

export interface DecisionRequest {
  readonly userId: string;
  readonly tenantId: string;
  readonly action: PermissionActionInput;
  readonly resource: string;
  readonly resourceType?: ScopeResourceType;
  readonly resourceId?: string;
  readonly patientProfileId?: string;
  readonly practitionerProfileId?: string;
  readonly purposeOfUse?: DecisionPurpose;
}

export interface MaskedField {
  readonly entity: string;
  readonly columnName: string;
  readonly strategy: string;
}

/** La decisión tal como la devuelve `POST /authz/decisions/evaluate`. */
export interface DecisionResult {
  readonly decision: 'PERMIT' | 'DENY';
  readonly reason: string;
  readonly effectiveRoleIds: readonly string[];
  readonly maskedFields: readonly MaskedField[];
  readonly purposeOfUse?: string;
  readonly cacheKey: string;
  readonly ttlSeconds: number;
}

/* ---- ciclo de vida ------------------------------------------------------- */

export type UserLifecycleState = 'ACTIVE' | 'SUSPENDED' | 'OFFBOARDED' | 'LOCKED_OTHER' | 'ANONYMIZED' | 'OTHER';
export type LifecycleAction = 'suspend' | 'reactivate' | 'offboard';

export interface LifecycleEvent {
  readonly id: string;
  readonly kind: 'SUSPENDED' | 'REACTIVATED' | 'OFFBOARDED' | string;
  readonly reason: string;
  readonly actorUserId: string | null;
  readonly recordedAt: Date;
}

export interface UserLifecycle {
  readonly userId: string;
  readonly state: UserLifecycleState | string;
  readonly history: readonly LifecycleEvent[];
}

export interface LifecycleResult {
  readonly userId: string;
  readonly state: UserLifecycleState | string;
  readonly revokedAssignments: number;
  readonly note: string;
}

/** Largo mínimo del motivo que acepta la API en toda acción de gobierno. */
export const GOVERNANCE_REASON_MIN = 10;
export const GOVERNANCE_REASON_MAX = 500;

/* ---- revisión de accesos ------------------------------------------------- */

export type AccessReviewDecision = 'CERTIFIED' | 'CHANGES_REQUIRED';

export interface AccessReview {
  readonly id: string;
  readonly userId: string;
  readonly decision: AccessReviewDecision | string;
  readonly reason: string;
  readonly assignmentIds: readonly string[];
  readonly reviewerUserId: string | null;
  readonly reviewedAt: Date;
}

export interface UserAccessReviews {
  readonly userId: string;
  readonly items: readonly AccessReview[];
}

export interface RecordAccessReviewInput {
  readonly decision: AccessReviewDecision;
  readonly reason: string;
  readonly assignmentIds: readonly string[];
}

export interface AccessReviewDue {
  readonly userId: string;
  readonly displayName: string;
  readonly activeAssignments: number;
  readonly lastReviewedAt?: Date;
}

export interface AccessReviewDuePage {
  readonly items: readonly AccessReviewDue[];
  readonly olderThanDays: number | null;
}

/**
 * Motivos estables con que la API rechaza estas operaciones
 * (`authz-governance.error-reasons.ts` en la API). Se ramifica por ellos.
 */
export const GOVERNANCE_REASONS = [
  'USER_LIFECYCLE_USER_NOT_FOUND',
  'USER_LIFECYCLE_NOT_ACTIVE',
  'USER_LIFECYCLE_NOT_SUSPENDED',
  'USER_LIFECYCLE_ANONYMIZED',
  'USER_LIFECYCLE_ALREADY_OFFBOARDED',
  'USER_LIFECYCLE_SELF_ACTION',
  'ACCESS_REVIEW_USER_NOT_FOUND',
  'ACCESS_REVIEW_SELF_REVIEW',
  'ACCESS_REVIEW_ASSIGNMENT_MISMATCH',
  'RESOURCE_SCOPE_GRANT_NOT_FOUND',
  'RESOURCE_SCOPE_GRANT_ALREADY_ENDED',
  'ROLE_NOT_FOUND',
  'ROLE_PERMISSION_NOT_FOUND',
  'ROLE_FIELD_PERMISSION_WRITE_REQUIRES_READ',
] as const;
export type GovernanceReason = (typeof GOVERNANCE_REASONS)[number];
