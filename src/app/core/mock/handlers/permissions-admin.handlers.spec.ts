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
      const ended = call('DELETE', `/authz/resource-scope-grants/${id}`);
      expect(status(ended)).toBe(200);
      const again = call('DELETE', `/authz/resource-scope-grants/${id}`);
      expect(status(again)).toBe(409);
      expect(reasonOf(again)).toBe('RESOURCE_SCOPE_GRANT_ALREADY_ENDED');
      expect(data<{ items: { isEffective: boolean }[] }>(call('GET', '/authz/resource-scope-grants', null, { resourceId: RESOURCE })).items[0]!.isEffective).toBe(false);
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
    const ask = (userId: string, action: string, resource: string) =>
      data<{ decision: string; effectiveRoleIds: string[]; reason: string; maskedFields: unknown[] }>(
        call('POST', '/authz/decisions/evaluate', { userId, tenantId: TENANT, action, resource }),
      );

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

    it('una persona sin roles efectivos recibe DENY, y los campos restringidos viajan como enmascarados', () => {
      expect(ask('00000000-0000-4000-8000-00000000ffff', 'READ', 'audit').decision).toBe('DENY');
      call('PUT', '/authz/roles/role-dpo/permissions', { permissions: [{ permissionId: 'perm-audit-read', effect: 'ALLOW' }] });
      call('PUT', '/authz/roles/role-dpo/field-permissions', { fields: [{ entity: 'audit', columnName: 'ip', canRead: true, canWrite: false, maskStrategy: 'HASH' }] });
      expect(ask(DPO, 'READ', 'audit').maskedFields).toEqual([{ entity: 'audit', columnName: 'ip', strategy: 'HASH' }]);
    });

    it('valida la entrada como el ValidationPipe', () => {
      expect(status(call('POST', '/authz/decisions/evaluate', { userId: 'x', tenantId: TENANT, action: 'FLY', resource: '' }))).toBe(400);
    });
  });

  describe('ciclo de vida', () => {
    const lifecycle = (id: string) => data<{ state: string; history: { kind: string; reason: string }[] }>(call('GET', `/authz/users/${id}/lifecycle`));
    const act = (id: string, action: string, reason = 'Motivo suficiente') => call('POST', `/authz/users/${id}/lifecycle/${action}`, { reason });

    it('suspender y reactivar dejan el historial con motivo', () => {
      expect(lifecycle(DPO).state).toBe('ACTIVE');
      expect(status(act(DPO, 'suspend', 'Licencia por maternidad'))).toBe(200);
      expect(lifecycle(DPO)).toEqual(expect.objectContaining({ state: 'SUSPENDED' }));
      expect(status(act(DPO, 'reactivate', 'Volvió de su licencia'))).toBe(200);
      const l = lifecycle(DPO);
      expect(l.state).toBe('ACTIVE');
      expect(l.history.map((e) => e.kind)).toEqual(['REACTIVATED', 'SUSPENDED']);
      expect(l.history[1]!.reason).toBe('Licencia por maternidad');
    });

    it('una transición inválida es 409 con su reason, y no escribe en el historial', () => {
      const notSuspended = act(DPO, 'reactivate');
      expect(status(notSuspended)).toBe(409);
      expect(reasonOf(notSuspended)).toBe('USER_LIFECYCLE_NOT_SUSPENDED');
      act(DPO, 'suspend');
      const twice = act(DPO, 'suspend');
      expect(status(twice)).toBe(409);
      expect(reasonOf(twice)).toBe('USER_LIFECYCLE_NOT_ACTIVE');
      expect(lifecycle(DPO).history).toHaveLength(1);
    });

    it('exige motivo, usuario existente y que nadie se suspenda a sí mismo', () => {
      expect(status(act(DPO, 'suspend', 'corto'))).toBe(400);
      expect(reasonOf(act('00000000-0000-4000-8000-00000000ffff', 'suspend'))).toBe('USER_LIFECYCLE_USER_NOT_FOUND');
      const self = call('POST', `/authz/users/${DPO}/lifecycle/suspend`, { reason: 'Me suspendo yo mismo' }, {}, { ...admin, id: DPO });
      expect(status(self)).toBe(422);
      expect(reasonOf(self)).toBe('USER_LIFECYCLE_SELF_ACTION');
    });
  });

  describe('revisión de accesos', () => {
    const activeIds = (id: string) =>
      data<{ items: { id: string; status: string }[] }>(call('GET', `/authz/users/${id}/role-assignments`)).items.filter((a) => a.status === 'ACTIVE').map((a) => a.id);
    const record = (id: string, body: unknown) => call('POST', `/authz/users/${id}/access-reviews`, body);

    it('registra quién, cuándo y qué asignaciones, y la cola cambia de fecha de última revisión', () => {
      const due = () => data<{ items: { userId: string; lastReviewedAt: string | null }[] }>(call('GET', '/authz/access-reviews/due'));
      expect(due().items.find((i) => i.userId === DPO)!.lastReviewedAt).toBeNull();
      const ids = activeIds(DPO);
      const created = record(DPO, { decision: 'CERTIFIED', reason: 'Sus roles siguen vigentes', assignmentIds: ids });
      expect(status(created)).toBe(201);
      expect(data<{ reviewerUserId: string }>(created).reviewerUserId).toBe(admin.id);
      expect(due().items.find((i) => i.userId === DPO)!.lastReviewedAt).not.toBeNull();
      const history = data<{ items: { decision: string; assignmentIds: string[] }[] }>(call('GET', `/authz/users/${DPO}/access-reviews`));
      expect(history.items).toEqual([expect.objectContaining({ decision: 'CERTIFIED', assignmentIds: ids })]);
    });

    it('con un plazo, lo revisado hace un momento sale de la cola y lo nunca revisado sigue', () => {
      record(DPO, { decision: 'CERTIFIED', reason: 'Sus roles siguen vigentes', assignmentIds: activeIds(DPO) });
      const items = data<{ items: { userId: string }[] }>(call('GET', '/authz/access-reviews/due', null, { olderThanDays: '30' })).items;
      expect(items.map((i) => i.userId)).not.toContain(DPO);
      expect(items.map((i) => i.userId)).toContain(STEWARD);
      expect(status(call('GET', '/authz/access-reviews/due', null, { olderThanDays: '0' }))).toBe(400);
    });

    it('rechaza una asignación ajena, la propia revisión, un motivo corto y una decisión desconocida', () => {
      const foreign = record(DPO, { decision: 'CERTIFIED', reason: 'Citó una asignación ajena', assignmentIds: activeIds(STEWARD) });
      expect(status(foreign)).toBe(422);
      expect(reasonOf(foreign)).toBe('ACCESS_REVIEW_ASSIGNMENT_MISMATCH');
      const self = call('POST', `/authz/users/${DPO}/access-reviews`, { decision: 'CERTIFIED', reason: 'Me apruebo a mí mismo', assignmentIds: [] }, {}, { ...admin, id: DPO });
      expect(reasonOf(self)).toBe('ACCESS_REVIEW_SELF_REVIEW');
      expect(status(record(DPO, { decision: 'CERTIFIED', reason: 'corto', assignmentIds: [] }))).toBe(400);
      expect(status(record(DPO, { decision: 'TAL_VEZ', reason: 'Una decisión inventada', assignmentIds: [] }))).toBe(400);
    });
  });

  // Va al final a propósito: `governance.handlers.ts` guarda las asignaciones en el módulo, así que
  // la baja de esta persona se vería desde cualquier prueba que corriera después.
  describe('baja de una cuenta', () => {
    const act = (id: string, action: string) => call('POST', `/authz/users/${id}/lifecycle/${action}`, { reason: 'Motivo suficiente' });

    it('la baja revoca los roles activos, no se repite y no se reactiva', () => {
      const result = data<{ revokedAssignments: number; state: string }>(act(STEWARD, 'offboard'));
      expect(result).toEqual(expect.objectContaining({ state: 'OFFBOARDED', revokedAssignments: 2 }));
      const assignments = data<{ items: { status: string }[] }>(call('GET', `/authz/users/${STEWARD}/role-assignments`));
      expect(assignments.items.every((a) => a.status !== 'ACTIVE')).toBe(true);
      expect(reasonOf(act(STEWARD, 'offboard'))).toBe('USER_LIFECYCLE_ALREADY_OFFBOARDED');
      expect(reasonOf(act(STEWARD, 'reactivate'))).toBe('USER_LIFECYCLE_ALREADY_OFFBOARDED');
    });

  });
});
