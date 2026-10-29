import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { FloorPlanClient } from '../../../core/data-access/floor-plan/floor-plan.client';
import { readPlanFailure } from '../../../core/data-access/floor-plan/floor-plan.failure';
import type { LayoutItemError, LayoutResponse, LayoutWarning, UnplacedSpace } from '../../../core/data-access/floor-plan/floor-plan.types';
import type { CanvasOverlay, WorldPointerEvent } from '../../../core/floor-plan/canvas.types';
import { applyDraft, buildDraft, clearDraft, loadDraft, saveDraft, type EditDraft } from '../../../core/floor-plan/editor-draft';
import {
  defaultRect, descendantsOf, diffPatch, EditHistory, fromViews, isDirty, measureText, moveWithChildren, patchSize, reapply, removeFromPlan,
  removePolygonVertex, setGeometry, shapesOf, withSpace, type EditSpace, type EditState,
} from '../../../core/floor-plan/editor-model';
import { buildEditorOverlay, type DraftShape } from '../../../core/floor-plan/editor-overlay';
import { diffRemote, type RemoteChange } from '../../../core/floor-plan/editor-remote';
import type { Point } from '../../../core/floor-plan/geometry';
import { validateLayout, type LayoutIssue } from '../../../core/floor-plan/layout-validation';
import { newSpaceView, spaceViewFromGeometry, toSpaceView, type SpaceView } from '../../../core/floor-plan/plan-view';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { FloorPlanStore } from '../viewer/floor-plan.store';
import { errorMarks, mergeIssues, type EditorIssue, type SaveFailure } from './editor-issues';
import { EditorPointerController, type EditorPointerHost, type EditTool } from './plan-editor-pointer';

export type { EditTool } from './plan-editor-pointer';
export type { EditorIssue, SaveFailure } from './editor-issues';


const PAGE = 500;

/**
 * Almacén del editor del plano (CONTRATO-PLANO §5.3): el dibujo en edición, el
 * historial, las herramientas, la validación local, el guardado con `If-Match`
 * y los dos fallos que tienen salida propia (422 por elemento y 412).
 *
 * La validación local es una ayuda inmediata: quien decide es la API. El
 * guardado siempre se envía, y los errores del servidor reemplazan a los locales.
 */
@Injectable()
export class FloorPlanEditorStore {
  private readonly client = inject(FloorPlanClient);
  private readonly dialogs = inject(DialogService);
  readonly plan = inject(FloorPlanStore);

  private history = new EditHistory<EditState>({ spaces: new Map(), removed: new Set() });
  readonly baseline = signal<EditState>({ spaces: new Map(), removed: new Set() });
  readonly current = signal<EditState>({ spaces: new Map(), removed: new Set() });
  private readonly historyTick = signal(0);
  readonly canUndo = computed(() => (this.historyTick(), this.history.canUndo));
  readonly canRedo = computed(() => (this.historyTick(), this.history.canRedo));

  readonly tool = signal<EditTool>('select');
  readonly selectedId = signal<string | null>(null);
  readonly selectedVertex = signal<number | null>(null);
  readonly armedId = signal<string | null>(null);
  readonly snapOn = signal(true);
  readonly hint = signal<string | null>(null);
  readonly unplaced = signal<readonly UnplacedSpace[]>([]);
  readonly version = signal<number | null>(null);

  readonly draft = signal<DraftShape | null>(null);
  readonly measuring = signal<string | null>(null);
  readonly snapMark = signal<Point | null>(null);
  readonly dragFocus = signal<ReadonlySet<string> | null>(null);
  readonly viewScale = signal(10);
  readonly pointerType = signal<'mouse' | 'touch' | 'pen'>('mouse');
  private readonly pointer: EditorPointerController = new EditorPointerController(this.asPointerHost());

  /* ---- guardado ----------------------------------------------------------------- */
  readonly saving = signal(false);
  readonly failure = signal<SaveFailure | null>(null);
  readonly serverErrors = signal<readonly LayoutItemError[]>([]);
  readonly lastSave = signal<{ version: number; requestId: string; warnings: readonly LayoutWarning[]; at: Date; counts: string } | null>(null);
  readonly remoteChanges = signal<readonly RemoteChange[] | null>(null);
  readonly reapplied = signal<{ applied: number; conflicts: readonly string[] } | null>(null);
  readonly pendingDraft = signal<EditDraft | null>(null);

  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  private initKey = '';
  private newMeta = new Map<string, UnplacedSpace>();

  /* ---- derivados ---------------------------------------------------------------- */
  readonly meta = this.plan.meta;
  readonly gridSizeM = computed(() => this.meta()?.gridSizeM ?? 0.5);
  readonly dirty = computed(() => isDirty(this.baseline(), this.current()));
  readonly changeCount = computed(() => patchSize(diffPatch(this.baseline(), this.current())));

  readonly views = computed<SpaceView[]>(() => {
    const cur = this.current();
    const before = this.baseline();
    const out: SpaceView[] = [];
    for (const view of this.plan.spaces()) {
      if (!view.inScope) {
        out.push(view);
        continue;
      }
      if (cur.removed.has(view.id)) continue;
      const edited = cur.spaces.get(view.id);
      const original = before.spaces.get(view.id);
      out.push(edited && original && edited.geometry !== original.geometry ? spaceViewFromGeometry(view, edited.geometry) : view);
    }
    for (const space of cur.spaces.values()) {
      if (before.spaces.has(space.id) || cur.removed.has(space.id)) continue;
      const meta = this.newMeta.get(space.id);
      out.push(newSpaceView({ id: space.id, code: space.code, name: space.name, parentId: space.parentId, formCode: space.formCode, functionCode: meta?.function ?? 'OTHER' }, space.geometry));
    }
    return out;
  });

  readonly localIssues = computed<LayoutIssue[]>(() => {
    const meta = this.meta();
    if (!meta) return [];
    return validateLayout(
      { canvas: { widthM: meta.widthM, heightM: meta.heightM, contactToleranceM: meta.contactToleranceM, anchorSpaceId: meta.anchor?.spaceId ?? null }, shapes: shapesOf(this.current()) },
      this.dragFocus() ?? undefined,
    );
  });

  readonly issues = computed<EditorIssue[]>(() => mergeIssues(this.serverErrors(), this.localIssues()));

  readonly selected = computed<EditSpace | null>(() => {
    const id = this.selectedId();
    const cur = this.current();
    return id && !cur.removed.has(id) ? (cur.spaces.get(id) ?? null) : null;
  });

  readonly palette = computed<readonly UnplacedSpace[]>(() => {
    const cur = this.current();
    const placed = new Set([...cur.spaces.keys()].filter((id) => !cur.removed.has(id)));
    const restored: UnplacedSpace[] = [];
    for (const id of cur.removed) {
      const space = this.baseline().spaces.get(id);
      if (space) restored.push({ spaceId: id, code: space.code, name: space.name, depth: 0, form: space.formCode, function: this.newMeta.get(id)?.function ?? 'OTHER', parentId: space.parentId, placeable: true });
    }
    return [...restored, ...this.unplaced().filter((u) => !placed.has(u.spaceId))];
  });

  readonly overlay = computed<CanvasOverlay | null>(() => {
    const { errors, shapes, labels } = errorMarks(this.issues(), this.current());
    const sel = this.selected();
    const measuringId = this.measuring();
    const measured = measuringId ? (this.current().spaces.get(measuringId) ?? null) : null;
    return buildEditorOverlay({
      selected: sel, selectedVertex: this.selectedVertex(), locked: sel?.locked ?? false, draft: this.draft(), measuring: measured,
      errors, errorShapes: shapes, errorLabels: labels, snapMark: this.snapMark(), scale: this.viewScale(), pointerType: this.pointerType(),
    });
  });

  constructor() {
    // Cada vez que llega un plano (otro lienzo o recarga ajena) se arma el editor sobre él.
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
    const base = fromViews(this.plan.spaces());
    this.resetTo(base);
    this.version.set(layout.layoutVersion);
    this.tool.set('select');
    this.selectedId.set(null);
    this.armedId.set(null);
    this.failure.set(null);
    this.serverErrors.set([]);
    this.reapplied.set(null);
    this.remoteChanges.set(null);
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

  private async loadUnplaced(planId: string): Promise<void> {
    try {
      const res = await firstValueFrom(this.client.getUnplacedSpaces(planId));
      this.unplaced.set(res.items);
      for (const item of res.items) this.newMeta.set(item.spaceId, item);
    } catch {
      this.unplaced.set([]);
    }
  }

  recoverDraft(): void {
    const draft = this.pendingDraft();
    if (!draft) return;
    const next = applyDraft(this.baseline(), draft);
    this.history.push(next);
    this.current.set(next);
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

  /* ---- puntero ---------------------------------------------------------------------------- */

  private asPointerHost(): EditorPointerHost {
    return {
      tool: () => this.tool(), current: () => this.current(), selectedId: () => this.selectedId(), armedId: () => this.armedId(),
      gridSizeM: () => this.gridSizeM(), snapOn: () => this.snapOn(), viewScale: () => this.viewScale(),
      paletteForm: (id) => this.paletteEntry(id)?.form,
      select: (id) => this.select(id), selectVertex: (i) => this.selectedVertex.set(i), showHint: (t) => this.hint.set(t),
      live: (next) => this.live(next), commit: (start, next) => this.commit(start, next), restore: (start) => this.restore(start),
      placeNew: (id, g) => this.placeNew(id, g),
      draft: this.draft, snapMark: this.snapMark, measuring: this.measuring, dragFocus: this.dragFocus, pointerType: this.pointerType,
    };
  }

  onWorld(ev: WorldPointerEvent): void {
    this.pointer.onWorld(ev);
  }

  private restore(start: EditState): void {
    this.history.replace(start);
    this.current.set(start);
  }

  /* ---- historial ------------------------------------------------------------------ */

  private live(next: EditState): void {
    this.history.replace(next);
    this.current.set(next);
  }

  private commit(start: EditState, next: EditState): void {
    this.history.replace(start);
    this.history.push(next);
    this.current.set(this.history.present);
    this.historyTick.update((n) => n + 1);
    this.afterChange();
  }

  private afterChange(): void {
    this.serverErrors.set([]);
    this.failure.set(null);
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
    this.hint.set(tool === 'rect' || tool === 'polygon' ? (this.armedId() ? null : 'Elija primero un espacio de la lista «Sin ubicar» para dibujarlo.') : null);
  }

  select(id: string | null): void {
    this.selectedId.set(id);
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
    this.newMeta.set(spaceId, entry);
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

  /* ---- teclado -------------------------------------------------------------------------- */

  /** Devuelve `true` si la tecla se usó (la pantalla evita su efecto por omisión). */
  onKey(event: KeyboardEvent): boolean {
    const target = event.target;
    if (target instanceof HTMLElement && (target.closest('input, select, textarea, [contenteditable="true"]') || target.closest('dialog'))) return false;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === 'z') {
      if (event.shiftKey) this.redo();
      else this.undo();
      return true;
    }
    if (mod && key === 'y') {
      this.redo();
      return true;
    }
    if (mod && key === 's') {
      void this.save();
      return true;
    }
    if (mod) return false;
    if (key === 'escape') return this.escape();
    if (key === 'enter' && this.draft()?.kind === 'polygon') {
      this.pointer.finishPolygon();
      return true;
    }
    if (key === 'backspace' && this.draft()?.kind === 'polygon') {
      const d = this.draft() as Extract<DraftShape, { kind: 'polygon' }>;
      this.draft.set(d.points.length > 1 ? { kind: 'polygon', points: d.points.slice(0, -1), cursor: null } : null);
      return true;
    }
    if (key === 'delete' || key === 'backspace') {
      void this.removeSelected();
      return true;
    }
    const tools: Record<string, EditTool> = { v: 'select', h: 'hand', r: 'rect', p: 'polygon' };
    if (tools[key] && !event.altKey) {
      this.setTool(tools[key]!);
      return true;
    }
    const arrow: Record<string, Point> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
    if (arrow[key] && !event.altKey && this.tool() === 'select' && this.selected()) {
      const step = this.gridSizeM() * (event.shiftKey ? 5 : 1);
      this.nudge(arrow[key]![0] * step, arrow[key]![1] * step);
      return true;
    }
    return false;
  }

  private escape(): boolean {
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
    if (this.selectedId()) {
      this.select(null);
      return true;
    }
    return false;
  }

  nudge(dx: number, dy: number): void {
    const id = this.selectedId();
    const start = this.current();
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

  /** «Quitar del plano»: el espacio sigue en el árbol de la organización; solo se quita su dibujo. */
  async removeSelected(): Promise<void> {
    const vertex = this.selectedVertex();
    const sel = this.selected();
    if (!sel) return;
    if (vertex !== null && sel.geometry.kind === 'POLYGON') {
      const start = this.current();
      const next = setGeometry(start, sel.id, removePolygonVertex(sel.geometry, vertex));
      if (next !== start) this.commit(start, next);
      this.selectedVertex.set(null);
      return;
    }
    if (sel.locked) {
      this.hint.set(`${sel.code} está bloqueado: desbloquéelo para quitarlo del plano.`);
      return;
    }
    const start = this.current();
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

  /* ---- guardar --------------------------------------------------------------------------- */

  readonly issueCount = computed(() => this.issues().length);

  async save(): Promise<void> {
    const planId = this.meta()?.id;
    const version = this.version();
    if (!planId || version === null || this.saving()) return;
    const patch = diffPatch(this.baseline(), this.current());
    if (patchSize(patch) === 0) return;
    this.saving.set(true);
    this.failure.set(null);
    this.serverErrors.set([]);
    try {
      const res = await firstValueFrom(this.client.patchLayout(planId, patch, version));
      const fresh = await this.fetchFresh(planId);
      this.plan.layout.set(fresh);
      this.resetTo(fromViews(this.plan.spaces()));
      this.version.set(res.layoutVersion);
      clearDraft(planId);
      const a = res.applied;
      this.lastSave.set({
        version: res.layoutVersion, requestId: res.requestId, warnings: res.warnings, at: new Date(),
        counts: `${a.placed} ubicados, ${a.moved} movidos, ${a.removed} quitados`,
      });
      this.reapplied.set(null);
      this.remoteChanges.set(null);
    } catch (error) {
      this.onSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  private onSaveError(error: unknown): void {
    const f = readPlanFailure(error);
    if (f.status === 422 && f.errors.length > 0) {
      this.serverErrors.set(f.errors);
      this.failure.set({ kind: 'invalid', requestId: f.requestId });
      const first = f.errors.find((e) => e.kind === 'SPACE');
      if (first) this.select(first.id);
    } else if (f.status === 412) {
      this.failure.set({ kind: 'conflict', currentVersion: f.currentVersion, summary: f.changedSummary, requestId: f.requestId });
    } else if (f.status === 403) {
      this.failure.set({ kind: 'forbidden', requestId: f.requestId });
    } else if (f.status === 0) {
      this.failure.set({ kind: 'offline' });
    } else {
      this.failure.set({ kind: 'error', message: f.message ?? 'No pudimos guardar el plano.', requestId: f.requestId });
    }
  }

  /** El plano tal como está ahora en el servidor (silueta, todas las páginas). */
  private async fetchFresh(planId: string): Promise<LayoutResponse> {
    let cursor: string | null = null;
    let first: LayoutResponse | null = null;
    const spaces: LayoutResponse['spaces'][number][] = [];
    do {
      const page: LayoutResponse = await firstValueFrom(this.client.getLayout(planId, { detail: 'lite', limit: PAGE, cursor }));
      first ??= page;
      spaces.push(...page.spaces);
      cursor = page.page.nextCursor;
    } while (cursor !== null);
    return { ...first!, spaces, page: { nextCursor: null, total: spaces.length } };
  }

  /** 412 · «Ver cambios»: qué movió la otra persona, y cuáles toqué yo también. */
  async showRemoteChanges(): Promise<void> {
    const planId = this.meta()?.id;
    if (!planId) return;
    try {
      const fresh = await this.fetchFresh(planId);
      const incoming = fromViews(fresh.spaces.map(toSpaceView));
      this.remoteChanges.set(diffRemote(this.baseline(), this.current(), incoming));
    } catch (error) {
      this.onSaveError(error);
    }
  }

  /** 412 · «Recargar y reaplicar mis cambios»: lo que no choca se reaplica. */
  async reloadAndReapply(): Promise<void> {
    const planId = this.meta()?.id;
    if (!planId) return;
    this.saving.set(true);
    try {
      const oldBase = this.baseline();
      const mine = this.current();
      const fresh = await this.fetchFresh(planId);
      this.plan.layout.set(fresh);
      const newBase = fromViews(this.plan.spaces());
      const result = reapply(oldBase, mine, newBase);
      this.baseline.set(newBase);
      this.history = new EditHistory<EditState>(newBase);
      this.history.push(result.state);
      this.current.set(result.state);
      this.historyTick.update((n) => n + 1);
      this.version.set(fresh.layoutVersion);
      this.failure.set(null);
      this.remoteChanges.set(null);
      this.reapplied.set({ applied: result.applied.length, conflicts: result.conflicts });
    } catch (error) {
      this.onSaveError(error);
    } finally {
      this.saving.set(false);
    }
  }

  /** Descarta todo lo no guardado y vuelve al plano cargado. */
  discardAll(): void {
    const planId = this.meta()?.id;
    this.resetTo(this.baseline());
    if (planId) clearDraft(planId);
    this.afterChange();
    this.select(null);
  }

  /** Enfoca una figura con error desde la lista (S4). */
  focusIssue(id: string): void {
    if (this.current().spaces.has(id)) this.select(id);
  }

  measureOf(id: string): string | null {
    const s = this.current().spaces.get(id);
    return s ? measureText(s) : null;
  }
}
