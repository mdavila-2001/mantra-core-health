import { EditHistory, defaultRect, diffPatch, fromViews, isDirty, measureText, moveWithChildren, movePolygonVertex, patchSize, reapply, rectFromCorners, removeFromPlan, resizeRect, rotateRectTo, setGeometry, shapesOf, translateGeometry, type EditSpace, type EditState, type RectGeometry } from './editor-model';
import { validateLayout } from './layout-validation';
import { toSpaceView } from './plan-view';
import type { SpacePlacementDTO } from '../data-access/floor-plan/floor-plan.types';

const dto = (id: string, parentId: string | null, x: number, y: number, w: number, d: number, form = 'ROOM'): SpacePlacementDTO => ({
  placementId: `p-${id}`, spaceId: id, rowVersion: 3, zOrder: 10, locked: false, inScope: true, code: id.toUpperCase(), name: id, parentId,
  form: { code: form }, function: { code: 'X' }, areaCalcM2: w * d, bbox: [x, y, x + w, y + d],
  geometry: { kind: 'RECT', centerXM: x + w / 2, centerYM: y + d / 2, widthM: w, depthM: d, rotationDeg: 0 },
});

const base = (): EditState => fromViews([dto('area', 'piso', 0, 0, 30, 10, 'AREA'), dto('a', 'area', 0, 0, 6, 6), dto('b', 'area', 6, 0, 6, 6), dto('cama', 'a', 1, 1, 1, 2, 'BED')].map(toSpaceView));
const rect = (s: EditSpace): RectGeometry => s.geometry as RectGeometry;

describe('modelo del editor', () => {
  describe('desde el layout', () => {
    it('reconstruye el rectángulo (centro, ancho, fondo y rotación) desde sus esquinas', () => {
      const a = base().spaces.get('a')!;
      expect(rect(a)).toMatchObject({ kind: 'RECT', centerXM: 3, centerYM: 3, widthM: 6, depthM: 6, rotationDeg: 0 });
    });

    it('lo que está fuera de alcance no se edita', () => {
      const silhouette = toSpaceView({ ...dto('x', null, 0, 0, 1, 1), inScope: false, code: undefined, name: undefined });
      expect(fromViews([silhouette]).spaces.size).toBe(0);
    });
  });

  describe('historial', () => {
    it('deshace y rehace, y un cambio nuevo descarta lo rehacible', () => {
      const h = new EditHistory(1);
      h.push(2); h.push(3);
      expect(h.undo()).toBe(2);
      expect(h.undo()).toBe(1);
      expect(h.canUndo).toBe(false);
      expect(h.redo()).toBe(2);
      h.push(9);
      expect(h.canRedo).toBe(false);
      expect(h.present).toBe(9);
    });

    it('guarda al menos 50 pasos', () => {
      const h = new EditHistory(0);
      for (let i = 1; i <= 120; i += 1) h.push(i);
      expect(h.depth).toBe(100);
      for (let i = 0; i < 60; i += 1) h.undo();
      expect(h.present).toBe(60);
    });

    it('replace no deja paso (el arrastre en curso se registra al soltar)', () => {
      const h = new EditHistory(1);
      h.replace(2); h.replace(3);
      expect(h.canUndo).toBe(false);
      h.push(4);
      expect(h.undo()).toBe(3);
    });
  });

  describe('mover, redimensionar y rotar', () => {
    it('mover una habitación arrastra a sus camas', () => {
      const moved = moveWithChildren(base(), 'a', 0.5, 0);
      expect(rect(moved.spaces.get('a')!).centerXM).toBe(3.5);
      expect(rect(moved.spaces.get('cama')!).centerXM).toBe(2);
      expect(rect(moved.spaces.get('b')!).centerXM).toBe(9);
    });

    it('un espacio bloqueado no se mueve', () => {
      const s = base();
      const locked = new Map(s.spaces); locked.set('a', { ...s.spaces.get('a')!, locked: true });
      const next = moveWithChildren({ ...s, spaces: locked }, 'a', 5, 5);
      expect(rect(next.spaces.get('a')!).centerXM).toBe(3);
    });

    it('arrastrar el asa este agranda hacia la derecha y deja fijo el borde oeste', () => {
      const g = rect(base().spaces.get('a')!);
      const r = resizeRect(g, 'e', [8, 3]);
      expect(r.widthM).toBe(8);
      expect(r.centerXM - r.widthM / 2).toBe(0);
    });

    it('arrastrar la esquina noroeste deja fija la sureste', () => {
      const g = rect(base().spaces.get('a')!);
      const r = resizeRect(g, 'nw', [1, 2]);
      expect(r.centerXM + r.widthM / 2).toBe(6);
      expect(r.centerYM + r.depthM / 2).toBe(6);
      expect([r.widthM, r.depthM]).toEqual([5, 4]);
    });

    it('no se puede achicar por debajo de 5 cm ni invertir', () => {
      const g = rect(base().spaces.get('a')!);
      expect(resizeRect(g, 'e', [-50, 3]).widthM).toBe(0.05);
    });

    it('redimensionar un rectángulo rotado 90° deja fijo el borde opuesto en el mundo', () => {
      const g: RectGeometry = { kind: 'RECT', centerXM: 10, centerYM: 10, widthM: 4, depthM: 2, rotationDeg: 90 };
      // el eje x local apunta ahora hacia abajo (+y): el asa «e» está en y = 12
      const r = resizeRect(g, 'e', [10, 14]);
      expect(r.widthM).toBe(6);
      expect(r.centerYM - r.widthM / 2).toBeCloseTo(8, 6);
      expect(r.rotationDeg).toBe(90);
    });

    it('rotar hacia el puntero y por pasos de 15°', () => {
      const g = rect(base().spaces.get('a')!);
      expect(rotateRectTo(g, [3, -10]).rotationDeg).toBe(0);
      expect(rotateRectTo(g, [13, 3]).rotationDeg).toBe(90);
      expect(rotateRectTo(g, [13, 5], 15).rotationDeg % 15).toBe(0);
    });

    it('mover un vértice de un polígono', () => {
      const moved = movePolygonVertex({ kind: 'POLYGON', vertices: [[0, 0], [4, 0], [4, 3]] }, 2, [5.0004, 3.0006]);
      expect(moved).toEqual({ kind: 'POLYGON', vertices: [[0, 0], [4, 0], [5, 3.001]] });
    });

    it('rectángulo desde dos esquinas, por omisión y medidas vivas', () => {
      expect(rectFromCorners([5, 4], [1, 1])).toMatchObject({ centerXM: 3, centerYM: 2.5, widthM: 4, depthM: 3 });
      expect(defaultRect('ROOM', [5, 5])).toMatchObject({ widthM: 3, depthM: 3 });
      expect(defaultRect('BED', [5, 5])).toMatchObject({ widthM: 1, depthM: 2 });
      expect(measureText({ ...base().spaces.get('a')!, geometry: rectFromCorners([0, 0], [4, 8.5]) })).toBe('4,00 × 8,50 m · 34,00 m²');
    });

    it('translateGeometry funciona con polígonos', () => {
      expect(translateGeometry({ kind: 'POLYGON', vertices: [[0, 0], [1, 0], [1, 1]] }, 2, 3)).toEqual({ kind: 'POLYGON', vertices: [[2, 3], [3, 3], [3, 4]] });
    });
  });

  describe('validación viva mientras se edita (ayuda; la autoridad es el servidor)', () => {
    const issues = (s: EditState) => validateLayout({ canvas: { widthM: 64, heightM: 26, contactToleranceM: 0.01, anchorSpaceId: 'piso' }, shapes: shapesOf(s) });

    it('un solape se marca por elemento con su vecino', () => {
      const moved = setGeometry(base(), 'b', translateGeometry(base().spaces.get('b')!.geometry, -2, 0));
      const found = issues(moved).filter((i) => i.code === 'PLAN_SIBLING_OVERLAP');
      expect(found.map((i) => i.id).sort()).toEqual(['a', 'b']);
    });

    it('tocarse por la pared es válido', () => {
      expect(issues(base())).toEqual([]);
    });

    it('sacar una cama de su habitación da PLAN_CHILD_OUTSIDE_PARENT', () => {
      const out = setGeometry(base(), 'cama', translateGeometry(base().spaces.get('cama')!.geometry, 9, 0));
      expect(issues(out).map((i) => i.code)).toContain('PLAN_CHILD_OUTSIDE_PARENT');
    });
  });

  describe('delta del guardado', () => {
    it('sin cambios no hay delta', () => {
      expect(patchSize(diffPatch(base(), base()))).toBe(0);
      expect(isDirty(base(), base())).toBe(false);
    });

    it('lo movido viaja con expectedRowVersion; lo nuevo, sin él', () => {
      let s = setGeometry(base(), 'b', translateGeometry(base().spaces.get('b')!.geometry, 1, 0));
      s = { ...s, spaces: new Map(s.spaces).set('n', { id: 'n', code: 'N', name: 'N', parentId: 'area', formCode: 'ROOM', geometry: defaultRect('ROOM', [20, 5]), zOrder: 10, locked: false, rowVersion: null }) };
      const patch = diffPatch(base(), s);
      const placements = patch.upsert!.placements!;
      expect(placements.map((p) => p.spaceId).sort()).toEqual(['b', 'n']);
      expect(placements.find((p) => p.spaceId === 'b')!.expectedRowVersion).toBe(3);
      expect(placements.find((p) => p.spaceId === 'n')!.expectedRowVersion).toBeUndefined();
    });

    it('quitar del plano lo que ya estaba guardado va en remove; lo nuevo que se quitó no viaja', () => {
      const s = removeFromPlan(base(), 'cama');
      expect(diffPatch(base(), s).remove).toEqual({ spaceIds: ['cama'] });
      const fresh: EditState = { ...base(), spaces: new Map(base().spaces).set('n', { ...base().spaces.get('a')!, id: 'n', rowVersion: null }) };
      expect(patchSize(diffPatch(base(), removeFromPlan(fresh, 'n')))).toBe(0);
    });

    it('deshacer lo movido deja el delta vacío', () => {
      const h = new EditHistory(base());
      h.push(setGeometry(h.present, 'b', translateGeometry(h.present.spaces.get('b')!.geometry, 1, 0)));
      expect(isDirty(base(), h.present)).toBe(true);
      expect(isDirty(base(), h.undo())).toBe(false);
    });
  });

  describe('conflicto 412: recargar y reaplicar', () => {
    it('reaplica lo que no chocó y deja afuera lo que otra persona movió', () => {
      const old = base();
      let mine = setGeometry(old, 'a', translateGeometry(old.spaces.get('a')!.geometry, 0, 1));
      mine = setGeometry(mine, 'b', translateGeometry(old.spaces.get('b')!.geometry, 0, 1));
      // otra persona movió «b» en el servidor
      const theirs = setGeometry(old, 'b', translateGeometry(old.spaces.get('b')!.geometry, 0, 2));
      const result = reapply(old, mine, { ...theirs, spaces: new Map([...theirs.spaces].map(([id, s]) => [id, { ...s, rowVersion: (s.rowVersion ?? 0) + 1 }])) });
      expect(result.applied).toEqual(['a']);
      expect(result.conflicts).toEqual(['b']);
      expect(rect(result.state.spaces.get('a')!).centerYM).toBe(4);
      expect(result.state.spaces.get('a')!.rowVersion).toBe(4);
      expect(rect(result.state.spaces.get('b')!).centerYM).toBe(5); // se queda con lo de la otra persona
    });

    it('un espacio que quité y otra persona no tocó se sigue quitando', () => {
      const old = base();
      const mine = removeFromPlan(old, 'cama');
      const result = reapply(old, mine, old);
      expect(result.applied).toEqual(['cama']);
      expect(result.state.removed.has('cama')).toBe(true);
    });
  });
});
