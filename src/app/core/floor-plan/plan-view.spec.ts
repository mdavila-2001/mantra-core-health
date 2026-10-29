import type { PlanElementDTO, SpacePlacementDTO } from '../data-access/floor-plan/floor-plan.types';
import { bandOf, paintOrder, pathOf, sortedElements, toElementViews, toSpaceView } from './plan-view';

const space = (over: Partial<SpacePlacementDTO> & { spaceId: string }): SpacePlacementDTO => ({
  placementId: `pl-${over.spaceId}`,
  rowVersion: 1,
  zOrder: 10,
  locked: false,
  geometry: { kind: 'RECT', centerXM: 5, centerYM: 4, widthM: 6, depthM: 4, rotationDeg: 0 },
  bbox: [2, 2, 8, 6],
  areaCalcM2: 24,
  inScope: true,
  code: over.spaceId.toUpperCase(),
  name: over.spaceId,
  form: { code: 'ROOM' },
  function: { code: 'CONSULTING_ROOM' },
  parentId: null,
  ...over,
});

describe('del DTO al dibujo', () => {
  it('un rectángulo se convierte en su contorno, su ruta y su centro', () => {
    const view = toSpaceView(space({ spaceId: 'a' }));
    expect(view.vertices).toEqual([[2, 2], [8, 2], [8, 6], [2, 6]]);
    expect(view.path).toBe('M2 2 L8 2 L8 6 L2 6 Z');
    expect(view.center).toEqual([5, 4]);
    expect(view.isRect).toBe(true);
    expect(view.band).toBe('room');
  });

  it('un polígono conserva sus vértices', () => {
    const view = toSpaceView(space({ spaceId: 'p', geometry: { kind: 'POLYGON', vertices: [[0, 0], [4, 0], [4, 3]] }, bbox: [0, 0, 4, 3], form: { code: 'AREA' } }));
    expect(view.isRect).toBe(false);
    expect(view.path).toBe('M0 0 L4 0 L4 3 Z');
    expect(view.band).toBe('zone');
  });

  it('un espacio fuera de alcance es una silueta sin identidad', () => {
    const view = toSpaceView({
      placementId: 'x', spaceId: 'x', rowVersion: 1, zOrder: 10, locked: false, inScope: false, bbox: [0, 0, 1, 1], areaCalcM2: 1,
      geometry: { kind: 'RECT', centerXM: 0.5, centerYM: 0.5, widthM: 1, depthM: 1, rotationDeg: 0 },
    });
    expect(view.code).toBe('');
    expect(view.name).toBe('');
    expect(view.inScope).toBe(false);
  });

  it('bandas: zonas, locales y camas', () => {
    expect(['BUILDING', 'LEVEL', 'AREA', 'WARD'].map(bandOf)).toEqual(['zone', 'zone', 'zone', 'zone']);
    expect(bandOf('ROOM')).toBe('room');
    expect(bandOf('BED')).toBe('bed');
    expect(bandOf(undefined)).toBe('room');
  });

  it('el orden de pintado es banda, zOrder e id; las camas quedan sobre los locales aunque tengan zOrder menor', () => {
    const views = [
      toSpaceView(space({ spaceId: 'cama', form: { code: 'BED' }, zOrder: 1 })),
      toSpaceView(space({ spaceId: 'sala-b', form: { code: 'ROOM' }, zOrder: 10 })),
      toSpaceView(space({ spaceId: 'area', form: { code: 'AREA' }, zOrder: 0 })),
      toSpaceView(space({ spaceId: 'sala-a', form: { code: 'ROOM' }, zOrder: 10 })),
    ];
    expect(paintOrder(views).map((v) => v.id)).toEqual(['area', 'sala-a', 'sala-b', 'cama']);
  });

  it('la puerta se resuelve sobre su muro: centro, bisagra, arco y boquete', () => {
    const wall: PlanElementDTO = { id: 'w', kind: 'WALL', rowVersion: 1, zOrder: 30, thicknessM: 0.12, vertices: [[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]] };
    const door: PlanElementDTO = { id: 'd', kind: 'DOOR', rowVersion: 1, zOrder: 40, hostElementId: 'w', offsetM: 4, widthM: 2, swing: 'LEFT', swingSide: 'A' };
    const [, doorView] = toElementViews([wall, door]);
    const opening = doorView!.opening!;
    expect(opening.center).toEqual([5, 0]);
    expect(opening.hinge).toEqual([4, 0]);
    // A = interior del lazo horario: la hoja abre hacia +y
    expect(opening.leafEnd[1]).toBeGreaterThan(0);
    expect(opening.arc.startsWith('M6 0 A2 2 0 0')).toBe(true);
    expect(opening.gap).toBe('M4 0 L6 0');
  });

  it('el lado B abre al otro lado y una puerta sin muro anfitrión no se dibuja', () => {
    const wall: PlanElementDTO = { id: 'w', kind: 'WALL', rowVersion: 1, zOrder: 30, vertices: [[0, 0], [10, 0]] };
    const b: PlanElementDTO = { id: 'd', kind: 'DOOR', rowVersion: 1, zOrder: 40, hostElementId: 'w', offsetM: 1, widthM: 1, swing: 'RIGHT', swingSide: 'B' };
    const orphan: PlanElementDTO = { id: 'o', kind: 'WINDOW', rowVersion: 1, zOrder: 35, hostElementId: 'nada', offsetM: 1, widthM: 1 };
    const views = toElementViews([wall, b, orphan]);
    expect(views[1]!.opening!.leafEnd[1]).toBeLessThan(0);
    expect(views[2]!.opening).toBeUndefined();
  });

  it('un muro con lazo cerrado y una circulación dan rutas; una anotación es un punto sin ruta', () => {
    const views = toElementViews([
      { id: 'm', kind: 'WALL', rowVersion: 1, zOrder: 30, vertices: [[0, 0], [2, 0], [2, 2]] },
      { id: 'c', kind: 'CIRCULATION', rowVersion: 1, zOrder: 5, vertices: [[0, 0], [2, 0], [2, 2]] },
      { id: 'n', kind: 'ANNOTATION', rowVersion: 1, zOrder: 60, vertices: [[1, 1]], label: 'N ↑' },
    ]);
    expect(views[0]!.path).toBe('M0 0 L2 0 L2 2');
    expect(views[1]!.path).toBe('M0 0 L2 0 L2 2 Z');
    expect(views[2]!.path).toBeUndefined();
    expect(views[2]!.label).toBe('N ↑');
  });

  it('los elementos se agrupan por capa y se ordenan por zOrder', () => {
    const views = toElementViews([
      { id: 'v2', kind: 'STAIRS', rowVersion: 1, zOrder: 20, vertices: [[0, 0], [1, 0], [1, 1]] },
      { id: 'v1', kind: 'ELEVATOR', rowVersion: 1, zOrder: 15, vertices: [[0, 0], [1, 0], [1, 1]] },
      { id: 'm', kind: 'WALL', rowVersion: 1, zOrder: 30, vertices: [[0, 0], [1, 0]] },
    ]);
    expect(sortedElements(views, 'vertical').map((e) => e.id)).toEqual(['v1', 'v2']);
    expect(sortedElements(views, 'walls').map((e) => e.id)).toEqual(['m']);
  });

  it('pathOf de una lista vacía es vacío', () => {
    expect(pathOf([])).toBe('');
  });
});
