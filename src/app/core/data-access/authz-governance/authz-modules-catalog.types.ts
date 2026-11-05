/* ============================================================================
    RBAC por módulo (API: `GET /authz/catalog/modules`, `SECURITY_ADMIN`).

    Espejo del contrato `ModulesCatalogDto` de la API. La autoridad es la API: esta
    capa transporta lo que responde. Los códigos `proposedCode` son SUGERENCIAS
    derivadas de las rutas reales; no están sembrados.
    ========================================================================== */

/** Las acciones canónicas de un permiso fino. */
export const CANONICAL_ACTIONS = [
  'read',
  'list',
  'create',
  'update',
  'delete',
  'export',
  'approve',
  'reject',
  'assign',
  'configure',
  'audit',
] as const;
export type CanonicalAction = (typeof CANONICAL_ACTIONS)[number];

/** Una acción sembrada que no tiene equivalente canónico (p. ej. `EXECUTE`). */
export type CellAction = CanonicalAction | 'other';

export type CellCoverage =
  'FINE_PERMISSION' | 'UNDECLARED_AUTH' | 'ROLE_ONLY' | 'GUARD_ONLY' | 'NOT_APPLICABLE';
export type GapKind =
  'MODULE_WITHOUT_FINE_PERMISSIONS' | 'ROLE_ONLY' | 'GUARD_ONLY' | 'UNDECLARED_AUTH';
export type GapSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ModuleRouteStats {
  readonly total: number;
  readonly publicRoutes: number;
  readonly roleOnly: number;
  readonly guardOnly: number;
  readonly selfService: number;
  readonly undeclaredAuth: number;
  readonly mutating: number;
  readonly mutatingRoleOnly: number;
}

export interface ModuleGrant {
  readonly roleId: string;
  readonly roleCode: string;
  readonly roleName: string;
  readonly effect: 'ALLOW' | 'DENY';
  readonly scope: string | null;
  /** Restricción ABAC del vínculo: viaja para poder conservarla al reemplazar los permisos del rol. */
  readonly constraintJson: Readonly<Record<string, unknown>> | null;
  readonly fieldValueSetId: string | null;
}

export interface ModulePermission {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly resource: string;
  readonly legacyAction: string | null;
  readonly action: CellAction;
  readonly canonicalCode: boolean;
  readonly isDangerous: boolean;
  readonly isActive: boolean;
  readonly grants: readonly ModuleGrant[];
}

export interface ModuleCell {
  readonly action: CellAction;
  readonly proposedCode: string | null;
  readonly coverage: CellCoverage;
  readonly permissionIds: readonly string[];
  readonly routeCount: number;
  readonly mutatingRouteCount: number;
  readonly undeclaredRouteCount: number;
  readonly publicRouteCount: number;
  /** Roles que las rutas de la celda exigen con `@Roles`. */
  readonly routeRoles: readonly string[];
}

export interface ModuleResource {
  readonly resource: string;
  readonly permissions: readonly ModulePermission[];
  readonly cells: readonly ModuleCell[];
}

export interface ModuleGapRoute {
  readonly method: string;
  readonly template: string;
  readonly controller: string;
  readonly handler: string;
  readonly roles: readonly string[];
}

export interface ModuleGap {
  readonly kind: GapKind;
  readonly severity: GapSeverity;
  readonly module: string;
  readonly resource: string | null;
  readonly action: CanonicalAction | null;
  readonly proposedCode: string | null;
  readonly routeCount: number;
  readonly sampleRoutes: readonly ModuleGapRoute[];
  readonly roles: readonly string[];
}

export interface ModuleEntry {
  readonly key: string;
  readonly routes: ModuleRouteStats;
  readonly permissionCount: number;
  readonly grantCount: number;
  readonly roleCodesInCode: readonly string[];
  readonly resources: readonly ModuleResource[];
  readonly gaps: readonly ModuleGap[];
}

export interface ModuleRoleRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isSystem: boolean;
  readonly tenantId: string | null;
}

export interface ModulesCatalogSummary {
  readonly modules: number;
  readonly permissions: number;
  readonly routes: number;
  readonly roleOnlyRoutes: number;
  readonly undeclaredAuthRoutes: number;
  readonly gaps: number;
  readonly modulesWithoutFinePermissions: number;
}

export interface ModulesCatalog {
  readonly generatedAt: Date;
  readonly canonicalActions: readonly string[];
  /** Lo que esta lectura NO demuestra. Se muestra siempre. */
  readonly notes: readonly string[];
  /** Con `true` la lectura quedó incompleta: no se edita ningún rol desde estos datos. */
  readonly truncated: boolean;
  readonly availableModules: readonly string[];
  readonly summary: ModulesCatalogSummary;
  readonly roles: readonly ModuleRoleRef[];
  readonly modules: readonly ModuleEntry[];
}

export interface ModulesCatalogQuery {
  readonly module?: string;
}
