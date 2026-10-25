/* ============================================================================
    Administración de acceso de la consola (API: `/authz`, todo `SECURITY_ADMIN`).

    Usuarios internos con sus roles, asignaciones con su alcance, permisos y
    permisos por rol. La autoridad es la API: esta capa no decide qué rol se
    puede asignar ni dónde; sólo transporta lo que la API responde, incluido
    el motivo (`reason`) de un rechazo.
    ========================================================================== */

/** Estado de una asignación, tal como lo muestra la consola. */
export type AssignmentStatus = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'OTHER';

/** Ámbito de un rol (`authz.roles.scope_concept_id`, resuelto por la API). */
export type RoleScope = 'SELF' | 'BRANCH' | 'TENANT' | 'GLOBAL';

/** Efecto de un permiso dentro de un rol. */
export type PermissionEffect = 'ALLOW' | 'DENY' | 'OTHER';

/** Tope de elementos por página de los listados de administración. */
export const AUTHZ_ADMIN_MAX_PAGE_SIZE = 200;

export interface AdminPageQuery {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface InternalUsersQuery extends AdminPageQuery {
  /** Texto a buscar en el nombre visible. */
  readonly q?: string;
  /** Sólo quienes tienen este rol activo, en cualquier ámbito. */
  readonly roleCode?: string;
}

export interface PermissionsQuery extends AdminPageQuery {
  /** Texto a buscar en el código, el nombre y el recurso. */
  readonly q?: string;
  readonly categoryId?: string;
}

/** Una página por cursor, sin total. */
export interface AdminPage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly limit: number;
}

/** Una asignación activa vista desde la lista de usuarios internos. */
export interface InternalUserAssignment {
  readonly assignmentId: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly tenantId: string | null;
  readonly validTo?: Date;
}

export interface InternalUser {
  readonly id: string;
  readonly displayName: string;
  readonly statusConceptId: string;
  readonly lastLoginAt?: Date;
  /** Roles globales de `iam` activos (`SECURITY_ADMIN`, `SUPERADMIN`, …). */
  readonly globalRoles: readonly string[];
  /** Asignaciones de rol activas de `authz`. */
  readonly assignments: readonly InternalUserAssignment[];
}

/** Una asignación de rol de un usuario, activa o no. */
export interface RoleAssignment {
  readonly id: string;
  readonly roleId: string;
  /** El código que exige `@Roles(...)`. */
  readonly roleCode: string;
  readonly roleName: string;
  readonly roleScope: RoleScope | string | null;
  readonly tenantId: string | null;
  readonly branchId: string | null;
  readonly practiceId: string | null;
  readonly status: AssignmentStatus | string;
  readonly validFrom?: Date;
  readonly validTo?: Date;
  /** La asignación está activa y su vigencia cubre el instante de la consulta. */
  readonly isEffective: boolean;
  /** Rol global asignado sin organización, sede ni consultorio: autoriza en las rutas de plataforma. */
  readonly appliesGlobally: boolean;
  readonly assignedByUserId: string | null;
  readonly createdAt: Date;
}

export interface UserRoleAssignments {
  readonly userId: string;
  readonly items: readonly RoleAssignment[];
}

/** Lo que se manda para asignar un rol. Sin organización = rol de toda la plataforma. */
export interface RoleAssignmentInput {
  readonly roleId: string;
  readonly tenantId?: string;
  readonly validFrom?: string;
  readonly validTo?: string;
}

export interface CreatedAssignment {
  readonly id: string;
}

export interface RevokedAssignment {
  readonly id: string;
  readonly status: 'REVOKED';
  readonly note: string;
}

/** Un rol que se puede asignar (`GET /authz/roles`). */
export interface AssignableRole {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isSystem: boolean;
  readonly tenantId: string | null;
}

export interface PermissionSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly resource: string;
  readonly categoryId: string | null;
  readonly isDangerous: boolean;
  readonly isFieldLevel: boolean;
  /** Sólo lo concede un rol, no una excepción por usuario. */
  readonly isRoleRestricted: boolean;
}

export interface RolePermission {
  readonly permissionId: string;
  readonly code: string;
  readonly name: string;
  readonly resource: string;
  readonly effect: PermissionEffect | string;
  readonly scope: RoleScope | string | null;
}

export interface RolePermissions {
  readonly roleId: string;
  readonly roleCode: string;
  readonly items: readonly RolePermission[];
}

/**
 * Motivos estables con que la API rechaza asignar o revocar
 * (`src/modules/authz/authz.error-reasons.ts`). Se ramifica por ellos, nunca
 * por el texto del mensaje.
 */
export const ROLE_ASSIGNMENT_REASONS = [
  'ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE',
  'ROLE_ASSIGNMENT_ALREADY_ACTIVE',
  'ROLE_ASSIGNMENT_ROLE_NOT_ASSIGNABLE',
  'ROLE_ASSIGNMENT_ROLE_NOT_FOUND',
  'ROLE_ASSIGNMENT_INVALID_VALIDITY_WINDOW',
  'ROLE_ASSIGNMENT_MISSING_ROLE_REFERENCE',
  'ROLE_ASSIGNMENT_NOT_FOUND',
  'ROLE_ASSIGNMENT_NOT_ACTIVE',
  'ROLE_ASSIGNMENT_USER_NOT_FOUND',
] as const;
export type RoleAssignmentReason = (typeof ROLE_ASSIGNMENT_REASONS)[number];
