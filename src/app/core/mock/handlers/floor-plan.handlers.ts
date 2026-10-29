import { bboxOf, bboxUnion, type BBox, type Point } from '../../floor-plan/geometry';
import { validateLayout } from '../../floor-plan/layout-validation';
import { applyLayoutPatch, areaWarnings, planError, validationInput, MAX_PATCH_ITEMS } from './floor-plan.patch';
import { PLAN_REASONS } from '../../data-access/floor-plan/floor-plan.codes';
import type {
  FloorPlanMeta,
  FloorPlanSummary,
  LayoutPatch,
  LayoutResponse,
  PlanCatalog,
  PlanFocusEntry,
  PlanSearchHit,
  PlanStateResponse,
  PlanValidationIssue,
  UnplacedSpace,
} from '../../data-access/floor-plan/floor-plan.types';
import {
  FOREIGN_SITE_ID,
  PLAN_SITE_ID,
  SEED_SPACES,
  SEED_SPACE_BY_KEY,
  UNIT_ROWS,
  planId,
  spaceId,
  unitId,
  type SeedSpace,
} from '../fixtures/floor-plan.seed';
import { rollupFor as rollupForOps } from '../fixtures/floor-plan.state';
import { MockRouter, forbidden, notFound, type MockReply, type MockRequest } from '../mock-router';
import { contieneSinTildes, texto } from '../mock-store';
import {
  FloorPlanModel,
  PLAN_ROLES,
  actorFor,
  inScope,
  verticesOf,
  type Actor,
  type PlacementRec,
  type PlanCode,
  type PlanRole,
} from './floor-plan.model';

/* ============================================================================
    Backend simulado del plano de planta — CONTRATO-PLANO §3.

    Rutas, cuerpos y códigos de error del contrato. El estado y la geometría
    viven en `FloorPlanModel`; acá solo se enruta, se autoriza por rol y se
    traducen los fallos al formato de error de la API (`reason`, `requestId`,
    `errors` por elemento).

    Para ver la pantalla con otro rol (Limpieza, Enfermería…) se escribe en
    `sessionStorage` la clave `mock:plan-role` con el código del rol (`LIM`,
    `ENF`, `ADM`, `MAN`, `JQ`, `FAC`, `PRO`, `AS`, `AO`, `SA`). Sin ella, el rol
    se deduce de las cuentas de la maqueta. Solo existe en el backend simulado.
    ========================================================================== */

const ROLE_KEY = 'mock:plan-role';
const DEDUP_MS = 60_000;

function readRoleOverride(): PlanRole | null {
  try {
    const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem(ROLE_KEY);
    return raw !== null && (PLAN_ROLES as readonly string[]).includes(raw) ? (raw as PlanRole) : null;
  } catch {
    return null;
  }
}

/**
 * Escenarios de demostración (solo simulador): `sessionStorage['mock:plan-scenario']` =
 * `no-plans` (la sede no tiene lienzos), `empty-plan` (el lienzo no tiene espacios dibujados) o
 * `concurrent-edit` (la próxima escritura encuentra que otra persona quitó una cama del plano
 * un instante antes: da el 412 del editor y se apaga sola).
 */
function readScenario(): 'no-plans' | 'empty-plan' | 'concurrent-edit' | null {
  try {
    const raw = typeof sessionStorage === 'undefined' ? null : sessionStorage.getItem('mock:plan-scenario');
    return raw === 'no-plans' || raw === 'empty-plan' || raw === 'concurrent-edit' ? raw : null;
  } catch {
    return null;
  }
}

/** Simulador: «otra persona» quita del plano la última cama dibujada y sube la versión. */
function simulateOtherEditor(model: FloorPlanModel, code: PlanCode): void {
  try {
    sessionStorage.removeItem('mock:plan-scenario');
  } catch {
    /* sin almacenamiento no hay escenario que apagar */
  }
  const beds = model.placementsOf(code).filter((rec) => SEED_SPACE_BY_KEY.get(rec.key)?.form === 'BED');
  const last = beds[beds.length - 1];
  if (last) model.placements.delete(last.key);
  model.plans.get(code)!.layoutVersion += 1;
}

function bboxOfPlacement(rec: PlacementRec): BBox {
  return bboxOf(verticesOf(rec.geometry));
}

const strip = (s: string): string => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export function registerFloorPlan(router: MockRouter, model: FloorPlanModel = new FloorPlanModel(), roleOverride: () => PlanRole | null = readRoleOverride): FloorPlanModel {
  const nowMs = (): number => Date.now();

  /* ---- actor ----------------------------------------------------------------- */

  const actorOf = (request: MockRequest): Actor | null => {
    const user = request.user;
    if (user === null) return null;
    const override = roleOverride();
    if (override !== null) return actorFor(override, user.id);
    if (user.roles.includes('SUPERADMIN')) return actorFor('SA', user.id);
    if (user.roles.includes('SECURITY_ADMIN') || user.roles.includes('PLATFORM_ADMIN')) return actorFor('AO', user.id);
    if (user.roles.includes('PRACTITIONER')) return actorFor('PRO', user.id);
    return null;
  };

  const guard = (request: MockRequest): Actor | MockReply => {
    const actor = actorOf(request);
    return actor ?? forbidden('Su cuenta no tiene acceso al plano de planta.');
  };
  const isReply = (value: Actor | MockReply): value is MockReply => 'status' in value && 'body' in value && !('caps' in value);

  /* ---- metadatos ------------------------------------------------------------- */

  const unplacedOf = (code: PlanCode): SeedSpace[] => {
    const anchorKey = code === 'CP' ? null : code;
    const pool = anchorKey === null ? SEED_SPACES.filter((s) => s.form !== 'LEVEL') : model.descendantsOf(anchorKey);
    return pool.filter((s) => !model.placements.has(s.key));
  };

  const metaOf = (code: PlanCode): FloorPlanMeta => {
    const rec = model.plans.get(code)!;
    const row = code === 'CP' ? { name: 'Campus', w: 100, h: 70, elev: null, grid: 1 } : code === 'PB' ? { name: 'Planta baja', w: 64, h: 26, elev: 0, grid: 0.5 } : { name: 'Piso 1', w: 64, h: 26, elev: 3.6, grid: 0.5 };
    const anchor = code === 'CP' ? null : { spaceId: spaceId(code), code: `PLANO-${code}`, name: row.name, form: 'LEVEL' };
    const summary: FloorPlanSummary = {
      id: planId(code),
      code: `PLANO-${code}`,
      name: row.name,
      anchor,
      widthM: row.w,
      heightM: row.h,
      elevationM: row.elev,
      layoutVersion: rec.layoutVersion,
      validFrom: new Date(model.ops.bootTime - 86_400_000 * 30).toISOString(),
      validTo: null,
      counts: { placed: model.placementsOf(code).length, unplaced: unplacedOf(code).length, elements: model.elementsOf(code).length },
    };
    return {
      ...summary,
      siteId: PLAN_SITE_ID,
      northBearingDeg: 0,
      gridSizeM: row.grid,
      snapToGrid: true,
      contactToleranceM: 0.01,
      rowVersion: rec.rowVersion,
      siblings: (['CP', 'PB', 'P1'] as const).map((c) => ({
        id: planId(c),
        code: `PLANO-${c}`,
        name: c === 'CP' ? 'Campus' : c === 'PB' ? 'Planta baja' : 'Piso 1',
        elevationM: c === 'CP' ? null : c === 'PB' ? 0 : 3.6,
      })),
    };
  };

  const resolvePlan = (request: MockRequest): PlanCode | MockReply => {
    const code = model.planCodeOfId(request.params['id'] ?? '');
    return code ?? notFound();
  };
  const isCode = (value: PlanCode | MockReply): value is PlanCode => typeof value === 'string';

  /* ---- catálogo y lienzos ---------------------------------------------------- */

  router.get('/practice/floor-plan-catalog', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    const catalog: PlanCatalog = {
      limits: { maxVertices: 64, maxCoordinateM: 100000, minRectSideM: 0.05, maxItemsPerPatch: MAX_PATCH_ITEMS, maxItemsPerReplace: 5000, maxPageSize: 2000 },
      defaults: { gridSizeM: 0.5, snapToGrid: true, contactToleranceM: 0.01 },
      stateLayers: ['lifecycle', 'availability', 'occupancy', 'hygiene', 'isolation', 'v2', 'unit', 'function'],
      elementKinds: ['WALL', 'DOOR', 'WINDOW', 'OPENING', 'STAIRS', 'ELEVATOR', 'CIRCULATION', 'COLUMN', 'ANNOTATION'],
    };
    return catalog;
  });

  router.get('/sites/:siteId/floor-plans', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    if (request.params['siteId'] === FOREIGN_SITE_ID) return notFound();
    if (readScenario() === 'no-plans') return [];
    return (['CP', 'PB', 'P1'] as const).map((c) => {
      const { siteId: _s, northBearingDeg: _n, gridSizeM: _g, snapToGrid: _sn, contactToleranceM: _c, rowVersion: _r, siblings: _sib, ...summary } = metaOf(c);
      void [_s, _n, _g, _sn, _c, _r, _sib];
      return summary;
    });
  });

  router.get('/floor-plans/:id', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    const code = resolvePlan(request);
    if (!isCode(code)) return code;
    return { ...metaOf(code), viewer: actor.caps };
  });

  /* ---- layout ---------------------------------------------------------------- */

  router.get('/floor-plans/:id/layout', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    const code = resolvePlan(request);
    if (!isCode(code)) return code;
    const q = request.query;
    const detail = texto(q, 'detail') === 'lite' ? 'lite' : 'full';
    const unitMode = texto(q, 'unitMode') === 'flag' ? 'flag' : 'filter';
    const focusSpace = texto(q, 'focusSpaceId');
    const focusUnit = texto(q, 'unitId');
    const bboxParam = texto(q, 'bbox');
    const includeRetired = texto(q, 'includeRetired') === 'true';
    const limit = Math.min(2000, Math.max(1, Number(texto(q, 'limit') ?? '500') || 500));
    const cursor = Number(texto(q, 'cursor') ?? '0') || 0;

    const focusKeys = focusKeySet(focusSpace, focusUnit);
    const window: BBox | null = bboxParam ? (bboxParam.split(',').map(Number) as unknown as BBox) : null;
    let recs = readScenario() === 'empty-plan' ? [] : model.placementsOf(code);
    if (!includeRetired) recs = recs.filter((r) => model.lifecycleOf(r.key) !== 'SPACE_RETIRED');
    if (focusKeys !== null && unitMode === 'filter') recs = recs.filter((r) => focusKeys.has(r.key));
    if (window !== null) recs = recs.filter((r) => intersects(bboxOfPlacement(r), window));
    recs.sort((a, b) => a.zOrder - b.zOrder || (spaceId(a.key) < spaceId(b.key) ? -1 : 1));
    const total = recs.length;
    const pageRecs = recs.slice(cursor, cursor + limit);
    const nextCursor = cursor + limit < total ? String(cursor + limit) : null;

    const spaces = pageRecs.map((r) => model.placementDto(r, actor, detail, focusKeys === null ? undefined : focusKeys.has(r.key)));
    const walls = new Set<string>();
    let elements = model.elementsOf(code).filter((e) => {
      if (e.kind === 'DOOR' || e.kind === 'WINDOW' || e.kind === 'OPENING') return true;
      if (window === null) return true;
      return e.vertices === undefined || intersects(bboxOf(e.vertices as readonly Point[]), window);
    });
    for (const e of elements) if (e.hostElementId) walls.add(e.hostElementId);
    elements = elements.filter((e) => !(e.kind === 'DOOR' || e.kind === 'WINDOW' || e.kind === 'OPENING') || (e.hostElementId !== undefined && elements.some((w) => w.id === e.hostElementId)));

    const focusedRecs = focusKeys === null ? [] : model.placementsOf(code).filter((r) => focusKeys.has(r.key));
    const body: LayoutResponse = {
      floorPlan: metaOf(code),
      layoutVersion: model.plans.get(code)!.layoutVersion,
      asOf: new Date(nowMs()).toISOString(),
      spaces,
      elements: elements.map((e) => model.elementDto(e)),
      page: { nextCursor, total },
      ...(focusKeys !== null && focusedRecs.length > 0
        ? { focus: { spaceIds: focusedRecs.map((r) => spaceId(r.key)), bbox: focusedRecs.map(bboxOfPlacement).reduce(bboxUnion) } }
        : {}),
      viewer: actor.caps,
    };
    return body;
  });

  const focusKeySet = (focusSpace: string | null, focusUnit: string | null): Set<string> | null => {
    if (focusSpace) {
      const key = model.keyOfSpaceId(focusSpace);
      if (key === null) return new Set();
      return new Set([key, ...model.descendantsOf(key).map((d) => d.key)]);
    }
    if (focusUnit) {
      const code = UNIT_ROWS.find((u) => unitId(u[0]) === focusUnit)?.[0];
      if (code === undefined) return new Set();
      return new Set(SEED_SPACES.filter((s) => s.unit === code).map((s) => s.key));
    }
    return null;
  };

  const intersects = (a: BBox, b: BBox): boolean => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

  /* ---- estado ---------------------------------------------------------------- */

  router.get('/floor-plans/:id/state', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    const code = resolvePlan(request);
    if (!isCode(code)) return code;
    if (!actor.caps.canSeeState) {
      return planError(403, PLAN_REASONS.ACTION_NOT_ALLOWED, 'Su rol no ve el estado operativo en el plano.', { details: { requiredRoles: ['SA', 'AO', 'AS', 'ENF', 'ADM', 'LIM', 'MAN', 'JQ', 'PRO'] } });
    }
    const now = nowMs();
    const lastEventMs = model.ops.advance(now);
    const spaces: Record<string, NonNullable<ReturnType<FloorPlanModel['stateFor']>>> = {};
    const rollups: PlanStateResponse['rollups'] = {};
    const mutableRollups: Record<string, PlanStateResponse['rollups'][string]> = {};
    for (const rec of model.placementsOf(code)) {
      const space = SEED_SPACE_BY_KEY.get(rec.key)!;
      if (!inScope(actor, space)) continue;
      const state = model.stateFor(rec.key, actor, now);
      if (state !== null) spaces[spaceId(rec.key)] = state;
      const rollup = rollupSafe(rec.key, now);
      if (rollup !== null && space.form !== 'BED') mutableRollups[spaceId(rec.key)] = rollup;
    }
    Object.assign(rollups, mutableRollups);
    const anchorKey = code === 'CP' ? 'BLD' : code;
    const total = rollupSafe(anchorKey, now);
    const body: PlanStateResponse = {
      asOf: new Date(now).toISOString(),
      lastEventAt: new Date(lastEventMs).toISOString(),
      layoutVersion: model.plans.get(code)!.layoutVersion,
      spaces,
      rollups: { ...rollups, ...(total ? { [spaceId(anchorKey)]: total } : {}) },
      counts: {
        total: total?.beds ?? 0,
        assignable: total?.assignable ?? 0,
        occupied: total?.occupied ?? 0,
        reserved: total?.reserved ?? 0,
        blocked: total?.blocked ?? 0,
        maintenance: total?.maintenance ?? 0,
        dirty: total?.dirty ?? 0,
        cleaning: total?.cleaning ?? 0,
        isolation: total?.isolation ?? 0,
        contaminated: total?.contaminated ?? 0,
      },
      viewer: actor.caps,
    };
    return body;
  });

  const rollupSafe = (key: string, now: number): ReturnType<typeof rollupForOps> => rollupForOps(model.ops, key, now);

  router.get('/care-spaces/:id/plan-card', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    const key = model.keyOfSpaceId(request.params['id'] ?? '');
    const space = key === null ? null : SEED_SPACE_BY_KEY.get(key)!;
    // Fuera de alcance = igual que inexistente (S6 ≠ S5).
    if (key === null || space === null || !inScope(actor, space)) return notFound();
    const now = nowMs();
    model.ops.advance(now);
    const body = model.cardResponse(key, actor, now);
    if (body.patient) {
      const last = [...model.occupantViews].reverse().find((v) => v.userId === actor.userId && v.spaceId === request.params['id']);
      if (!last || now - last.at > DEDUP_MS) model.occupantViews.push({ userId: actor.userId, spaceId: request.params['id']!, at: now });
    }
    return body;
  });

  /* ---- localización y búsqueda ------------------------------------------------ */

  const locationOf = (key: string): { plan: PlanCode; bbox: BBox } | null => {
    const placement = model.placements.get(key);
    if (placement) return { plan: placement.plan, bbox: bboxOfPlacement(placement) };
    if (key === 'PB' || key === 'P1') return { plan: key, bbox: [0, 0, 64, 26] };
    return null;
  };

  router.get('/care-spaces/:id/plan-location', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    const key = model.keyOfSpaceId(request.params['id'] ?? '');
    if (key === null || !inScope(actor, SEED_SPACE_BY_KEY.get(key)!)) return notFound();
    const where = locationOf(key);
    if (where === null) return { placed: false };
    const [x0, y0, x1, y1] = where.bbox;
    return { placed: true, floorPlanId: planId(where.plan), floorPlanName: metaOf(where.plan).name, bbox: where.bbox, centerXM: (x0 + x1) / 2, centerYM: (y0 + y1) / 2 };
  });

  router.get('/sites/:siteId/plan-search', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    if (request.params['siteId'] === FOREIGN_SITE_ID) return notFound();
    const q = texto(request.query, 'q') ?? '';
    const limit = Math.min(50, Number(texto(request.query, 'limit') ?? '10') || 10);
    if (q.trim() === '') return [];
    const hits: PlanSearchHit[] = [];
    for (const space of SEED_SPACES) {
      if (!inScope(actor, space)) continue;
      const code = `PLANO-${space.key}`;
      if (!(contieneSinTildes(space.name, q) || contieneSinTildes(code, q))) continue;
      const where = locationOf(space.key);
      const path = model.ancestorsOf(space.key).map((a) => a.name).join(' › ');
      hits.push({
        spaceId: spaceId(space.key),
        code,
        name: space.name,
        path,
        floorPlanId: where ? planId(where.plan) : null,
        floorPlanName: where ? metaOf(where.plan).name : null,
        centerXM: where ? (where.bbox[0] + where.bbox[2]) / 2 : null,
        centerYM: where ? (where.bbox[1] + where.bbox[3]) / 2 : null,
        bbox: where ? where.bbox : null,
        placed: where !== null,
      });
    }
    hits.sort((a, b) => Number(strip(a.name).startsWith(strip(q))) < Number(strip(b.name).startsWith(strip(q))) ? 1 : 0);
    return hits.slice(0, limit);
  });

  router.get('/sites/:siteId/plan-focus', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    if (request.params['siteId'] === FOREIGN_SITE_ID) return notFound();
    const spaceParam = texto(request.query, 'spaceId');
    const unitParam = texto(request.query, 'unitId');
    if ((spaceParam && model.keyOfSpaceId(spaceParam) === null) || (unitParam && !UNIT_ROWS.some((u) => unitId(u[0]) === unitParam))) return notFound();
    const keys = focusKeySet(spaceParam, unitParam) ?? new Set<string>();
    const out: PlanFocusEntry[] = [];
    for (const code of ['CP', 'PB', 'P1'] as const) {
      const recs = model.placementsOf(code).filter((r) => keys.has(r.key) && inScope(actor, SEED_SPACE_BY_KEY.get(r.key)!));
      if (recs.length === 0) continue;
      out.push({ floorPlanId: planId(code), floorPlanName: metaOf(code).name, bbox: recs.map(bboxOfPlacement).reduce(bboxUnion), spaceIds: recs.map((r) => spaceId(r.key)) });
    }
    return out;
  });

  router.get('/floor-plans/:id/validation', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    const code = resolvePlan(request);
    if (!isCode(code)) return code;
    const placements = new Map(model.placementsOf(code).map((r) => [r.key, r]));
    const elements = new Map(model.elementsOf(code).map((e) => [e.id, e]));
    const issues: PlanValidationIssue[] = validateLayout(validationInput(code, placements, elements)).map((i) => ({
      severity: 'ERROR', code: i.code, subjectId: i.id, ...(i.conflictsWith?.[0] ? { otherId: i.conflictsWith[0].id } : {}), detail: i.message,
    }));
    for (const w of areaWarnings(placements)) {
      issues.push({ severity: 'WARNING', code: w.code, subjectId: w.spaceId, detail: `Área declarada ${w.declaredM2} m² frente a ${w.calculatedM2} m² dibujados (${w.deviationPct > 0 ? '+' : ''}${w.deviationPct} %).` });
    }
    return { issues };
  });

  router.get('/floor-plans/:id/unplaced-spaces', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    const code = resolvePlan(request);
    if (!isCode(code)) return code;
    if (!actor.caps.canEditPlan) return planError(403, PLAN_REASONS.ACTION_NOT_ALLOWED, 'Solo quien edita la estructura ve la paleta.', { details: { requiredRoles: ['SA', 'AO', 'AS'] } });
    const anchorKey = code === 'CP' ? null : code;
    const items: UnplacedSpace[] = unplacedOf(code).map((s) => {
      const parentPlaced = s.parent === null || s.parent === anchorKey || model.placements.get(s.parent)?.plan === code;
      const parent = s.parent ? SEED_SPACE_BY_KEY.get(s.parent) : null;
      return {
        spaceId: spaceId(s.key), code: `PLANO-${s.key}`, name: s.name, depth: model.ancestorsOf(s.key).length + 1,
        form: s.form, function: s.fn, parentId: s.parent === null ? null : spaceId(s.parent), placeable: parentPlaced,
        ...(parentPlaced ? {} : { reason: `Ubique primero «${parent?.name ?? 'su espacio padre'}».` }),
      };
    });
    return { items, nextCursor: null };
  });

  /* ---- escritura -------------------------------------------------------------- */

  router.patch('/floor-plans/:id/layout', (request) => {
    const actor = guard(request);
    if (isReply(actor)) return actor;
    const code = resolvePlan(request);
    if (!isCode(code)) return code;
    if (!actor.caps.canEditPlan) {
      return planError(403, PLAN_REASONS.ACTION_NOT_ALLOWED, 'Editar el plano es editar estructura: su rol no puede hacerlo.', { details: { requiredRoles: ['SA', 'AO', 'AS'] } });
    }
    if (readScenario() === 'concurrent-edit') simulateOtherEditor(model, code);
    const ifMatch = request.headers.get('If-Match');
    const plan = model.plans.get(code)!;
    if (ifMatch === null || Number(ifMatch) !== plan.layoutVersion) {
      return planError(412, PLAN_REASONS.VERSION_MISMATCH, 'Otra persona modificó este plano.', {
        currentVersion: plan.layoutVersion,
        changedSummary: 'El plano cambió desde que lo abrió.',
      });
    }
    const dryRun = texto(request.query, 'dryRun') === 'true';
    return applyLayoutPatch(model, code, (request.body ?? {}) as LayoutPatch, dryRun);
  });

  return model;
}
