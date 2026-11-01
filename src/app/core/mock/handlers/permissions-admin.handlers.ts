import { HttpHeaders } from '@angular/common/http';

import {
  conflict, isMockReply, notFound, precondition, reply, validation, type MockHandler,
  type MockReply, type MockRequest, type MockRouter,
} from '../mock-router';
import {
  DAY_MS, ACTIONS, SCOPES, EFFECTS, MASKS, SUBJECTS, RESOURCES, PURPOSES, UUID, ACTION_OF_SUFFIX,
  rejectWith, bodyOf, denyReason, lifecycleReason, type Binding, type FieldRule, type ScopeGrant,
  type LifecycleEvent, type Review, type Page,
} from './permissions-admin.support';

/* ============================================================================
    Backend simulado del gobierno de permisos (H5): edición de permisos por
    rol, permisos por campo y por alcance de recurso, «quién puede qué»,
    simulación del PDP, ciclo de vida de las cuentas internas (rutas de `iam`) y
    revisión de accesos.

    Reproduce el contrato REAL de la API: el ciclo de vida vive en
    `/iam/users/:id/{suspend,reactivate,deactivate}` y `GET …/lifecycle`; la
    revisión de accesos es un hecho sin cuerpo (`POST /authz/users/:id/access-reviews`);
    el simulador es `POST /authz/simulations`. Simplificación declarada: no
    distingue al administrador de plataforma del que tiene alcance de una
    organización, así que el 403 `ROLE_INSUFFICIENT` que la API da al segundo no
    se simula.

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
    if (grant.effect === 'DENY') {
      const reason = denyReason(req);
      if (typeof reason !== 'string') return reason;
    }
    if (grant.validTo !== null && Date.parse(grant.validTo) <= now()) {
      return rejectWith(conflict('El permiso por alcance ya terminó su vigencia'), 'RESOURCE_SCOPE_GRANT_ALREADY_ENDED');
    }
    grant.validTo = iso(now());
    return { id: grant.id, validTo: grant.validTo };
  });


  /* ---- personas: existencia, nombre y estado ------------------------------ */

  const history = new Map<string, LifecycleEvent[]>();
  const lifecycleStateOf = (userId: string): 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' => {
    const last = history.get(userId)?.[0]?.action;
    return last === 'SUSPEND' ? 'SUSPENDED' : last === 'DEACTIVATE' ? 'DEACTIVATED' : 'ACTIVE';
  };
  const accountStatusOf = (userId: string): string => (lifecycleStateOf(userId) === 'ACTIVE' ? 'ACTIVE' : 'LOCKED');
  const userExists = (userId: string): boolean => (ask('GET', `/iam/users/${userId}`)?.status ?? 404) === 200;

  interface InternalUserRow {
    id: string;
    displayName: string;
    globalRoles: string[];
    assignments: unknown[];
  }
  const internalUsers = (): readonly InternalUserRow[] =>
    ask<Page<InternalUserRow>>('GET', '/authz/internal-users', 'limit=200')?.body.items ?? [];
  const nameOf = (userId: string): string | null =>
    internalUsers().find((u) => u.id === userId)?.displayName ??
    ask<{ displayName?: string }>('GET', `/iam/users/${userId}`)?.body.displayName ??
    null;

  const missingUser = (): MockReply => rejectWith(notFound('Usuario no encontrado'), 'GOVERNANCE_USER_NOT_FOUND');

  /** Página por cursor opaco (el índice de la primera fila), con el límite validado como la API. */
  function pageOf<T>(req: MockRequest, rows: readonly T[], max: number, byDefault: number): MockReply | Page<T> {
    const raw = req.query.get('limit');
    const limit = raw === null || raw === '' ? byDefault : Number(raw);
    if (!Number.isInteger(limit) || limit < 1 || limit > max) {
      return validation('Error de validación', [{ field: 'limit', message: `must not be greater than ${max}` }]);
    }
    const start = Number(req.query.get('cursor') ?? '0') || 0;
    return {
      items: rows.slice(start, start + limit),
      nextCursor: start + limit < rows.length ? String(start + limit) : null,
      limit,
    };
  }

  /* ---- simulación del PDP ---------------------------------------------- */

  router.post('/authz/simulations', (req) => {
    const b = bodyOf(req);
    const issues: { field: string; message: string }[] = [];
    if (typeof b['userId'] !== 'string' || !UUID.test(b['userId'])) issues.push({ field: 'userId', message: 'must be a UUID' });
    if (typeof b['tenantId'] !== 'string' || !UUID.test(b['tenantId'])) issues.push({ field: 'tenantId', message: 'must be a UUID' });
    if (!ACTIONS.has(String(b['action']))) issues.push({ field: 'action', message: 'must be one of the following values: READ, WRITE, CREATE, DELETE, EXECUTE, APPROVE' });
    if (typeof b['resource'] !== 'string' || b['resource'].trim() === '') issues.push({ field: 'resource', message: 'must be longer than or equal to 1 characters' });
    if (b['purposeOfUse'] !== undefined && !PURPOSES.has(String(b['purposeOfUse']))) issues.push({ field: 'purposeOfUse', message: 'must be a valid enum value' });
    if (issues.length > 0) return validation('Error de validación', issues);

    const userId = b['userId'] as string;
    // Un usuario inexistente daría un DENY engañoso: la API lo rechaza antes de consultar al PDP.
    if (!userExists(userId)) return missingUser();
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
      simulated: true,
      decision: {
        decision,
        reason: `${why} (decisión simulada por la maqueta, no del PDP real)`,
        effectiveRoleIds,
        maskedFields,
        ...(typeof b['purposeOfUse'] === 'string' ? { purposeOfUse: b['purposeOfUse'] } : {}),
        cacheKey: `simulada:${userId}:${action}:${resource}`,
        ttlSeconds: 30,
      },
    };
  });

  /* ---- revisión de accesos (se declara antes: el mapa de accesos lee la última) --- */

  const reviews: Review[] = [];
  const lastReviewOf = (userId: string): Review | null =>
    reviews.filter((r) => r.userId === userId).sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt))[0] ?? null;

  /* ---- «quién puede qué» -------------------------------------------------- */

  router.get('/authz/users/:userId/access-map', (req) => {
    const userId = req.params['userId']!;
    if (!userExists(userId)) return missingUser();
    const list = ask<{ items: { roleId: string; isEffective: boolean }[] }>('GET', `/authz/users/${userId}/role-assignments`);
    const assignments = list?.body.items ?? [];
    const roleIds = [...new Set(assignments.filter((a) => a.isEffective).map((a) => a.roleId))];
    return {
      user: { id: userId, displayName: nameOf(userId) ?? 'Sin nombre', accountStatus: accountStatusOf(userId) },
      globalRoles: [...(internalUsers().find((u) => u.id === userId)?.globalRoles ?? [])].sort(),
      assignments,
      counts: {
        directGrants: 0,
        resourceScopeGrants: grants.filter((g) => g.subjectType === 'USER' && g.subjectId === userId && grantView(g).isEffective).length,
        restrictedFields: roleIds.reduce(
          (sum, roleId) => sum + fieldsOf(roleId).filter((f) => !f.canRead || !f.canWrite || f.maskStrategy !== null).length,
          0,
        ),
      },
      lastReview: lastReviewOf(userId),
    };
  });

  router.get('/authz/permissions/:permissionId/holders', (req) => {
    const permissionId = req.params['permissionId']!;
    if (!catalog().some((p) => p.id === permissionId)) {
      return rejectWith(notFound('Permiso no encontrado'), 'GOVERNANCE_PERMISSION_NOT_FOUND');
    }
    const source = req.query.get('source');
    if (source !== null && source !== '' && !['ROLE', 'USER', 'RESOURCE'].includes(source)) {
      return validation('Error de validación', [{ field: 'source', message: 'must be one of the following values: ROLE, USER, RESOURCE' }]);
    }
    const text = (req.query.get('q') ?? '').trim().toLowerCase();
    const rows = internalUsers()
      .map((u) => {
        const list = ask<{ items: { roleId: string; roleCode: string; isEffective: boolean; tenantId: string | null }[] }>(
          'GET',
          `/authz/users/${u.id}/role-assignments`,
        );
        const byRole = (list?.body.items ?? [])
          .filter((a) => a.isEffective)
          .flatMap((a) => {
            const perms = ask<{ items: { permissionId: string; effect: string }[] }>('GET', `/authz/roles/${a.roleId}/permissions`);
            const hit = perms?.body.items.find((p) => p.permissionId === permissionId);
            return hit
              ? [{ source: 'ROLE', effect: hit.effect, roleCode: a.roleCode, viaRoleCode: a.roleCode, resourceId: null, tenantId: a.tenantId }]
              : [];
          });
        const byResource = grants
          .filter((g) => g.subjectType === 'USER' && g.subjectId === u.id && g.permissionId === permissionId && grantView(g).isEffective)
          .map((g) => ({ source: 'RESOURCE', effect: g.effect, roleCode: null, viaRoleCode: null, resourceId: g.resourceId, tenantId: g.tenantId }));
        return {
          userId: u.id,
          displayName: u.displayName,
          accountStatus: accountStatusOf(u.id),
          sources: [...byRole, ...byResource].filter((s) => !source || s.source === source),
        };
      })
      .filter((h) => h.sources.length > 0 && (text === '' || h.displayName.toLowerCase().includes(text)))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
    const page = pageOf(req, rows, 200, 50);
    return isMockReply(page) ? page : { permissionId, ...page };
  });

  /* ---- ciclo de vida (iam) ---------------------------------------------- */

  router.get('/iam/users/:id/lifecycle', (req) => {
    const userId = req.params['id']!;
    if (!userExists(userId)) return rejectWith(notFound('Usuario no encontrado'), 'USER_NOT_FOUND');
    const page = pageOf(req, history.get(userId) ?? [], 100, 20);
    return isMockReply(page) ? page : { userId, state: lifecycleStateOf(userId), ...page };
  });

  const LIFECYCLE = {
    suspend: { event: 'SUSPEND', from: ['ACTIVE'], to: 'SUSPENDED' },
    reactivate: { event: 'REACTIVATE', from: ['SUSPENDED'], to: 'ACTIVE' },
    deactivate: { event: 'DEACTIVATE', from: ['ACTIVE', 'SUSPENDED'], to: 'DEACTIVATED' },
  } as const;

  const act =
    (action: keyof typeof LIFECYCLE): MockHandler =>
    (req) => {
      const userId = req.params['id']!;
      const rule = LIFECYCLE[action];
      const reason = lifecycleReason(req);
      if (typeof reason !== 'string') return reason;
      if (action !== 'reactivate' && req.user?.id === userId) {
        return precondition('Un administrador no puede suspender ni dar de baja su propia cuenta', 'USER_SELF_LIFECYCLE_FORBIDDEN');
      }
      if (!userExists(userId)) return rejectWith(notFound('Usuario no encontrado'), 'USER_NOT_FOUND');
      const from = lifecycleStateOf(userId);
      // Idempotente: la cuenta ya está donde la acción la dejaría y no se escribe nada.
      if (from === rule.to) return { id: userId, state: from, changed: false, revokedSessions: 0 };
      if (!(rule.from as readonly string[]).includes(from)) {
        return rejectWith(
          conflict('La cuenta no puede pasar a ese estado desde el que tiene', { userId, action, state: from }),
          'USER_LIFECYCLE_TRANSITION_INVALID',
        );
      }
      if (action !== 'reactivate') {
        const target = internalUsers().find((u) => u.id === userId);
        const holdsAccess = target?.globalRoles.some((r) => r === 'SECURITY_ADMIN' || r === 'SUPERADMIN') ?? false;
        const others = internalUsers().filter(
          (u) => u.id !== userId && lifecycleStateOf(u.id) === 'ACTIVE' && u.globalRoles.some((r) => r === 'SECURITY_ADMIN' || r === 'SUPERADMIN'),
        );
        if (holdsAccess && others.length === 0) {
          return precondition('Es la última cuenta que administra accesos: conceda ese rol a otra antes', 'USER_LAST_SECURITY_ADMIN');
        }
      }
      // La baja real revoca credenciales, roles GLOBALES de `iam` y sesiones; las asignaciones de `authz`
      // no se tocan (la cuenta ya no puede ingresar). La maqueta tampoco las toca.
      history.set(userId, [
        { id: nextId(), action: rule.event, reason, recordedByUserId: req.user?.id ?? null, recordedAt: iso(now()) },
        ...(history.get(userId) ?? []),
      ]);
      return { id: userId, state: rule.to, changed: true, revokedSessions: action === 'reactivate' ? 0 : 1 };
    };

  router.post('/iam/users/:id/suspend', act('suspend'));
  router.post('/iam/users/:id/reactivate', act('reactivate'));
  router.post('/iam/users/:id/deactivate', act('deactivate'));

  /* ---- revisión de accesos ---------------------------------------------- */

  const DUE_LOOKBACK_DAYS = 730;
  const isAccessAdmin = (u: InternalUserRow): boolean =>
    u.globalRoles.some((r) => r === 'SECURITY_ADMIN' || r === 'SUPERADMIN') || u.assignments.length > 0;

  router.get('/authz/access-reviews/due', (req) => {
    const raw = req.query.get('olderThanDays');
    const days = raw === null || raw === '' ? 90 : Number(raw);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return validation('Error de validación', [{ field: 'olderThanDays', message: 'must not be greater than 3650' }]);
    }
    const rows = internalUsers()
      .filter(isAccessAdmin)
      .map((u) => {
        const last = lastReviewOf(u.id);
        return {
          userId: u.id,
          displayName: u.displayName,
          accountStatus: accountStatusOf(u.id),
          lastReviewedAt: last?.reviewedAt ?? null,
          lastReviewerUserId: last?.reviewerUserId ?? null,
        };
      })
      .filter((i) => i.lastReviewedAt === null || Date.parse(i.lastReviewedAt) < now() - days * DAY_MS)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'es'));
    const page = pageOf(req, rows, 200, 50);
    return isMockReply(page) ? page : { ...page, olderThanDays: days, lookbackDays: DUE_LOOKBACK_DAYS };
  });

  router.get('/authz/access-reviews', (req) => {
    for (const key of ['userId', 'reviewerId']) {
      const value = req.query.get(key);
      if (value !== null && value !== '' && !UUID.test(value)) {
        return validation('Error de validación', [{ field: key, message: 'must be a UUID' }]);
      }
    }
    const rows = reviews
      .filter(
        (r) =>
          (!req.query.get('userId') || r.userId === req.query.get('userId')) &&
          (!req.query.get('reviewerId') || r.reviewerUserId === req.query.get('reviewerId')),
      )
      .slice()
      .sort((a, b) => b.reviewedAt.localeCompare(a.reviewedAt));
    return pageOf(req, rows, 200, 50);
  });

  router.post('/authz/users/:userId/access-reviews', (req) => {
    const userId = req.params['userId']!;
    const reviewerId = req.user?.id ?? null;
    if (reviewerId === userId) {
      return precondition('Los accesos propios los revisa otra persona', 'ACCESS_REVIEW_SELF_REVIEW_FORBIDDEN');
    }
    if (!userExists(userId)) return missingUser();
    const review: Review = {
      id: nextId(),
      userId,
      userDisplayName: nameOf(userId),
      reviewerUserId: reviewerId ?? '00000000-0000-4000-8000-00000000c001',
      reviewerDisplayName: reviewerId ? nameOf(reviewerId) : null,
      reviewedAt: iso(now()),
    };
    reviews.unshift(review);
    return reply(201, review);
  });
}
