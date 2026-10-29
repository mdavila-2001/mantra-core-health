import { distanceToSegment, type Point } from './geometry';

export interface SnapOptions {
  /** Paso de la grilla en metros; `null` o 0 desactiva el snap a grilla. */
  readonly gridSizeM: number | null;
  /** Vértices de vecinos a los que imantar. */
  readonly vertices?: readonly Point[];
  /** Aristas de vecinos a las que imantar. */
  readonly edges?: readonly (readonly [Point, Point])[];
  /** Radio de captura, en metros (se deriva del zoom: ~8 px). */
  readonly radiusM: number;
  /** `Alt` suspende el snap. */
  readonly suspended?: boolean;
  /** `Shift` fuerza ortogonal respecto de `origin`. */
  readonly orthogonalFrom?: Point | null;
}

export interface SnapResult {
  readonly point: Point;
  readonly kind: 'none' | 'grid' | 'vertex' | 'edge';
}

/** Redondea al múltiplo de `step` más cercano. */
export function snapToGrid(value: number, step: number): number {
  if (!(step > 0)) return value;
  return Math.round(value / step) * step;
}

/**
 * Imanta un punto: vértices de vecinos primero, luego aristas, luego la grilla
 * (CONTRATO-PLANO §5.3). El snap a vértice gana sobre el de grilla porque dos
 * locales con pared compartida deben coincidir al milímetro, no al paso.
 */
export function snapPoint(point: Point, options: SnapOptions): SnapResult {
  let working: Point = point;
  if (options.orthogonalFrom != null) {
    const [ox, oy] = options.orthogonalFrom;
    working = Math.abs(point[0] - ox) >= Math.abs(point[1] - oy) ? [point[0], oy] : [ox, point[1]];
  }
  if (options.suspended === true) return { point: working, kind: 'none' };

  let bestVertex: { point: Point; distance: number } | null = null;
  for (const vertex of options.vertices ?? []) {
    const d = Math.hypot(vertex[0] - working[0], vertex[1] - working[1]);
    if (d <= options.radiusM && (bestVertex === null || d < bestVertex.distance)) {
      bestVertex = { point: vertex, distance: d };
    }
  }
  if (bestVertex !== null) return { point: bestVertex.point, kind: 'vertex' };

  let bestEdge: { point: Point; distance: number } | null = null;
  for (const [a, b] of options.edges ?? []) {
    const d = distanceToSegment(working, a, b);
    if (d <= options.radiusM && (bestEdge === null || d < bestEdge.distance)) {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const lengthSquared = dx * dx + dy * dy;
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((working[0] - a[0]) * dx + (working[1] - a[1]) * dy) / lengthSquared));
      bestEdge = { point: [a[0] + dx * t, a[1] + dy * t], distance: d };
    }
  }
  if (bestEdge !== null) return { point: bestEdge.point, kind: 'edge' };

  if (options.gridSizeM != null && options.gridSizeM > 0) {
    return { point: [snapToGrid(working[0], options.gridSizeM), snapToGrid(working[1], options.gridSizeM)], kind: 'grid' };
  }
  return { point: working, kind: 'none' };
}
