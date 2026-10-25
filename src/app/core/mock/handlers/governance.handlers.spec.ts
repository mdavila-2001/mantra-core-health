import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registerGovernance } from './governance.handlers';

describe('gobierno de acceso simulado: mismas reglas que /audit, /authz y la deriva de permisos', () => {
  const router = new MockRouter();
  registerGovernance(router);
  const admin = buscarUsuario('superadmin')!;

  function call(method: MockMethod, path: string, query: Record<string, string> = {}, body: unknown = null) {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body,
      headers: new HttpHeaders(),
      user: admin,
    } satisfies MockRequest);
  }

  const status = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const bodyOf = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;

  interface Page<T> {
    items: T[];
    nextCursor: string | null;
    limit: number;
  }

  it('la bitácora va de lo más nuevo a lo más viejo, mira 30 días sin rango y pagina por cursor', () => {
    const first = bodyOf<Page<{ id: string; recordedAt: string }>>(call('GET', '/audit/log', { limit: '2' }));
    expect(first.items).toHaveLength(2);
    expect(first.items[0]!.recordedAt >= first.items[1]!.recordedAt).toBe(true);
    expect(first.nextCursor).not.toBeNull();
    const all = bodyOf<Page<{ id: string }>>(call('GET', '/audit/log'));
    // El sello de hace 45 días queda fuera de la ventana por omisión.
    expect(all.items.map((e) => e.id)).not.toContain('audit-6');
    const wide = bodyOf<Page<{ id: string }>>(call('GET', '/audit/log', { from: '2000-01-01' }));
    expect(wide.items.map((e) => e.id)).toContain('audit-6');
  });

  it('filtra la bitácora por resultado y verbo, y un código desconocido es 400', () => {
    const failures = bodyOf<Page<{ result: string }>>(call('GET', '/audit/log', { result: 'FAILURE' }));
    expect(failures.items.every((e) => e.result === 'FAILURE')).toBe(true);
    expect(status(call('GET', '/audit/log', { result: 'MAYBE' }))).toBe(400);
    expect(status(call('GET', '/audit/log', { method: 'GET' }))).toBe(400);
    expect(status(call('GET', '/audit/log', { limit: '500' }))).toBe(400);
  });

  it('los accesos a datos sensibles no traen pacientes', () => {
    const page = bodyOf<Page<{ patientProfileId: string | null; operation: string }>>(
      call('GET', '/audit/data-access', { operation: 'READ' }),
    );
    expect(page.items.length).toBeGreaterThan(0);
    expect(page.items.every((e) => e.patientProfileId === null && e.operation === 'READ')).toBe(true);
    expect(status(call('GET', '/audit/data-access', { operation: 'PEEK' }))).toBe(400);
  });

  it('un rol de ámbito global con organización es 422 con su motivo en la raíz del cuerpo', () => {
    const users = bodyOf<Page<{ id: string }>>(call('GET', '/authz/internal-users'));
    const target = users.items[0]!.id;
    const res = call('POST', `/authz/users/${target}/role-assignments`, {}, {
      roleId: 'role-auditor',
      tenantId: '00000000-0000-4000-8000-00000000c0a1',
    });
    expect(status(res)).toBe(422);
    expect(bodyOf<{ code: string; reason: string }>(res)).toMatchObject({
      code: 'PRECONDITION_FAILED',
      reason: 'ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE',
    });
  });

  it('asignar, repetir y revocar siguen las reglas de la API', () => {
    const users = bodyOf<Page<{ id: string; globalRoles: string[] }>>(call('GET', '/authz/internal-users'));
    const target = users.items.find((u) => u.globalRoles.includes('SECURITY_ADMIN'))!.id;

    const created = call('POST', `/authz/users/${target}/role-assignments`, {}, { roleId: 'role-auditor' });
    expect(status(created)).toBe(201);
    const id = bodyOf<{ id: string }>(created).id;

    const again = call('POST', `/authz/users/${target}/role-assignments`, {}, { roleId: 'role-auditor' });
    expect(status(again)).toBe(409);
    expect(bodyOf<{ reason: string }>(again).reason).toBe('ROLE_ASSIGNMENT_ALREADY_ACTIVE');

    const listed = bodyOf<{ items: { id: string; appliesGlobally: boolean; isEffective: boolean }[] }>(
      call('GET', `/authz/users/${target}/role-assignments`),
    );
    expect(listed.items.find((a) => a.id === id)).toMatchObject({ appliesGlobally: true, isEffective: true });

    const revoked = call('DELETE', `/authz/users/${target}/role-assignments/${id}`);
    expect(bodyOf<{ status: string }>(revoked).status).toBe('REVOKED');
    const twice = call('DELETE', `/authz/users/${target}/role-assignments/${id}`);
    expect(status(twice)).toBe(422);
    expect(bodyOf<{ reason: string }>(twice).reason).toBe('ROLE_ASSIGNMENT_NOT_ACTIVE');
  });

  it('un usuario o una asignación que no existen son 404 con su motivo', () => {
    const missing = '00000000-0000-4000-8000-0000000000ff';
    const res = call('GET', `/authz/users/${missing}/role-assignments`);
    expect(status(res)).toBe(404);
    expect(bodyOf<{ reason: string }>(res).reason).toBe('ROLE_ASSIGNMENT_USER_NOT_FOUND');
  });

  it('los permisos de un rol traen efecto y ámbito; el catálogo busca por texto', () => {
    const perms = bodyOf<{ roleCode: string; items: { effect: string; scope: string }[] }>(
      call('GET', '/authz/roles/role-auditor/permissions'),
    );
    expect(perms.roleCode).toBe('AUDITOR');
    expect(perms.items.map((p) => p.effect)).toEqual(['ALLOW', 'DENY']);
    const search = bodyOf<Page<{ code: string }>>(call('GET', '/authz/permissions', { q: 'audit' }));
    expect(search.items.every((p) => p.code.startsWith('AUDIT.'))).toBe(true);
    expect(status(call('GET', '/authz/roles/nope/permissions'))).toBe(404);
  });

  it('la deriva de permisos trae las tres categorías y el recuento de rutas', () => {
    const drift = bodyOf<{
      routes: { total: number; withoutRoles: number };
      usedNotSeeded: unknown[];
      seededNotUsed: string[];
      routesWithoutRolesTruncated: boolean;
    }>(call('GET', '/admin/catalog/permission-drift'));
    expect(drift.routes.total).toBeGreaterThan(0);
    expect(drift.usedNotSeeded.length).toBeGreaterThan(0);
    expect(drift.seededNotUsed.length).toBeGreaterThan(0);
    expect(drift.routesWithoutRolesTruncated).toBe(true);
  });
});
