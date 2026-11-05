import type {
  CellAction,
  GapKind,
  GapSeverity,
  ModuleCell,
  ModuleEntry,
  ModuleGap,
  ModuleGrant,
  ModulePermission,
  ModulesCatalog,
} from '../../../../core/data-access/authz-governance/authz-modules-catalog.types';
import { CANONICAL_ACTIONS } from '../../../../core/data-access/authz-governance/authz-modules-catalog.types';

/* ============================================================================
    Lógica pura de la matriz RBAC por módulo: qué se muestra en cada celda, cómo
    se arma el reemplazo de permisos de un rol y qué cobertura tiene cada módulo.
    Sin Angular: lo que decide qué se manda al servidor se prueba aislado.
    ========================================================================== */

export type Effect = 'ALLOW' | 'DENY';
/** `''` = sin asignar. */
export type DraftEffect = Effect | '';

const ORDER: readonly string[] = [...CANONICAL_ACTIONS, 'other'];

/* ---- el módulo elegido ------------------------------------------------------ */

/** El módulo a mostrar: el pedido si existe; si no, el primero con permisos; si no, el primero. */
export function pickModule(catalog: ModulesCatalog, requested: string): ModuleEntry | null {
  const exact = catalog.modules.find((m) => m.key === requested);
  if (exact !== undefined) return exact;
  return catalog.modules.find((m) => m.permissionCount > 0) ?? catalog.modules[0] ?? null;
}

/* ---- la matriz módulo × acción ----------------------------------------------- */

export interface MatrixRow {
  readonly resource: string;
  /** Una celda por columna; `null` si el módulo no ofrece esa acción sobre el recurso. */
  readonly cells: readonly (ModuleCell | null)[];
  readonly permissions: ReadonlyMap<string, ModulePermission>;
}

export interface Matrix {
  readonly columns: readonly CellAction[];
  readonly rows: readonly MatrixRow[];
}

/** Sólo las acciones que el módulo realmente ofrece, en el orden canónico. */
export function buildMatrix(module: ModuleEntry, query = ''): Matrix {
  const text = query.trim().toLowerCase();
  const resources = module.resources.filter(
    (r) => text === '' || r.resource.toLowerCase().includes(text),
  );
  const columns = [...new Set(resources.flatMap((r) => r.cells.map((c) => c.action)))].sort(
    (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b),
  ) as CellAction[];
  return {
    columns,
    rows: resources.map((r) => ({
      resource: r.resource,
      cells: columns.map((a) => r.cells.find((c) => c.action === a) ?? null),
      permissions: new Map(r.permissions.map((p) => [p.id, p])),
    })),
  };
}

export interface CellRoles {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
}

/** Quién tiene (y a quién se le niega) lo que la celda protege con permisos finos. */
export function cellRoles(
  cell: ModuleCell,
  permissions: ReadonlyMap<string, ModulePermission>,
): CellRoles {
  const allow = new Set<string>();
  const deny = new Set<string>();
  for (const id of cell.permissionIds) {
    for (const g of permissions.get(id)?.grants ?? [])
      (g.effect === 'ALLOW' ? allow : deny).add(g.roleCode);
  }
  const sorted = (s: Set<string>): string[] => [...s].sort((a, b) => a.localeCompare(b));
  return { allow: sorted(allow), deny: sorted(deny) };
}

/* ---- la vista por rol ---------------------------------------------------------- */

export type Draft = ReadonlyMap<string, DraftEffect>;

/** El índice permiso → módulo, y lo que cada rol tiene hoy, para no recorrer el catálogo por celda. */
export interface CatalogIndex {
  readonly permissionById: ReadonlyMap<string, ModulePermission & { readonly module: string }>;
  /** `roleId` → (`permissionId` → vínculo vigente). */
  readonly grantsByRole: ReadonlyMap<string, ReadonlyMap<string, ModuleGrant>>;
}

export function indexCatalog(catalog: ModulesCatalog): CatalogIndex {
  const permissionById = new Map<string, ModulePermission & { module: string }>();
  const grantsByRole = new Map<string, Map<string, ModuleGrant>>();
  for (const m of catalog.modules) {
    for (const r of m.resources) {
      for (const p of r.permissions) {
        permissionById.set(p.id, { ...p, module: m.key });
        for (const g of p.grants) {
          const owned = grantsByRole.get(g.roleId) ?? new Map<string, ModuleGrant>();
          owned.set(p.id, g);
          grantsByRole.set(g.roleId, owned);
        }
      }
    }
  }
  return { permissionById, grantsByRole };
}

/** Lo que el rol tiene sobre un permiso, con el borrador por encima de lo guardado. */
export function effectOf(
  index: CatalogIndex,
  roleId: string,
  permissionId: string,
  draft: Draft,
): DraftEffect {
  const touched = draft.get(permissionId);
  if (touched !== undefined) return touched;
  return index.grantsByRole.get(roleId)?.get(permissionId)?.effect ?? '';
}

/** Cuántos permisos finos permite el rol en cada módulo (con el borrador aplicado). */
export function roleCountsByModule(
  catalog: ModulesCatalog,
  index: CatalogIndex,
  roleId: string,
  draft: Draft,
): readonly {
  readonly module: string;
  readonly allow: number;
  readonly deny: number;
  readonly total: number;
}[] {
  return catalog.modules.map((m) => {
    const permissions = m.resources.flatMap((r) => r.permissions);
    let allow = 0;
    let deny = 0;
    for (const p of permissions) {
      const e = effectOf(index, roleId, p.id, draft);
      if (e === 'ALLOW') allow += 1;
      else if (e === 'DENY') deny += 1;
    }
    return { module: m.key, allow, deny, total: permissions.length };
  });
}

/* ---- el reemplazo de permisos de un rol ---------------------------------------- */

/** Un vínculo del rol tal como lo devuelve `GET /authz/roles/:id/permissions`. */
export interface ServerBinding {
  readonly permissionId: string;
  readonly effect: string;
  readonly scope: string | null;
}

/** Un vínculo tal como lo recibe `PUT /authz/roles/:id/permissions`. */
export interface SaveBinding {
  readonly permissionId: string;
  readonly effect: Effect;
  readonly scope?: 'SELF' | 'BRANCH' | 'TENANT' | 'GLOBAL';
  readonly constraintJson?: Readonly<Record<string, unknown>>;
  readonly fieldValueSetId?: string;
}

export interface PlanLine {
  readonly code: string;
  readonly name: string;
  readonly from: DraftEffect;
  readonly to: DraftEffect;
  readonly dangerous: boolean;
}

export interface SavePlan {
  /** El conjunto COMPLETO que se manda: la API reemplaza todo lo activo del rol. */
  readonly bindings: readonly SaveBinding[];
  readonly added: readonly PlanLine[];
  readonly changed: readonly PlanLine[];
  readonly removed: readonly PlanLine[];
  /** Permisos sensibles que pasan a permitirse. */
  readonly dangerousGranted: number;
  /** Permisos que el rol tiene en el servidor y este catálogo no conoce: hay que recargar. */
  readonly unknown: readonly string[];
  /** La API no acepta dejar un rol sin permisos. */
  readonly wouldEmpty: boolean;
  readonly total: number;
}

const SCOPES = new Set(['SELF', 'BRANCH', 'TENANT', 'GLOBAL']);

/**
 * Arma el reemplazo: parte de lo que el SERVIDOR tiene hoy (no de la foto del catálogo, que puede
 * ser vieja), aplica el borrador y conserva la restricción ABAC y el conjunto de campos de lo que
 * no se tocó. Lo que el catálogo no conoce no se descarta en silencio: se reporta en `unknown`.
 */
export function buildSavePlan(input: {
  readonly base: readonly ServerBinding[];
  readonly draft: Draft;
  readonly index: CatalogIndex;
  readonly roleId: string;
}): SavePlan {
  const { base, draft, index, roleId } = input;
  const owned = index.grantsByRole.get(roleId);
  const unknown = base
    .filter((b) => !index.permissionById.has(b.permissionId))
    .map((b) => b.permissionId);

  const result = new Map<string, SaveBinding>();
  for (const b of base) {
    if (b.effect !== 'ALLOW' && b.effect !== 'DENY') continue;
    const kept = owned?.get(b.permissionId);
    result.set(b.permissionId, {
      permissionId: b.permissionId,
      effect: b.effect,
      ...(b.scope !== null && SCOPES.has(b.scope)
        ? { scope: b.scope as SaveBinding['scope'] }
        : {}),
      ...(kept?.constraintJson ? { constraintJson: kept.constraintJson } : {}),
      ...(kept?.fieldValueSetId ? { fieldValueSetId: kept.fieldValueSetId } : {}),
    });
  }
  const before = new Map(
    base.map((b) => [
      b.permissionId,
      (b.effect === 'ALLOW' || b.effect === 'DENY' ? b.effect : '') as DraftEffect,
    ]),
  );

  const added: PlanLine[] = [];
  const changed: PlanLine[] = [];
  const removed: PlanLine[] = [];
  for (const [permissionId, wanted] of draft) {
    const permission = index.permissionById.get(permissionId);
    if (permission === undefined) continue;
    const was = before.get(permissionId) ?? '';
    if (wanted === was) continue;
    const line: PlanLine = {
      code: permission.code,
      name: permission.name,
      from: was,
      to: wanted,
      dangerous: permission.isDangerous,
    };
    if (wanted === '') {
      result.delete(permissionId);
      removed.push(line);
    } else {
      const previous = result.get(permissionId);
      result.set(permissionId, { ...(previous ?? { permissionId }), permissionId, effect: wanted });
      (was === '' ? added : changed).push(line);
    }
  }
  const all = [...added, ...changed];
  return {
    bindings: [...result.values()],
    added,
    changed,
    removed,
    dangerousGranted: all.filter((l) => l.to === 'ALLOW' && l.dangerous).length,
    unknown,
    wouldEmpty: result.size === 0,
    total: added.length + changed.length + removed.length,
  };
}

/** Cuántos cambios hay en el borrador respecto de lo guardado en el catálogo. */
export function draftChangeCount(index: CatalogIndex, roleId: string, draft: Draft): number {
  let n = 0;
  for (const [permissionId, wanted] of draft) {
    const saved = index.grantsByRole.get(roleId)?.get(permissionId)?.effect ?? '';
    if (saved !== wanted) n += 1;
  }
  return n;
}

/* ---- cobertura ------------------------------------------------------------------ */

export interface CoverageRow {
  readonly module: string;
  readonly total: number;
  /** Rutas que autorizan algo: todas menos las públicas y las de autoservicio. */
  readonly authorizable: number;
  readonly roleOnly: number;
  readonly undeclared: number;
  readonly guardOnly: number;
  readonly permissions: number;
  readonly gaps: number;
  /** Rutas en celdas con permiso fino. */
  readonly inFineCells: number;
  /** `null` si el módulo no tiene rutas que autorizar: un 0 % o un 100 % serían inventados. */
  readonly finePercent: number | null;
}

export function coverageRows(catalog: ModulesCatalog): readonly CoverageRow[] {
  return catalog.modules
    .map((m): CoverageRow => {
      const authorizable = m.routes.total - m.routes.publicRoutes - m.routes.selfService;
      const inFineCells = m.resources
        .flatMap((r) => r.cells)
        .filter((c) => c.coverage === 'FINE_PERMISSION')
        .reduce((n, c) => n + c.routeCount - c.publicRouteCount, 0);
      return {
        module: m.key,
        total: m.routes.total,
        authorizable,
        roleOnly: m.routes.roleOnly,
        undeclared: m.routes.undeclaredAuth,
        guardOnly: m.routes.guardOnly,
        permissions: m.permissionCount,
        gaps: m.gaps.length,
        inFineCells,
        finePercent:
          authorizable > 0 ? Math.min(100, Math.round((inFineCells / authorizable) * 100)) : null,
      };
    })
    .sort((a, b) => b.gaps - a.gaps || a.module.localeCompare(b.module));
}

/* ---- huecos ---------------------------------------------------------------------- */

export interface GapFilter {
  readonly module: string;
  readonly severity: string;
  readonly kind: string;
  readonly query: string;
}

const SEVERITY_ORDER: Readonly<Record<GapSeverity, number>> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function allGaps(catalog: ModulesCatalog): readonly ModuleGap[] {
  return catalog.modules
    .flatMap((m) => m.gaps)
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        a.module.localeCompare(b.module) ||
        (a.resource ?? '').localeCompare(b.resource ?? '') ||
        (a.action ?? '').localeCompare(b.action ?? ''),
    );
}

export function filterGaps(gaps: readonly ModuleGap[], filter: GapFilter): readonly ModuleGap[] {
  const text = filter.query.trim().toLowerCase();
  return gaps.filter(
    (g) =>
      (filter.module === '' || g.module === filter.module) &&
      (filter.severity === '' || g.severity === (filter.severity as GapSeverity)) &&
      (filter.kind === '' || g.kind === (filter.kind as GapKind)) &&
      (text === '' ||
        `${g.module} ${g.resource ?? ''} ${g.proposedCode ?? ''} ${g.roles.join(' ')}`
          .toLowerCase()
          .includes(text)),
  );
}
