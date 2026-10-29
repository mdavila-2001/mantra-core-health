/* ============================================================================
    Lo que el editor dibuja encima del plano (asas, selección, borrador, errores
    y medidas), calculado a partir del estado de edición. Sin Angular.
    ========================================================================== */

import type { CanvasOverlay, OverlayHandle, OverlayLabel, OverlayShape } from './canvas.types';
import { type EditSpace, type ResizeHandle, measureText, verticesOfEdit } from './editor-model';
import { bboxOf, type Point } from './geometry';
import { pathOf } from './plan-view';

/** Distancia en pantalla del asa de rotación al borde superior. */
export const ROTATE_HANDLE_OFFSET_PX = 30;

export type DraftShape =
  | { readonly kind: 'rect'; readonly a: Point; readonly b: Point; readonly space: EditSpace | null }
  | { readonly kind: 'polygon'; readonly points: readonly Point[]; readonly cursor: Point | null };

export interface OverlayInput {
  readonly selected: EditSpace | null;
  readonly selectedVertex: number | null;
  readonly locked: boolean;
  readonly draft: DraftShape | null;
  /** Figura que se está arrastrando: muestra sus medidas vivas. */
  readonly measuring: EditSpace | null;
  readonly errors: ReadonlyMap<string, string>;
  readonly errorShapes: ReadonlyMap<string, readonly Point[]>;
  readonly snapMark: Point | null;
  /** Píxeles por metro, para que las asas y los desfases queden del mismo tamaño en pantalla. */
  readonly scale: number;
  readonly pointerType: 'mouse' | 'touch' | 'pen';
}

const RESIZE_CURSOR: Readonly<Record<ResizeHandle, string>> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize',
};

/** Asas de un rectángulo: 8 de tamaño y una de rotación sobre el borde superior. */
export function rectHandles(space: EditSpace, scale: number): OverlayHandle[] {
  const [nw, ne, se, sw] = verticesOfEdit(space) as [Point, Point, Point, Point];
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const at: Record<ResizeHandle, Point> = { nw, ne, se, sw, n: mid(nw, ne), e: mid(ne, se), s: mid(se, sw), w: mid(sw, nw) };
  const handles: OverlayHandle[] = (Object.keys(at) as ResizeHandle[]).map((key) => ({
    id: `resize:${key}`, x: at[key][0], y: at[key][1], kind: 'resize', cursor: RESIZE_CURSOR[key],
  }));
  const top = at.n;
  // «Hacia arriba» del rectángulo, ya rotado: del centro del borde inferior al del superior.
  const down = at.s;
  const length = Math.hypot(top[0] - down[0], top[1] - down[1]) || 1;
  const offset = ROTATE_HANDLE_OFFSET_PX / scale;
  handles.push({
    id: 'rotate',
    x: top[0] + ((top[0] - down[0]) / length) * offset,
    y: top[1] + ((top[1] - down[1]) / length) * offset,
    kind: 'rotate',
    cursor: 'grab',
  });
  return handles;
}

/** Asas de un polígono: una por vértice y una en el medio de cada arista. */
export function polygonHandles(space: EditSpace): OverlayHandle[] {
  const ring = verticesOfEdit(space);
  const handles: OverlayHandle[] = [];
  ring.forEach((v, i) => {
    handles.push({ id: `vertex:${i}`, x: v[0], y: v[1], kind: 'vertex', cursor: 'move' });
    const next = ring[(i + 1) % ring.length]!;
    handles.push({ id: `mid:${i}`, x: (v[0] + next[0]) / 2, y: (v[1] + next[1]) / 2, kind: 'midpoint', cursor: 'copy' });
  });
  return handles;
}

export function buildEditorOverlay(input: OverlayInput): CanvasOverlay {
  const shapes: OverlayShape[] = [];
  const handles: OverlayHandle[] = [];
  const labels: OverlayLabel[] = [];

  for (const [id, ring] of input.errorShapes) shapes.push({ id: `error:${id}`, path: pathOf(ring), kind: 'error' });

  if (input.selected) {
    const ring = verticesOfEdit(input.selected);
    shapes.push({ id: 'selection', path: pathOf(ring), kind: 'selection' });
    if (!input.locked) {
      handles.push(...(input.selected.geometry.kind === 'RECT' ? rectHandles(input.selected, input.scale) : polygonHandles(input.selected)));
    }
  }

  const draft = input.draft;
  if (draft?.kind === 'rect') {
    const ring: Point[] = [draft.a, [draft.b[0], draft.a[1]], draft.b, [draft.a[0], draft.b[1]]];
    shapes.push({ id: 'draft', path: pathOf(ring), kind: 'draft' });
    const w = Math.abs(draft.b[0] - draft.a[0]);
    const d = Math.abs(draft.b[1] - draft.a[1]);
    const fmt = (n: number): string => n.toFixed(2).replace('.', ',');
    labels.push({ x: (draft.a[0] + draft.b[0]) / 2, y: Math.min(draft.a[1], draft.b[1]) - 10 / input.scale, text: `${fmt(w)} × ${fmt(d)} m · ${fmt(w * d)} m²`, kind: 'measure' });
  } else if (draft?.kind === 'polygon') {
    const pts = draft.cursor ? [...draft.points, draft.cursor] : [...draft.points];
    if (pts.length >= 2) shapes.push({ id: 'draft', path: pathOf(pts, false), kind: 'draft' });
    draft.points.forEach((p, i) => handles.push({ id: `draft-vertex:${i}`, x: p[0], y: p[1], kind: 'vertex', cursor: i === 0 ? 'pointer' : 'crosshair' }));
  }

  if (input.measuring) {
    const box = bboxOf(verticesOfEdit(input.measuring));
    labels.push({ x: (box[0] + box[2]) / 2, y: box[1] - 10 / input.scale, text: measureText(input.measuring), kind: 'measure' });
  }

  // Cada error: glifo + mensaje junto a la figura (además del borde): no depende del color.
  for (const [id, ring] of input.errorShapes) {
    const message = input.errors.get(id);
    if (!message) continue;
    const box = bboxOf(ring);
    labels.push({ x: (box[0] + box[2]) / 2, y: (box[1] + box[3]) / 2, text: `⚠ ${message}`, kind: 'error' });
  }

  return {
    shapes,
    handles,
    labels,
    errorIds: new Set(input.errors.keys()),
    errorMessages: input.errors,
    snapMark: input.snapMark,
  };
}
