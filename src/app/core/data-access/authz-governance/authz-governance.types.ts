/* ============================================================================
    Gobierno de acceso de la consola (API: `/authz`, todo `SECURITY_ADMIN`).

    Edición de permisos por rol, permisos por campo y por alcance de recurso, la
    simulación de una decisión del PDP, «quién puede qué», el ciclo de vida de las
    cuentas internas (`/iam/users/:id/...`) y la revisión periódica de accesos.
    La autoridad es la API: esta capa transporta lo que responde, incluido el
    `reason` de un rechazo.

    Contrato REAL (API `dev` + extensión de gobierno):
    - ciclo de vida: `/iam/users/:id/{suspend,reactivate,deactivate}` y
      `GET /iam/users/:id/lifecycle` — sólo administrador de plataforma;
    - «quién puede qué», revisiones y simulador: `/authz/users/:id/access-map`,
      `/authz/permissions/:id/holders`, `/authz/access-reviews[/due]`,
      `/authz/users/:id/access-reviews`, `/authz/simulations` — sólo administrador
      de plataforma;
    - permisos por campo de un rol y permisos por alcance (listado y término):
      admiten al administrador con alcance de organización (la API acota).
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

/** La decisión del PDP real, tal como la devuelve `POST /authz/simulations` dentro de `decision`. */
export interface DecisionResult {
  readonly decision: 'PERMIT' | 'DENY';
  readonly reason: string;
  readonly effectiveRoleIds: readonly string[];
  readonly maskedFields: readonly MaskedField[];
  readonly purposeOfUse?: string;
  readonly cacheKey: string;
  readonly ttlSeconds: number;
}

/** `POST /authz/simulations`: la decisión del PDP real y la marca de que nada se aplicó. */
export interface SimulationResult {
  readonly simulated: true;
  readonly decision: DecisionResult;
}

/* ---- ciclo de vida (iam) ------------------------------------------------- */

/** Estado de la cuenta: `/iam/users/:id/lifecycle`. */
export type UserLifecycleState = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'ANONYMIZED';
/** Segmento de ruta de la acción: `/iam/users/:id/<acción>`. */
export type LifecycleAction = 'suspend' | 'reactivate' | 'deactivate';
export type LifecycleEventAction = 'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE';

export interface LifecycleEvent {
  readonly id: string;
  readonly action: LifecycleEventAction | string;
  readonly reason: string | null;
  readonly recordedByUserId: string | null;
  readonly recordedAt: Date;
}

export interface UserLifecycleQuery {
  /** 1..100 (20 por defecto). */
  readonly limit?: number;
  readonly cursor?: string;
}

/** La historia va de la más reciente a la más antigua, paginada por cursor. */
export interface UserLifecycle {
  readonly userId: string;
  readonly state: UserLifecycleState | string;
  readonly items: readonly LifecycleEvent[];
  readonly nextCursor: string | null;
  readonly limit: number;
}

export interface LifecycleResult {
  readonly id: string;
  readonly state: UserLifecycleState | string;
  /** `false`: la cuenta ya estaba en ese estado y no se escribió nada. */
  readonly changed: boolean;
  readonly revokedSessions: number;
}

/** Tope del motivo de una acción de ciclo de vida. La API lo exige (no vacío). */
export const LIFECYCLE_REASON_MAX = 500;
/** Largo mínimo del motivo al terminar un permiso por alcance de efecto DENY. */
export const GOVERNANCE_REASON_MIN = 10;
export const GOVERNANCE_REASON_MAX = 500;

/* ---- «quién puede qué» ---------------------------------------------------- */

export type AccountStatus = 'ACTIVE' | 'LOCKED' | 'ANONYMIZED' | 'OTHER';
export type HolderSourceKind = 'ROLE' | 'USER' | 'RESOURCE';
export const HOLDER_SOURCES: readonly HolderSourceKind[] = ['ROLE', 'USER', 'RESOURCE'];

export interface HoldersQuery {
  readonly source?: HolderSourceKind;
  /** Texto a buscar en el nombre visible. */
  readonly q?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

/** Un camino por el que una persona tiene (o se le niega) un permiso. */
export interface HolderSource {
  readonly source: HolderSourceKind | string;
  readonly effect: 'ALLOW' | 'DENY' | 'OTHER' | string;
  /** `ROLE`: el rol que tiene asignado. */
  readonly roleCode: string | null;
  /** `ROLE`: el rol que define el permiso (distinto del asignado si lo hereda de un padre). */
  readonly viaRoleCode: string | null;
  readonly resourceId: string | null;
  readonly tenantId: string | null;
}

export interface PermissionHolder {
  readonly userId: string;
  readonly displayName: string;
  readonly accountStatus: AccountStatus | string;
  readonly sources: readonly HolderSource[];
}

export interface PermissionHoldersPage {
  readonly permissionId: string;
  readonly items: readonly PermissionHolder[];
  readonly nextCursor: string | null;
  readonly limit: number;
}

/** Una asignación de rol del mapa de accesos (la misma forma que `GET /authz/users/:id/role-assignments`). */
export interface AccessMapAssignment {
  readonly id: string;
  readonly roleId: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly roleScope: string | null;
  readonly tenantId: string | null;
  readonly branchId: string | null;
  readonly practiceId: string | null;
  readonly status: string;
  readonly validFrom?: Date;
  readonly validTo?: Date;
  readonly isEffective: boolean;
  readonly appliesGlobally: boolean;
}

export interface AccessMap {
  readonly user: { readonly id: string; readonly displayName: string; readonly accountStatus: AccountStatus | string };
  /** Roles globales de `iam` activos. */
  readonly globalRoles: readonly string[];
  readonly assignments: readonly AccessMapAssignment[];
  readonly counts: {
    readonly directGrants: number;
    readonly resourceScopeGrants: number;
    readonly restrictedFields: number;
  };
  readonly lastReview: AccessReview | null;
}

/* ---- revisión de accesos ------------------------------------------------- */

/** Una revisión registrada: el hecho de que alguien revisó los accesos de una cuenta. */
export interface AccessReview {
  readonly id: string;
  readonly userId: string;
  readonly userDisplayName: string | null;
  readonly reviewerUserId: string;
  readonly reviewerDisplayName: string | null;
  readonly reviewedAt: Date;
}

export interface AccessReviewsQuery {
  /** La cuenta revisada. */
  readonly userId?: string;
  /** Quien revisó. */
  readonly reviewerId?: string;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AccessReviewDue {
  readonly userId: string;
  readonly displayName: string;
  readonly accountStatus: AccountStatus | string;
  /** `undefined`: sin revisión dentro del horizonte de búsqueda. */
  readonly lastReviewedAt?: Date;
  readonly lastReviewerUserId: string | null;
}

export interface AccessReviewDueQuery {
  /** 1..3650 (90 por defecto en la API). */
  readonly olderThanDays?: number;
  readonly limit?: number;
  readonly cursor?: string;
}

export interface AccessReviewDuePage {
  readonly items: readonly AccessReviewDue[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly olderThanDays: number;
  /** Cuánto mira hacia atrás la búsqueda de la última revisión. */
  readonly lookbackDays: number;
}

/**
 * Motivos estables con que la API rechaza estas operaciones. Se ramifica por
 * ellos. Los de ciclo de vida son los de `iam`; los de gobierno, los de `authz`.
 */
export const GOVERNANCE_REASONS = [
  'USER_NOT_FOUND',
  'USER_LIFECYCLE_TRANSITION_INVALID',
  'USER_SELF_LIFECYCLE_FORBIDDEN',
  'USER_LAST_SECURITY_ADMIN',
  'GOVERNANCE_USER_NOT_FOUND',
  'GOVERNANCE_PERMISSION_NOT_FOUND',
  'ACCESS_REVIEW_SELF_REVIEW_FORBIDDEN',
  'RESOURCE_SCOPE_GRANT_NOT_FOUND',
  'RESOURCE_SCOPE_GRANT_ALREADY_ENDED',
  'RESOURCE_SCOPE_GRANT_DENY_REASON_REQUIRED',
  'ROLE_NOT_FOUND',
  'ROLE_PERMISSION_NOT_FOUND',
  'ROLE_FIELD_PERMISSION_WRITE_REQUIRES_READ',
  'ROLE_INSUFFICIENT',
] as const;
export type GovernanceReason = (typeof GOVERNANCE_REASONS)[number];
