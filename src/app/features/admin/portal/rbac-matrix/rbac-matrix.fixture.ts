import type {
  ModuleCell,
  ModuleEntry,
  ModuleGap,
  ModulePermission,
  ModulesCatalog,
} from '../../../../core/data-access/authz-governance/authz-modules-catalog.types';

/* Catálogo SINTÉTICO para las pruebas de la matriz RBAC. Ningún dato real. */

export const ROLE_FIN = 'role-fin';
export const ROLE_OPS = 'role-ops';

export const permission = (
  over: Partial<ModulePermission> & Pick<ModulePermission, 'id' | 'code'>,
): ModulePermission => ({
  name: `Permiso ${over.code} (SIMULADO)`,
  resource: 'invoices',
  legacyAction: null,
  action: 'list',
  canonicalCode: true,
  isDangerous: false,
  isActive: true,
  grants: [],
  ...over,
});

export const cell = (over: Partial<ModuleCell> & Pick<ModuleCell, 'action'>): ModuleCell => ({
  proposedCode: null,
  coverage: 'ROLE_ONLY',
  permissionIds: [],
  routeCount: 1,
  mutatingRouteCount: 0,
  undeclaredRouteCount: 0,
  publicRouteCount: 0,
  routeRoles: [],
  ...over,
});

const gap = (over: Partial<ModuleGap>): ModuleGap => ({
  kind: 'ROLE_ONLY',
  severity: 'MEDIUM',
  module: 'billing',
  resource: 'invoices',
  action: 'export',
  proposedCode: 'billing.invoices.export',
  routeCount: 1,
  sampleRoutes: [
    {
      method: 'POST',
      template: '/billing/invoices/export',
      controller: 'C',
      handler: 'h',
      roles: ['FINANCE'],
    },
  ],
  roles: ['FINANCE'],
  ...over,
});

const stats = (over: Partial<ModuleEntry['routes']> = {}): ModuleEntry['routes'] => ({
  total: 4,
  publicRoutes: 0,
  roleOnly: 4,
  guardOnly: 0,
  selfService: 0,
  undeclaredAuth: 0,
  mutating: 2,
  mutatingRoleOnly: 2,
  ...over,
});

const LIST = permission({
  id: 'p-list',
  code: 'billing.invoices.list',
  action: 'list',
  grants: [
    {
      roleId: ROLE_FIN,
      roleCode: 'FINANCE',
      roleName: 'Finanzas',
      effect: 'ALLOW',
      scope: 'TENANT',
      constraintJson: { maxAmount: 100 },
      fieldValueSetId: null,
    },
    {
      roleId: ROLE_OPS,
      roleCode: 'OPS',
      roleName: 'Operaciones',
      effect: 'DENY',
      scope: null,
      constraintJson: null,
      fieldValueSetId: null,
    },
  ],
});
const APPROVE = permission({
  id: 'p-approve',
  code: 'billing.invoices.approve',
  action: 'approve',
  isDangerous: true,
});

export function fixtureCatalog(): ModulesCatalog {
  const billing: ModuleEntry = {
    key: 'billing',
    routes: stats(),
    permissionCount: 2,
    grantCount: 2,
    roleCodesInCode: ['FINANCE'],
    resources: [
      {
        resource: 'invoices',
        permissions: [LIST, APPROVE],
        cells: [
          cell({
            action: 'list',
            coverage: 'FINE_PERMISSION',
            permissionIds: ['p-list'],
            routeRoles: ['FINANCE'],
          }),
          cell({
            action: 'approve',
            coverage: 'FINE_PERMISSION',
            permissionIds: ['p-approve'],
            routeRoles: ['FINANCE'],
            mutatingRouteCount: 1,
          }),
          cell({
            action: 'export',
            coverage: 'ROLE_ONLY',
            proposedCode: 'billing.invoices.export',
            routeRoles: ['FINANCE'],
          }),
        ],
      },
    ],
    gaps: [gap({})],
  };
  const lab: ModuleEntry = {
    key: 'pharma_lab',
    routes: stats({ total: 3, roleOnly: 2, undeclaredAuth: 1 }),
    permissionCount: 0,
    grantCount: 0,
    roleCodesInCode: ['PHARMA_LAB_ADMIN'],
    resources: [
      {
        resource: 'notices',
        permissions: [],
        cells: [
          cell({
            action: 'update',
            coverage: 'UNDECLARED_AUTH',
            undeclaredRouteCount: 1,
            proposedCode: 'pharma_lab.notices.update',
          }),
        ],
      },
    ],
    gaps: [
      gap({
        kind: 'MODULE_WITHOUT_FINE_PERMISSIONS',
        module: 'pharma_lab',
        resource: null,
        action: null,
        proposedCode: null,
        routeCount: 3,
        sampleRoutes: [],
        roles: ['PHARMA_LAB_ADMIN'],
      }),
      gap({
        kind: 'UNDECLARED_AUTH',
        severity: 'HIGH',
        module: 'pharma_lab',
        resource: 'notices',
        action: 'update',
        proposedCode: 'pharma_lab.notices.update',
        roles: [],
      }),
    ],
  };
  const ops: ModuleEntry = {
    key: 'ops',
    routes: stats({ total: 1, publicRoutes: 1, roleOnly: 0, mutating: 0, mutatingRoleOnly: 0 }),
    permissionCount: 0,
    grantCount: 0,
    roleCodesInCode: [],
    resources: [
      {
        resource: 'ping',
        permissions: [],
        cells: [cell({ action: 'read', coverage: 'NOT_APPLICABLE', publicRouteCount: 1 })],
      },
    ],
    gaps: [],
  };
  return {
    generatedAt: new Date('2026-10-31T10:00:00.000Z'),
    canonicalActions: ['read', 'list'],
    notes: ['SIMULADO: nota de prueba'],
    truncated: false,
    availableModules: ['billing', 'ops', 'pharma_lab'],
    summary: {
      modules: 3,
      permissions: 2,
      routes: 8,
      roleOnlyRoutes: 6,
      undeclaredAuthRoutes: 1,
      gaps: 3,
      modulesWithoutFinePermissions: 1,
    },
    roles: [
      { id: ROLE_FIN, code: 'FINANCE', name: 'Finanzas', isSystem: true, tenantId: null },
      { id: ROLE_OPS, code: 'OPS', name: 'Operaciones', isSystem: true, tenantId: null },
    ],
    modules: [billing, ops, lab],
  };
}
