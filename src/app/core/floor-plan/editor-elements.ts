/* ============================================================================
    Muros, puertas y ventanas del editor (CONTRATO-PLANO §5.3): las operaciones
    sobre `EditState.elements`, el delta que viaja a `PATCH /layout` y cómo se
    vuelven a mostrar en el lienzo. Sin Angular.
    ========================================================================== */

import type { ElementUpsert, PlanElementDTO } from '../data-access/floor-plan/floor-plan.types';
import { EDITABLE_ELEMENT_KINDS, type EditElement, type EditState } from './editor-state.types';
import { distance, pointAlongPolyline, projectOnPolyline, roundToMillimeter, type Point } from './geometry';
import type { LayoutOpening, LayoutWall } from './layout-validation';

export const DEFAULT_WALL_THICKNESS_M = 0.12;
export const DOOR_WIDTH_M = 0.9;
export const WINDOW_WIDTH_M = 1.2;
const Z_ORDER = { WALL: 30, WINDOW: 35, DOOR: 40 } as const;

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Identificador de elemento nuevo: lo genera el cliente, así reintentar el guardado es idempotente. */
export function newElementId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  const hex = (n: number): string => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}`;
}

export function withElement(state: EditState, element: EditElement): EditState {
  const elements = new Map(state.elements);
  elements.set(element.id, element);
  const removedElements = new Set(state.removedElements);
  removedElements.delete(element.id);
  return { ...state, elements, removedElements };
}

/** Quita un elemento; si es un muro, también sus puertas y ventanas (el servidor hace lo mismo). */
export function removeElement(state: EditState, id: string): EditState {
  if (!state.elements.has(id)) return state;
  const removedElements = new Set(state.removedElements);
  removedElements.add(id);
  for (const el of state.elements.values()) if (el.hostElementId === id) removedElements.add(el.id);
  return { ...state, removedElements };
}

export function newWall(id: string, vertices: readonly Point[], thicknessM = DEFAULT_WALL_THICKNESS_M): EditElement {
  return {
    id, kind: 'WALL', zOrder: Z_ORDER.WALL, rowVersion: null, thicknessM,
    vertices: vertices.map(([x, y]) => [roundToMillimeter(x), roundToMillimeter(y)] as [number, number]),
  };
}

export function newOpening(id: string, kind: 'DOOR' | 'WINDOW', hostElementId: string, offsetM: number): EditElement {
  return {
    id, kind, zOrder: Z_ORDER[kind], rowVersion: null, hostElementId, offsetM: roundToMillimeter(offsetM),
    widthM: kind === 'DOOR' ? DOOR_WIDTH_M : WINDOW_WIDTH_M,
    ...(kind === 'DOOR' ? { swing: 'LEFT' as const, swingSide: 'A' as const } : {}),
  };
}

export function translateWall(wall: EditElement, dx: number, dy: number): EditElement {
  return { ...wall, vertices: (wall.vertices ?? []).map(([x, y]) => [roundToMillimeter(x + dx), roundToMillimeter(y + dy)] as [number, number]) };
}

export function moveWallVertex(wall: EditElement, index: number, p: Point): EditElement {
  return { ...wall, vertices: (wall.vertices ?? []).map((v, i) => (i === index ? ([roundToMillimeter(p[0]), roundToMillimeter(p[1])] as [number, number]) : v)) };
}

export function wallLength(wall: EditElement): number {
  const v = (wall.vertices ?? []) as readonly Point[];
  let total = 0;
  for (let i = 0; i + 1 < v.length; i += 1) total += distance(v[i]!, v[i + 1]!);
  return total;
}

/** El muro más cercano a un punto (dentro de `radiusM`) y dónde cae sobre su eje. */
export function nearestWall(state: EditState, point: Point, radiusM: number): { wall: EditElement; offsetM: number; distanceM: number } | null {
  let best: { wall: EditElement; offsetM: number; distanceM: number } | null = null;
  for (const el of state.elements.values()) {
    if (el.kind !== 'WALL' || state.removedElements.has(el.id) || !el.vertices) continue;
    const hit = projectOnPolyline(el.vertices as readonly Point[], point);
    if (hit && hit.distance <= radiusM && (best === null || hit.distance < best.distanceM)) best = { wall: el, offsetM: hit.offset, distanceM: hit.distance };
  }
  return best;
}

/** La puerta o ventana más cercana a un punto (por el segmento del boquete que deja en su muro). */
export function nearestOpening(state: EditState, point: Point, radiusM: number): EditElement | null {
  let best: { el: EditElement; d: number } | null = null;
  for (const el of state.elements.values()) {
    if (el.kind === 'WALL' || state.removedElements.has(el.id) || !el.hostElementId || el.offsetM === undefined || el.widthM === undefined) continue;
    const axis = elementAxis(state, el);
    if (!axis) continue;
    const hit = projectOnPolyline(axis, point);
    if (hit && hit.distance <= radiusM && (best === null || hit.distance < best.d)) best = { el, d: hit.distance };
  }
  return best?.el ?? null;
}

/** El eje del elemento: la polilínea de un muro o el tramo que una puerta o ventana ocupa sobre su muro. */
export function elementAxis(state: EditState, el: EditElement): Point[] | null {
  if (el.kind === 'WALL') return el.vertices ? (el.vertices as readonly Point[]).map(([x, y]) => [x, y] as Point) : null;
  const host = el.hostElementId ? state.elements.get(el.hostElementId) : undefined;
  if (!host?.vertices || el.offsetM === undefined || el.widthM === undefined) return null;
  // Una abertura que se pasó del muro se dibuja hasta donde el muro llega: así el error se ve donde está.
  const length = wallLength(host);
  const a = pointAlongPolyline(host.vertices as readonly Point[], Math.min(length, Math.max(0, el.offsetM)));
  const b = pointAlongPolyline(host.vertices as readonly Point[], Math.min(length, Math.max(0, el.offsetM + el.widthM)));
  return a && b ? [a.point, b.point] : null;
}

/** Offset (sobre el eje del muro) para una abertura centrada en el punto del clic, sin salirse del muro. */
export function openingOffsetAt(wall: EditElement, clickOffsetM: number, widthM: number): number {
  const max = Math.max(0, wallLength(wall) - widthM);
  return roundToMillimeter(Math.min(max, Math.max(0, clickOffsetM - widthM / 2)));
}

/* ---- hacia el servidor ---------------------------------------------------------------- */

function toUpsert(el: EditElement, before: EditElement | undefined): ElementUpsert {
  return {
    id: el.id, kind: el.kind, zOrder: el.zOrder,
    ...(el.vertices ? { vertices: el.vertices } : {}),
    ...(el.thicknessM !== undefined ? { thicknessM: el.thicknessM } : {}),
    ...(el.hostElementId ? { hostElementId: el.hostElementId } : {}),
    ...(el.offsetM !== undefined ? { offsetM: el.offsetM } : {}),
    ...(el.widthM !== undefined ? { widthM: el.widthM } : {}),
    ...(el.swing ? { swing: el.swing } : {}),
    ...(el.swingSide ? { swingSide: el.swingSide } : {}),
    ...(before && el.rowVersion !== null ? { expectedRowVersion: el.rowVersion } : {}),
  };
}

const contentOf = (el: EditElement): unknown => [el.vertices, el.thicknessM, el.hostElementId, el.offsetM, el.widthM, el.swing, el.swingSide, el.zOrder];

/** Lo que cambió en los elementos: muros primero (una puerta nueva necesita su muro). */
export function elementPatch(baseline: EditState, current: EditState): { upserts: ElementUpsert[]; removeIds: string[] } {
  const upserts: ElementUpsert[] = [];
  for (const el of current.elements.values()) {
    if (current.removedElements.has(el.id)) continue;
    const before = baseline.elements.get(el.id);
    if (before && !baseline.removedElements.has(el.id) && same(contentOf(before), contentOf(el))) continue;
    upserts.push(toUpsert(el, before));
  }
  upserts.sort((a, b) => (a.kind === 'WALL' ? 0 : 1) - (b.kind === 'WALL' ? 0 : 1));
  const removeIds = [...current.removedElements].filter((id) => baseline.elements.has(id) && !baseline.removedElements.has(id));
  return { upserts, removeIds };
}

/** Tras un 412: reaplica mis cambios de elementos que no chocaron con los de la otra persona. */
export function reapplyElements(oldBase: EditState, mine: EditState, newBase: EditState): { state: EditState; applied: string[]; conflicts: string[] } {
  let state = newBase;
  const applied: string[] = [];
  const conflicts: string[] = [];
  const touched = new Set<string>();
  for (const el of mine.elements.values()) {
    const before = oldBase.elements.get(el.id);
    if (!before || !same(contentOf(before), contentOf(el))) touched.add(el.id);
  }
  for (const id of mine.removedElements) if (oldBase.elements.has(id)) touched.add(id);
  for (const id of touched) {
    const before = oldBase.elements.get(id);
    const theirs = newBase.elements.get(id);
    const remoteChanged = before ? (theirs ? !same(contentOf(before), contentOf(theirs)) : true) : false;
    const mineNow = mine.elements.get(id);
    if (remoteChanged || !mineNow) {
      conflicts.push(id);
      continue;
    }
    state = mine.removedElements.has(id) ? removeElement(state, id) : withElement(state, { ...mineNow, rowVersion: theirs?.rowVersion ?? null });
    applied.push(id);
  }
  return { state, applied, conflicts };
}

/* ---- hacia el lienzo y la validación ---------------------------------------------------- */

/** Lo que ve el lienzo: los elementos que el editor no toca, tal cual, y los editables en su estado actual. */
export function elementDtosOf(baseDtos: readonly PlanElementDTO[], state: EditState): PlanElementDTO[] {
  const kept = baseDtos.filter((dto) => !EDITABLE_ELEMENT_KINDS.includes(dto.kind));
  const edited = [...state.elements.values()]
    .filter((el) => !state.removedElements.has(el.id))
    .map<PlanElementDTO>((el) => ({
      id: el.id, kind: el.kind, rowVersion: el.rowVersion ?? 0, zOrder: el.zOrder,
      ...(el.vertices ? { vertices: el.vertices } : {}), ...(el.thicknessM !== undefined ? { thicknessM: el.thicknessM } : {}),
      ...(el.hostElementId ? { hostElementId: el.hostElementId } : {}), ...(el.offsetM !== undefined ? { offsetM: el.offsetM } : {}),
      ...(el.widthM !== undefined ? { widthM: el.widthM } : {}), ...(el.swing ? { swing: el.swing } : {}), ...(el.swingSide ? { swingSide: el.swingSide } : {}),
    }));
  return [...kept, ...edited];
}

export function validationElements(state: EditState): { walls: LayoutWall[]; openings: LayoutOpening[] } {
  const walls: LayoutWall[] = [];
  const openings: LayoutOpening[] = [];
  for (const el of state.elements.values()) {
    if (state.removedElements.has(el.id)) continue;
    if (el.kind === 'WALL' && el.vertices) walls.push({ id: el.id, vertices: el.vertices as readonly Point[] });
    else if (el.kind !== 'WALL' && el.hostElementId && el.offsetM !== undefined && el.widthM !== undefined) {
      openings.push({ id: el.id, hostId: el.hostElementId, offsetM: el.offsetM, widthM: el.widthM });
    }
  }
  return { walls, openings };
}

export function elementLabel(el: EditElement): string {
  return el.kind === 'WALL' ? 'Muro' : el.kind === 'DOOR' ? 'Puerta' : 'Ventana';
}
