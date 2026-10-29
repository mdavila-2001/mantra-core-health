import type { WritableSignal } from '@angular/core';

import type { WorldPointerEvent } from '../../../core/floor-plan/canvas.types';
import { moveWallVertex, translateWall, withElement } from '../../../core/floor-plan/editor-elements';
import {
  defaultRect, descendantsOf, insertPolygonVertex, movePolygonVertex, moveWithChildren, rectFromCorners, resizeRect, rotateRectTo, setGeometry, verticesOfEdit,
  type EditSpace, type EditState, type ResizeHandle,
} from '../../../core/floor-plan/editor-model';
import type { DraftShape } from '../../../core/floor-plan/editor-overlay';
import { neighborGeometry, snapDelta, snapWorldPoint, type NeighborGeometry } from '../../../core/floor-plan/editor-snap';
import { bboxIntersects, bboxOf, contactOverlapArea, orientClockwise, validatePolygon, type Point } from '../../../core/floor-plan/geometry';

export type EditTool = 'select' | 'hand' | 'rect' | 'polygon' | 'wall' | 'door' | 'window';

/** Lo que el controlador necesita del almacén del editor. */
export interface EditorPointerHost {
  readonly tool: () => EditTool;
  readonly current: () => EditState;
  readonly selectedId: () => string | null;
  readonly armedId: () => string | null;
  readonly gridSizeM: () => number;
  readonly snapOn: () => boolean;
  readonly viewScale: () => number;
  readonly paletteForm: (id: string) => string | undefined;
  readonly select: (id: string | null) => void;
  readonly selectVertex: (index: number | null) => void;
  readonly showHint: (text: string | null) => void;
  /** Cambia el estado sin dejar un paso en el historial (arrastre en curso). */
  readonly live: (next: EditState) => void;
  /** Cierra un gesto: un solo paso de deshacer. */
  readonly commit: (start: EditState, next: EditState) => void;
  /** Vuelve al estado de antes del gesto. */
  readonly restore: (start: EditState) => void;
  readonly placeNew: (id: string, geometry: EditSpace['geometry']) => boolean;
  /* Muros, puertas y ventanas */
  readonly selectedElementId: () => string | null;
  readonly selectElement: (id: string | null) => void;
  /** La puerta, ventana o muro bajo el punto (en ese orden de prioridad). */
  readonly hitElement: (world: Point, radiusM: number) => string | null;
  readonly wallVertices: (id: string) => readonly Point[] | null;
  readonly placeWall: (points: readonly Point[]) => boolean;
  /** Dónde caería una puerta o ventana si se hiciera clic acá (el muro más cercano). */
  readonly openingPreview: (kind: 'DOOR' | 'WINDOW', world: Point, radiusM: number) => { wallId: string; offsetM: number; start: Point; end: Point } | null;
  readonly placeOpening: (kind: 'DOOR' | 'WINDOW', wallId: string, offsetM: number) => boolean;
  readonly draft: WritableSignal<DraftShape | null>;
  readonly snapMark: WritableSignal<Point | null>;
  readonly measuring: WritableSignal<string | null>;
  readonly dragFocus: WritableSignal<ReadonlySet<string> | null>;
  readonly pointerType: WritableSignal<'mouse' | 'touch' | 'pen'>;
}

type Gesture =
  | { kind: 'move'; id: string; startWorld: Point; startState: EditState; moving: Point[]; neighbors: NeighborGeometry; siblings: Point[][] }
  | { kind: 'resize'; id: string; handle: ResizeHandle; startState: EditState; neighbors: NeighborGeometry }
  | { kind: 'rotate'; id: string; startState: EditState }
  | { kind: 'vertex'; id: string; index: number; startState: EditState; neighbors: NeighborGeometry }
  | { kind: 'wall-move'; id: string; startWorld: Point; startState: EditState; moving: Point[]; neighbors: NeighborGeometry }
  | { kind: 'wall-vertex'; id: string; index: number; startState: EditState; neighbors: NeighborGeometry }
  | { kind: 'draw-rect'; a: Point; neighbors: NeighborGeometry };

const SNAP_RADIUS_PX = 8;
const CLOSE_RADIUS_PX = 14;
const MIN_DRAWN_SIDE_M = 0.3;
const PICK_FIRST = 'Elija primero un espacio de la lista «Sin ubicar» para dibujarlo.';

/**
 * Traduce los gestos del lienzo (en metros) a cambios del dibujo: mover,
 * redimensionar, rotar, editar vértices y dibujar rectángulos y polígonos.
 */
export class EditorPointerController {
  private gesture: Gesture | null = null;
  private lastTap: { at: number; point: Point } | null = null;

  constructor(private readonly host: EditorPointerHost) {}

  get active(): boolean {
    return this.gesture !== null;
  }

  onWorld(ev: WorldPointerEvent): void {
    this.host.pointerType.set(ev.pointerType === 'touch' ? 'touch' : ev.pointerType === 'pen' ? 'pen' : 'mouse');
    if (ev.phase === 'cancel') {
      this.cancel();
      return;
    }
    const tool = this.host.tool();
    if (tool === 'select') this.selectTool(ev);
    else if (tool === 'rect') this.rectTool(ev);
    else if (tool === 'polygon' || tool === 'wall') this.pathTool(ev, tool);
    else if (tool === 'door' || tool === 'window') this.openingTool(ev, tool === 'door' ? 'DOOR' : 'WINDOW');
  }

  private radiusM(): number {
    return SNAP_RADIUS_PX / Math.max(this.host.viewScale(), 0.5);
  }

  neighborsOf(except: ReadonlySet<string>): NeighborGeometry {
    const cur = this.host.current();
    return neighborGeometry([...cur.spaces.values()].filter((s) => !cur.removed.has(s.id) && !except.has(s.id)).map((s) => verticesOfEdit(s)));
  }

  snapPoint(point: Point, suspended: boolean, neighbors?: NeighborGeometry, orthogonalFrom: Point | null = null): { point: Point; mark: Point | null } {
    return snapWorldPoint(point, {
      neighbors: neighbors ?? this.neighborsOf(new Set()),
      gridSizeM: this.host.snapOn() ? this.host.gridSizeM() : null,
      radiusM: this.radiusM(),
      suspended,
      orthogonalFrom,
    });
  }

  /* ---- seleccionar / mover / asas ------------------------------------------------------- */

  private selectTool(ev: WorldPointerEvent): void {
    if (ev.phase === 'down') {
      if (ev.handleId) {
        this.startHandle(ev.handleId);
        return;
      }
      // Una puerta, ventana o muro tiene prioridad sobre el local que hay debajo (se pisan en el borde).
      const element = this.host.hitElement(ev.world, this.radiusM());
      if (element) {
        this.host.selectElement(element);
        this.startWallMove(element, ev.world);
      } else if (ev.targetId && this.host.current().spaces.has(ev.targetId)) {
        this.host.select(ev.targetId);
        this.startMove(ev.targetId, ev.world);
      } else this.host.select(null);
      return;
    }
    const g = this.gesture;
    if (!g) return;
    if (ev.phase === 'move') this.update(g, ev);
    else this.finish(g);
  }

  private startMove(id: string, world: Point): void {
    const start = this.host.current();
    const space = start.spaces.get(id);
    if (!space) return;
    if (space.locked) {
      this.host.showHint(`${space.code} está bloqueado: desbloquéelo para moverlo.`);
      return;
    }
    const ids = descendantsOf(start, id);
    const siblings = [...start.spaces.values()].filter((s) => s.parentId === space.parentId && !ids.has(s.id) && !start.removed.has(s.id)).map((s) => verticesOfEdit(s));
    this.gesture = { kind: 'move', id, startWorld: world, startState: start, moving: verticesOfEdit(space), neighbors: this.neighborsOf(ids), siblings };
    this.host.dragFocus.set(ids);
  }

  private startWallMove(id: string, world: Point): void {
    const start = this.host.current();
    const wall = start.elements.get(id);
    if (wall?.kind !== 'WALL' || !wall.vertices) return;
    this.gesture = { kind: 'wall-move', id, startWorld: world, startState: start, moving: wall.vertices.map(([x, y]) => [x, y] as Point), neighbors: this.neighborsOf(new Set()) };
  }

  private startWallHandle(handleId: string, elementId: string): void {
    const start = this.host.current();
    const wall = start.elements.get(elementId);
    if (wall?.kind !== 'WALL' || !handleId.startsWith('vertex:')) return;
    this.gesture = { kind: 'wall-vertex', id: elementId, index: Number(handleId.slice(7)), startState: start, neighbors: this.neighborsOf(new Set()) };
  }

  private startHandle(handleId: string): void {
    const elementId = this.host.selectedElementId();
    if (elementId) {
      this.startWallHandle(handleId, elementId);
      return;
    }
    const id = this.host.selectedId();
    const start = this.host.current();
    const space = id ? start.spaces.get(id) : undefined;
    if (!id || !space || space.locked) return;
    const neighbors = this.neighborsOf(new Set([id]));
    const g = space.geometry;
    if (handleId.startsWith('resize:') && g.kind === 'RECT') {
      this.gesture = { kind: 'resize', id, handle: handleId.slice(7) as ResizeHandle, startState: start, neighbors };
    } else if (handleId === 'rotate' && g.kind === 'RECT') {
      this.gesture = { kind: 'rotate', id, startState: start };
    } else if (handleId.startsWith('vertex:') && g.kind === 'POLYGON') {
      const index = Number(handleId.slice(7));
      this.host.selectVertex(index);
      this.gesture = { kind: 'vertex', id, index, startState: start, neighbors };
    } else if (handleId.startsWith('mid:') && g.kind === 'POLYGON') {
      const index = Number(handleId.slice(4));
      this.host.live(setGeometry(start, id, insertPolygonVertex(g, index)));
      this.host.selectVertex(index + 1);
      this.gesture = { kind: 'vertex', id, index: index + 1, startState: start, neighbors };
    } else return;
    this.host.dragFocus.set(new Set([...descendantsOf(start, id), ...(space.parentId ? [space.parentId] : [])]));
  }

  private update(g: Gesture, ev: WorldPointerEvent): void {
    const suspended = ev.altKey;
    if (g.kind === 'move') {
      const raw: Point = [ev.world[0] - g.startWorld[0], ev.world[1] - g.startWorld[1]];
      const rejects = (delta: Point): boolean => this.overlapsSibling(g.moving.map(([x, y]) => [x + delta[0], y + delta[1]] as Point), g.siblings);
      const snapped = snapDelta({ moving: g.moving, delta: raw, neighbors: g.neighbors, gridSizeM: this.host.snapOn() ? this.host.gridSizeM() : null, radiusM: this.radiusM(), suspended, orthogonal: ev.shiftKey, rejects });
      this.host.snapMark.set(snapped.mark);
      this.host.live(moveWithChildren(g.startState, g.id, snapped.delta[0], snapped.delta[1]));
      this.host.measuring.set(g.id);
      return;
    }
    if (g.kind === 'draw-rect') return;
    if (g.kind === 'wall-move') {
      const raw: Point = [ev.world[0] - g.startWorld[0], ev.world[1] - g.startWorld[1]];
      const snapped = snapDelta({ moving: g.moving, delta: raw, neighbors: g.neighbors, gridSizeM: this.host.snapOn() ? this.host.gridSizeM() : null, radiusM: this.radiusM(), suspended, orthogonal: ev.shiftKey });
      this.host.snapMark.set(snapped.mark);
      const wall = g.startState.elements.get(g.id)!;
      this.host.live(withElement(g.startState, translateWall(wall, snapped.delta[0], snapped.delta[1])));
      return;
    }
    if (g.kind === 'wall-vertex') {
      const p = this.snapPoint(ev.world, suspended, g.neighbors);
      this.host.snapMark.set(p.mark);
      const wall = this.host.current().elements.get(g.id) ?? g.startState.elements.get(g.id)!;
      this.host.live(withElement(this.host.current(), moveWallVertex(wall, g.index, p.point)));
      return;
    }
    const space = g.startState.spaces.get(g.id);
    if (!space) return;
    if (g.kind === 'rotate' && space.geometry.kind === 'RECT') {
      this.host.live(setGeometry(g.startState, g.id, rotateRectTo(space.geometry, ev.world, ev.shiftKey ? 15 : undefined)));
    } else if (g.kind === 'resize' && space.geometry.kind === 'RECT') {
      const p = this.snapPoint(ev.world, suspended, g.neighbors);
      this.host.snapMark.set(p.mark);
      this.host.live(setGeometry(g.startState, g.id, resizeRect(space.geometry, g.handle, p.point)));
    } else if (g.kind === 'vertex' && space.geometry.kind === 'POLYGON') {
      const p = this.snapPoint(ev.world, suspended, g.neighbors);
      this.host.snapMark.set(p.mark);
      // Con «mid:» el vértice ya se insertó en el estado en curso: se parte de él.
      const live = this.host.current().spaces.get(g.id)?.geometry ?? space.geometry;
      this.host.live(setGeometry(this.host.current(), g.id, movePolygonVertex(live, g.index, p.point)));
    }
    this.host.measuring.set(g.id);
  }

  /** ¿La figura, en esa posición, pisa a una hermana? (más que el contacto de pared compartida) */
  private overlapsSibling(ring: readonly Point[], siblings: readonly (readonly Point[])[]): boolean {
    const box = bboxOf(ring);
    return siblings.some((other) => bboxIntersects(box, bboxOf(other)) && contactOverlapArea(ring, other, 0.01) > 0);
  }

  private finish(g: Gesture): void {
    const final = this.host.current();
    this.reset();
    if (g.kind === 'draw-rect') return;
    const start = g.startState;
    const signature = (s: EditState): string => JSON.stringify([[...s.spaces.values()].map((x) => x.geometry), [...s.elements.values()].map((x) => x.vertices)]);
    if (final !== start && signature(final) !== signature(start)) this.host.commit(start, final);
    else this.host.restore(start);
  }

  cancel(): void {
    const g = this.gesture;
    this.reset();
    this.host.draft.update((d) => (d?.kind === 'rect' ? null : d));
    if (g && g.kind !== 'draw-rect') this.host.restore(g.startState);
  }

  private reset(): void {
    this.gesture = null;
    this.host.snapMark.set(null);
    this.host.measuring.set(null);
    this.host.dragFocus.set(null);
  }

  /* ---- dibujar ---------------------------------------------------------------------------- */

  private rectTool(ev: WorldPointerEvent): void {
    const armed = this.host.armedId();
    if (ev.phase === 'down') {
      if (!armed) {
        this.host.showHint(PICK_FIRST);
        return;
      }
      const neighbors = this.neighborsOf(new Set());
      const p = this.snapPoint(ev.world, ev.altKey, neighbors).point;
      this.gesture = { kind: 'draw-rect', a: p, neighbors };
      this.host.draft.set({ kind: 'rect', a: p, b: p, space: null });
      return;
    }
    const g = this.gesture;
    if (ev.phase === 'move') {
      const probe = this.snapPoint(ev.world, ev.altKey, g?.kind === 'draw-rect' ? g.neighbors : undefined);
      this.host.snapMark.set(probe.mark);
      if (g?.kind === 'draw-rect') this.host.draft.set({ kind: 'rect', a: g.a, b: probe.point, space: null });
      return;
    }
    if (g?.kind !== 'draw-rect' || !armed) return;
    const b = this.snapPoint(ev.world, ev.altKey, g.neighbors).point;
    this.reset();
    const big = Math.abs(b[0] - g.a[0]) >= MIN_DRAWN_SIDE_M && Math.abs(b[1] - g.a[1]) >= MIN_DRAWN_SIDE_M;
    this.host.placeNew(armed, big ? rectFromCorners(g.a, b) : defaultRect(this.host.paletteForm(armed) ?? 'ROOM', b));
  }

  /** Polígono de un espacio (cierra con ≥ 3 puntos) o muro (cierra con ≥ 2): se va marcando punto a punto. */
  private pathTool(ev: WorldPointerEvent, tool: 'polygon' | 'wall'): void {
    const armed = this.host.armedId();
    const needsSpace = tool === 'polygon';
    const minPoints = tool === 'polygon' ? 3 : 2;
    const draft = this.host.draft();
    const points = draft?.kind === 'polygon' ? draft.points : [];
    const last = points.length > 0 ? points[points.length - 1]! : null;
    if (ev.phase === 'move') {
      const probe = this.snapPoint(ev.world, ev.altKey, undefined, ev.shiftKey ? last : null);
      this.host.snapMark.set(probe.mark);
      if (points.length > 0) this.host.draft.set({ kind: 'polygon', points, cursor: probe.point });
      return;
    }
    if (ev.phase === 'down') {
      if (needsSpace && !armed) this.host.showHint(PICK_FIRST);
      return;
    }
    if (needsSpace && !armed) return;
    const p = this.snapPoint(ev.world, ev.altKey, this.neighborsOf(new Set()), ev.shiftKey ? last : null).point;
    const now = Date.now();
    const doubleTap = this.lastTap !== null && now - this.lastTap.at < 350 && Math.hypot(p[0] - this.lastTap.point[0], p[1] - this.lastTap.point[1]) < this.radiusM() * 2;
    const closes = tool === 'polygon' && points.length >= 3 && Math.hypot(p[0] - points[0]![0], p[1] - points[0]![1]) <= CLOSE_RADIUS_PX / Math.max(this.host.viewScale(), 0.5);
    this.lastTap = { at: now, point: p };
    if ((doubleTap || closes) && points.length >= minPoints) this.finishPath();
    else if (!doubleTap) this.host.draft.set({ kind: 'polygon', points: [...points, p], cursor: p });
  }

  /** Cierra el trazo en curso: el polígono del espacio elegido o el muro. */
  finishPath(): void {
    const draft = this.host.draft();
    if (draft?.kind !== 'polygon') return;
    if (this.host.tool() === 'wall') {
      if (draft.points.length < 2) return;
      this.host.placeWall(draft.points);
      this.host.draft.set(null);
      return;
    }
    const armed = this.host.armedId();
    if (!armed) return;
    const ring = orientClockwise(draft.points);
    if (validatePolygon(ring) !== null) {
      this.host.showHint('La figura no es un polígono simple: sin cruces ni vértices repetidos. Quite el último vértice con Retroceso o empiece de nuevo con Esc.');
      return;
    }
    this.host.placeNew(armed, { kind: 'POLYGON', vertices: ring.map(([x, y]) => [x, y] as [number, number]) });
  }

  /** Puerta o ventana: al pasar sobre un muro se ve dónde caería; un clic la ubica. */
  private openingTool(ev: WorldPointerEvent, kind: 'DOOR' | 'WINDOW'): void {
    const preview = this.host.openingPreview(kind, ev.world, this.radiusM() * 1.5);
    if (ev.phase === 'move') {
      this.host.draft.set(preview ? { kind: 'opening', start: preview.start, end: preview.end } : null);
      return;
    }
    if (ev.phase !== 'up') return;
    if (!preview) {
      this.host.showHint('Acerque el puntero a un muro para ubicar ' + (kind === 'DOOR' ? 'la puerta.' : 'la ventana.') + ' Si todavía no hay muro, dibújelo con la herramienta Muro (W).');
      return;
    }
    this.host.placeOpening(kind, preview.wallId, preview.offsetM);
  }
}
