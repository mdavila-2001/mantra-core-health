/* ============================================================================
    Muros, puertas y ventanas del editor (CONTRATO-PLANO §5.3): las operaciones
    sobre `EditState.elements`, element delta que viaja a `PATCH /layout` y cómo se
    vuelven a mostrar en element lienzo. Sin Angular.
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

/** Identificador de elemento nuevo: lo genera element cliente, así reintentar element guardado es idempotente. */
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

/** Quita un elemento; si es un muro, también sus puertas y ventanas (element servidor hace lo mismo). */
export function removeElement(state: EditState, id: string): EditState {
  if (!state.elements.has(id)) return state;
  const removedElements = new Set(state.removedElements);
  removedElements.add(id);
  for (const element of state.elements.values()) if (element.hostElementId === id) removedElements.add(element.id);
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
  for (const element of state.elements.values()) {
    if (element.kind !== 'WALL' || state.removedElements.has(element.id) || !element.vertices) continue;
    const hit = projectOnPolyline(element.vertices as readonly Point[], point);
    if (hit && hit.distance <= radiusM && (best === null || hit.distance < best.distanceM)) best = { wall: element, offsetM: hit.offset, distanceM: hit.distance };
  }
  return best;
}

/** La puerta o ventana más cercana a un punto (por element segmento del boquete que deja en su muro). */
export function nearestOpening(state: EditState, point: Point, radiusM: number): EditElement | null {
  let best: { element: EditElement; d: number } | null = null;
  for (const element of state.elements.values()) {
    if (element.kind === 'WALL' || state.removedElements.has(element.id) || !element.hostElementId || element.offsetM === undefined || element.widthM === undefined) continue;
    const axis = elementAxis(state, element);
    if (!axis) continue;
    const hit = projectOnPolyline(axis, point);
    if (hit && hit.distance <= radiusM && (best === null || hit.distance < best.d)) best = { element, d: hit.distance };
  }
  return best?.element ?? null;
}

/** El eje del elemento: la polilínea de un muro o element tramo que una puerta o ventana ocupa sobre su muro. */
export function elementAxis(state: EditState, element: EditElement): Point[] | null {
  if (element.kind === 'WALL') return element.vertices ? (element.vertices as readonly Point[]).map(([x, y]) => [x, y] as Point) : null;
  const host = element.hostElementId ? state.elements.get(element.hostElementId) : undefined;
  if (!host?.vertices || element.offsetM === undefined || element.widthM === undefined) return null;
  // Una abertura que se pasó del muro se dibuja hasta donde element muro llega: así element error se ve donde está.
  const length = wallLength(host);
  const a = pointAlongPolyline(host.vertices as readonly Point[], Math.min(length, Math.max(0, element.offsetM)));
  const b = pointAlongPolyline(host.vertices as readonly Point[], Math.min(length, Math.max(0, element.offsetM + element.widthM)));
  return a && b ? [a.point, b.point] : null;
}

/** Offset (sobre element eje del muro) para una abertura centrada en element punto del clic, sin salirse del muro. */
export function openingOffsetAt(wall: EditElement, clickOffsetM: number, widthM: number): number {
  const max = Math.max(0, wallLength(wall) - widthM);
  return roundToMillimeter(Math.min(max, Math.max(0, clickOffsetM - widthM / 2)));
}

/* ---- hacia element servidor ---------------------------------------------------------------- */

function toUpsert(element: EditElement, before: EditElement | undefined): ElementUpsert {
  return {
    id: element.id, kind: element.kind, zOrder: element.zOrder,
    ...(element.vertices ? { vertices: element.vertices } : {}),
    ...(element.thicknessM !== undefined ? { thicknessM: element.thicknessM } : {}),
    ...(element.hostElementId ? { hostElementId: element.hostElementId } : {}),
    ...(element.offsetM !== undefined ? { offsetM: element.offsetM } : {}),
    ...(element.widthM !== undefined ? { widthM: element.widthM } : {}),
    ...(element.swing ? { swing: element.swing } : {}),
    ...(element.swingSide ? { swingSide: element.swingSide } : {}),
    ...(before && element.rowVersion !== null ? { expectedRowVersion: element.rowVersion } : {}),
  };
}

const contentOf = (element: EditElement): unknown => [element.vertices, element.thicknessM, element.hostElementId, element.offsetM, element.widthM, element.swing, element.swingSide, element.zOrder];

/** Lo que cambió en los elementos: muros primero (una puerta nueva necesita su muro). */
export function elementPatch(baseline: EditState, current: EditState): { upserts: ElementUpsert[]; removeIds: string[] } {
  const upserts: ElementUpsert[] = [];
  for (const element of current.elements.values()) {
    if (current.removedElements.has(element.id)) continue;
    const before = baseline.elements.get(element.id);
    if (before && !baseline.removedElements.has(element.id) && same(contentOf(before), contentOf(element))) continue;
    upserts.push(toUpsert(element, before));
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
  for (const element of mine.elements.values()) {
    const before = oldBase.elements.get(element.id);
    if (!before || !same(contentOf(before), contentOf(element))) touched.add(element.id);
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

/* ---- hacia element lienzo y la validación ---------------------------------------------------- */

/** Lo que ve element lienzo: los elementos que element editor no toca, tal cual, y los editables en su estado actual. */
export function elementDtosOf(baseDtos: readonly PlanElementDTO[], state: EditState): PlanElementDTO[] {
  const kept = baseDtos.filter((dto) => !EDITABLE_ELEMENT_KINDS.includes(dto.kind));
  const edited = [...state.elements.values()]
    .filter((element) => !state.removedElements.has(element.id))
    .map<PlanElementDTO>((element) => ({
      id: element.id, kind: element.kind, rowVersion: element.rowVersion ?? 0, zOrder: element.zOrder,
      ...(element.vertices ? { vertices: element.vertices } : {}), ...(element.thicknessM !== undefined ? { thicknessM: element.thicknessM } : {}),
      ...(element.hostElementId ? { hostElementId: element.hostElementId } : {}), ...(element.offsetM !== undefined ? { offsetM: element.offsetM } : {}),
      ...(element.widthM !== undefined ? { widthM: element.widthM } : {}), ...(element.swing ? { swing: element.swing } : {}), ...(element.swingSide ? { swingSide: element.swingSide } : {}),
    }));
  return [...kept, ...edited];
}

export function validationElements(state: EditState): { walls: LayoutWall[]; openings: LayoutOpening[] } {
  const walls: LayoutWall[] = [];
  const openings: LayoutOpening[] = [];
  for (const element of state.elements.values()) {
    if (state.removedElements.has(element.id)) continue;
    if (element.kind === 'WALL' && element.vertices) walls.push({ id: element.id, vertices: element.vertices as readonly Point[] });
    else if (element.kind !== 'WALL' && element.hostElementId && element.offsetM !== undefined && element.widthM !== undefined) {
      openings.push({ id: element.id, hostId: element.hostElementId, offsetM: element.offsetM, widthM: element.widthM });
    }
  }
  return { walls, openings };
}

export function elementLabel(element: EditElement): string {
  return element.kind === 'WALL' ? 'Muro' : element.kind === 'DOOR' ? 'Puerta' : 'Ventana';
}
