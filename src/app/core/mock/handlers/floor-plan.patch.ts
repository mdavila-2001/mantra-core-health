import { polygonArea, type Point } from '../../floor-plan/geometry';
import { validateLayout, type LayoutIssue } from '../../floor-plan/layout-validation';
import { PLAN_REASONS } from '../../data-access/floor-plan/floor-plan.codes';
import type { ElementUpsert, LayoutApplyResponse, LayoutPatch, LayoutWarning, PlacementGeometry } from '../../data-access/floor-plan/floor-plan.types';
import { SEED_SPACE_BY_KEY, planId, spaceId, type SeedSpace } from '../fixtures/floor-plan.seed';
import { reply, notFound, type MockReply } from '../mock-router';
import { nuevoId, uuid } from '../mock-store';
import { verticesOf, type ElementRec, type FloorPlanModel, type PlacementRec, type PlanCode } from './floor-plan.model';

/* ============================================================================
    Escritura del layout del plano simulado (CONTRATO-PLANO §3.4): delta
    `PATCH /floor-plans/:id/layout`, todo-o-nada, con los errores por elemento.
    Ver el aviso de `floor-plan.model.ts`: la validación reutiliza la librería de
    geometría del cliente y no es una segunda opinión independiente.
    ========================================================================== */

export const PLAN_NAMES: Readonly<Record<PlanCode, string>> = { CP: 'Campus', PB: 'Planta baja', P1: 'Piso 1' };
export const MAX_PATCH_ITEMS = 500;

const GENERIC_CODE: Readonly<Record<number, { code: string; error: string }>> = {
  403: { code: 'FORBIDDEN', error: 'Forbidden' },
  404: { code: 'NOT_FOUND', error: 'Not Found' },
  409: { code: 'CONFLICT', error: 'Conflict' },
  412: { code: 'CONCURRENCY_CONFLICT', error: 'Precondition Failed' },
  413: { code: 'PAYLOAD_TOO_LARGE', error: 'Payload Too Large' },
  422: { code: 'PRECONDITION_FAILED', error: 'Unprocessable Entity' },
};

/** Un error con la forma de `DomainException`: `reason`, `requestId` y el `code` genérico que `errorToViewState` entiende. */
export function planError(status: number, reason: string, message: string, extra: Record<string, unknown> = {}): MockReply {
  const requestId = nuevoId('req').replace(/-/g, '').slice(0, 16);
  const generic = GENERIC_CODE[status] ?? { code: 'INTERNAL', error: 'Error' };
  return reply(status, { statusCode: status, code: generic.code, error: generic.error, message, reason, requestId, correlationId: requestId, ...extra });
}

function defaultZ(space: SeedSpace): number {
  return space.form === 'AREA' || space.form === 'WARD' || space.form === 'BUILDING' ? 0 : space.form === 'BED' ? 20 : 10;
}


function shapesOf(placements: ReadonlyMap<string, PlacementRec>) {
  return [...placements.values()].map((r) => {
    const s = SEED_SPACE_BY_KEY.get(r.key)!;
    return { spaceId: spaceId(r.key), code: `PLANO-${s.key}`, name: s.name, parentId: s.parent === null ? null : spaceId(s.parent), vertices: verticesOf(r.geometry) };
  });
}

export function validationInput(code: PlanCode, placements: ReadonlyMap<string, PlacementRec>, elements: ReadonlyMap<string, ElementRec>) {
  return {
  canvas: { widthM: code === 'CP' ? 100 : 64, heightM: code === 'CP' ? 70 : 26, contactToleranceM: 0.01, anchorSpaceId: code === 'CP' ? null : spaceId(code) },
  shapes: shapesOf(placements),
  walls: [...elements.values()].filter((e) => e.kind === 'WALL').map((e) => ({ id: e.id, vertices: (e.vertices ?? []) as readonly Point[] })),
  openings: [...elements.values()].filter((e) => e.hostElementId !== undefined).map((e) => ({ id: e.id, hostId: e.hostElementId!, offsetM: e.offsetM ?? 0, widthM: e.widthM ?? 1 })),
  };
}

export function areaWarnings(placements: ReadonlyMap<string, PlacementRec>): LayoutWarning[] {
  const warnings: LayoutWarning[] = [];
  for (const rec of placements.values()) {
    const s = SEED_SPACE_BY_KEY.get(rec.key)!;
    if (s.declared === null) continue;
    const calc = polygonArea(verticesOf(rec.geometry));
    const deviation = ((calc - s.declared) / s.declared) * 100;
    if (Math.abs(deviation) > 10) {
      warnings.push({ code: 'AREA_MISMATCH', spaceId: spaceId(rec.key), declaredM2: s.declared, calculatedM2: Math.round(calc * 100) / 100, deviationPct: Math.round(deviation * 10) / 10, tolerancePct: 10 });
    }
  }
  return warnings;
}

export function applyLayoutPatch(model: FloorPlanModel, code: PlanCode, patch: LayoutPatch, dryRun: boolean): MockReply | LayoutApplyResponse {
  const metaOf = (c: PlanCode): { name: string } => ({ name: PLAN_NAMES[c] });
  const upserts = patch.upsert?.placements ?? [];
  const elementUpserts = patch.upsert?.elements ?? [];
  const removeSpaces = patch.remove?.spaceIds ?? [];
  const removeElements = patch.remove?.elementIds ?? [];
  if (upserts.length + elementUpserts.length + removeSpaces.length + removeElements.length > MAX_PATCH_ITEMS) {
    return planError(413, PLAN_REASONS.TOO_MANY_ITEMS, `Un guardado admite hasta ${MAX_PATCH_ITEMS} ítems.`);
  }
  const placements = new Map<string, PlacementRec>(model.placementsOf(code).map((r) => [r.key, { ...r }]));
  const elements = new Map<string, ElementRec>(model.elementsOf(code).map((e) => [e.id, { ...e }]));
  const applied = { placed: 0, moved: 0, removed: 0, elementsUpserted: 0, elementsRemoved: 0 };

  // Quitar del plano (no borra el espacio del árbol).
  const toRemove = new Set<string>();
  for (const id of removeSpaces) {
    const key = model.keyOfSpaceId(id);
    if (key === null || !placements.has(key)) continue;
    toRemove.add(key);
  }
  for (const key of [...toRemove]) {
    if (model.hasActiveOccupancy(key)) {
      return planError(409, PLAN_REASONS.SPACE_OCCUPIED, `No se puede sacar «${SEED_SPACE_BY_KEY.get(key)!.name}» del plano: tiene camas con pacientes.`, { details: { spaceId: spaceId(key) } });
    }
    const placedChildren = model.descendantsOf(key).filter((d) => placements.has(d.key));
    if (placedChildren.length > 0) {
      if (patch.remove?.cascade === true) {
        for (const c of placedChildren) {
          if (model.hasActiveOccupancy(c.key)) {
            return planError(409, PLAN_REASONS.SPACE_OCCUPIED, `No se puede sacar «${c.name}» del plano: está ocupada.`, { details: { spaceId: spaceId(c.key) } });
          }
          toRemove.add(c.key);
        }
      } else if (!placedChildren.every((c) => toRemove.has(c.key))) {
        return planError(409, 'PLAN_HAS_PLACED_CHILDREN', `«${SEED_SPACE_BY_KEY.get(key)!.name}» tiene ${placedChildren.length} espacio(s) dibujado(s) adentro.`, { details: { spaceId: spaceId(key), count: placedChildren.length } });
      }
    }
  }
  for (const key of toRemove) {
    placements.delete(key);
    applied.removed += 1;
  }

  // Altas y movimientos.
  const itemErrors: LayoutIssue[] = [];
  for (const item of upserts) {
    const key = model.keyOfSpaceId(item.spaceId);
    if (key === null) return notFound();
    const space = SEED_SPACE_BY_KEY.get(key)!;
    const elsewhere = model.placements.get(key);
    if (elsewhere && elsewhere.plan !== code) {
      return planError(409, 'PLAN_SPACE_ALREADY_PLACED', `«${space.name}» ya está dibujado en «${metaOf(elsewhere.plan).name}».`, { details: { floorPlanId: planId(elsewhere.plan) } });
    }
    const current = placements.get(key);
    if (current && item.expectedRowVersion !== undefined && item.expectedRowVersion !== current.rowVersion) {
      return planError(412, PLAN_REASONS.ROW_VERSION_MISMATCH, 'Otra persona modificó este espacio.', { currentVersion: current.rowVersion });
    }
    if (space.form === 'LEVEL') {
      itemErrors.push({ kind: 'SPACE', id: item.spaceId, code: 'PLAN_GEOMETRY_INVALID', field: 'geometry', message: 'Un piso es un lienzo, no una figura.' });
      continue;
    }
    const geometry: PlacementGeometry = item.geometry;
    if (geometry.kind === 'RECT' && (geometry.widthM < 0.05 || geometry.depthM < 0.05)) {
      itemErrors.push({ kind: 'SPACE', id: item.spaceId, code: 'PLAN_GEOMETRY_INVALID', field: 'size', message: 'El ancho y el fondo mínimos son de 0,05 m.' });
      continue;
    }
    const next: PlacementRec = {
      key, plan: code, geometry, zOrder: item.zOrder ?? current?.zOrder ?? defaultZ(space), locked: item.locked ?? current?.locked ?? false,
      rowVersion: current ? current.rowVersion + 1 : 1,
    };
    placements.set(key, next);
    if (current) applied.moved += 1;
    else applied.placed += 1;
  }

  // Elementos.
  for (const id of removeElements) {
    const el = elements.get(id);
    if (!el) continue;
    for (const hosted of [...elements.values()].filter((e) => e.hostElementId === id)) {
      elements.delete(hosted.id);
      applied.elementsRemoved += 1;
    }
    elements.delete(id);
    applied.elementsRemoved += 1;
  }
  for (const item of elementUpserts as readonly ElementUpsert[]) {
    const id = item.id ?? uuid(`plano-el-new-${nuevoId('el')}`);
    const current = elements.get(id);
    if (current && item.expectedRowVersion !== undefined && item.expectedRowVersion !== current.rowVersion) {
      return planError(412, PLAN_REASONS.ROW_VERSION_MISMATCH, 'Otra persona modificó este elemento.', { currentVersion: current.rowVersion });
    }
    elements.set(id, {
      ...(current ?? {}),
      id, plan: code, kind: item.kind, zOrder: item.zOrder ?? current?.zOrder ?? (item.kind === 'DOOR' ? 40 : item.kind === 'WINDOW' ? 35 : item.kind === 'WALL' ? 30 : 5),
      rowVersion: current ? current.rowVersion + 1 : 1,
      ...(item.vertices ? { vertices: item.vertices } : {}),
      ...(item.thicknessM !== undefined ? { thicknessM: item.thicknessM } : {}),
      ...(item.hostElementId ? { hostElementId: item.hostElementId } : {}),
      ...(item.offsetM !== undefined ? { offsetM: item.offsetM } : {}),
      ...(item.widthM !== undefined ? { widthM: item.widthM } : {}),
      ...(item.swing ? { swing: item.swing } : {}),
      ...(item.swingSide ? { swingSide: item.swingSide } : {}),
      ...(item.label ? { label: item.label } : {}),
    } as ElementRec);
    applied.elementsUpserted += 1;
  }

  // Validación (el servidor devuelve todos los errores, uno por elemento).
  const issues = [...itemErrors, ...validateLayout(validationInput(code, placements, elements))];
  if (issues.length > 0) {
    return planError(422, PLAN_REASONS.LAYOUT_INVALID, 'El dibujo tiene errores: corríjalos y vuelva a guardar.', { errors: issues });
  }
  const warnings = areaWarnings(placements);
  const plan = model.plans.get(code)!;
  const requestId = nuevoId('req').replace(/-/g, '').slice(0, 16);
  if (dryRun) {
    return { layoutVersion: plan.layoutVersion, applied, warnings, requestId };
  }
  for (const [key, rec] of model.placements) if (rec.plan === code) model.placements.delete(key);
  for (const [key, rec] of placements) model.placements.set(key, rec);
  for (const [id, rec] of model.elements) if (rec.plan === code) model.elements.delete(id);
  for (const [id, rec] of elements) model.elements.set(id, rec);
  plan.layoutVersion += 1;
  return { layoutVersion: plan.layoutVersion, applied, warnings, requestId };
}
