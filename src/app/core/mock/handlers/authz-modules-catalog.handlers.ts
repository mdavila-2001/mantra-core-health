import { HttpHeaders } from '@angular/common/http';

import type {
  CanonicalAction,
  CellAction,
  CellCoverage,
  GapKind,
  GapSeverity,
  ModuleCell,
  ModuleEntry,
  ModuleGap,
  ModuleGrant,
  ModulePermission,
  ModuleResource,
  ModuleRouteStats,
} from '../../data-access/authz-governance/authz-modules-catalog.types';
import { CANONICAL_ACTIONS } from '../../data-access/authz-governance/authz-modules-catalog.types';
import { isMockReply, type MockRequest, type MockRouter } from '../mock-router';

/* ============================================================================
    Backend simulado del catálogo RBAC por módulo (`GET /authz/catalog/modules`).

    **SIMULADO · DATOS SINTÉTICOS.** Los permisos, los roles y sus vínculos NO son
    inventados aquí: se leen llamando a los manejadores que ya sirven
    `/authz/permissions`, `/authz/roles` y `/authz/roles/:id/permissions`, de modo que
    lo que se edite con `PUT /authz/roles/:id/permissions` se ve al volver a leer. Lo
    único propio de este archivo son las RUTAS de cada módulo (cuántas, con qué rol, si
    declaran autorización): son una maqueta, y la respuesta lo dice en sus `notes`.

    **Debe registrarse DESPUÉS de `registerGovernance` y `registerPermissionsAdmin`.**

    Los huecos se calculan con las mismas reglas que la API: una celda sin permiso fino
    cuyas rutas sólo tienen `@Roles` (o ninguna autorización declarada) es un hueco, y un
    módulo con rutas pero sin ningún permiso fino lo es entero.
    ========================================================================== */

const SIMULADO = 'SIMULADO · DATOS SINTÉTICOS';

/** Una celda de rutas de la maqueta: lo que el código del módulo exigiría hoy. */
interface RutaSimulada {
  readonly resource: string;
  readonly action: CanonicalAction;
  readonly routes: number;
  readonly mutating: boolean;
  readonly roles: readonly string[];
  readonly status: 'ROLE_ONLY' | 'UNDECLARED_AUTH' | 'GUARD_ONLY' | 'PUBLIC';
}

const MODULOS_SIMULADOS: Readonly<Record<string, readonly RutaSimulada[]>> = {
  audit: [
    {
      resource: 'general',
      action: 'read',
      routes: 2,
      mutating: false,
      roles: ['AUDITOR', 'DPO'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'general',
      action: 'export',
      routes: 1,
      mutating: false,
      roles: ['DPO'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'retention',
      action: 'configure',
      routes: 1,
      mutating: true,
      roles: ['DPO'],
      status: 'ROLE_ONLY',
    },
  ],
  data_catalog: [
    {
      resource: 'general',
      action: 'read',
      routes: 3,
      mutating: false,
      roles: ['DPO', 'GOVERNANCE_ADMIN'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'general',
      action: 'approve',
      routes: 1,
      mutating: true,
      roles: ['GOVERNANCE_ADMIN'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'annotations',
      action: 'update',
      routes: 2,
      mutating: true,
      roles: ['GOVERNANCE_ADMIN'],
      status: 'ROLE_ONLY',
    },
  ],
  authz: [
    {
      resource: 'general',
      action: 'assign',
      routes: 1,
      mutating: true,
      roles: ['SECURITY_ADMIN'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'permissions',
      action: 'create',
      routes: 1,
      mutating: true,
      roles: ['SECURITY_ADMIN'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'roles_permissions',
      action: 'update',
      routes: 1,
      mutating: true,
      roles: ['SECURITY_ADMIN'],
      status: 'ROLE_ONLY',
    },
  ],
  scheduling: [
    {
      resource: 'general',
      action: 'read',
      routes: 4,
      mutating: false,
      roles: ['SCHEDULING_ADMIN', 'SCHEDULING_AGENT'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'bookings',
      action: 'create',
      routes: 1,
      mutating: true,
      roles: ['SCHEDULING_ADMIN'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'confirmation_rules',
      action: 'update',
      routes: 1,
      mutating: true,
      roles: [],
      status: 'UNDECLARED_AUTH',
    },
  ],
  pharma_lab: [
    {
      resource: 'products',
      action: 'list',
      routes: 2,
      mutating: false,
      roles: ['PHARMA_LAB_ADMIN'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'products',
      action: 'create',
      routes: 1,
      mutating: true,
      roles: ['PHARMA_LAB_ADMIN'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'notices',
      action: 'update',
      routes: 1,
      mutating: true,
      roles: [],
      status: 'UNDECLARED_AUTH',
    },
  ],
  billing: [
    {
      resource: 'invoices',
      action: 'list',
      routes: 2,
      mutating: false,
      roles: ['FINANCE'],
      status: 'ROLE_ONLY',
    },
    {
      resource: 'invoices',
      action: 'export',
      routes: 1,
      mutating: false,
      roles: ['FINANCE'],
      status: 'ROLE_ONLY',
    },
    { resource: 'ping', action: 'read', routes: 1, mutating: false, roles: [], status: 'PUBLIC' },
  ],
};

/** El sufijo del código de la maqueta (`AUDIT.EXPORT`) → acción canónica. */
const ACCION_DEL_SUFIJO: Readonly<Record<string, CanonicalAction>> = {
  READ: 'read',
  EXPORT: 'export',
  REVIEW: 'approve',
  ASSIGN: 'assign',
  WRITE: 'update',
  CREATE: 'create',
  DELETE: 'delete',
};

interface PermisoLeido {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly resource: string;
  readonly isDangerous: boolean;
}
interface RolLeido {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly isSystem: boolean;
  readonly tenantId: string | null;
}
interface VinculoLeido {
  readonly permissionId: string;
  readonly effect: string;
  readonly scope: string | null;
}

const ORDEN: readonly string[] = [...CANONICAL_ACTIONS, 'other'];
const ordenar = (valores: Iterable<string>): string[] =>
  [...new Set(valores)].sort((a, b) => a.localeCompare(b));

function estadisticas(rutas: readonly RutaSimulada[]): ModuleRouteStats {
  const suma = (pred: (r: RutaSimulada) => boolean): number =>
    rutas.filter(pred).reduce((n, r) => n + r.routes, 0);
  return {
    total: suma(() => true),
    publicRoutes: suma((r) => r.status === 'PUBLIC'),
    roleOnly: suma((r) => r.status === 'ROLE_ONLY'),
    guardOnly: suma((r) => r.status === 'GUARD_ONLY'),
    selfService: 0,
    undeclaredAuth: suma((r) => r.status === 'UNDECLARED_AUTH'),
    mutating: suma((r) => r.mutating),
    mutatingRoleOnly: suma((r) => r.mutating && r.status === 'ROLE_ONLY'),
  };
}

function cobertura(conPermiso: boolean, rutas: readonly RutaSimulada[]): CellCoverage {
  if (conPermiso) return 'FINE_PERMISSION';
  if (rutas.some((r) => r.status === 'UNDECLARED_AUTH')) return 'UNDECLARED_AUTH';
  if (rutas.some((r) => r.status === 'ROLE_ONLY')) return 'ROLE_ONLY';
  if (rutas.some((r) => r.status === 'GUARD_ONLY')) return 'GUARD_ONLY';
  return 'NOT_APPLICABLE';
}

function severidad(kind: GapKind, mutating: boolean): GapSeverity {
  if (kind === 'UNDECLARED_AUTH') return mutating ? 'HIGH' : 'MEDIUM';
  if (kind === 'ROLE_ONLY') return mutating ? 'MEDIUM' : 'LOW';
  return kind === 'GUARD_ONLY' ? 'LOW' : 'MEDIUM';
}

/** Registra el catálogo RBAC por módulo simulado. Llamar después de gobierno y permisos. */
export function registrarCatalogoDeModulos(router: MockRouter): void {
  /** Llama a un manejador ya registrado, como lo haría una petición. */
  function preguntar<T>(path: string, query = ''): T | null {
    const match = router.match('GET', path);
    if (match === null) return null;
    const out = match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: null,
    } satisfies MockRequest);
    if (isMockReply(out)) return out.status === 200 ? (out.body as T) : null;
    return out as T;
  }

  router.get('/authz/catalog/modules', (req) => {
    const permisos =
      preguntar<{ items: PermisoLeido[] }>('/authz/permissions', 'limit=200')?.items ?? [];
    const roles = preguntar<RolLeido[]>('/authz/roles') ?? [];
    const vinculos = new Map<string, ModuleGrant[]>();
    for (const rol of roles) {
      const lectura = preguntar<{ items: VinculoLeido[] }>(`/authz/roles/${rol.id}/permissions`);
      for (const v of lectura?.items ?? []) {
        if (v.effect !== 'ALLOW' && v.effect !== 'DENY') continue;
        const lista = vinculos.get(v.permissionId) ?? [];
        lista.push({
          roleId: rol.id,
          roleCode: rol.code,
          roleName: rol.name,
          effect: v.effect,
          scope: v.scope,
          constraintJson: null,
          fieldValueSetId: null,
        });
        vinculos.set(v.permissionId, lista);
      }
    }

    // Cada permiso de la maqueta cae en el módulo de su `resource`.
    const porModulo = new Map<
      string,
      { permisos: ModulePermission[]; recurso: Map<string, string> }
    >();
    const ranura = (clave: string) => {
      let r = porModulo.get(clave);
      if (r === undefined) {
        r = { permisos: [], recurso: new Map() };
        porModulo.set(clave, r);
      }
      return r;
    };
    for (const p of permisos) {
      const sufijo = p.code.split('.').pop() ?? '';
      const accion: CellAction = ACCION_DEL_SUFIJO[sufijo] ?? 'other';
      const modulo = ranura(p.resource);
      modulo.permisos.push({
        id: p.id,
        code: p.code,
        name: p.name,
        resource: p.resource,
        legacyAction: sufijo || null,
        action: accion,
        canonicalCode: false,
        isDangerous: p.isDangerous,
        isActive: true,
        grants: vinculos.get(p.id) ?? [],
      });
      modulo.recurso.set(p.id, 'general');
    }
    for (const clave of Object.keys(MODULOS_SIMULADOS)) ranura(clave);

    const modulos: ModuleEntry[] = [];
    for (const clave of ordenar(porModulo.keys())) {
      const { permisos: permisosDelModulo, recurso } = porModulo.get(clave)!;
      const rutas = MODULOS_SIMULADOS[clave] ?? [];
      const recursos = ordenar([...rutas.map((r) => r.resource), ...recurso.values()]);
      const gaps: ModuleGap[] = [];
      const resources: ModuleResource[] = recursos.map((nombre) => {
        const permisosDelRecurso = permisosDelModulo.filter((p) => recurso.get(p.id) === nombre);
        const acciones = [
          ...new Set([
            ...rutas.filter((r) => r.resource === nombre).map((r) => r.action as string),
            ...permisosDelRecurso.map((p) => p.action as string),
          ]),
        ].sort((a, b) => ORDEN.indexOf(a) - ORDEN.indexOf(b));
        const cells: ModuleCell[] = acciones.map((accion) => {
          const rutasDeLaCelda = rutas.filter((r) => r.resource === nombre && r.action === accion);
          const permisosDeLaCelda = permisosDelRecurso.filter((p) => p.action === accion);
          const canonica = (CANONICAL_ACTIONS as readonly string[]).includes(accion);
          const propuesta = canonica ? `${clave}.${nombre}.${accion}` : null;
          if (permisosDeLaCelda.length === 0 && canonica) {
            for (const kind of ['UNDECLARED_AUTH', 'ROLE_ONLY', 'GUARD_ONLY'] as const) {
              const subconjunto = rutasDeLaCelda.filter((r) => r.status === kind);
              if (subconjunto.length === 0) continue;
              gaps.push({
                kind,
                severity: severidad(
                  kind,
                  subconjunto.some((r) => r.mutating),
                ),
                module: clave,
                resource: nombre,
                action: accion as CanonicalAction,
                proposedCode: propuesta,
                routeCount: subconjunto.reduce((n, r) => n + r.routes, 0),
                sampleRoutes: [
                  {
                    method: subconjunto[0]!.mutating ? 'POST' : 'GET',
                    template: `/${clave.replace(/_/g, '-')}/${nombre} (${SIMULADO})`,
                    controller: 'ControladorSimulado',
                    handler: accion,
                    roles: [...subconjunto[0]!.roles],
                  },
                ],
                roles: ordenar(subconjunto.flatMap((r) => r.roles)),
              });
            }
          }
          const suma = (pred: (r: RutaSimulada) => boolean): number =>
            rutasDeLaCelda.filter(pred).reduce((n, r) => n + r.routes, 0);
          return {
            action: accion as CellAction,
            proposedCode: propuesta,
            coverage: cobertura(permisosDeLaCelda.length > 0, rutasDeLaCelda),
            permissionIds: permisosDeLaCelda.map((p) => p.id),
            routeCount: suma(() => true),
            mutatingRouteCount: suma((r) => r.mutating),
            undeclaredRouteCount: suma((r) => r.status === 'UNDECLARED_AUTH'),
            publicRouteCount: suma((r) => r.status === 'PUBLIC'),
            routeRoles: ordenar(
              rutasDeLaCelda.filter((r) => r.status === 'ROLE_ONLY').flatMap((r) => r.roles),
            ),
          };
        });
        return { resource: nombre, permissions: permisosDelRecurso, cells };
      });
      const autorizables = rutas.filter((r) => r.status !== 'PUBLIC');
      if (permisosDelModulo.length === 0 && autorizables.length > 0) {
        gaps.unshift({
          kind: 'MODULE_WITHOUT_FINE_PERMISSIONS',
          severity: 'MEDIUM',
          module: clave,
          resource: null,
          action: null,
          proposedCode: null,
          routeCount: autorizables.reduce((n, r) => n + r.routes, 0),
          sampleRoutes: [],
          roles: ordenar(autorizables.flatMap((r) => r.roles)),
        });
      }
      const orden: Record<GapSeverity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      gaps.sort((a, b) => orden[a.severity] - orden[b.severity]);
      modulos.push({
        key: clave,
        routes: estadisticas(rutas),
        permissionCount: permisosDelModulo.length,
        grantCount: permisosDelModulo.reduce((n, p) => n + p.grants.length, 0),
        roleCodesInCode: ordenar(
          rutas.filter((r) => r.status === 'ROLE_ONLY').flatMap((r) => r.roles),
        ),
        resources,
        gaps,
      });
    }

    const filtro = req.query.get('module');
    const visibles =
      filtro === null || filtro === '' ? modulos : modulos.filter((m) => m.key === filtro);
    return {
      generatedAt: new Date().toISOString(),
      canonicalActions: [...CANONICAL_ACTIONS],
      notes: [
        `${SIMULADO}: las rutas de cada módulo son una maqueta; los permisos y roles salen del gobierno simulado.`,
        'Los controladores autorizan con `@Roles(...)`. Ningún controlador evalúa un permiso fino: lo hacen el PDP y la capa de vistas.',
        'Asignar un permiso a un rol no cambia hoy lo que un endpoint permite.',
        'Los códigos propuestos no están sembrados.',
      ],
      truncated: false,
      availableModules: modulos.map((m) => m.key),
      summary: {
        modules: visibles.length,
        permissions: visibles.reduce((n, m) => n + m.permissionCount, 0),
        routes: visibles.reduce((n, m) => n + m.routes.total, 0),
        roleOnlyRoutes: visibles.reduce((n, m) => n + m.routes.roleOnly, 0),
        undeclaredAuthRoutes: visibles.reduce((n, m) => n + m.routes.undeclaredAuth, 0),
        gaps: visibles.reduce((n, m) => n + m.gaps.length, 0),
        modulesWithoutFinePermissions: visibles.filter(
          (m) => m.routes.total > 0 && m.permissionCount === 0,
        ).length,
      },
      roles,
      modules: visibles,
    };
  });
}
