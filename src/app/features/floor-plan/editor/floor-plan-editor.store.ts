import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { FloorPlanClient } from '../../../core/data-access/floor-plan/floor-plan.client';
import type { LayoutResponse, UnplacedSpace } from '../../../core/data-access/floor-plan/floor-plan.types';
import type { CanvasOverlay, WorldPointerEvent } from '../../../core/floor-plan/canvas.types';
import { applyDraft, buildDraft, clearDraft, loadDraft, saveDraft, type EditDraft } from '../../../core/floor-plan/editor-draft';
import {
  elementAxis, newElementId, newOpening, newWall, nearestOpening, nearestWall, openingOffsetAt, removeElement, translateWall, wallLength, withElement,
} from '../../../core/floor-plan/editor-elements';
import {
  defaultRect, descendantsOf, diffPatch, EditHistory, EMPTY_EDIT, fromViews, isDirty, moveWithChildren, patchSize, removeFromPlan, removePolygonVertex,
  setGeometry, withSpace, type EditElement, type EditSpace, type EditState,
} from '../../../core/floor-plan/editor-model';
import { buildEditorOverlay, type DraftShape } from '../../../core/floor-plan/editor-overlay';
import { buildElementViews, buildPalette, buildSpaceViews, validateEdit } from '../../../core/floor-plan/editor-views';
import { pointAlongPolyline, type Point } from '../../../core/floor-plan/geometry';
import { pathOf, type ElementView, type SpaceView } from '../../../core/floor-plan/plan-view';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FloorPlanStore } from '../viewer/floor-plan.store';
import { errorMarks, mergeIssues, type EditorIssue } from './editor-issues';
import { EditorSaver } from './editor-save';
import { EditorPointerController, type EditorPointerHost, type EditTool } from './plan-editor-pointer';

export type { EditTool } from './plan-editor-pointer';
export type { EditorIssue, SaveFailure } from './editor-issues';

/**
 * Almacén del editor del plano (CONTRATO-PLANO §5.3): el dibujo en edición, el
 * historial, las herramientas, la validación local y el borrador. Guardar y los
 * dos fallos que tienen salida propia (422 por elemento y 412) los resuelve
 * {@link EditorSaver}; los gestos, {@link EditorPointerController}.
 *
 * La validación local es una ayuda inmediata: quien decide es la API. El
 * guardado siempre se envía, y los errores del servidor reemplazan a los locales.
 */
@Injectable()
export class FloorPlanEditorStore {
  private readonly client = inject(FloorPlanClient);
  private readonly dialogs = inject(DialogService);
  readonly plan = inject(FloorPlanStore);

  private history = new EditHistory<EditState>(EMPTY_EDIT);
  readonly baseline = signal<EditState>(EMPTY_EDIT);
  readonly current = signal<EditState>(EMPTY_EDIT);
  private readonly historyTick = signal(0);
  readonly canUndo = computed(() => (this.historyTick(), this.history.canUndo));
  readonly canRedo = computed(() => (this.historyTick(), this.history.canRedo));

  readonly tool = signal<EditTool>('select');
  readonly selectedId = signal<string | null>(null);
  readonly selectedElementId = signal<string | null>(null);
  readonly selectedVertex = signal<number | null>(null);
  readonly armedId = signal<string | null>(null);
  readonly snapOn = signal(true);
  readonly hint = signal<string | null>(null);
  readonly unplaced = signal<readonly UnplacedSpace[]>([]);
  readonly version = signal<number | null>(null);
  readonly pendingDraft = signal<EditDraft | null>(null);

  readonly draft = signal<DraftShape | null>(null);
  readonly measuring = signal<string | null>(null);
  readonly snapMark = signal<Point | null>(null);
  readonly dragFocus = signal<ReadonlySet<string> | null>(null);
  readonly viewScale = signal(10);
  readonly pointerType = signal<'mouse' | 'touch' | 'pen'>('mouse');

  private readonly pointer = new EditorPointerController(this.pointerHost());
  private readonly saver = new EditorSaver({
    client: this.client, plan: this.plan,
    planId: () => this.meta()?.id ?? null, version: () => this.version(), baseline: () => this.baseline(), current: () => this.current(),
    setVersion: (v) => this.version.set(v), reset: (state) => this.resetTo(state), adopt: (base, state) => this.adopt(base, state), select: (id) => this.select(id),
  });
  readonly saving = this.saver.saving;
  readonly failure = this.saver.failure;
  readonly serverErrors = this.saver.serverErrors;
  readonly lastSave = this.saver.lastSave;
  readonly remoteChanges = this.saver.remoteChanges;
  readonly reapplied = this.saver.reapplied;

  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private initKey = '';
  private readonly known = new Map<string, UnplacedSpace>();

  /* ---- derivados ---------------------------------------------------------------- */
  readonly meta = this.plan.meta;
  readonly gridSizeM = computed(() => this.meta()?.gridSizeM ?? 0.5);
  readonly dirty = computed(() => isDirty(this.baseline(), this.current()));
  readonly changeCount = computed(() => patchSize(diffPatch(this.baseline(), this.current())));

  readonly views = computed<SpaceView[]>(() => buildSpaceViews(this.plan.spaces(), this.baseline(), this.current(), this.known));
  readonly elementViews = computed<ElementView[]>(() => buildElementViews(this.plan.layout()?.elements ?? [], this.current()));
  readonly localIssues = computed(() => {
    const meta = this.meta();
    return meta ? validateEdit(meta, this.current(), this.dragFocus() ?? undefined) : [];
  });
  readonly issues = computed<EditorIssue[]>(() => mergeIssues(this.serverErrors(), this.localIssues()));
  readonly palette = computed<readonly UnplacedSpace[]>(() => buildPalette(this.baseline(), this.current(), this.unplaced(), this.known));

  readonly selected = computed<EditSpace | null>(() => {
    const id = this.selectedId();
    const cur = this.current();
    return id && !cur.removed.has(id) ? (cur.spaces.get(id) ?? null) : null;
  });
  readonly selectedElement = computed<EditElement | null>(() => {
    const id = this.selectedElementId();
    const cur = this.current();
    return id && !cur.removedElements.has(id) ? (cur.elements.get(id) ?? null) : null;
  });
  /** Hay un polígono o un muro a medio dibujar. */
  readonly pathDraft = computed(() => this.draft()?.kind === 'polygon');
  readonly canNudge = computed(() => this.tool() === 'select' && (this.selected() !== null || this.selectedElement() !== null));

  readonly overlay = computed<CanvasOverlay | null>(() => {
    const cur = this.current();
    const { errors, shapes, labels, elements } = errorMarks(this.issues(), cur);
    const sel = this.selected();
    const measuringId = this.measuring();
    const element = this.selectedElement();
    const axis = element ? elementAxis(cur, element) : null;
    return buildEditorOverlay({
      selected: sel, selectedVertex: this.selectedVertex(), locked: sel?.locked ?? false, draft: this.draft(),
      measuring: measuringId ? (cur.spaces.get(measuringId) ?? null) : null,
      elementSelection: axis ? { path: pathOf(axis, false), vertices: element?.kind === 'WALL' ? axis : null } : null,
      elementErrors: elements,
      errors, errorShapes: shapes, errorLabels: labels, snapMark: this.snapMark(), scale: this.viewScale(), pointerType: this.pointerType(),
    });
  });

  constructor() {
    // Cada vez que llega un plano (otro lienzo) se arma el editor sobre él.
    effect(() => {
      const layout = this.plan.layout();
      if (!layout) return;
      untracked(() => this.initFrom(layout));
    });
    // Borrador: se guarda con una pausa corta, solo si hay cambios.
    effect(() => {
      const cur = this.current();
      const dirty = this.dirty();
      untracked(() => this.scheduleDraft(cur, dirty));
    });
  }

  /* ---- arranque ------------------------------------------------------------------ */

  private initFrom(layout: LayoutResponse): void {
    const key = `${layout.floorPlan.id}`;
    if (key === this.initKey) return;
    this.initKey = key;
    this.resetTo(fromViews(this.plan.spaces(), layout.elements));
    this.version.set(layout.layoutVersion);
    this.tool.set('select');
    this.select(null);
    this.armedId.set(null);
    this.saver.clearAll();
    const draft = loadDraft(layout.floorPlan.id);
    this.pendingDraft.set(draft && draft.baseVersion === layout.layoutVersion ? draft : null);
    if (draft && draft.baseVersion !== layout.layoutVersion) clearDraft(layout.floorPlan.id);
    void this.loadUnplaced(layout.floorPlan.id);
  }

  private resetTo(state: EditState): void {
    this.baseline.set(state);
    this.history = new EditHistory<EditState>(state);
    this.current.set(state);
    this.historyTick.update((n) => n + 1);
    this.draft.set(null);
  }

  /** Un plano nuevo como base y mis cambios encima (tras un 412), con un paso de deshacer. */
  private adopt(base: EditState, state: EditState): void {
    this.baseline.set(base);
    this.history = new EditHistory<EditState>(base);
    this.history.push(state);
    this.current.set(this.history.present);
    this.historyTick.update((n) => n + 1);
  }

  private async loadUnplaced(planId: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.client.getUnplacedSpaces(planId));
      this.unplaced.set(res.items);
      for (const item of res.items) this.known.set(item.spaceId, item);
    } catch {
      this.unplaced.set([]);
    }
  }

  recoverDraft(): void {
    const draft = this.pendingDraft();
    if (!draft) return;
    const next = applyDraft(this.baseline(), draft);
    this.history.push(next);
    this.current.set(this.history.present);
    this.historyTick.update((n) => n + 1);
    this.pendingDraft.set(null);
  }

  discardDraft(): void {
    const planId = this.meta()?.id;
    if (planId) clearDraft(planId);
    this.pendingDraft.set(null);
  }

  private scheduleDraft(cur: EditState, dirty: boolean): void {
    const planId = this.meta()?.id;
    const version = this.version();
    if (!planId || version === null || this.pendingDraft() !== null) return;
    if (this.draftTimer !== null) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => {
      const draft = dirty ? buildDraft(planId, version, this.baseline(), cur, new Date()) : null;
      if (draft) saveDraft(draft);
      else clearDraft(planId);
    }, 400);
  }

  /* ---- guardar (lo resuelve EditorSaver) ----------------------------------------------- */

  save(): Promise<void> {
    return this.saver.save();
  }

  showRemoteChanges(): Promise<void> {
    return this.saver.showRemoteChanges();
  }

  reloadAndReapply(): Promise<void> {
    return this.saver.reloadAndReapply();
  }

  /** Descarta todo lo no guardado y vuelve al plano cargado. */
  discardAll(): void {
    const planId = this.meta()?.id;
    this.resetTo(this.baseline());
    if (planId) clearDraft(planId);
    this.afterChange();
    this.select(null);
  }

  /* ---- puntero ---------------------------------------------------------------------------- */

  private pointerHost(): EditorPointerHost {
    return {
      tool: () => this.tool(), current: () => this.current(), selectedId: () => this.selectedId(), armedId: () => this.armedId(),
      gridSizeM: () => this.gridSizeM(), snapOn: () => this.snapOn(), viewScale: () => this.viewScale(),
      paletteForm: (id) => this.paletteEntry(id)?.form,
      select: (id) => this.select(id), selectVertex: (i) => this.selectedVertex.set(i), showHint: (t) => this.hint.set(t),
      live: (next) => this.live(next), commit: (start, next) => this.commit(start, next), restore: (start) => this.restore(start),
      placeNew: (id, g) => this.placeNew(id, g),
      selectedElementId: () => this.selectedElementId(), selectElement: (id) => this.selectElement(id),
      hitElement: (world, radius) => this.hitElement(world, radius), wallVertices: (id) => this.current().elements.get(id)?.vertices as Point[] | null ?? null,
      placeWall: (points) => this.placeWall(points), openingPreview: (kind, world, radius) => this.openingPreview(kind, world, radius),
      placeOpening: (kind, wall, offset) => this.placeOpening(kind, wall, offset),
      draft: this.draft, snapMark: this.snapMark, measuring: this.measuring, dragFocus: this.dragFocus, pointerType: this.pointerType,
    };
  }

  onWorld(ev: WorldPointerEvent): void {
    this.pointer.onWorld(ev);
  }

  /* ---- historial ------------------------------------------------------------------ */

  private live(next: EditState): void {
    this.history.replace(next);
    this.current.set(next);
  }

  private restore(start: EditState): void {
    this.live(start);
  }

  private commit(start: EditState, next: EditState): void {
    this.history.replace(start);
    this.history.push(next);
    this.current.set(this.history.present);
    this.historyTick.update((n) => n + 1);
    this.afterChange();
  }

  private afterChange(): void {
    this.saver.clearOutcome();
    this.hint.set(null);
  }

  undo(): void {
    this.pointer.cancel();
    this.current.set(this.history.undo());
    this.historyTick.update((n) => n + 1);
    this.afterChange();
  }

  redo(): void {
    this.pointer.cancel();
    this.current.set(this.history.redo());
    this.historyTick.update((n) => n + 1);
    this.afterChange();
  }

  /* ---- herramientas y selección ------------------------------------------------------ */

  setTool(tool: EditTool): void {
    this.pointer.cancel();
    this.draft.set(null);
    this.tool.set(tool);
    const needsSpace = (tool === 'rect' || tool === 'polygon') && !this.armedId();
    this.hint.set(
      needsSpace
        ? 'Elija primero un espacio de la lista «Sin ubicar» para dibujarlo.'
        : tool === 'wall'
          ? 'Marque los puntos del muro con un clic cada uno; doble clic o Entrar lo termina. Shift mantiene la línea recta.'
          : tool === 'door' || tool === 'window'
            ? `Acerque el puntero a un muro y haga clic para ubicar ${tool === 'door' ? 'la puerta' : 'la ventana'}.`
            : null,
    );
  }

  select(id: string | null): void {
    this.selectedId.set(id);
    this.selectedElementId.set(null);
    this.selectedVertex.set(null);
  }

  selectElement(id: string | null): void {
    this.selectedElementId.set(id);
    this.selectedId.set(null);
    this.selectedVertex.set(null);
  }

  arm(id: string | null): void {
    this.armedId.set(id);
    if (id && (this.tool() === 'select' || this.tool() === 'hand')) this.tool.set('rect');
    this.hint.set(id ? 'Dibuje el local en el plano: arrastre para un rectángulo, o haga un clic para uno de tamaño habitual.' : null);
  }

  /** Ubica el espacio elegido con su tamaño habitual, en el centro de lo que se ve. */
  placeAtCenter(center: Point): boolean {
    const id = this.armedId();
    if (!id) return false;
    return this.placeNew(id, defaultRect(this.paletteEntry(id)?.form ?? 'ROOM', this.pointer.snapPoint(center, false).point));
  }

  private paletteEntry(id: string): UnplacedSpace | undefined {
    return this.palette().find((p) => p.spaceId === id);
  }

  private placeNew(spaceId: string, geometry: EditSpace['geometry']): boolean {
    const entry = this.paletteEntry(spaceId);
    if (!entry) return false;
    this.known.set(spaceId, entry);
    const start = this.current();
    const base = this.baseline().spaces.get(spaceId);
    const space: EditSpace = {
      id: spaceId, code: entry.code, name: entry.name, parentId: entry.parentId, formCode: entry.form, geometry,
      zOrder: entry.form === 'BED' ? 20 : 10, locked: false, rowVersion: base ? base.rowVersion : null,
    };
    this.commit(start, withSpace(start, space));
    this.armedId.set(null);
    this.draft.set(null);
    this.tool.set('select');
    this.select(spaceId);
    return true;
  }

  /* ---- muros, puertas y ventanas ----------------------------------------------------------- */

  private hitElement(world: Point, radiusM: number): string | null {
    const cur = this.current();
    return nearestOpening(cur, world, radiusM)?.id ?? nearestWall(cur, world, radiusM)?.wall.id ?? null;
  }

  private placeWall(points: readonly Point[]): boolean {
    const start = this.current();
    const wall = newWall(newElementId(), points);
    this.commit(start, withElement(start, wall));
    this.tool.set('select');
    this.selectElement(wall.id);
    return true;
  }

  private openingPreview(kind: 'DOOR' | 'WINDOW', world: Point, radiusM: number): { wallId: string; offsetM: number; start: Point; end: Point } | null {
    const hit = nearestWall(this.current(), world, radiusM);
    if (!hit?.wall.vertices) return null;
    const width = newOpening('preview', kind, hit.wall.id, 0).widthM ?? 0.9;
    const offsetM = openingOffsetAt(hit.wall, hit.offsetM, width);
    const a = pointAlongPolyline(hit.wall.vertices as readonly Point[], offsetM);
    const b = pointAlongPolyline(hit.wall.vertices as readonly Point[], offsetM + Math.min(width, wallLength(hit.wall)));
    return a && b ? { wallId: hit.wall.id, offsetM, start: a.point, end: b.point } : null;
  }

  private placeOpening(kind: 'DOOR' | 'WINDOW', wallId: string, offsetM: number): boolean {
    const start = this.current();
    if (start.elements.get(wallId)?.kind !== 'WALL') return false;
    const opening = newOpening(newElementId(), kind, wallId, offsetM);
    this.commit(start, withElement(start, opening));
    this.draft.set(null);
    this.tool.set('select');
    this.selectElement(opening.id);
    return true;
  }

  /** Cambia un dato del muro, puerta o ventana elegido desde el panel. */
  setElementFields(id: string, fields: Partial<Pick<EditElement, 'thicknessM' | 'offsetM' | 'widthM' | 'swing' | 'swingSide'>>): void {
    const start = this.current();
    const element = start.elements.get(id);
    if (element) this.commit(start, withElement(start, { ...element, ...fields }));
  }

  /* ---- teclado ----------------------------------------------------------------------------- */

  /** `Esc`: sale de lo que se esté haciendo, de lo más inmediato a lo más general. Devuelve si hizo algo. */
  escape(): boolean {
    if (this.pointer.active) {
      this.pointer.cancel();
      return true;
    }
    if (this.draft()) {
      this.draft.set(null);
      return true;
    }
    if (this.armedId()) {
      this.arm(null);
      this.tool.set('select');
      return true;
    }
    if (this.tool() !== 'select') {
      this.setTool('select');
      return true;
    }
    if (this.selectedId() || this.selectedElementId()) {
      this.select(null);
      return true;
    }
    return false;
  }

  finishDraft(): void {
    this.pointer.finishPath();
  }

  /** Retroceso con un trazo a medias: quita el último punto. */
  backDraft(): void {
    const d = this.draft();
    if (d?.kind === 'polygon') this.draft.set(d.points.length > 1 ? { kind: 'polygon', points: d.points.slice(0, -1), cursor: null } : null);
  }

  nudge(dx: number, dy: number): void {
    const start = this.current();
    const element = this.selectedElement();
    if (element) {
      if (element.kind === 'WALL') this.commit(start, withElement(start, translateWall(element, dx, dy)));
      else if (element.offsetM !== undefined) {
        const host = element.hostElementId ? start.elements.get(element.hostElementId) : undefined;
        const max = host ? Math.max(0, wallLength(host) - (element.widthM ?? 0)) : element.offsetM;
        const delta = Math.abs(dx) > Math.abs(dy) ? dx : dy;
        this.commit(start, withElement(start, { ...element, offsetM: Math.min(max, Math.max(0, Math.round((element.offsetM + delta) * 1000) / 1000)) }));
      }
      return;
    }
    const id = this.selectedId();
    const space = id ? start.spaces.get(id) : undefined;
    if (!id || !space) return;
    if (space.locked) {
      this.hint.set(`${space.code} está bloqueado: desbloquéelo para moverlo.`);
      return;
    }
    this.commit(start, moveWithChildren(start, id, dx, dy));
  }

  /** Cambia la geometría desde el panel numérico. */
  setGeometryOf(id: string, geometry: EditSpace['geometry']): void {
    const start = this.current();
    const next = setGeometry(start, id, geometry);
    if (next !== start) this.commit(start, next);
  }

  toggleLock(id: string): void {
    const start = this.current();
    const space = start.spaces.get(id);
    if (space) this.commit(start, withSpace(start, { ...space, locked: !space.locked }));
  }

  /** `Supr`: quita el vértice, el muro, la puerta o la ventana elegidos; o «quita del plano» un espacio, que se confirma. */
  async removeSelected(): Promise<void> {
    const start = this.current();
    const element = this.selectedElement();
    if (element) {
      this.commit(start, removeElement(start, element.id));
      this.selectElement(null);
      this.hint.set('Se quitó del plano. Ctrl+Z lo devuelve.');
      return;
    }
    const sel = this.selected();
    if (!sel) return;
    const vertex = this.selectedVertex();
    if (vertex !== null && sel.geometry.kind === 'POLYGON') {
      const next = setGeometry(start, sel.id, removePolygonVertex(sel.geometry, vertex));
      if (next !== start) this.commit(start, next);
      this.selectedVertex.set(null);
      return;
    }
    if (sel.locked) {
      this.hint.set(`${sel.code} está bloqueado: desbloquéelo para quitarlo del plano.`);
      return;
    }
    const ids = descendantsOf(start, sel.id);
    const nested = ids.size - 1;
    const message = `«${sel.code} · ${sel.name}» deja de dibujarse en este plano. El espacio sigue existiendo en el árbol de la organización: no se borra, solo se quita su dibujo${nested > 0 ? `, y el de los ${nested} espacios que contiene` : ''}.`;
    const ok = nested > 0
      ? (await this.dialogs.confirmWithReason({ title: 'Quitar del plano', message, confirmLabel: 'Quitar del plano', destructive: true }, { label: 'Motivo', hint: 'Queda en este borrador; el servidor guarda el cambio con su historia.' })) !== null
      : await this.dialogs.confirm({ title: 'Quitar del plano', message, confirmLabel: 'Quitar del plano', destructive: true });
    if (!ok) return;
    let next = start;
    for (const id of ids) next = removeFromPlan(next, id);
    this.commit(start, next);
    this.select(null);
  }

  /** Enfoca una figura o un elemento con error desde la lista (S4). */
  focusIssue(id: string): void {
    if (this.current().spaces.has(id)) this.select(id);
    else if (this.current().elements.has(id)) this.selectElement(id);
  }
}
