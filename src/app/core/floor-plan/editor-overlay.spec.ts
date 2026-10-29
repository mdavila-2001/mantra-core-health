import { describe, expect, it } from 'vitest';

import { buildEditorOverlay, polygonHandles, rectHandles } from './editor-overlay';
import type { EditSpace } from './editor-model';

const rect: EditSpace = {
  id: 'a', code: 'A', name: 'Sala', parentId: null, formCode: 'ROOM', zOrder: 10, locked: false, rowVersion: 1,
  geometry: { kind: 'RECT', centerXM: 10, centerYM: 10, widthM: 4, depthM: 2, rotationDeg: 0 },
};

describe('editor-overlay', () => {
  it('un rectángulo tiene 8 asas de tamaño y la de rotación sobre el borde superior', () => {
    const handles = rectHandles(rect, 10);
    expect(handles.filter((h) => h.kind === 'resize')).toHaveLength(8);
    const rotate = handles.find((h) => h.kind === 'rotate')!;
    expect(rotate.x).toBeCloseTo(10, 6);
    expect(rotate.y).toBeCloseTo(9 - 3, 6); // borde superior y = 9; 30 px / 10 px/m = 3 m
  });

  it('con rotación de 90° el asa de rotación queda a la derecha del centro', () => {
    const turned: EditSpace = { ...rect, geometry: { kind: 'RECT', centerXM: 10, centerYM: 10, widthM: 4, depthM: 2, rotationDeg: 90 } };
    const rotate = rectHandles(turned, 10).find((h) => h.kind === 'rotate')!;
    expect(rotate.x).toBeGreaterThan(10);
    expect(rotate.y).toBeCloseTo(10, 6);
  });

  it('un polígono tiene un asa por vértice y una por arista', () => {
    const poly: EditSpace = { ...rect, geometry: { kind: 'POLYGON', vertices: [[0, 0], [4, 0], [4, 4]] } };
    const handles = polygonHandles(poly);
    expect(handles.filter((h) => h.kind === 'vertex')).toHaveLength(3);
    expect(handles.filter((h) => h.kind === 'midpoint')).toHaveLength(3);
  });

  it('los errores llevan borde, glifo y mensaje; sin selección no hay asas', () => {
    const overlay = buildEditorOverlay({
      selected: null, selectedVertex: null, locked: false, draft: null, measuring: null,
      errors: new Map([['a', 'A se solapa con B.']]),
      errorShapes: new Map([['a', [[0, 0], [2, 0], [2, 2], [0, 2]]]]),
      errorLabels: new Map([['a', 'Se solapa con B']]),
      snapMark: null, scale: 10, pointerType: 'mouse',
    });
    expect(overlay.handles).toHaveLength(0);
    expect(overlay.errorIds.has('a')).toBe(true);
    expect(overlay.labels[0]!.text).toContain('⚠ Se solapa con B');
    expect(overlay.shapes[0]!.kind).toBe('error');
  });
});
