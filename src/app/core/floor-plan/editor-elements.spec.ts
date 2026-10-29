import { describe, expect, it } from 'vitest';

import {
  elementAxis, elementDtosOf, elementPatch, nearestOpening, nearestWall, newOpening, newWall, openingOffsetAt, reapplyElements, removeElement, validationElements,
  wallLength, withElement,
} from './editor-elements';
import { EMPTY_EDIT, diffPatch, fromViews, isDirty, type EditState } from './editor-model';
import type { PlanElementDTO } from '../data-access/floor-plan/floor-plan.types';
import { validateLayout } from './layout-validation';

const wallDto: PlanElementDTO = { id: 'w1', kind: 'WALL', rowVersion: 2, zOrder: 30, vertices: [[0, 0], [10, 0]], thicknessM: 0.12 };
const doorDto: PlanElementDTO = { id: 'd1', kind: 'DOOR', rowVersion: 1, zOrder: 40, hostElementId: 'w1', offsetM: 2, widthM: 0.9, swing: 'LEFT', swingSide: 'A' };
const stairs: PlanElementDTO = { id: 's1', kind: 'STAIRS', rowVersion: 1, zOrder: 20, vertices: [[20, 0], [22, 0], [22, 3], [20, 3]] };
const base: EditState = fromViews([], [wallDto, doorDto, stairs]);

describe('editor-elements', () => {
  it('solo trae al estado de edición muros, puertas y ventanas; lo demás se conserva tal cual', () => {
    expect([...base.elements.keys()]).toEqual(['w1', 'd1']);
    expect(elementDtosOf([wallDto, doorDto, stairs], base).map((d) => d.id).sort()).toEqual(['d1', 's1', 'w1']);
    expect(isDirty(base, base)).toBe(false);
  });

  it('un muro nuevo viaja sin versión, con su id de cliente, y las puertas después de su muro', () => {
    const wall = newWall('00000000-0000-4000-a000-000000000001', [[0, 5], [6, 5]]);
    const door = newOpening('00000000-0000-4000-a000-000000000002', 'DOOR', wall.id, 1);
    // La puerta se agrega primero a propósito: el delta igual manda el muro antes.
    const current = withElement(withElement(base, door), wall);
    const patch = diffPatch(base, current);
    const elements = patch.upsert!.elements!;
    expect(elements.map((e) => e.kind)).toEqual(['WALL', 'DOOR']);
    expect(elements[0]).toMatchObject({ id: wall.id, vertices: [[0, 5], [6, 5]], thicknessM: 0.12 });
    expect(elements[0]).not.toHaveProperty('expectedRowVersion');
    expect(elements[1]).toMatchObject({ hostElementId: wall.id, offsetM: 1, widthM: 0.9, swing: 'LEFT' });
  });

  it('mover un muro existente manda su expectedRowVersion; sin cambios no manda nada', () => {
    const moved = withElement(base, { ...base.elements.get('w1')!, vertices: [[0, 1], [10, 1]] });
    expect(elementPatch(base, moved).upserts).toEqual([expect.objectContaining({ id: 'w1', expectedRowVersion: 2 })]);
    expect(elementPatch(base, base).upserts).toEqual([]);
  });

  it('quitar un muro quita también sus aberturas y solo viaja lo que existía en el servidor', () => {
    const removed = removeElement(base, 'w1');
    expect(elementPatch(base, removed).removeIds.sort()).toEqual(['d1', 'w1']);
    const drawn = withElement(EMPTY_EDIT, newWall('x', [[0, 0], [1, 0]]));
    expect(elementPatch(EMPTY_EDIT, removeElement(drawn, 'x')).removeIds).toEqual([]);
  });

  it('la abertura queda dentro del muro y se la encuentra por su tramo', () => {
    const wall = base.elements.get('w1')!;
    expect(wallLength(wall)).toBe(10);
    expect(openingOffsetAt(wall, 0.2, 0.9)).toBe(0);
    expect(openingOffsetAt(wall, 9.9, 0.9)).toBe(9.1);
    expect(openingOffsetAt(wall, 5, 0.9)).toBe(4.55);
    expect(nearestWall(base, [5, 0.1], 0.3)?.wall.id).toBe('w1');
    expect(nearestWall(base, [5, 2], 0.3)).toBeNull();
    expect(nearestOpening(base, [2.4, 0.05], 0.3)?.id).toBe('d1');
    expect(elementAxis(base, base.elements.get('d1')!)).toEqual([[2, 0], [2.9, 0]]);
  });

  it('la validación local avisa de una puerta que no cabe en su muro y de un muro que no existe', () => {
    const tooFar = withElement(base, { ...base.elements.get('d1')!, offsetM: 9.5 });
    const { walls, openings } = validationElements(tooFar);
    const canvas = { widthM: 64, heightM: 26, contactToleranceM: 0.01, anchorSpaceId: null };
    expect(validateLayout({ canvas, shapes: [], walls, openings }).map((i) => i.code)).toEqual(['PLAN_OPENING_OUTSIDE_WALL']);
    const orphan = withElement(base, { ...base.elements.get('d1')!, hostElementId: 'nada' });
    expect(validateLayout({ canvas, shapes: [], ...validationElements(orphan) }).map((i) => i.code)).toEqual(['PLAN_HOST_NOT_WALL']);
  });

  it('tras un 412 reaplica lo mío que no chocó y avisa de lo que sí', () => {
    const mine = withElement(withElement(base, { ...base.elements.get('w1')!, thicknessM: 0.2 }), newWall('nuevo', [[0, 9], [3, 9]]));
    const theirsSame = fromViews([], [{ ...wallDto, rowVersion: 3, vertices: [[0, 0], [12, 0]] }, doorDto]);
    const r1 = reapplyElements(base, mine, theirsSame);
    expect(r1.conflicts).toEqual(['w1']);
    expect(r1.applied).toEqual(['nuevo']);
    const theirsOther = fromViews([], [{ ...wallDto, rowVersion: 3 }, doorDto]);
    const r2 = reapplyElements(base, mine, theirsOther);
    expect(r2.conflicts).toEqual([]);
    expect(r2.state.elements.get('w1')).toMatchObject({ thicknessM: 0.2, rowVersion: 3 });
  });
});
