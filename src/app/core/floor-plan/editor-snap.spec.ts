import { describe, expect, it } from 'vitest';

import { neighborGeometry, snapDelta, snapWorldPoint } from './editor-snap';
import type { Point } from './geometry';

const square = (x: number, y: number, s: number): Point[] => [
  [x, y],
  [x + s, y],
  [x + s, y + s],
  [x, y + s],
];

describe('editor-snap', () => {
  const neighbors = neighborGeometry([square(10, 0, 4)]);

  it('pega un vértice al vértice vecino más cercano (pared compartida)', () => {
    const result = snapDelta({ moving: square(0, 0, 4), delta: [5.95, 0.02], neighbors, gridSizeM: null, radiusM: 0.3, suspended: false, orthogonal: false });
    expect(result.kind).toBe('vertex');
    expect(result.delta[0]).toBeCloseTo(6, 6);
    expect(result.delta[1]).toBeCloseTo(0, 6);
    expect([[10, 0], [10, 4]]).toContainEqual(result.mark);
  });

  it('sin vecinos cerca cae en la grilla', () => {
    const result = snapDelta({ moving: square(0, 0, 4), delta: [1.26, 0.74], neighbors, gridSizeM: 0.5, radiusM: 0.2, suspended: false, orthogonal: false });
    expect(result.kind).toBe('grid');
    expect(result.delta).toEqual([1.5, 0.5]);
  });

  it('Alt suspende el imán y Shift fuerza el eje dominante', () => {
    expect(snapDelta({ moving: square(0, 0, 4), delta: [1.26, 0.74], neighbors, gridSizeM: 0.5, radiusM: 0.2, suspended: true, orthogonal: false }).delta).toEqual([1.26, 0.74]);
    expect(snapDelta({ moving: square(0, 0, 4), delta: [3, 0.7], neighbors, gridSizeM: null, radiusM: 0.1, suspended: false, orthogonal: true }).delta).toEqual([3, 0]);
  });

  it('un punto suelto se pega a una arista', () => {
    const result = snapWorldPoint([12, 4.1], { neighbors, gridSizeM: 0.5, radiusM: 0.3, suspended: false });
    expect(result.point[1]).toBeCloseTo(4, 6);
    expect(result.mark).not.toBeNull();
  });
});
