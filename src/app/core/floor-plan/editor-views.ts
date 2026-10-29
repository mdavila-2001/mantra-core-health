/* ============================================================================
    Lo que el editor le muestra al lienzo y a la paleta, derivado del estado de
    edición. Funciones puras: el almacén las envuelve en `computed`.
    ========================================================================== */

import type { FloorPlanMeta, PlanElementDTO, UnplacedSpace } from '../data-access/floor-plan/floor-plan.types';
import { elementDtosOf, validationElements } from './editor-elements';
import { shapesOf, type EditState } from './editor-model';
import { validateLayout, type LayoutIssue } from './layout-validation';
import { newSpaceView, spaceViewFromGeometry, toElementViews, type ElementView, type SpaceView } from './plan-view';

/** Las figuras que el lienzo dibuja: las cargadas (con su geometría editada), menos las quitadas, más las nuevas. */
export function buildSpaceViews(baseViews: readonly SpaceView[], baseline: EditState, current: EditState, known: ReadonlyMap<string, UnplacedSpace>): SpaceView[] {
  const out: SpaceView[] = [];
  for (const view of baseViews) {
    if (!view.inScope) {
      out.push(view);
      continue;
    }
    if (current.removed.has(view.id)) continue;
    const edited = current.spaces.get(view.id);
    const original = baseline.spaces.get(view.id);
    out.push(edited && original && edited.geometry !== original.geometry ? spaceViewFromGeometry(view, edited.geometry) : view);
  }
  for (const space of current.spaces.values()) {
    if (baseline.spaces.has(space.id) || current.removed.has(space.id)) continue;
    out.push(newSpaceView({ id: space.id, code: space.code, name: space.name, parentId: space.parentId, formCode: space.formCode, functionCode: known.get(space.id)?.function ?? 'OTHER' }, space.geometry));
  }
  return out;
}

export function buildElementViews(baseDtos: readonly PlanElementDTO[], current: EditState): ElementView[] {
  return toElementViews(elementDtosOf(baseDtos, current));
}

/** Espacios sin dibujar: los que trae el servidor más los que se quitaron en esta sesión. */
export function buildPalette(baseline: EditState, current: EditState, unplaced: readonly UnplacedSpace[], known: ReadonlyMap<string, UnplacedSpace>): UnplacedSpace[] {
  const placed = new Set([...current.spaces.keys()].filter((id) => !current.removed.has(id)));
  const restored: UnplacedSpace[] = [];
  for (const id of current.removed) {
    const space = baseline.spaces.get(id);
    if (space) restored.push({ spaceId: id, code: space.code, name: space.name, depth: 0, form: space.formCode, function: known.get(id)?.function ?? 'OTHER', parentId: space.parentId, placeable: true });
  }
  return [...restored, ...unplaced.filter((u) => !placed.has(u.spaceId))];
}

/** La ayuda de validación del editor (la API decide): figuras, muros y aberturas. */
export function validateEdit(meta: FloorPlanMeta, state: EditState, focus?: ReadonlySet<string>): LayoutIssue[] {
  const { walls, openings } = validationElements(state);
  return validateLayout(
    { canvas: { widthM: meta.widthM, heightM: meta.heightM, contactToleranceM: meta.contactToleranceM, anchorSpaceId: meta.anchor?.spaceId ?? null }, shapes: shapesOf(state), walls, openings },
    focus,
  );
}
