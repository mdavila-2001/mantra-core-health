import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registerGovernance } from './governance.handlers';
import { registerPermissionsAdmin } from './permissions-admin.handlers';

const DPO = '00000000-0000-4000-8000-00000000c002';
const STEWARD = '00000000-0000-4000-8000-00000000c003';
const TENANT = '00000000-0000-4000-8000-00000000c0a1';
const RESOURCE = '00000000-0000-4000-8000-00000000d777';

describe('gobierno de permisos simulado: mismas reglas que la API', () => {
  let router: MockRouter;
  const admin = buscarUsuario('superadmin')!;

  beforeEach(() => {
    router = new MockRouter();
    registerGovernance(router);
    registerPermissionsAdmin(router);
  });

  function call(method: MockMethod, path: string, body: unknown = null, query: Record<string, string> = {}, user = admin) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body,
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest);
  }
  const status = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const data = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;
  const reasonOf = (r: unknown) => (data<{ reason?: string }>(r)).reason;

  describe('permisos por acción', () => {
    it('lo que se guarda es lo que se relee, y la edición no toca otros roles', () => {
      const before = data<{ items: unknown[] }>(call('GET', '/authz/roles/role-dpo/permissions')).items.length;
      const saved = call('PUT', '/authz/roles/role-dpo/permissions', {
        permissions: [{ permissionId: 'perm-audit-read', effect: 'DENY', scope: 'GLOBAL' }],
      });
      expect(status(saved)).toBe(200);
      expect(data<{ permissionCount: number }>(saved).permissionCount).toBe(1);
      const after = data<{ items: { code: string; effect: string }[] }>(call('GET', '/authz/roles/role-dpo/permissions'));
      expect(after.items).toEqual([expect.objectContaining({ code: 'AUDIT.READ', effect: 'DENY' })]);
      expect(before).toBeGreaterThan(1);
      expect(data<{ items: unknown[] }>(call('GET', '/authz/roles/role-auditor/permissions')).items).toHaveLength(2);
    });

    it('rechaza una lista vacía, un efecto desconocido, un permiso inexistente y un rol inexistente', () => {
      expect(status(call('PUT', '/authz/roles/role-dpo/permissions', { permissions: [] }))).toBe(400);
      expect(status(call('PUT', '/authz/roles/role-dpo/permissions', { permissions: [{ permissionId: 'perm-audit-read', effect: 'MAYBE' }] }))).toBe(400);
      const unknownPermission = call('PUT', '/authz/roles/role-dpo/permissions', { permissions: [{ permissionId: 'nope', effect: 'ALLOW' }] });
      expect(status(unknownPermission)).toBe(422);
      expect(reasonOf(unknownPermission)).toBe('ROLE_PERMISSION_NOT_FOUND');
      const unknownRole = call('PUT', '/authz/roles/no-existe/permissions', { permissions: [{ permissionId: 'perm-audit-read', effect: 'ALLOW' }] });
      expect(status(unknownRole)).toBe(404);
      expect(reasonOf(unknownRole)).toBe('ROLE_NOT_FOUND');
    });
  });

  describe('permisos por campo', () => {
    it('guarda con upsert por (entidad, columna) y exige leer para escribir', () => {
      const bad = call('PUT', '/authz/roles/role-auditor/field-permissions', { fields: [{ entity: 'p', columnName: 'c', canRead: false, canWrite: true }] });
      expect(status(bad)).toBe(422);
      expect(reasonOf(bad)).toBe('ROLE_FIELD_PERMISSION_WRITE_REQUIRES_READ');
      for (const mask of ['HASH', 'REDACT']) {
        expect(status(call('PUT', '/authz/roles/role-auditor/field-permissions', { fields: [{ entity: 'p', columnName: 'c', canRead: true, canWrite: false, maskStrategy: mask }] }))).toBe(200);
      }
      const rules = data<{ items: { maskStrategy: string }[] }>(call('GET', '/authz/roles/role-auditor/field-permissions')).items;
      expect(rules).toHaveLength(1);
      expect(rules[0]!.maskStrategy).toBe('REDACT');
    });

    it('un rol inexistente es 404 con su motivo', () => {
      expect(reasonOf(call('GET', '/authz/roles/nope/field-permissions'))).toBe('ROLE_NOT_FOUND');
    });
  });

  describe('alcance de recurso', () => {
    const body = { subjectType: 'USER', subjectId: DPO, permissionId: 'perm-catalog-read', resourceType: 'PATIENT', resourceId: RESOURCE, effect: 'DENY' };

    it('crea, lista y termina la vigencia; terminarla dos veces es 409', () => {
      const created = call('POST', '/authz/resource-scope-grants', body);
      expect(status(created)).toBe(201);
      const id = data<{ id: string }>(created).id;
      const listed = data<{ items: { id: string; isEffective: boolean }[] }>(call('GET', '/authz/resource-scope-grants', null, { resourceId: RESOURCE }));
      expect(listed.items).toEqual([expect.objectContaining({ id, isEffective: true })]);
      const ended = call('DELETE', `/authz/resource-scope-grants/${id}`, { reason: 'Se cargó por error, sí debe acceder' });
      expect(status(ended)).toBe(200);
      const again = call('DELETE', `/authz/resource-scope-grants/${id}`, { reason: 'Se cargó por error, sí debe acceder' });
      expect(status(again)).toBe(409);
      expect(reasonOf(again)).toBe('RESOURCE_SCOPE_GRANT_ALREADY_ENDED');
      expect(data<{ items: { isEffective: boolean }[] }>(call('GET', '/authz/resource-scope-grants', null, { resourceId: RESOURCE })).items[0]!.isEffective).toBe(false);
    });

    it('terminar un permiso DENY exige motivo (422) y no lo termina; un ALLOW no lo exige', () => {
      const deny = data<{ id: string }>(call('POST', '/authz/resource-scope-grants', body)).id;
      for (const motivo of [undefined, '', '   ', 'corto']) {
        const sinMotivo = call('DELETE', `/authz/resource-scope-grants/${deny}`, motivo === undefined ? null : { reason: motivo });
        expect(status(sinMotivo)).toBe(422);
        expect(reasonOf(sinMotivo)).toBe('RESOURCE_SCOPE_GRANT_DENY_REASON_REQUIRED');
      }
      expect(data<{ items: { isEffective: boolean }[] }>(call('GET', '/authz/resource-scope-grants', null, { resourceId: RESOURCE })).items[0]!.isEffective).toBe(true);
      const allow = data<{ id: string }>(call('POST', '/authz/resource-scope-grants', { ...body, resourceId: RESOURCE.replace('d777', 'd779'), effect: 'ALLOW' })).id;
      expect(status(call('DELETE', `/authz/resource-scope-grants/${allow}`))).toBe(200);
    });

    it('rechaza duplicados vigentes, ventanas invertidas, ids que no son UUID y grants inexistentes', () => {
      expect(status(call('POST', '/authz/resource-scope-grants', body))).toBe(201);
      expect(status(call('POST', '/authz/resource-scope-grants', body))).toBe(409);
      expect(status(call('POST', '/authz/resource-scope-grants', { ...body, resourceId: RESOURCE.replace('d777', 'd778'), validFrom: '2027-02-01T00:00:00Z', validTo: '2027-01-01T00:00:00Z' }))).toBe(422);
      expect(status(call('POST', '/authz/resource-scope-grants', { ...body, subjectId: 'no-es-uuid' }))).toBe(400);
      expect(reasonOf(call('DELETE', '/authz/resource-scope-grants/nope'))).toBe('RESOURCE_SCOPE_GRANT_NOT_FOUND');
    });
  });

  describe('simulación del PDP', () => {
    const simulate = (userId: string, action: string, resource: string) =>
      data<{ simulated: boolean; decision: { decision: string; effectiveRoleIds: string[]; reason: string; maskedFields: unknown[] } }>(
        call('POST', '/authz/simulations', { userId, tenantId: TENANT, action, resource }),
      );
    const ask = (userId: string, action: string, resource: string) => simulate(userId, action, resource).decision;

    it('devuelve la decisión envuelta y marcada como simulada', () => {
      const out = simulate(DPO, 'READ', 'audit');
      expect(out.simulated).toBe(true);
      expect(out.decision.decision).toBe('PERMIT');
    });

    it('permite lo que un rol efectivo concede y dice cuál rol decidió', () => {
      const result = ask(DPO, 'READ', 'audit');
      expect(result.decision).toBe('PERMIT');
      expect(result.effectiveRoleIds).toEqual(['role-dpo']);
      expect(result.reason).toContain('simulada');
    });

    it('niega por omisión, y la negación explícita prevalece sobre un permiso', () => {
      expect(ask(DPO, 'DELETE', 'audit').decision).toBe('DENY');
      call('PUT', '/authz/roles/role-dpo/permissions', {
        permissions: [
          { permissionId: 'perm-audit-read', effect: 'ALLOW' },
          { permissionId: 'perm-audit-read', effect: 'DENY' },
        ],
      });
      expect(ask(DPO, 'READ', 'audit').decision).toBe('DENY');
    });

    it('los campos restringidos viajan como enmascarados', () => {
      call('PUT', '/authz/roles/role-dpo/permissions', { permissions: [{ permissionId: 'perm-audit-read', effect: 'ALLOW' }] });
      call('PUT', '/authz/roles/role-dpo/field-permissions', { fields: [{ entity: 'audit', columnName: 'ip', canRead: true, canWrite: false, maskStrategy: 'HASH' }] });
      expect(ask(DPO, 'READ', 'audit').maskedFields).toEqual([{ entity: 'audit', columnName: 'ip', strategy: 'HASH' }]);
    });

    it('un usuario inexistente es 404 y NO una decisión DENY engañosa', () => {
      const r = call('POST', '/authz/simulations', { userId: '00000000-0000-4000-8000-00000000ffff', tenantId: TENANT, action: 'READ', resource: 'audit' });
      expect(status(r)).toBe(404);
      expect(reasonOf(r)).toBe('GOVERNANCE_USER_NOT_FOUND');
    });

    it('valida la entrada como el ValidationPipe', () => {
      expect(status(call('POST', '/authz/simulations', { userId: 'x', tenantId: TENANT, action: 'FLY', resource: '' }))).toBe(400);
    });
  });

  describe('«quién puede qué»', () => {
    const holders = (permissionId: string, query: Record<string, string> = {}) =>
      data<{ permissionId: string; items: { userId: string; displayName: string; sources: { source: string; effect: string; roleCode: string | null }[] }[]; nextCursor: string | null }>(
        call('GET', `/authz/permissions/${permissionId}/holders`, null, query),
      );

    it('lista a las personas con el permiso y el camino por el que lo tienen', () => {
      const out = holders('perm-audit-read');
      expect(out.permissionId).toBe('perm-audit-read');
      const dpo = out.items.find((h) => h.userId === DPO)!;
      expect(dpo.sources).toEqual([expect.objectContaining({ source: 'ROLE', effect: 'ALLOW', roleCode: 'DPO' })]);
    });

    it('un permiso inexistente es 404 con su motivo y un filtro de camino desconocido es 400', () => {
      const missing = call('GET', '/authz/permissions/nope/holders');
      expect(status(missing)).toBe(404);
      expect(reasonOf(missing)).toBe('GOVERNANCE_PERMISSION_NOT_FOUND');
      expect(status(call('GET', '/authz/permissions/perm-audit-read/holders', null, { source: 'MAGIA' }))).toBe(400);
    });

    it('un grant por recurso aparece como camino RESOURCE y el filtro de camino lo respeta', () => {
      call('POST', '/authz/resource-scope-grants', { subjectType: 'USER', subjectId: DPO, permissionId: 'perm-catalog-read', resourceType: 'PATIENT', resourceId: RESOURCE, effect: 'ALLOW' });
      const viaResource = holders('perm-catalog-read', { source: 'RESOURCE' });
      expect(viaResource.items.map((h) => h.userId)).toEqual([DPO]);
      expect(viaResource.items[0]!.sources.every((s) => s.source === 'RESOURCE')).toBe(true);
    });

    it('pagina por cursor y valida el límite', () => {
      for (const subjectId of [DPO, STEWARD]) {
        call('POST', '/authz/resource-scope-grants', { subjectType: 'USER', subjectId, permissionId: 'perm-catalog-read', resourceType: 'PATIENT', resourceId: RESOURCE, effect: 'ALLOW' });
      }
      const first = holders('perm-catalog-read', { source: 'RESOURCE', limit: '1' });
      expect(first.items).toHaveLength(1);
      expect(first.nextCursor).not.toBeNull();
      const second = holders('perm-catalog-read', { source: 'RESOURCE', limit: '1', cursor: first.nextCursor! });
      expect(second.items).toHaveLength(1);
      expect(second.items[0]!.userId).not.toBe(first.items[0]!.userId);
      expect(second.nextCursor).toBeNull();
      expect(status(call('GET', '/authz/permissions/perm-audit-read/holders', null, { limit: '500' }))).toBe(400);
    });

    it('el mapa de accesos de una persona trae roles, conteos y su última revisión', () => {
      const map = () =>
        data<{ user: { displayName: string }; globalRoles: string[]; assignments: unknown[]; counts: { resourceScopeGrants: number }; lastReview: { reviewerUserId: string } | null }>(
          call('GET', `/authz/users/${DPO}/access-map`),
        );
      expect(map().user.displayName).toBeTruthy();
      expect(map().assignments.length).toBeGreaterThan(0);
      expect(map().lastReview).toBeNull();
      call('POST', `/authz/users/${DPO}/access-reviews`);
      expect(map().lastReview!.reviewerUserId).toBe(admin.id);
      const missing = call('GET', '/authz/users/00000000-0000-4000-8000-00000000ffff/access-map');
      expect(status(missing)).toBe(404);
      expect(reasonOf(missing)).toBe('GOVERNANCE_USER_NOT_FOUND');
    });
  });

  describe('ciclo de vida (iam)', () => {
    const lifecycle = (id: string, query: Record<string, string> = {}) =>
      data<{ state: string; items: { action: string; reason: string }[]; nextCursor: string | null }>(call('GET', `/iam/users/${id}/lifecycle`, null, query));
    const act = (id: string, action: string, reason = 'Motivo suficiente') => call('POST', `/iam/users/${id}/${action}`, { reason });

    it('suspender y reactivar dejan el historial con motivo, de la más reciente a la más antigua', () => {
      expect(lifecycle(DPO).state).toBe('ACTIVE');
      const suspended = act(DPO, 'suspend', 'Licencia por maternidad');
      expect(data<{ changed: boolean; state: string; revokedSessions: number }>(suspended)).toEqual({ id: DPO, state: 'SUSPENDED', changed: true, revokedSessions: 1 });
      expect(lifecycle(DPO).state).toBe('SUSPENDED');
      expect(data<{ state: string }>(act(DPO, 'reactivate', 'Volvió de su licencia')).state).toBe('ACTIVE');
      const l = lifecycle(DPO);
      expect(l.state).toBe('ACTIVE');
      expect(l.items.map((e) => e.action)).toEqual(['REACTIVATE', 'SUSPEND']);
      expect(l.items[1]!.reason).toBe('Licencia por maternidad');
    });

    it('es idempotente: repetir la acción responde 200 con changed:false y no escribe en el historial', () => {
      act(DPO, 'suspend');
      const again = data<{ changed: boolean; revokedSessions: number }>(act(DPO, 'suspend'));
      expect(again).toEqual(expect.objectContaining({ changed: false, revokedSessions: 0 }));
      expect(lifecycle(DPO).items).toHaveLength(1);
      expect(data<{ changed: boolean }>(act(STEWARD, 'reactivate')).changed).toBe(false);
    });

    it('una transición inválida es 409 con su reason y no escribe: reactivar tras la baja, suspender tras la baja', () => {
      act(DPO, 'deactivate');
      for (const action of ['reactivate', 'suspend']) {
        const r = act(DPO, action);
        expect(status(r)).toBe(409);
        expect(reasonOf(r)).toBe('USER_LIFECYCLE_TRANSITION_INVALID');
      }
      expect(lifecycle(DPO)).toEqual(expect.objectContaining({ state: 'DEACTIVATED' }));
      expect(lifecycle(DPO).items).toHaveLength(1);
    });

    it('exige motivo no vacío, usuario existente y que nadie se suspenda a sí mismo', () => {
      expect(status(act(DPO, 'suspend', ''))).toBe(400);
      expect(status(act(DPO, 'suspend', '   '))).toBe(400);
      expect(status(act(DPO, 'suspend', 'x'.repeat(501)))).toBe(400);
      expect(reasonOf(act('00000000-0000-4000-8000-00000000ffff', 'suspend'))).toBe('USER_NOT_FOUND');
      const self = call('POST', `/iam/users/${DPO}/suspend`, { reason: 'Me suspendo yo mismo' }, {}, { ...admin, id: DPO });
      expect(status(self)).toBe(422);
      expect(reasonOf(self)).toBe('USER_SELF_LIFECYCLE_FORBIDDEN');
    });

    it('un motivo corto vale: la API no fija un mínimo en el ciclo de vida', () => {
      expect(status(act(DPO, 'suspend', 'baja'))).toBe(200);
    });

    it('pagina la historia con cursor', () => {
      act(DPO, 'suspend');
      act(DPO, 'reactivate');
      const first = lifecycle(DPO, { limit: '1' });
      expect(first.items).toHaveLength(1);
      expect(first.nextCursor).not.toBeNull();
      expect(status(call('GET', `/iam/users/${DPO}/lifecycle`, null, { limit: '101' }))).toBe(400);
    });
  });

  describe('revisión de accesos', () => {
    const due = (query: Record<string, string> = {}) =>
      data<{ items: { userId: string; lastReviewedAt: string | null }[]; olderThanDays: number; lookbackDays: number }>(call('GET', '/authz/access-reviews/due', null, query));
    const record = (id: string, user = admin) => call('POST', `/authz/users/${id}/access-reviews`, null, {}, user);

    it('registra quién y cuándo sin cuerpo, y la persona sale de la cola', () => {
      expect(due().items.find((i) => i.userId === DPO)!.lastReviewedAt).toBeNull();
      const created = record(DPO);
      expect(status(created)).toBe(201);
      expect(data<{ reviewerUserId: string; userId: string }>(created)).toEqual(expect.objectContaining({ reviewerUserId: admin.id, userId: DPO }));
      expect(due().items.map((i) => i.userId)).not.toContain(DPO);
      const history = data<{ items: { userId: string }[] }>(call('GET', '/authz/access-reviews', null, { userId: DPO }));
      expect(history.items).toEqual([expect.objectContaining({ userId: DPO })]);
    });

    it('la cola trae el plazo efectivo (90 por defecto) y el horizonte de búsqueda', () => {
      expect(due()).toEqual(expect.objectContaining({ olderThanDays: 90, lookbackDays: 730 }));
      expect(due({ olderThanDays: '30' }).olderThanDays).toBe(30);
    });

    it('con un plazo, lo revisado hace un momento sale de la cola y lo nunca revisado sigue', () => {
      record(DPO);
      const ids = due({ olderThanDays: '30' }).items.map((i) => i.userId);
      expect(ids).not.toContain(DPO);
      expect(ids).toContain(STEWARD);
      expect(status(call('GET', '/authz/access-reviews/due', null, { olderThanDays: '0' }))).toBe(400);
      expect(status(call('GET', '/authz/access-reviews/due', null, { olderThanDays: '3651' }))).toBe(400);
    });

    it('rechaza la propia revisión (422) y un usuario inexistente (404), sin sellar nada', () => {
      const self = record(DPO, { ...admin, id: DPO });
      expect(status(self)).toBe(422);
      expect(reasonOf(self)).toBe('ACCESS_REVIEW_SELF_REVIEW_FORBIDDEN');
      const missing = record('00000000-0000-4000-8000-00000000ffff');
      expect(status(missing)).toBe(404);
      expect(reasonOf(missing)).toBe('GOVERNANCE_USER_NOT_FOUND');
      expect(data<{ items: unknown[] }>(call('GET', '/authz/access-reviews')).items).toHaveLength(0);
    });

    it('valida los filtros de la historia como UUID', () => {
      expect(status(call('GET', '/authz/access-reviews', null, { userId: 'no-es-uuid' }))).toBe(400);
    });
  });

  // Va al final a propósito: `governance.handlers.ts` guarda las asignaciones en el módulo, así que
  // cualquier cambio de esta persona se vería desde una prueba que corriera después.
  describe('baja de una cuenta', () => {
    const act = (id: string, action: string) => call('POST', `/iam/users/${id}/${action}`, { reason: 'Motivo suficiente' });

    it('la baja deja la cuenta DEACTIVATED, no se repite como cambio y no se reactiva', () => {
      expect(data<{ state: string; changed: boolean }>(act(STEWARD, 'deactivate'))).toEqual(expect.objectContaining({ state: 'DEACTIVATED', changed: true }));
      expect(data<{ changed: boolean }>(act(STEWARD, 'deactivate')).changed).toBe(false);
      expect(reasonOf(act(STEWARD, 'reactivate'))).toBe('USER_LIFECYCLE_TRANSITION_INVALID');
    });
  });
});
