import { HttpHeaders } from '@angular/common/http';

import type {
  ModuleEntry,
  ModulesCatalog,
} from '../../data-access/authz-governance/authz-modules-catalog.types';
import { CANONICAL_ACTIONS } from '../../data-access/authz-governance/authz-modules-catalog.types';
import { MockRouter, isMockReply, type MockMethod, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarCatalogoDeModulos } from './authz-modules-catalog.handlers';
import { registerGovernance } from './governance.handlers';
import { registerPermissionsAdmin } from './permissions-admin.handlers';

type Wire = Omit<ModulesCatalog, 'generatedAt'> & { generatedAt: string };

describe('catálogo RBAC por módulo simulado: mismas reglas que GET /authz/catalog/modules', () => {
  let router: MockRouter;
  const admin = buscarUsuario('superadmin')!;

  beforeEach(() => {
    router = new MockRouter();
    registerGovernance(router);
    registerPermissionsAdmin(router);
    registrarCatalogoDeModulos(router);
  });

  function call(
    method: MockMethod,
    path: string,
    body: unknown = null,
    query: Record<string, string> = {},
  ) {
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
  const data = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;
  const catalog = (query: Record<string, string> = {}) =>
    data<Wire>(call('GET', '/authz/catalog/modules', null, query));
  const moduleOf = (c: Wire, key: string): ModuleEntry => c.modules.find((m) => m.key === key)!;

  it('se declara simulado y repite lo que la lectura no demuestra', () => {
    const c = catalog();
    expect(c.notes[0]).toContain('SIMULADO');
    expect(c.notes.join(' ')).toContain('@Roles');
    expect(c.canonicalActions).toEqual([...CANONICAL_ACTIONS]);
    expect(c.truncated).toBe(false);
  });

  it('correcto: los permisos y los roles que los tienen salen del gobierno simulado', () => {
    const audit = moduleOf(catalog(), 'audit');
    const general = audit.resources.find((r) => r.resource === 'general')!;
    const read = general.permissions.find((p) => p.code === 'AUDIT.READ')!;
    expect(read.grants.map((g) => `${g.roleCode}:${g.effect}`).sort()).toEqual([
      'AUDITOR:ALLOW',
      'DPO:ALLOW',
    ]);
    const exportar = general.permissions.find((p) => p.code === 'AUDIT.EXPORT')!;
    expect(exportar.grants.map((g) => `${g.roleCode}:${g.effect}`).sort()).toEqual([
      'AUDITOR:DENY',
      'DPO:ALLOW',
    ]);
    expect(general.cells.find((c) => c.action === 'read')).toMatchObject({
      coverage: 'FINE_PERMISSION',
      permissionIds: [read.id],
      routeRoles: ['AUDITOR', 'DPO'],
    });
  });

  it('huecos: una celda sin permiso fino es un hueco y un módulo sin ninguno lo es entero', () => {
    const c = catalog();
    const audit = moduleOf(c, 'audit');
    expect(audit.gaps).toEqual([
      expect.objectContaining({
        kind: 'ROLE_ONLY',
        severity: 'MEDIUM',
        proposedCode: 'audit.retention.configure',
        routeCount: 1,
      }),
    ]);
    const pharma = moduleOf(c, 'pharma_lab');
    expect(pharma.permissionCount).toBe(0);
    expect(pharma.gaps[0]).toMatchObject({
      kind: 'UNDECLARED_AUTH',
      severity: 'HIGH',
      proposedCode: 'pharma_lab.notices.update',
    });
    expect(pharma.gaps.some((g) => g.kind === 'MODULE_WITHOUT_FINE_PERMISSIONS')).toBe(true);
    expect(c.summary.modulesWithoutFinePermissions).toBeGreaterThanOrEqual(2);
    expect(c.summary.gaps).toBe(c.modules.reduce((n, m) => n + m.gaps.length, 0));
  });

  it('límite: un módulo con sólo rutas públicas no tiene huecos', () => {
    const billing = moduleOf(catalog(), 'billing');
    expect(billing.resources.find((r) => r.resource === 'ping')!.cells[0]).toMatchObject({
      coverage: 'NOT_APPLICABLE',
      publicRouteCount: 1,
    });
    expect(billing.gaps.some((g) => g.resource === 'ping')).toBe(false);
  });

  it('límite: lo que se guarda con PUT se ve al volver a leer el catálogo', () => {
    const saved = call('PUT', '/authz/roles/role-dpo/permissions', {
      permissions: [{ permissionId: 'perm-audit-read', effect: 'DENY', scope: 'GLOBAL' }],
    });
    expect(status(saved)).toBe(200);
    const read = moduleOf(catalog(), 'audit')
      .resources.find((r) => r.resource === 'general')!
      .permissions.find((p) => p.code === 'AUDIT.READ')!;
    expect(read.grants.find((g) => g.roleCode === 'DPO')).toMatchObject({
      effect: 'DENY',
      scope: 'GLOBAL',
    });
    const exportar = moduleOf(catalog(), 'audit')
      .resources.find((r) => r.resource === 'general')!
      .permissions.find((p) => p.code === 'AUDIT.EXPORT')!;
    expect(exportar.grants.map((g) => g.roleCode)).toEqual(['AUDITOR']);
  });

  it('límite: el filtro de módulo acota la respuesta y conserva la lista de módulos', () => {
    const c = catalog({ module: 'authz' });
    expect(c.modules.map((m) => m.key)).toEqual(['authz']);
    expect(c.availableModules).toContain('pharma_lab');
    expect(c.summary.modules).toBe(1);
  });

  it('inválido: un módulo que no existe devuelve la lista vacía, no un error', () => {
    const c = catalog({ module: 'no_existe' });
    expect(c.modules).toEqual([]);
    expect(c.summary).toMatchObject({ modules: 0, permissions: 0, routes: 0 });
  });

  it('toda celda canónica sin permiso lleva un código propuesto y ninguna "other" lo lleva', () => {
    for (const m of catalog().modules) {
      for (const r of m.resources) {
        for (const cell of r.cells) {
          if (cell.action === 'other') expect(cell.proposedCode).toBeNull();
          else expect(cell.proposedCode).toBe(`${m.key}.${r.resource}.${cell.action}`);
        }
      }
    }
  });
});
