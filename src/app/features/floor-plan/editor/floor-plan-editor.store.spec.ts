import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { FloorPlanClient } from '../../../core/data-access/floor-plan/floor-plan.client';
import type { FloorPlanMeta, FloorPlanSummary, LayoutResponse, SpacePlacementDTO, ViewerCaps } from '../../../core/data-access/floor-plan/floor-plan.types';
import { MedicalOrganizationClient } from '../../../core/data-access/medical-organization/medical-organization.client';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import type { WorldPointerEvent } from '../../../core/floor-plan/canvas.types';
import type { Point } from '../../../core/floor-plan/geometry';
import { FloorPlanStore } from '../viewer/floor-plan.store';
import { FloorPlanEditorStore } from './floor-plan-editor.store';

const VIEWER: ViewerCaps = { canEditPlan: true, canSeeState: false, canSeePatient: false, canOpenSpaceFile: true, scope: 'ALL' };
const META = { id: 'p1', code: 'P1', name: 'Piso 1', anchor: null, widthM: 64, heightM: 26, elevationM: 0, layoutVersion: 3, validFrom: '2026-01-01', validTo: null, counts: { placed: 3, unplaced: 1, elements: 0 }, siteId: 's', northBearingDeg: 0, gridSizeM: 0.5, snapToGrid: true, contactToleranceM: 0.01, rowVersion: 1 } as FloorPlanMeta;
const SUMMARY: FloorPlanSummary = { ...META };

const place = (id: string, parentId: string | null, x: number, y: number, w: number, d: number, form = 'ROOM', rowVersion = 1): SpacePlacementDTO => ({
  placementId: `pl-${id}`, spaceId: id, rowVersion, zOrder: form === 'BED' ? 20 : 10, locked: false, inScope: true, bbox: [x - w / 2, y - d / 2, x + w / 2, y + d / 2], areaCalcM2: w * d,
  geometry: { kind: 'RECT', centerXM: x, centerYM: y, widthM: w, depthM: d, rotationDeg: 0 }, code: id.toUpperCase(), name: `Espacio ${id}`, form: { code: form }, function: { code: 'X' }, parentId,
} as unknown as SpacePlacementDTO);

function layout(version = 3, over: Partial<Record<string, SpacePlacementDTO>> = {}, drop: string[] = []): LayoutResponse {
  const base = [place('a', null, 5, 5, 4, 4), place('b', null, 12, 5, 4, 4), place('c', 'a', 5, 5, 1, 2, 'BED')];
  const spaces = base.filter((s) => !drop.includes(s.spaceId)).map((s) => over[s.spaceId] ?? s);
  return { floorPlan: { ...META, layoutVersion: version }, layoutVersion: version, asOf: '2026-10-29T12:00:00Z', page: { nextCursor: null, total: spaces.length }, viewer: VIEWER, elements: [], spaces };
}

const pointerAt = (phase: WorldPointerEvent['phase'], world: Point, over: Partial<WorldPointerEvent> = {}): WorldPointerEvent => ({
  phase, world, targetId: null, handleId: null, shiftKey: false, altKey: false, ctrlKey: false, pointerType: 'mouse', detail: 0, scale: 10, ...over,
});
const http = (status: number, error: unknown = null): HttpErrorResponse => new HttpErrorResponse({ status, error });
const applied = { layoutVersion: 4, applied: { placed: 0, moved: 1, removed: 0, elementsUpserted: 0, elementsRemoved: 0 }, warnings: [], requestId: 'rq-1' };

describe('FloorPlanEditorStore', () => {
  let plan: FloorPlanStore;
  let ed: FloorPlanEditorStore;
  let client: Record<'listPlans' | 'getLayout' | 'getState' | 'getFocus' | 'patchLayout' | 'getUnplacedSpaces', ReturnType<typeof vi.fn>>;
  let dialogs: { confirm: ReturnType<typeof vi.fn>; confirmWithReason: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    client = {
      listPlans: vi.fn(() => of([SUMMARY])),
      getLayout: vi.fn(() => of(layout())),
      getState: vi.fn(() => of({})),
      getFocus: vi.fn(() => of([])),
      patchLayout: vi.fn(() => of(applied)),
      getUnplacedSpaces: vi.fn(() => of({ items: [{ spaceId: 'u1', code: 'U1', name: 'Sin ubicar 1', depth: 1, form: 'ROOM', function: 'X', parentId: null, placeable: true }], nextCursor: null })),
    };
    dialogs = { confirm: vi.fn(async () => true), confirmWithReason: vi.fn(async () => 'motivo') };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(), FloorPlanStore, FloorPlanEditorStore,
        { provide: FloorPlanClient, useValue: client },
        { provide: DialogService, useValue: dialogs },
        { provide: MedicalOrganizationClient, useValue: { listPractices: () => of([]), getConsole: () => of({ sites: [] }) } },
      ],
    });
    plan = TestBed.inject(FloorPlanStore);
    ed = TestBed.inject(FloorPlanEditorStore);
    plan.siteId.set('s');
    plan.planId.set('p1');
    await plan.load();
    TestBed.tick();
  });
  afterEach(() => plan.stop());

  it('arranca sin cambios, con la paleta de lo que falta ubicar', () => {
    expect(ed.dirty()).toBe(false);
    expect(ed.version()).toBe(3);
    expect(ed.current().spaces.size).toBe(3);
    expect(ed.palette().map((p) => p.spaceId)).toEqual(['u1']);
  });

  it('mover con las flechas es un paso de deshacer, y deshacer/rehacer lo recorren', () => {
    ed.select('b');
    ed.nudge(0, 0.5);
    expect(ed.dirty()).toBe(true);
    expect(ed.changeCount()).toBe(1);
    expect(ed.canUndo()).toBe(true);
    ed.undo();
    expect(ed.dirty()).toBe(false);
    expect(ed.canRedo()).toBe(true);
    ed.redo();
    expect(ed.dirty()).toBe(true);
  });

  it('mover una habitación arrastra sus camas; la cama sola puede quedar en un solo paso', () => {
    ed.select('a');
    ed.nudge(1, 0);
    const c = ed.current().spaces.get('c')!.geometry;
    expect(c.kind === 'RECT' && c.centerXM).toBe(6);
  });

  it('un solape pinta borde de error con mensaje (ayuda local) y el overlay lo señala', () => {
    ed.setGeometryOf('b', { kind: 'RECT', centerXM: 7, centerYM: 5, widthM: 4, depthM: 4, rotationDeg: 0 });
    const overlap = ed.issues().find((i) => i.code === 'PLAN_SIBLING_OVERLAP');
    expect(overlap?.source).toBe('local');
    expect(ed.overlay()!.errorIds.has('b')).toBe(true);
    expect(ed.overlay()!.labels.some((l) => l.kind === 'error' && l.text.startsWith('⚠'))).toBe(true);
  });

  it('guardar manda el delta con If-Match y, si sale bien, vuelve a cargar y queda sin cambios', async () => {
    ed.select('b');
    ed.nudge(0, 0.5);
    client.getLayout.mockReturnValue(of(layout(4, { b: place('b', null, 12, 5.5, 4, 4, 'ROOM', 2) })));
    await ed.save();
    const [planId, patch, version] = client.patchLayout.mock.calls[0]!;
    expect(planId).toBe('p1');
    expect(version).toBe(3);
    expect(patch.upsert.placements).toHaveLength(1);
    expect(patch.upsert.placements[0]).toMatchObject({ spaceId: 'b', expectedRowVersion: 1 });
    expect(ed.dirty()).toBe(false);
    expect(ed.version()).toBe(4);
    expect(ed.lastSave()?.requestId).toBe('rq-1');
    const b = ed.current().spaces.get('b')!;
    expect(b.rowVersion).toBe(2);
  });

  it('422: muestra el error por figura del servidor (con su vecina), lo enfoca y se limpia al editar', async () => {
    ed.setGeometryOf('b', { kind: 'RECT', centerXM: 7, centerYM: 5, widthM: 4, depthM: 4, rotationDeg: 0 });
    client.patchLayout.mockReturnValue(
      throwError(() => http(422, { reason: 'PLAN_LAYOUT_INVALID', requestId: 'rq-422', errors: [{ kind: 'SPACE', id: 'b', code: 'PLAN_SIBLING_OVERLAP', field: 'geometry', message: 'B se solapa con A.', conflictsWith: [{ kind: 'SPACE', id: 'a', code: 'A', name: 'Espacio a', overlapAreaM2: 4 }], nextAction: { label: 'Separarlo', hint: 'Muévalo.' } }] })),
    );
    await ed.save();
    expect(ed.failure()).toEqual({ kind: 'invalid', requestId: 'rq-422' });
    expect(ed.issues()[0]).toMatchObject({ source: 'server', id: 'b', code: 'PLAN_SIBLING_OVERLAP' });
    expect(ed.issues()[0]!.conflictsWith[0]!.overlapAreaM2).toBe(4);
    expect(ed.selectedId()).toBe('b');
    expect(ed.overlay()!.errorIds.has('a')).toBe(true);
    expect(ed.dirty()).toBe(true);
    ed.undo();
    expect(ed.failure()).toBeNull();
    expect(ed.serverErrors()).toEqual([]);
  });

  it('412: avisa que otra persona modificó el plano; «Ver cambios» lista lo que movió y «Recargar y reaplicar» conserva lo que no choca', async () => {
    ed.select('b');
    ed.nudge(0, 0.5);
    client.patchLayout.mockReturnValue(throwError(() => http(412, { reason: 'PLAN_VERSION_MISMATCH', requestId: 'rq-412', currentVersion: 4, changedSummary: 'Se quitó una cama.' })));
    await ed.save();
    expect(ed.failure()).toMatchObject({ kind: 'conflict', currentVersion: 4, requestId: 'rq-412' });
    // La otra persona quitó la cama c; yo moví b.
    client.getLayout.mockReturnValue(of(layout(4, {}, ['c'])));
    await ed.showRemoteChanges();
    expect(ed.remoteChanges()).toEqual([expect.objectContaining({ id: 'c', what: 'quitado', collides: false })]);
    await ed.reloadAndReapply();
    expect(ed.version()).toBe(4);
    expect(ed.failure()).toBeNull();
    expect(ed.reapplied()).toEqual({ applied: 1, conflicts: [] });
    expect(ed.current().spaces.has('c')).toBe(false);
    const b = ed.current().spaces.get('b')!.geometry;
    expect(b.kind === 'RECT' && b.centerYM).toBe(5.5);
    expect(ed.dirty()).toBe(true);
  });

  it('412: lo que la otra persona también tocó no se reaplica y se avisa', async () => {
    ed.select('b');
    ed.nudge(0, 0.5);
    client.patchLayout.mockReturnValue(throwError(() => http(412, { reason: 'PLAN_VERSION_MISMATCH', currentVersion: 4 })));
    await ed.save();
    client.getLayout.mockReturnValue(of(layout(4, { b: place('b', null, 13, 5, 4, 4, 'ROOM', 2) })));
    await ed.reloadAndReapply();
    expect(ed.reapplied()).toEqual({ applied: 0, conflicts: ['b'] });
    const b = ed.current().spaces.get('b')!.geometry;
    expect(b.kind === 'RECT' && b.centerXM).toBe(13);
  });

  it('403, sin conexión y error inesperado tienen su aviso (con el código de soporte)', async () => {
    ed.select('b');
    ed.nudge(0, 0.5);
    client.patchLayout.mockReturnValueOnce(throwError(() => http(403, { reason: 'PLAN_ACTION_NOT_ALLOWED', requestId: 'rq-403' })));
    await ed.save();
    expect(ed.failure()).toEqual({ kind: 'forbidden', requestId: 'rq-403' });
    client.patchLayout.mockReturnValueOnce(throwError(() => http(0)));
    await ed.save();
    expect(ed.failure()).toEqual({ kind: 'offline' });
    client.patchLayout.mockReturnValueOnce(throwError(() => http(500, { message: 'Se cayó.', requestId: 'rq-500' })));
    await ed.save();
    expect(ed.failure()).toEqual({ kind: 'error', message: 'Se cayó.', requestId: 'rq-500' });
    expect(ed.dirty()).toBe(true);
  });

  it('quitar del plano confirma, saca la figura (y sus camas) y la devuelve a la paleta', async () => {
    ed.select('a');
    await ed.removeSelected();
    expect(dialogs.confirmWithReason).toHaveBeenCalled();
    expect(ed.views().map((v) => v.id)).toEqual(['b']);
    expect(ed.palette().map((p) => p.spaceId)).toContain('a');
    const patch = client.patchLayout;
    client.getLayout.mockReturnValue(of(layout(4, {}, ['a', 'c'])));
    await ed.save();
    expect(patch.mock.calls[0]![1].remove.spaceIds.sort()).toEqual(['a', 'c']);
  });

  it('quitar del plano y cancelar el diálogo no cambia nada', async () => {
    dialogs.confirm.mockResolvedValue(false);
    ed.select('b');
    await ed.removeSelected();
    expect(ed.dirty()).toBe(false);
  });

  it('ubicar un espacio de la paleta crea su figura con el tamaño habitual y la deja elegida', () => {
    ed.arm('u1');
    expect(ed.placeAtCenter([20, 15])).toBe(true);
    expect(ed.selectedId()).toBe('u1');
    expect(ed.palette()).toEqual([]);
    const g = ed.current().spaces.get('u1')!.geometry;
    expect(g.kind === 'RECT' && [g.widthM, g.depthM]).toEqual([3, 3]);
    expect(ed.current().spaces.get('u1')!.rowVersion).toBeNull();
  });

  it('el borrador se guarda en localStorage y se puede recuperar tras recargar', async () => {
    vi.useFakeTimers();
    try {
      ed.select('b');
      ed.nudge(0, 0.5);
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(500);
    } finally {
      vi.useRealTimers();
    }
    expect(Object.keys(localStorage).some((k) => k.includes('floor-plan.draft.p1'))).toBe(true);
  });

  it('un almacenamiento que falla no rompe el editor', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('cuota');
    };
    try {
      ed.select('b');
      expect(() => ed.nudge(0, 0.5)).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
    }
  });

  describe('muros, puertas y ventanas', () => {
    const tap = (p: Point, over: Partial<WorldPointerEvent> = {}): void => {
      ed.onWorld(pointerAt('down', p, over));
      ed.onWorld(pointerAt('up', p, over));
    };

    it('el muro se dibuja punto a punto (Entrar lo termina) y queda elegido con la herramienta de selección', () => {
      ed.setTool('wall');
      tap([30, 10]);
      tap([36, 10]);
      expect(ed.pathDraft()).toBe(true);
      ed.finishDraft();
      const wall = ed.selectedElement()!;
      expect(wall.kind).toBe('WALL');
      expect(wall.vertices).toEqual([[30, 10], [36, 10]]);
      expect(wall.rowVersion).toBeNull();
      expect(ed.tool()).toBe('select');
      expect(ed.dirty()).toBe(true);
      expect(ed.elementViews().some((v) => v.id === wall.id && v.kind === 'WALL')).toBe(true);
    });

    it('una puerta se ubica sobre el muro más cercano y no cae fuera de él', () => {
      ed.setTool('wall');
      tap([30, 10]);
      tap([36, 10]);
      ed.finishDraft();
      const wallId = ed.selectedElementId()!;
      ed.setTool('door');
      tap([30.1, 10.05]);
      const door = ed.selectedElement()!;
      expect(door).toMatchObject({ kind: 'DOOR', hostElementId: wallId, offsetM: 0, widthM: 0.9 });
      expect(ed.issues().filter((i) => i.kind === 'ELEMENT')).toEqual([]);
    });

    it('sin un muro cerca la herramienta de puerta no ubica nada y explica qué hacer', () => {
      ed.setTool('door');
      tap([50, 20]);
      expect(ed.dirty()).toBe(false);
      expect(ed.hint()).toMatch(/Acerque el puntero a un muro/);
    });

    it('guardar manda el muro nuevo (con id de cliente) antes que su puerta, y quitar el muro quita la puerta', async () => {
      ed.setTool('wall');
      tap([30, 10]);
      tap([36, 10]);
      ed.finishDraft();
      ed.setTool('window');
      tap([33, 10.02]);
      client.getLayout.mockReturnValue(of(layout(4)));
      await ed.save();
      const patch = client.patchLayout.mock.calls[0]![1];
      expect(patch.upsert.elements.map((e: { kind: string }) => e.kind)).toEqual(['WALL', 'WINDOW']);
      expect(patch.upsert.elements[0].id).toMatch(/^[0-9a-f-]{36}$/);
      expect(patch.upsert.elements[1].hostElementId).toBe(patch.upsert.elements[0].id);
    });

    it('un muro y su puerta se deshacen y se quitan de a un paso; la puerta sola se empuja a lo largo del muro', async () => {
      ed.setTool('wall');
      tap([30, 10]);
      tap([36, 10]);
      ed.finishDraft();
      ed.setTool('door');
      tap([33, 10.02]);
      const before = ed.selectedElement()!.offsetM!;
      ed.nudge(0.5, 0);
      expect(ed.selectedElement()!.offsetM).toBe(before + 0.5);
      await ed.removeSelected();
      expect(ed.selectedElement()).toBeNull();
      ed.undo();
      ed.undo();
      ed.undo();
      expect(ed.dirty()).toBe(true);
      ed.undo();
      expect(ed.dirty()).toBe(false);
    });

    it('con el 422 de una abertura fuera de su muro, el error queda en el elemento y se rotula sobre el muro', async () => {
      ed.setTool('wall');
      tap([30, 10]);
      tap([36, 10]);
      ed.finishDraft();
      const wallId = ed.selectedElementId()!;
      ed.setTool('window');
      tap([33, 10.02]);
      const windowId = ed.selectedElementId()!;
      ed.setElementFields(windowId, { offsetM: 5.5 });
      expect(ed.issues().find((i) => i.id === windowId)?.code).toBe('PLAN_OPENING_OUTSIDE_WALL');
      expect(ed.overlay()!.labels.some((l) => l.text.startsWith('⚠ Ventana'))).toBe(true);
      client.patchLayout.mockReturnValue(throwError(() => http(422, { reason: 'PLAN_LAYOUT_INVALID', requestId: 'r', errors: [{ kind: 'ELEMENT', id: windowId, code: 'PLAN_OPENING_OUTSIDE_WALL', field: 'host', message: 'No cabe en su muro.' }] })));
      await ed.save();
      expect(ed.issues()[0]).toMatchObject({ source: 'server', id: windowId });
      ed.focusIssue(windowId);
      expect(ed.selectedElementId()).toBe(windowId);
      expect(wallId).toBeTruthy();
    });
  });
});
