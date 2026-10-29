/* ============================================================================
    Modelo del editor del plano (CONTRATO-PLANO §5.3): lo que se está editando,
    las operaciones sobre las figuras, el historial de deshacer/rehacer y el
    delta que se manda a `PATCH /layout`.

    Todo es inmutable y sin Angular: cada operación devuelve un estado nuevo, así
    que deshacer es volver a un estado anterior y la prueba recorre una sesión
    de edición entera sin un navegador. La validación de lo que se dibuja es
    una **ayuda inmediata**: la autoridad es `dryRun` + el guardado.
    ========================================================================== */

import type { LayoutPatch, PlacementGeometry, PlacementUpsert } from '../data-access/floor-plan/floor-plan.types';
import {
  MAX_POLYGON_VERTICES,
  bboxOf,
  normalizeDegrees,
  polygonArea,
  rectVertices,
  roundToMillimeter,
  toRadians,
  type Point,
} from './geometry';
import type { LayoutShape } from './layout-validation';
import type { SpaceView } from './plan-view';

export interface EditSpace {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly formCode: string;
  readonly geometry: PlacementGeometry;
  readonly zOrder: number;
  readonly locked: boolean;
  /** `null` = figura nueva (todavía sin fila en el servidor). */
  readonly rowVersion: number | null;
}

export interface EditState {
  readonly spaces: ReadonlyMap<string, EditSpace>;
  /** Espacios que se sacan del plano (no se borran del árbol). */
  readonly removed: ReadonlySet<string>;
}

export type RectGeometry = Extract<PlacementGeometry, { kind: 'RECT' }>;

export const EMPTY_EDIT: EditState = { spaces: new Map(), removed: new Set() };

export function fromViews(views: readonly SpaceView[]): EditState {
  const spaces = new Map<string, EditSpace>();
  for (const v of views) {
    if (!v.inScope) continue;
    spaces.set(v.id, {
      id: v.id,
      code: v.code,
      name: v.name,
      parentId: v.parentId,
      formCode: v.formCode,
      geometry: v.isRect
        ? { kind: 'RECT', centerXM: v.center[0], centerYM: v.center[1], ...rectSizeOf(v) }
        : { kind: 'POLYGON', vertices: v.vertices.map(([x, y]) => [x, y] as [number, number]) },
      zOrder: v.zOrder,
      locked: v.locked,
      rowVersion: v.rowVersion,
    });
  }
  return { spaces, removed: new Set() };
}

/** Ancho, fondo y rotación de un rectángulo a partir de sus cuatro esquinas. */
function rectSizeOf(v: SpaceView): { widthM: number; depthM: number; rotationDeg: number } {
  const [a, b, , d] = v.vertices;
  const width = Math.hypot(b![0] - a![0], b![1] - a![1]);
  const depth = Math.hypot(d![0] - a![0], d![1] - a![1]);
  const rotation = normalizeDegrees((Math.atan2(b![1] - a![1], b![0] - a![0]) * 180) / Math.PI);
  return { widthM: roundToMillimeter(width), depthM: roundToMillimeter(depth), rotationDeg: roundToMillimeter(rotation) };
}

export function verticesOfEdit(space: EditSpace): Point[] {
  const g = space.geometry;
  return g.kind === 'RECT' ? rectVertices(g.centerXM, g.centerYM, g.widthM, g.depthM, g.rotationDeg) : g.vertices.map(([x, y]) => [x, y] as Point);
}

export function shapesOf(state: EditState): LayoutShape[] {
  return [...state.spaces.values()]
    .filter((s) => !state.removed.has(s.id))
    .map((s) => ({ spaceId: s.id, code: s.code, name: s.name, parentId: s.parentId, vertices: verticesOfEdit(s) }));
}

/* ---- historial ------------------------------------------------------------------ */

export const HISTORY_LIMIT = 100;

/** Deshacer/rehacer por instantáneas (≥ 50 pasos en memoria, CONTRATO-PLANO §5.3). */
export class EditHistory<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(public present: T, private readonly limit = HISTORY_LIMIT) {}

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  /** Registra un estado nuevo; se pierde lo que se había deshecho. */
  push(next: T): void {
    if (next === this.present) return;
    this.past.push(this.present);
    if (this.past.length > this.limit) this.past.shift();
    this.present = next;
    this.future = [];
  }

  /** Cambia el estado actual sin dejar un paso en el historial (arrastre en curso). */
  replace(next: T): void {
    this.present = next;
  }

  undo(): T {
    const previous = this.past.pop();
    if (previous !== undefined) {
      this.future.push(this.present);
      this.present = previous;
    }
    return this.present;
  }

  redo(): T {
    const next = this.future.pop();
    if (next !== undefined) {
      this.past.push(this.present);
      this.present = next;
    }
    return this.present;
  }

  clear(base: T): void {
    this.past = [];
    this.future = [];
    this.present = base;
  }

  get depth(): number {
    return this.past.length;
  }
}

/* ---- operaciones sobre figuras ------------------------------------------------------ */

export function withSpace(state: EditState, space: EditSpace): EditState {
  const spaces = new Map(state.spaces);
  spaces.set(space.id, space);
  const removed = new Set(state.removed);
  removed.delete(space.id);
  return { spaces, removed };
}

export function removeFromPlan(state: EditState, id: string): EditState {
  if (!state.spaces.has(id)) return state;
  const removed = new Set(state.removed);
  removed.add(id);
  return { spaces: state.spaces, removed };
}

export function setGeometry(state: EditState, id: string, geometry: PlacementGeometry): EditState {
  const space = state.spaces.get(id);
  if (!space || space.locked) return state;
  return withSpace(state, { ...space, geometry });
}

export function translateGeometry(g: PlacementGeometry, dx: number, dy: number): PlacementGeometry {
  return g.kind === 'RECT'
    ? { ...g, centerXM: roundToMillimeter(g.centerXM + dx), centerYM: roundToMillimeter(g.centerYM + dy) }
    : { kind: 'POLYGON', vertices: g.vertices.map(([x, y]) => [roundToMillimeter(x + dx), roundToMillimeter(y + dy)] as [number, number]) };
}

/** Mover una habitación arrastra a sus hijos dibujados (así «mover la habitación con sus camas» guarda en un solo paso). */
export function moveWithChildren(state: EditState, id: string, dx: number, dy: number): EditState {
  const moved = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of state.spaces.values()) {
      if (!moved.has(s.id) && s.parentId !== null && moved.has(s.parentId) && !state.removed.has(s.id)) {
        moved.add(s.id);
        grew = true;
      }
    }
  }
  let next = state;
  for (const target of moved) {
    const s = state.spaces.get(target)!;
    if (!s.locked) next = withSpace(next, { ...s, geometry: translateGeometry(s.geometry, dx, dy) });
  }
  return next;
}

/** El espacio y todo lo que dibujó dentro (hijos, nietos…). */
export function descendantsOf(state: EditState, id: string): Set<string> {
  const ids = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const s of state.spaces.values()) {
      if (!ids.has(s.id) && s.parentId !== null && ids.has(s.parentId) && !state.removed.has(s.id)) {
        ids.add(s.id);
        grew = true;
      }
    }
  }
  return ids;
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export const MIN_SIDE_M = 0.05;

const toLocal = (g: RectGeometry, p: Point): Point => {
  const a = toRadians(-g.rotationDeg);
  const dx = p[0] - g.centerXM;
  const dy = p[1] - g.centerYM;
  return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
};

const toWorld = (g: RectGeometry, p: Point): Point => {
  const a = toRadians(g.rotationDeg);
  return [g.centerXM + p[0] * Math.cos(a) - p[1] * Math.sin(a), g.centerYM + p[0] * Math.sin(a) + p[1] * Math.cos(a)];
};

/**
 * Redimensiona un rectángulo arrastrando una de sus 8 asas: el borde (o la
 * esquina) opuesto queda fijo, también cuando el rectángulo está rotado.
 */
export function resizeRect(g: RectGeometry, handle: ResizeHandle, world: Point): RectGeometry {
  const local = toLocal(g, world);
  let left = -g.widthM / 2;
  let right = g.widthM / 2;
  let top = -g.depthM / 2;
  let bottom = g.depthM / 2;
  if (handle.includes('e')) right = Math.max(left + MIN_SIDE_M, local[0]);
  if (handle.includes('w')) left = Math.min(right - MIN_SIDE_M, local[0]);
  if (handle.includes('s')) bottom = Math.max(top + MIN_SIDE_M, local[1]);
  if (handle.includes('n')) top = Math.min(bottom - MIN_SIDE_M, local[1]);
  const centerLocal: Point = [(left + right) / 2, (top + bottom) / 2];
  const center = toWorld(g, centerLocal);
  return {
    kind: 'RECT',
    centerXM: roundToMillimeter(center[0]),
    centerYM: roundToMillimeter(center[1]),
    widthM: roundToMillimeter(right - left),
    depthM: roundToMillimeter(bottom - top),
    rotationDeg: g.rotationDeg,
  };
}

/** Rota hacia el puntero; con `stepDeg` (Shift = 15°) salta de a pasos. */
export function rotateRectTo(g: RectGeometry, world: Point, stepDeg?: number): RectGeometry {
  // El asa de rotación está sobre el borde superior: 0° apunta hacia arriba.
  const raw = (Math.atan2(world[1] - g.centerYM, world[0] - g.centerXM) * 180) / Math.PI + 90;
  const snapped = stepDeg ? Math.round(raw / stepDeg) * stepDeg : raw;
  return { ...g, rotationDeg: roundToMillimeter(normalizeDegrees(snapped)) };
}

/** Rectángulo por omisión al ubicar un espacio (3 × 3 m; una cama, 1 × 2 m). */
export function defaultRect(formCode: string, center: Point): RectGeometry {
  const size = formCode === 'BED' ? { widthM: 1, depthM: 2 } : formCode === 'AREA' || formCode === 'WARD' ? { widthM: 10, depthM: 8 } : { widthM: 3, depthM: 3 };
  return { kind: 'RECT', centerXM: roundToMillimeter(center[0]), centerYM: roundToMillimeter(center[1]), rotationDeg: 0, ...size };
}

/** Rectángulo a partir de dos esquinas opuestas (herramienta «Local rectangular»). */
export function rectFromCorners(a: Point, b: Point): RectGeometry {
  return {
    kind: 'RECT',
    centerXM: roundToMillimeter((a[0] + b[0]) / 2),
    centerYM: roundToMillimeter((a[1] + b[1]) / 2),
    widthM: roundToMillimeter(Math.abs(b[0] - a[0])),
    depthM: roundToMillimeter(Math.abs(b[1] - a[1])),
    rotationDeg: 0,
  };
}

export function movePolygonVertex(g: PlacementGeometry, index: number, p: Point): PlacementGeometry {
  if (g.kind !== 'POLYGON') return g;
  return { kind: 'POLYGON', vertices: g.vertices.map((v, i) => (i === index ? ([roundToMillimeter(p[0]), roundToMillimeter(p[1])] as [number, number]) : v)) };
}

/** Agrega un vértice en la mitad de la arista `index` → `index + 1` (asa del medio). */
export function insertPolygonVertex(g: PlacementGeometry, index: number, p?: Point): PlacementGeometry {
  if (g.kind !== 'POLYGON' || g.vertices.length >= MAX_POLYGON_VERTICES) return g;
  const a = g.vertices[index]!;
  const b = g.vertices[(index + 1) % g.vertices.length]!;
  const at: Point = p ?? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const vertices = [...g.vertices];
  vertices.splice(index + 1, 0, [roundToMillimeter(at[0]), roundToMillimeter(at[1])]);
  return { kind: 'POLYGON', vertices };
}

/** Quita un vértice (`Supr`); un polígono no baja de tres. */
export function removePolygonVertex(g: PlacementGeometry, index: number): PlacementGeometry {
  if (g.kind !== 'POLYGON' || g.vertices.length <= 3) return g;
  return { kind: 'POLYGON', vertices: g.vertices.filter((_, i) => i !== index) };
}

/** Medidas vivas al arrastrar: «4,00 × 8,50 m · 34,00 m²». */
export function measureText(space: EditSpace): string {
  const g = space.geometry;
  const area = polygonArea(verticesOfEdit(space));
  const fmt = (n: number): string => n.toFixed(2).replace('.', ',');
  if (g.kind === 'RECT') return `${fmt(g.widthM)} × ${fmt(g.depthM)} m · ${fmt(area)} m²`;
  const box = bboxOf(verticesOfEdit(space));
  return `${fmt(box[2] - box[0])} × ${fmt(box[3] - box[1])} m (caja) · ${fmt(area)} m²`;
}

/* ---- delta para el guardado ------------------------------------------------------------ */

const sameGeometry = (a: PlacementGeometry, b: PlacementGeometry): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * El delta de `PATCH /layout` (CONTRATO-PLANO §3.4): solo lo que cambió respecto
 * del estado cargado. Lo nuevo va sin `expectedRowVersion`; lo movido lo lleva.
 */
export function diffPatch(baseline: EditState, current: EditState): LayoutPatch {
  const upsert: PlacementUpsert[] = [];
  for (const s of current.spaces.values()) {
    if (current.removed.has(s.id)) continue;
    const before = baseline.spaces.get(s.id);
    if (before && !baseline.removed.has(s.id) && sameGeometry(before.geometry, s.geometry) && before.locked === s.locked && before.zOrder === s.zOrder) continue;
    upsert.push({
      spaceId: s.id,
      geometry: s.geometry,
      zOrder: s.zOrder,
      locked: s.locked,
      ...(before && s.rowVersion !== null ? { expectedRowVersion: s.rowVersion } : {}),
    });
  }
  // Sacar del plano lo que existía en el servidor (lo que se dibujó y se quitó sin guardar no viaja).
  const removeIds = [...current.removed].filter((id) => baseline.spaces.has(id) && !baseline.removed.has(id));
  return {
    ...(upsert.length > 0 ? { upsert: { placements: upsert } } : {}),
    ...(removeIds.length > 0 ? { remove: { spaceIds: removeIds } } : {}),
  };
}

export function patchSize(patch: LayoutPatch): number {
  return (patch.upsert?.placements?.length ?? 0) + (patch.upsert?.elements?.length ?? 0) + (patch.remove?.spaceIds?.length ?? 0) + (patch.remove?.elementIds?.length ?? 0);
}

export function isDirty(baseline: EditState, current: EditState): boolean {
  return patchSize(diffPatch(baseline, current)) > 0;
}

/**
 * Tras un 412: reaplica mis cambios sobre el plano recargado, solo en lo que no
 * chocó (el espacio no se movió en el servidor desde que lo cargué). Devuelve
 * lo que se reaplicó y lo que quedó sin reaplicar para que la persona lo revise.
 */
export function reapply(oldBase: EditState, mine: EditState, newBase: EditState): { state: EditState; applied: string[]; conflicts: string[] } {
  let state = newBase;
  const applied: string[] = [];
  const conflicts: string[] = [];
  const touched = new Set<string>();
  for (const s of mine.spaces.values()) {
    const before = oldBase.spaces.get(s.id);
    if (!before || !sameGeometry(before.geometry, s.geometry)) touched.add(s.id);
  }
  for (const id of mine.removed) if (oldBase.spaces.has(id)) touched.add(id);
  for (const id of touched) {
    const theirsNow = newBase.spaces.get(id);
    const before = oldBase.spaces.get(id);
    const mineNow = mine.spaces.get(id);
    const remoteChanged = before && theirsNow ? !sameGeometry(before.geometry, theirsNow.geometry) : before !== undefined && theirsNow === undefined;
    if (remoteChanged || !mineNow) {
      conflicts.push(id);
      continue;
    }
    if (mine.removed.has(id)) {
      state = removeFromPlan(state, id);
    } else {
      state = withSpace(state, { ...mineNow, rowVersion: theirsNow?.rowVersion ?? null });
    }
    applied.push(id);
  }
  return { state, applied, conflicts };
}
