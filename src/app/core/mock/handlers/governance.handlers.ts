import {
  conflict,
  notFound,
  preconditionFailed,
  reply,
  validation,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';

/* ============================================================================
    Backend simulado del gobierno de acceso: bitácora de auditoría
    (`/audit/log`, `/audit/data-access`), administración de acceso
    (`/authz/internal-users`, asignaciones de rol, permisos, roles) y deriva de
    permisos (`/admin/catalog/permission-drift`).

    Reproduce las REGLAS de la API, no sólo la forma: un rol de ámbito global
    con organización es 422 con `reason`, la misma asignación activa dos veces
    es 409, revocar algo que no está activo es 422, filtros con códigos
    desconocidos son 400 y las listas van por cursor.

    Todo es sintético y de plataforma: ningún paciente, ninguna historia
    clínica. Los accesos a datos sensibles que se simulan son lecturas de la
    propia bitácora.
    ========================================================================== */

const DAY_MS = 86_400_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const DEFAULT_WINDOW_DAYS = 30;

const AUDIT_RESULTS = new Set(['SUCCESS', 'FAILURE']);
const AUDIT_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const DATA_OPERATIONS = new Set(['READ', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT']);

const SECURITY_ADMIN_ID = '00000000-0000-4000-8000-00000000c001';
const DPO_ID = '00000000-0000-4000-8000-00000000c002';
const STEWARD_ID = '00000000-0000-4000-8000-00000000c003';
const ACTIVE_STATUS = '00000000-0000-4000-8000-00000000c0f1';
const DEMO_TENANT = '00000000-0000-4000-8000-00000000c0a1';

const daysAgo = (days: number, hour = 10) =>
  new Date(Date.now() - days * DAY_MS + hour * 3_600_000 - 12 * 3_600_000).toISOString();

/* ---- Roles y permisos ---------------------------------------------------- */

interface MockRole {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly scope: 'GLOBAL' | 'TENANT';
  readonly permissions: readonly { permissionId: string; effect: 'ALLOW' | 'DENY' }[];
}

interface MockPermission {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly resource: string;
  readonly isDangerous: boolean;
}

const PERMISSIONS: readonly MockPermission[] = [
  { id: 'perm-audit-read', code: 'AUDIT.READ', name: 'Leer la bitácora', resource: 'audit', isDangerous: false },
  { id: 'perm-audit-export', code: 'AUDIT.EXPORT', name: 'Exportar la bitácora', resource: 'audit', isDangerous: true },
  { id: 'perm-catalog-read', code: 'CATALOG.READ', name: 'Leer el catálogo de datos', resource: 'data_catalog', isDangerous: false },
  { id: 'perm-catalog-review', code: 'CATALOG.REVIEW', name: 'Decidir fichas del catálogo', resource: 'data_catalog', isDangerous: false },
  { id: 'perm-roles-assign', code: 'ROLES.ASSIGN', name: 'Asignar roles', resource: 'authz', isDangerous: true },
  { id: 'perm-schedule-read', code: 'SCHEDULE.READ', name: 'Leer la agenda de la organización', resource: 'scheduling', isDangerous: false },
];

const ROLES: readonly MockRole[] = [
  {
    id: 'role-auditor',
    code: 'AUDITOR',
    name: 'Auditor de sólo lectura',
    scope: 'GLOBAL',
    permissions: [
      { permissionId: 'perm-audit-read', effect: 'ALLOW' },
      { permissionId: 'perm-audit-export', effect: 'DENY' },
    ],
  },
  {
    id: 'role-dpo',
    code: 'DPO',
    name: 'Encargado de protección de datos',
    scope: 'GLOBAL',
    permissions: [
      { permissionId: 'perm-audit-read', effect: 'ALLOW' },
      { permissionId: 'perm-audit-export', effect: 'ALLOW' },
      { permissionId: 'perm-catalog-read', effect: 'ALLOW' },
    ],
  },
  {
    id: 'role-governance',
    code: 'GOVERNANCE_ADMIN',
    name: 'Administrador de gobierno de datos',
    scope: 'GLOBAL',
    permissions: [
      { permissionId: 'perm-catalog-read', effect: 'ALLOW' },
      { permissionId: 'perm-catalog-review', effect: 'ALLOW' },
    ],
  },
  {
    id: 'role-receptionist',
    code: 'RECEPTIONIST',
    name: 'Recepción',
    scope: 'TENANT',
    permissions: [{ permissionId: 'perm-schedule-read', effect: 'ALLOW' }],
  },
  {
    // Lo usan las reglas sintéticas de visibilidad («Ver como» por rol): sin él, el rol se veía
    // sólo por su código. Sin permisos del catálogo de gobierno: es personal de mostrador.
    id: 'role-pharmacy-staff',
    code: 'PHARMACY_STAFF',
    name: 'Personal de farmacia',
    scope: 'TENANT',
    permissions: [],
  },
];

/* ---- Usuarios y asignaciones --------------------------------------------- */

interface MockUser {
  readonly id: string;
  readonly displayName: string;
  readonly globalRoles: readonly string[];
  readonly lastLoginAt: string | null;
}

interface MockAssignment {
  readonly id: string;
  readonly userId: string;
  readonly roleId: string;
  readonly tenantId: string | null;
  status: 'ACTIVE' | 'REVOKED';
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly createdAt: string;
}

const USERS: readonly MockUser[] = [
  { id: SECURITY_ADMIN_ID, displayName: 'Lucía Paredes (simulada)', globalRoles: ['SECURITY_ADMIN'], lastLoginAt: daysAgo(0) },
  { id: DPO_ID, displayName: 'Marcos Rivero (simulado)', globalRoles: [], lastLoginAt: daysAgo(2) },
  { id: STEWARD_ID, displayName: 'Elena Quispe (simulada)', globalRoles: [], lastLoginAt: null },
];

let sequence = 0;
const nextId = () => {
  sequence += 1;
  return `00000000-0000-4000-9100-${String(sequence).padStart(12, '0')}`;
};

const assignments: MockAssignment[] = [
  { id: nextId(), userId: DPO_ID, roleId: 'role-dpo', tenantId: null, status: 'ACTIVE', validFrom: null, validTo: null, createdAt: daysAgo(40) },
  { id: nextId(), userId: DPO_ID, roleId: 'role-auditor', tenantId: null, status: 'REVOKED', validFrom: null, validTo: null, createdAt: daysAgo(90) },
  { id: nextId(), userId: STEWARD_ID, roleId: 'role-governance', tenantId: null, status: 'ACTIVE', validFrom: null, validTo: daysAgo(-180), createdAt: daysAgo(12) },
  { id: nextId(), userId: STEWARD_ID, roleId: 'role-receptionist', tenantId: DEMO_TENANT, status: 'ACTIVE', validFrom: null, validTo: null, createdAt: daysAgo(5) },
];

const roleById = (id: string) => ROLES.find((r) => r.id === id);

function isEffective(a: MockAssignment): boolean {
  const now = Date.now();
  return (
    a.status === 'ACTIVE' &&
    (a.validFrom === null || Date.parse(a.validFrom) <= now) &&
    (a.validTo === null || Date.parse(a.validTo) > now)
  );
}

function assignmentView(a: MockAssignment) {
  const role = roleById(a.roleId)!;
  return {
    id: a.id,
    roleId: role.id,
    roleCode: role.code,
    roleName: role.name,
    roleScope: role.scope,
    tenantId: a.tenantId,
    branchId: null,
    practiceId: null,
    status: a.status,
    validFrom: a.validFrom,
    validTo: a.validTo,
    isEffective: isEffective(a),
    appliesGlobally: role.scope === 'GLOBAL' && a.tenantId === null,
    assignedByUserId: SECURITY_ADMIN_ID,
    createdAt: a.createdAt,
  };
}

function internalUserView(user: MockUser) {
  return {
    id: user.id,
    displayName: user.displayName,
    statusConceptId: ACTIVE_STATUS,
    lastLoginAt: user.lastLoginAt,
    globalRoles: user.globalRoles,
    assignments: assignments
      .filter((a) => a.userId === user.id && a.status === 'ACTIVE')
      .map((a) => {
        const role = roleById(a.roleId)!;
        return { assignmentId: a.id, roleCode: role.code, roleName: role.name, tenantId: a.tenantId, validTo: a.validTo };
      }),
  };
}

/* ---- Bitácora ------------------------------------------------------------ */

interface MockAuditEntry {
  readonly id: string;
  readonly userId: string;
  readonly action: string;
  readonly entity: string;
  readonly result: 'SUCCESS' | 'FAILURE';
  readonly method: string | null;
  readonly route: string | null;
  readonly healthRisk: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  readonly recordedAt: string;
}

const AUDIT_LOG: readonly MockAuditEntry[] = [
  { id: 'audit-1', userId: SECURITY_ADMIN_ID, action: 'ROLE_ASSIGNED', entity: 'user_role_assignment', result: 'SUCCESS', method: 'POST', route: '/authz/users/:userId/role-assignments', healthRisk: 'CRITICAL', recordedAt: daysAgo(0, 9) },
  { id: 'audit-2', userId: SECURITY_ADMIN_ID, action: 'ROLE_ASSIGNMENT_REVOKED', entity: 'user_role_assignment', result: 'SUCCESS', method: 'DELETE', route: '/authz/users/:userId/role-assignments/:assignmentId', healthRisk: 'CRITICAL', recordedAt: daysAgo(1, 15) },
  { id: 'audit-3', userId: STEWARD_ID, action: 'CATALOG_ANNOTATION_SAVED', entity: 'catalog_annotation', result: 'SUCCESS', method: 'PUT', route: '/admin/catalog/objects/:id/annotation', healthRisk: 'LOW', recordedAt: daysAgo(2, 11) },
  { id: 'audit-4', userId: STEWARD_ID, action: 'HTTP POST /admin/catalog/scans', entity: 'catalog_scan_run', result: 'FAILURE', method: 'POST', route: '/admin/catalog/scans', healthRisk: 'LOW', recordedAt: daysAgo(3, 16) },
  { id: 'audit-5', userId: DPO_ID, action: 'CATALOG_REVIEW_DECIDED', entity: 'catalog_annotation', result: 'SUCCESS', method: null, route: null, healthRisk: 'LOW', recordedAt: daysAgo(6, 10) },
  { id: 'audit-6', userId: SECURITY_ADMIN_ID, action: 'ROLE_PERMISSIONS_SET', entity: 'role', result: 'SUCCESS', method: 'PUT', route: '/authz/roles/:roleId/permissions', healthRisk: 'CRITICAL', recordedAt: daysAgo(45, 10) },
];

const DATA_ACCESS: readonly {
  readonly id: string;
  readonly userId: string;
  readonly operation: string;
  readonly resourceType: string;
  readonly purpose: string;
  readonly healthRisk: string;
  readonly recordedAt: string;
}[] = [
  { id: 'access-1', userId: DPO_ID, operation: 'READ', resourceType: 'AUDIT_LOG', purpose: 'SECURITY_OVERSIGHT', healthRisk: 'LOW', recordedAt: daysAgo(0, 8) },
  { id: 'access-2', userId: DPO_ID, operation: 'READ', resourceType: 'DATA_ACCESS_LOG', purpose: 'SECURITY_OVERSIGHT', healthRisk: 'LOW', recordedAt: daysAgo(1, 14) },
  { id: 'access-3', userId: SECURITY_ADMIN_ID, operation: 'EXPORT', resourceType: 'AUDIT_LOG', purpose: 'SECURITY_OVERSIGHT', healthRisk: 'LOW', recordedAt: daysAgo(4, 9) },
];

/* ---- Utilidades de la API ------------------------------------------------ */

function pageSize(req: MockRequest): number | MockReply {
  const raw = req.query.get('limit');
  if (raw === null) return DEFAULT_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) {
    return validation('Error de validación', [{ field: 'limit', message: `must not be greater than ${MAX_LIMIT}` }]);
  }
  return n;
}

/** Cursor opaco: la posición siguiente, como la API la codifica a su manera. */
function paginate<T>(items: readonly T[], req: MockRequest): MockReply | { items: readonly T[]; nextCursor: string | null; limit: number } {
  const limit = pageSize(req);
  if (typeof limit !== 'number') return limit;
  const start = Number(req.query.get('cursor') ?? '0') || 0;
  const slice = items.slice(start, start + limit);
  const next = start + limit < items.length ? String(start + limit) : null;
  return { items: slice, nextCursor: next, limit };
}

/** El rango de la consulta. Sin rango, los últimos 30 días, como la API. */
function inRange(req: MockRequest): (iso: string) => boolean {
  const from = req.query.get('from');
  const to = req.query.get('to');
  const lower = from ? Date.parse(from) : from === null && to === null ? Date.now() - DEFAULT_WINDOW_DAYS * DAY_MS : -Infinity;
  const upper = to ? Date.parse(to) : Infinity;
  return (iso) => {
    const t = Date.parse(iso);
    return t >= lower && t < upper;
  };
}

function invalidCode(req: MockRequest, key: string, allowed: ReadonlySet<string>): MockReply | null {
  const value = req.query.get(key);
  return value !== null && !allowed.has(value)
    ? validation('Error de validación', [{ field: key, message: `must be one of the following values: ${[...allowed].join(', ')}` }])
    : null;
}

const byNewest = (a: { recordedAt: string }, b: { recordedAt: string }) => b.recordedAt.localeCompare(a.recordedAt);

/** Un rechazo de negocio con su motivo estable en la raíz del cuerpo, como la API. */
function withReason(base: MockReply, reason: string): MockReply {
  return reply(base.status, { ...(base.body as Record<string, unknown>), reason });
}

/* ---- Rutas --------------------------------------------------------------- */

function registerAudit(router: MockRouter): void {
  router.get('/audit/log', (req) => {
    const invalid = invalidCode(req, 'result', AUDIT_RESULTS) ?? invalidCode(req, 'method', AUDIT_METHODS);
    if (invalid) return invalid;
    const q = (key: string) => req.query.get(key);
    const within = inRange(req);
    const rows = AUDIT_LOG.filter(
      (e) =>
        within(e.recordedAt) &&
        (!q('userId') || e.userId === q('userId')) &&
        (!q('result') || e.result === q('result')) &&
        (!q('method') || e.method === q('method')) &&
        (!q('action') || e.action === q('action')) &&
        (!q('route') || e.route === q('route')) &&
        (!q('entity') || e.entity === q('entity')),
    )
      .slice()
      .sort(byNewest)
      .map((e) => ({ ...e, tenantId: null, entityId: null, ip: null }));
    return paginate(rows, req);
  });

  router.get('/audit/data-access', (req) => {
    const invalid = invalidCode(req, 'operation', DATA_OPERATIONS);
    if (invalid) return invalid;
    const q = (key: string) => req.query.get(key);
    const within = inRange(req);
    const rows = DATA_ACCESS.filter(
      (e) =>
        within(e.recordedAt) &&
        (!q('userId') || e.userId === q('userId')) &&
        (!q('operation') || e.operation === q('operation')) &&
        (!q('resourceType') || e.resourceType === q('resourceType')),
    )
      .slice()
      .sort(byNewest)
      .map((e) => ({ ...e, tenantId: null, patientProfileId: null, resourceId: null }));
    return paginate(rows, req);
  });
}

function registerAccessAdmin(router: MockRouter): void {
  router.get('/authz/internal-users', (req) => {
    const text = req.query.get('q')?.trim().toLowerCase() ?? '';
    const roleCode = req.query.get('roleCode');
    const rows = USERS.map(internalUserView).filter(
      (u) =>
        (text === '' || u.displayName.toLowerCase().includes(text)) &&
        (roleCode === null
          ? u.globalRoles.length > 0 || u.assignments.some((a) => roleByCode(a.roleCode)?.scope === 'GLOBAL')
          : u.globalRoles.includes(roleCode) || u.assignments.some((a) => a.roleCode === roleCode)),
    );
    return paginate(rows, req);
  });

  router.get('/authz/users/:userId/role-assignments', (req) => {
    const userId = req.params['userId']!;
    if (!USERS.some((u) => u.id === userId)) {
      return withReason(notFound('No existe el usuario'), 'ROLE_ASSIGNMENT_USER_NOT_FOUND');
    }
    return {
      userId,
      items: assignments.filter((a) => a.userId === userId).map(assignmentView),
    };
  });

  router.post('/authz/users/:userId/role-assignments', (req) => assign(req));

  router.delete('/authz/users/:userId/role-assignments/:assignmentId', (req) => {
    const found = assignments.find(
      (a) => a.id === req.params['assignmentId'] && a.userId === req.params['userId'],
    );
    if (!found) return withReason(notFound('No existe la asignación'), 'ROLE_ASSIGNMENT_NOT_FOUND');
    if (found.status !== 'ACTIVE') {
      return withReason(preconditionFailed('La asignación no está activa'), 'ROLE_ASSIGNMENT_NOT_ACTIVE');
    }
    found.status = 'REVOKED';
    return {
      id: found.id,
      status: 'REVOKED',
      note: 'El rol deja de llegar al token en su próxima renovación; las sesiones ya emitidas lo conservan hasta entonces',
    };
  });

  // Sólo el nombre visible: es lo que lee la consola de una persona fuera de la lista.
  router.get('/iam/users/:id', (req) => {
    const user = USERS.find((u) => u.id === req.params['id']);
    return user
      ? { id: user.id, displayName: user.displayName, statusConceptId: ACTIVE_STATUS, lastLoginAt: user.lastLoginAt }
      : notFound('Usuario no encontrado');
  });

  router.get('/authz/roles', () =>
    ROLES.map((r) => ({ id: r.id, code: r.code, name: r.name, isSystem: true, tenantId: null })),
  );

  router.get('/authz/roles/:roleId/permissions', (req) => {
    const role = roleById(req.params['roleId']!);
    if (!role) return notFound('No existe el rol');
    return {
      roleId: role.id,
      roleCode: role.code,
      items: role.permissions.map((p) => {
        const permission = PERMISSIONS.find((x) => x.id === p.permissionId)!;
        return {
          permissionId: permission.id,
          code: permission.code,
          name: permission.name,
          resource: permission.resource,
          effect: p.effect,
          scope: role.scope,
        };
      }),
    };
  });

  router.get('/authz/permissions', (req) => {
    const text = req.query.get('q')?.trim().toLowerCase() ?? '';
    const rows = PERMISSIONS.filter(
      (p) => text === '' || `${p.code} ${p.name} ${p.resource}`.toLowerCase().includes(text),
    ).map((p) => ({
      ...p,
      categoryId: null,
      isFieldLevel: false,
      isRoleRestricted: true,
    }));
    return paginate(rows, req);
  });
}

const roleByCode = (code: string) => ROLES.find((r) => r.code === code);

function assign(req: MockRequest): MockReply | { id: string } {
  const userId = req.params['userId']!;
  const body = (req.body ?? {}) as {
    roleId?: string;
    roleCode?: string;
    tenantId?: string;
    branchId?: string;
    practiceId?: string;
    validFrom?: string;
    validTo?: string;
  };
  if (!body.roleId && !body.roleCode) {
    return withReason(
      preconditionFailed('Indique el rol a asignar por `roleId` o por `roleCode`'),
      'ROLE_ASSIGNMENT_MISSING_ROLE_REFERENCE',
    );
  }
  const role = body.roleId ? roleById(body.roleId) : roleByCode(body.roleCode!);
  if (!role) return withReason(notFound('Rol no encontrado'), 'ROLE_ASSIGNMENT_ROLE_NOT_FOUND');
  if (role.scope === 'GLOBAL' && (body.tenantId || body.branchId || body.practiceId)) {
    return withReason(
      preconditionFailed('Un rol de ámbito global se asigna sin tenant, sede ni consultorio', {
        roleId: role.id,
        roleCode: role.code,
      }),
      'ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE',
    );
  }
  if (body.validFrom && body.validTo && Date.parse(body.validFrom) >= Date.parse(body.validTo)) {
    return withReason(
      preconditionFailed('validFrom debe ser anterior a validTo'),
      'ROLE_ASSIGNMENT_INVALID_VALIDITY_WINDOW',
    );
  }
  const tenantId = body.tenantId ?? null;
  const duplicate = assignments.some(
    (a) => a.userId === userId && a.roleId === role.id && a.tenantId === tenantId && a.status === 'ACTIVE',
  );
  if (duplicate) {
    return withReason(
      conflict('El usuario ya tiene ese rol asignado y activo en ese ámbito'),
      'ROLE_ASSIGNMENT_ALREADY_ACTIVE',
    );
  }
  const created: MockAssignment = {
    id: nextId(),
    userId,
    roleId: role.id,
    tenantId,
    status: 'ACTIVE',
    validFrom: body.validFrom ?? null,
    validTo: body.validTo ?? null,
    createdAt: new Date().toISOString(),
  };
  assignments.push(created);
  return reply(201, { id: created.id, status: 'ACTIVE', createdAt: created.createdAt });
}

function registerPermissionDrift(router: MockRouter): void {
  router.get('/admin/catalog/permission-drift', () => ({
    generatedAt: daysAgo(0, 7),
    routes: { total: 412, public: 18, withRoles: 371, withoutRoles: 23 },
    usedNotSeeded: [
      {
        role: 'PLATFORM_ADMIN',
        routeCount: 64,
        inDatabase: true,
        sample: [
          { method: 'GET', template: '/admin/analytics/overview', controller: 'TelemetryAnalyticsController', handler: 'overview' },
          { method: 'GET', template: '/admin/ops/incidents', controller: 'OpsConsoleController', handler: 'incidents' },
        ],
      },
      {
        role: 'RELEASE_MANAGER',
        routeCount: 9,
        inDatabase: false,
        sample: [{ method: 'GET', template: '/admin/ops/deployments', controller: 'OpsConsoleController', handler: 'deployments' }],
      },
    ],
    seededNotUsed: ['LEGACY_VIEWER'],
    routesWithoutRoles: [
      { method: 'GET', template: '/notifications/inbox', controller: 'NotificationsController', handler: 'inbox' },
      { method: 'POST', template: '/files/uploads', controller: 'FilesController', handler: 'upload' },
    ],
    routesWithoutRolesTruncated: true,
  }));
}

/** Registra el gobierno de acceso: bitácora, administración de acceso y deriva de permisos. */
export function registerGovernance(router: MockRouter): void {
  registerAudit(router);
  registerAccessAdmin(router);
  registerPermissionDrift(router);
}
