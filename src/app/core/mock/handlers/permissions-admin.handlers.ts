import { HttpHeaders } from '@angular/common/http';

import {
  conflict,
  isMockReply,
  notFound,
  precondition,
  reply,
  validation,
  type MockHandler,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';

/* ============================================================================
    Backend simulado del gobierno de permisos (H5): edición de permisos por
    rol, permisos por campo y por alcance de recurso, simulación del PDP, ciclo
    de vida de las cuentas internas y revisión de accesos.

    Reproduce las REGLAS de la API —precondición en la escritura, 409/422 con
    `reason` estable, el motivo obligatorio— y se apoya en los roles, permisos,
    usuarios y asignaciones que ya sirve `governance.handlers.ts`: lo consulta
    llamando a sus manejadores, no copia sus datos.

    **Debe registrarse DESPUÉS de `registerGovernance`.** Envuelve
    `GET /authz/roles/:roleId/permissions` para que lo editado se vea al releer.

    Todo es sintético. La decisión del PDP que devuelve es una aproximación de
    la maqueta (resuelve por recurso y acción sobre los permisos del rol) y lo
    dice en su `reason`: no sustituye al PDP real.
    ========================================================================== */

const DAY_MS = 86_400_000;
const REASON_MIN = 10;
const REASON_MAX = 500;
const ACTIONS = new Set(['READ', 'WRITE', 'CREATE', 'DELETE', 'EXECUTE', 'APPROVE']);
const SCOPES = new Set(['SELF', 'BRANCH', 'TENANT', 'GLOBAL']);
const EFFECTS = new Set(['ALLOW', 'DENY']);
const MASKS = new Set(['REDACT', 'HASH', 'PARTIAL', 'NULLIFY']);
const SUBJECTS = new Set(['USER', 'ROLE', 'SERVICE']);
const RESOURCES = new Set(['PATIENT', 'ENCOUNTER', 'DOCUMENT', 'RECORD']);
const PURPOSES = new Set(['TREATMENT', 'PAYMENT', 'OPERATIONS', 'EMERGENCY']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Acciones de los códigos de permiso de la maqueta que no son un verbo de la API. */
const ACTION_OF_SUFFIX: Readonly<Record<string, string>> = { EXPORT: 'EXECUTE', ASSIGN: 'EXECUTE', REVIEW: 'APPROVE' };

interface Binding {
  readonly permissionId: string;
  readonly effect: string;
  readonly scope: string | null;
}
interface FieldRule {
  entity: string;
  columnName: string;
  canRead: boolean;
  canWrite: boolean;
  maskStrategy: string | null;
  conditionJson: Record<string, unknown> | null;
}
interface ScopeGrant {
  readonly id: string;
  readonly subjectId: string;
  readonly permissionId: string;
  readonly resourceId: string;
  readonly tenantId: string | null;
  readonly subjectType: string;
  readonly resourceType: string;
  readonly effect: string;
  readonly validFrom: string | null;
  validTo: string | null;
  readonly createdAt: string;
}
interface LifecycleEvent {
  readonly id: string;
  readonly kind: 'SUSPENDED' | 'REACTIVATED' | 'OFFBOARDED';
  readonly reason: string;
  readonly actorUserId: string | null;
  readonly recordedAt: string;
}
interface Review {
  readonly id: string;
  readonly userId: string;
  readonly decision: string;
  readonly reason: string;
  readonly assignmentIds: readonly string[];
  readonly reviewerUserId: string | null;
  readonly reviewedAt: string;
}

interface Page<T> {
  items: T[];
  nextCursor: string | null;
  limit: number;
}

const rejectWith = (base: MockReply, reason: string): MockReply =>
  reply(base.status, { ...(base.body as Record<string, unknown>), reason });

const bodyOf = (req: MockRequest): Record<string, unknown> =>
  typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};

function textReason(req: MockRequest): string | MockReply {
  const reason = bodyOf(req)['reason'];
  if (typeof reason !== 'string' || reason.trim().length < REASON_MIN || reason.length > REASON_MAX) {
    return validation('Error de validación', [
      { field: 'reason', message: `must be longer than or equal to ${REASON_MIN} characters` },
    ]);
  }
  return reason.trim();
}

/** Registra el gobierno de permisos simulado. Llamar después de `registerGovernance`. */
export function registerPermissionsAdmin(router: MockRouter): void {
  let sequence = 0;
  const nextId = (): string => `00000000-0000-4000-a200-${String(++sequence).padStart(12, '0')}`;
  const now = (): number => Date.now();
  const iso = (ms: number): string => new Date(ms).toISOString();

  /** Llama a un manejador ya registrado, como lo haría una petición. */
  function ask<T>(method: 'GET' | 'DELETE', path: string, query = ''): { status: number; body: T } | null {
    const match = router.match(method, path);
    if (match === null) return null;
    const out = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: null,
    } satisfies MockRequest);
    return isMockReply(out) ? { status: out.status, body: out.body as T } : { status: 200, body: out as T };
  }

  const catalog = (): readonly { id: string; code: string; name: string; resource: string }[] =>
    ask<Page<{ id: string; code: string; name: string; resource: string }>>('GET', '/authz/permissions', 'limit=200')?.body
      .items ?? [];
  const roles = (): readonly { id: string; code: string; name: string }[] =>
    ask<{ id: string; code: string; name: string }[]>('GET', '/authz/roles')?.body ?? [];
  const roleExists = (id: string): boolean => roles().some((r) => r.id === id);

  /* ---- permisos por acción --------------------------------------------- */

  const edited = new Map<string, readonly Binding[]>();

  router.wrap('GET', '/authz/roles/:roleId/permissions', (req, next) => {
    const roleId = req.params['roleId']!;
    const bindings = edited.get(roleId);
    if (bindings === undefined) return next(req);
    const role = roles().find((r) => r.id === roleId);
    if (!role) return notFound('No existe el rol');
    const permissions = catalog();
    return {
      roleId,
      roleCode: role.code,
      items: bindings.map((b) => {
        const p = permissions.find((x) => x.id === b.permissionId)!;
        return { permissionId: p.id, code: p.code, name: p.name, resource: p.resource, effect: b.effect, scope: b.scope };
      }),
    };
  });

  router.put('/authz/roles/:roleId/permissions', (req) => {
    const roleId = req.params['roleId']!;
    const list = bodyOf(req)['permissions'];
    if (!Array.isArray(list) || list.length === 0) {
      return validation('Error de validación', [{ field: 'permissions', message: 'must contain at least 1 elements' }]);
    }
    for (const item of list as Record<string, unknown>[]) {
      if (typeof item['permissionId'] !== 'string' || !EFFECTS.has(String(item['effect']))) {
        return validation('Error de validación', [{ field: 'permissions', message: 'permissionId and effect are required' }]);
      }
      if (item['scope'] !== undefined && !SCOPES.has(String(item['scope']))) {
        return validation('Error de validación', [{ field: 'permissions.scope', message: 'must be a valid enum value' }]);
      }
    }
    const role = roles().find((r) => r.id === roleId);
    if (!role) return rejectWith(notFound('Rol no encontrado'), 'ROLE_NOT_FOUND');
    const known = new Set(catalog().map((p) => p.id));
    const bindings = (list as Record<string, string | undefined>[]).map((i) => ({
      permissionId: i['permissionId']!,
      effect: i['effect']!,
      scope: i['scope'] ?? null,
    }));
    if (bindings.some((b) => !known.has(b.permissionId))) {
      return precondition('Alguno de los permisos no existe', 'ROLE_PERMISSION_NOT_FOUND');
    }
    edited.set(roleId, bindings);
    return { id: roleId, code: role.code, status: 'ACTIVE', permissionCount: bindings.length };
  });

  /* ---- permisos por campo ---------------------------------------------- */

  const fields = new Map<string, FieldRule[]>();
  const fieldsOf = (roleId: string): FieldRule[] => {
    let rules = fields.get(roleId);
    if (rules === undefined) {
      rules =
        roleId === 'role-dpo'
          ? [
              { entity: 'patient_profile', columnName: 'national_id', canRead: true, canWrite: false, maskStrategy: 'PARTIAL', conditionJson: null },
              { entity: 'patient_profile', columnName: 'phone', canRead: false, canWrite: false, maskStrategy: 'REDACT', conditionJson: null },
            ]
          : [];
      fields.set(roleId, rules);
    }
    return rules;
  };

  router.get('/authz/roles/:roleId/field-permissions', (req) => {
    const roleId = req.params['roleId']!;
    if (!roleExists(roleId)) return rejectWith(notFound('Rol no encontrado'), 'ROLE_NOT_FOUND');
    return { roleId, items: fieldsOf(roleId).map((r) => ({ ...r })) };
  });

  router.put('/authz/roles/:roleId/field-permissions', (req) => {
    const roleId = req.params['roleId']!;
    const list = bodyOf(req)['fields'];
    if (!Array.isArray(list) || list.length === 0) {
      return validation('Error de validación', [{ field: 'fields', message: 'must contain at least 1 elements' }]);
    }
    for (const item of list as Record<string, unknown>[]) {
      if (
        typeof item['entity'] !== 'string' ||
        item['entity'] === '' ||
        typeof item['columnName'] !== 'string' ||
        item['columnName'] === '' ||
        typeof item['canRead'] !== 'boolean' ||
        typeof item['canWrite'] !== 'boolean' ||
        (item['maskStrategy'] !== undefined && !MASKS.has(String(item['maskStrategy'])))
      ) {
        return validation('Error de validación', [{ field: 'fields', message: 'entity, columnName, canRead and canWrite are required' }]);
      }
    }
    if (!roleExists(roleId)) return rejectWith(notFound('Rol no encontrado'), 'ROLE_NOT_FOUND');
    const items = list as { entity: string; columnName: string; canRead: boolean; canWrite: boolean; maskStrategy?: string }[];
    if (items.some((i) => i.canWrite && !i.canRead)) {
      return precondition('Escribir un campo exige poder leerlo', 'ROLE_FIELD_PERMISSION_WRITE_REQUIRES_READ');
    }
    const rules = fieldsOf(roleId);
    for (const i of items) {
      const existing = rules.find((r) => r.entity === i.entity && r.columnName === i.columnName);
      const next = { ...i, maskStrategy: i.maskStrategy ?? null, conditionJson: null };
      if (existing) Object.assign(existing, next);
      else rules.push(next);
    }
    return { ok: true, affected: items.length };
  });

  /* ---- alcance de recurso ---------------------------------------------- */

  const grants: ScopeGrant[] = [
    {
      id: nextId(),
      subjectId: '00000000-0000-4000-8000-00000000c002',
      permissionId: 'perm-audit-export',
      resourceId: '00000000-0000-4000-8000-00000000d001',
      tenantId: null,
      subjectType: 'USER',
      resourceType: 'DOCUMENT',
      effect: 'DENY',
      validFrom: null,
      validTo: null,
      createdAt: iso(now() - 12 * DAY_MS),
    },
  ];
  const grantView = (g: ScopeGrant) => ({
    ...g,
    isEffective:
      (g.validFrom === null || Date.parse(g.validFrom) <= now()) && (g.validTo === null || Date.parse(g.validTo) > now()),
  });

  router.get('/authz/resource-scope-grants', (req) => {
    const limit = Number(req.query.get('limit') ?? 50);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      return validation('Error de validación', [{ field: 'limit', message: 'must not be greater than 200' }]);
    }
    const q = (k: string) => req.query.get(k);
    for (const key of ['subjectId', 'resourceId']) {
      if (q(key) !== null && q(key) !== '' && !UUID.test(q(key)!)) {
        return validation('Error de validación', [{ field: key, message: 'must be a UUID' }]);
      }
    }
    const rows = grants
      .filter(
        (g) =>
          (!q('subjectId') || g.subjectId === q('subjectId')) &&
          (!q('resourceId') || g.resourceId === q('resourceId')) &&
          (!q('permissionId') || g.permissionId === q('permissionId')),
      )
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const start = Number(q('cursor') ?? '0') || 0;
    return {
      items: rows.slice(start, start + limit).map(grantView),
      nextCursor: start + limit < rows.length ? String(start + limit) : null,
      limit,
    };
  });

  router.post('/authz/resource-scope-grants', (req) => {
    const b = bodyOf(req);
    const issues: { field: string; message: string }[] = [];
    if (!SUBJECTS.has(String(b['subjectType']))) issues.push({ field: 'subjectType', message: 'must be one of the following values: USER, ROLE, SERVICE' });
    if (!RESOURCES.has(String(b['resourceType']))) issues.push({ field: 'resourceType', message: 'must be one of the following values: PATIENT, ENCOUNTER, DOCUMENT, RECORD' });
    if (!EFFECTS.has(String(b['effect']))) issues.push({ field: 'effect', message: 'must be one of the following values: ALLOW, DENY' });
    if (typeof b['subjectId'] !== 'string' || !UUID.test(b['subjectId'])) issues.push({ field: 'subjectId', message: 'must be a UUID' });
    if (typeof b['resourceId'] !== 'string' || !UUID.test(b['resourceId'])) issues.push({ field: 'resourceId', message: 'must be a UUID' });
    if (typeof b['permissionId'] !== 'string' || b['permissionId'] === '') issues.push({ field: 'permissionId', message: 'must be a UUID' });
    if (issues.length > 0) return validation('Error de validación', issues);
    if (!catalog().some((p) => p.id === b['permissionId'])) {
      return precondition('El permiso no existe', 'ROLE_PERMISSION_NOT_FOUND');
    }
    const from = typeof b['validFrom'] === 'string' ? (b['validFrom'] as string) : null;
    const to = typeof b['validTo'] === 'string' ? (b['validTo'] as string) : null;
    if (from !== null && to !== null && Date.parse(from) >= Date.parse(to)) {
      return precondition('validFrom debe ser anterior a validTo', 'RESOURCE_SCOPE_INVALID_VALIDITY_WINDOW');
    }
    const duplicate = grants.some(
      (g) =>
        g.subjectId === b['subjectId'] &&
        g.permissionId === b['permissionId'] &&
        g.resourceId === b['resourceId'] &&
        grantView(g).isEffective,
    );
    if (duplicate) return conflict('Ya existe un permiso vigente para ese sujeto, permiso y recurso');
    const grant: ScopeGrant = {
      id: nextId(),
      subjectId: b['subjectId'] as string,
      permissionId: b['permissionId'] as string,
      resourceId: b['resourceId'] as string,
      tenantId: typeof b['tenantId'] === 'string' ? b['tenantId'] : null,
      subjectType: b['subjectType'] as string,
      resourceType: b['resourceType'] as string,
      effect: b['effect'] as string,
      validFrom: from,
      validTo: to,
      createdAt: iso(now()),
    };
    grants.unshift(grant);
    return reply(201, { id: grant.id });
  });

  router.delete('/authz/resource-scope-grants/:grantId', (req) => {
    const grant = grants.find((g) => g.id === req.params['grantId']);
    if (!grant) return rejectWith(notFound('Permiso por alcance no encontrado'), 'RESOURCE_SCOPE_GRANT_NOT_FOUND');
    if (grant.validTo !== null && Date.parse(grant.validTo) <= now()) {
      return rejectWith(conflict('El permiso por alcance ya terminó su vigencia'), 'RESOURCE_SCOPE_GRANT_ALREADY_ENDED');
    }
    grant.validTo = iso(now());
    return { id: grant.id, validTo: grant.validTo };
  });

  /* ---- simulación del PDP ---------------------------------------------- */

  router.post('/authz/decisions/evaluate', (req) => {
    const b = bodyOf(req);
    const issues: { field: string; message: string }[] = [];
    if (typeof b['userId'] !== 'string' || !UUID.test(b['userId'])) issues.push({ field: 'userId', message: 'must be a UUID' });
    if (typeof b['tenantId'] !== 'string' || !UUID.test(b['tenantId'])) issues.push({ field: 'tenantId', message: 'must be a UUID' });
    if (!ACTIONS.has(String(b['action']))) issues.push({ field: 'action', message: 'must be one of the following values: READ, WRITE, CREATE, DELETE, EXECUTE, APPROVE' });
    if (typeof b['resource'] !== 'string' || b['resource'].trim() === '') issues.push({ field: 'resource', message: 'must be longer than or equal to 1 characters' });
    if (b['purposeOfUse'] !== undefined && !PURPOSES.has(String(b['purposeOfUse']))) issues.push({ field: 'purposeOfUse', message: 'must be a valid enum value' });
    if (issues.length > 0) return validation('Error de validación', issues);

    const userId = b['userId'] as string;
    const resource = b['resource'] as string;
    const action = b['action'] as string;
    const assignments = ask<{ items: { roleId: string; isEffective: boolean }[] }>('GET', `/authz/users/${userId}/role-assignments`);
    const effectiveRoleIds = [
      ...new Set((assignments?.status === 200 ? assignments.body.items : []).filter((a) => a.isEffective).map((a) => a.roleId)),
    ];
    const hits = effectiveRoleIds.flatMap((roleId) => {
      const perms = ask<{ items: { code: string; resource: string; effect: string }[] }>('GET', `/authz/roles/${roleId}/permissions`);
      return (perms?.body.items ?? [])
        .filter((p) => {
          const suffix = p.code.split('.').pop() ?? '';
          return p.resource === resource && (ACTION_OF_SUFFIX[suffix] ?? suffix) === action;
        })
        .map((p) => ({ roleId, effect: p.effect }));
    });
    const denied = hits.some((h) => h.effect === 'DENY');
    const allowed = hits.some((h) => h.effect === 'ALLOW');
    const decision = allowed && !denied ? 'PERMIT' : 'DENY';
    const why = denied
      ? 'Un permiso del rol lo niega y la negación prevalece'
      : allowed
        ? 'Un rol efectivo lo permite'
        : effectiveRoleIds.length === 0
          ? 'La persona no tiene roles efectivos'
          : 'Ningún rol efectivo concede esa acción sobre ese recurso';
    const maskedFields =
      decision === 'PERMIT'
        ? effectiveRoleIds.flatMap((roleId) =>
            fieldsOf(roleId)
              .filter((f) => f.entity === resource && (!f.canRead || f.maskStrategy !== null))
              .map((f) => ({ entity: f.entity, columnName: f.columnName, strategy: f.maskStrategy ?? 'NULLIFY' })),
          )
        : [];
    return {
      decision,
      reason: `${why} (decisión simulada por la maqueta, no del PDP real)`,
      effectiveRoleIds,
      maskedFields,
      ...(typeof b['purposeOfUse'] === 'string' ? { purposeOfUse: b['purposeOfUse'] } : {}),
      cacheKey: `simulada:${userId}:${action}:${resource}`,
      ttlSeconds: 30,
    };
  });

  /* ---- ciclo de vida ---------------------------------------------------- */

  const history = new Map<string, LifecycleEvent[]>();
  const stateOf = (userId: string): string => {
    const last = history.get(userId)?.[0]?.kind;
    return last === 'SUSPENDED' ? 'SUSPENDED' : last === 'OFFBOARDED' ? 'OFFBOARDED' : 'ACTIVE';
  };
  const userExists = (userId: string): boolean => (ask('GET', `/iam/users/${userId}`)?.status ?? 404) === 200;
  const userMissing = (): MockReply => rejectWith(notFound('Usuario no encontrado'), 'USER_LIFECYCLE_USER_NOT_FOUND');

  router.get('/authz/users/:userId/lifecycle', (req) => {
    const userId = req.params['userId']!;
    if (!userExists(userId)) return userMissing();
    return { userId, state: stateOf(userId), history: history.get(userId) ?? [] };
  });

  const act =
    (action: 'suspend' | 'reactivate' | 'offboard'): MockHandler =>
    (req) => {
      const userId = req.params['userId']!;
      const reason = textReason(req);
      if (typeof reason !== 'string') return reason;
      if (action !== 'reactivate' && req.user?.id === userId) {
        return precondition('Nadie puede suspenderse ni darse de baja a sí mismo', 'USER_LIFECYCLE_SELF_ACTION');
      }
      if (!userExists(userId)) return userMissing();
      const state = stateOf(userId);
      if (action === 'suspend' && state !== 'ACTIVE') {
        return rejectWith(conflict('La cuenta no está activa', { userId, state }), 'USER_LIFECYCLE_NOT_ACTIVE');
      }
      if (action === 'reactivate' && state === 'OFFBOARDED') {
        return rejectWith(conflict('La cuenta se dio de baja: no se reactiva', { userId, state }), 'USER_LIFECYCLE_ALREADY_OFFBOARDED');
      }
      if (action === 'reactivate' && state !== 'SUSPENDED') {
        return rejectWith(conflict('La cuenta no está suspendida', { userId, state }), 'USER_LIFECYCLE_NOT_SUSPENDED');
      }
      if (action === 'offboard' && state === 'OFFBOARDED') {
        return rejectWith(conflict('La cuenta ya se dio de baja', { userId, state }), 'USER_LIFECYCLE_ALREADY_OFFBOARDED');
      }
      let revoked = 0;
      if (action === 'offboard') {
        const list = ask<{ items: { id: string; status: string }[] }>('GET', `/authz/users/${userId}/role-assignments`);
        for (const a of (list?.body.items ?? []).filter((x) => x.status === 'ACTIVE')) {
          if (ask('DELETE', `/authz/users/${userId}/role-assignments/${a.id}`)?.status === 200) revoked += 1;
        }
      }
      const kind = action === 'suspend' ? 'SUSPENDED' : action === 'reactivate' ? 'REACTIVATED' : 'OFFBOARDED';
      history.set(userId, [
        { id: nextId(), kind, reason, actorUserId: req.user?.id ?? null, recordedAt: iso(now()) },
        ...(history.get(userId) ?? []),
      ]);
      return {
        userId,
        state: stateOf(userId),
        revokedAssignments: revoked,
        note:
          action === 'offboard'
            ? 'Las sesiones abiertas se cortaron y los roles de authz se revocaron.'
            : action === 'suspend'
              ? 'Las sesiones abiertas se cortaron. Los roles se conservan.'
              : 'La cuenta puede volver a ingresar. Sus roles no cambiaron.',
      };
    };

  router.post('/authz/users/:userId/lifecycle/suspend', act('suspend'));
  router.post('/authz/users/:userId/lifecycle/reactivate', act('reactivate'));
  router.post('/authz/users/:userId/lifecycle/offboard', act('offboard'));

  /* ---- revisión de accesos ---------------------------------------------- */

  const reviews: Review[] = [];

  router.get('/authz/access-reviews/due', (req) => {
    const raw = req.query.get('olderThanDays');
    const days = raw === null || raw === '' ? null : Number(raw);
    if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
      return validation('Error de validación', [{ field: 'olderThanDays', message: 'must not be greater than 3650' }]);
    }
    const users = ask<Page<{ id: string; displayName: string; assignments: unknown[] }>>('GET', '/authz/internal-users', 'limit=200')?.body.items ?? [];
    const items = users
      .filter((u) => u.assignments.length > 0)
      .map((u) => {
        const last = reviews.filter((r) => r.userId === u.id).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))[0];
        return { userId: u.id, displayName: u.displayName, activeAssignments: u.assignments.length, lastReviewedAt: last?.reviewedAt ?? null };
      })
      .filter((i) => days === null || i.lastReviewedAt === null || Date.parse(i.lastReviewedAt) < now() - days * DAY_MS)
      .sort((a, b) => (a.lastReviewedAt ?? '').localeCompare(b.lastReviewedAt ?? ''));
    return { items, olderThanDays: days };
  });

  router.get('/authz/users/:userId/access-reviews', (req) => {
    const userId = req.params['userId']!;
    if (!userExists(userId)) return rejectWith(notFound('Usuario no encontrado'), 'ACCESS_REVIEW_USER_NOT_FOUND');
    return { userId, items: reviews.filter((r) => r.userId === userId).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt)) };
  });

  router.post('/authz/users/:userId/access-reviews', (req) => {
    const userId = req.params['userId']!;
    const b = bodyOf(req);
    const reason = textReason(req);
    if (typeof reason !== 'string') return reason;
    if (b['decision'] !== 'CERTIFIED' && b['decision'] !== 'CHANGES_REQUIRED') {
      return validation('Error de validación', [{ field: 'decision', message: 'must be one of the following values: CERTIFIED, CHANGES_REQUIRED' }]);
    }
    if (!Array.isArray(b['assignmentIds'])) {
      return validation('Error de validación', [{ field: 'assignmentIds', message: 'must be an array' }]);
    }
    if (req.user?.id === userId) return precondition('Nadie revisa sus propios accesos', 'ACCESS_REVIEW_SELF_REVIEW');
    if (!userExists(userId)) return rejectWith(notFound('Usuario no encontrado'), 'ACCESS_REVIEW_USER_NOT_FOUND');
    const ids = [...new Set(b['assignmentIds'] as string[])];
    const list = ask<{ items: { id: string; status: string }[] }>('GET', `/authz/users/${userId}/role-assignments`);
    const active = new Set((list?.body.items ?? []).filter((a) => a.status === 'ACTIVE').map((a) => a.id));
    if (ids.some((id) => !active.has(id))) {
      return precondition('Alguna asignación citada no es de esa persona o ya no está activa', 'ACCESS_REVIEW_ASSIGNMENT_MISMATCH');
    }
    const review: Review = {
      id: nextId(),
      userId,
      decision: b['decision'] as string,
      reason,
      assignmentIds: ids,
      reviewerUserId: req.user?.id ?? null,
      reviewedAt: iso(now()),
    };
    reviews.unshift(review);
    return reply(201, review);
  });
}
