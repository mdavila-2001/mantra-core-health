/* ============================================================================
    Imán del editor (CONTRATO-PLANO §5.3): al arrastrar una figura, sus vértices
    se pegan a los vértices y aristas de las vecinas (pared compartida al
    milímetro) y, si no hay ninguna cerca, el ancla cae en la grilla. `Alt`
    suspende todo; `Shift` fuerza el eje dominante.
    ========================================================================== */

import { distanceToSegment, type Point } from './geometry';
import { snapPoint, snapToGrid } from './snap';

export interface NeighborGeometry {
  readonly vertices: readonly Point[];
  readonly edges: readonly (readonly [Point, Point])[];
}

/** Vértices y aristas de los anillos de las figuras vecinas. */
export function neighborGeometry(rings: readonly (readonly Point[])[]): NeighborGeometry {
  const vertices: Point[] = [];
  const edges: (readonly [Point, Point])[] = [];
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 1) {
      vertices.push(ring[i]!);
      edges.push([ring[i]!, ring[(i + 1) % ring.length]!]);
    }
  }
  return { vertices, edges };
}

export interface DragSnapInput {
  /** Vértices de la figura que se mueve, tal como estaban al empezar. */
  readonly moving: readonly Point[];
  /** Cuánto se movió el puntero desde que empezó (sin imán). */
  readonly delta: Point;
  readonly neighbors: NeighborGeometry;
  readonly gridSizeM: number | null;
  readonly radiusM: number;
  readonly suspended: boolean;
  readonly orthogonal: boolean;
}

export interface DragSnapResult {
  readonly delta: Point;
  /** Punto al que se pegó (para dibujar la marca). */
  readonly mark: Point | null;
  readonly kind: 'none' | 'grid' | 'vertex' | 'edge';
}

/**
 * Corrige el desplazamiento de una figura entera. Gana el vértice vecino más
 * cercano; después una arista; después la grilla (sobre el primer vértice).
 */
export function snapDelta(input: DragSnapInput): DragSnapResult {
  let [dx, dy] = input.delta;
  if (input.orthogonal) {
    if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
    else dx = 0;
  }
  if (input.suspended || input.moving.length === 0) return { delta: [dx, dy], mark: null, kind: 'none' };

  let best: { correction: Point; mark: Point; kind: 'vertex' | 'edge'; distance: number } | null = null;
  for (const v of input.moving) {
    const probe: Point = [v[0] + dx, v[1] + dy];
    const hit = snapPoint(probe, { gridSizeM: null, vertices: input.neighbors.vertices, edges: input.neighbors.edges, radiusM: input.radiusM });
    if (hit.kind !== 'vertex' && hit.kind !== 'edge') continue;
    const correction: Point = [hit.point[0] - probe[0], hit.point[1] - probe[1]];
    const distance = Math.hypot(correction[0], correction[1]);
    const better = best === null || (hit.kind === 'vertex' && best.kind === 'edge') || (hit.kind === best.kind && distance < best.distance);
    if (better) best = { correction, mark: hit.point, kind: hit.kind, distance };
  }
  if (best !== null) return { delta: [dx + best.correction[0], dy + best.correction[1]], mark: best.mark, kind: best.kind };

  const grid = input.gridSizeM;
  if (grid != null && grid > 0) {
    const anchor = input.moving[0]!;
    const snapped: Point = [snapToGrid(anchor[0] + dx, grid), snapToGrid(anchor[1] + dy, grid)];
    return { delta: [snapped[0] - anchor[0], snapped[1] - anchor[1]], mark: null, kind: 'grid' };
  }
  return { delta: [dx, dy], mark: null, kind: 'none' };
}

/** Imán de un punto suelto (esquina que se dibuja, vértice que se arrastra). */
export function snapWorldPoint(
  point: Point,
  options: { neighbors: NeighborGeometry; gridSizeM: number | null; radiusM: number; suspended: boolean; orthogonalFrom?: Point | null },
): { point: Point; mark: Point | null } {
  const hit = snapPoint(point, {
    gridSizeM: options.gridSizeM,
    vertices: options.neighbors.vertices,
    edges: options.neighbors.edges,
    radiusM: options.radiusM,
    suspended: options.suspended,
    orthogonalFrom: options.orthogonalFrom ?? null,
  });
  return { point: hit.point, mark: hit.kind === 'vertex' || hit.kind === 'edge' ? hit.point : null };
}

/** ¿Algún borde de las vecinas pasa a menos de `radiusM` del punto? (para las guías) */
export function nearestEdgeDistance(point: Point, neighbors: NeighborGeometry): number {
  let best = Number.POSITIVE_INFINITY;
  for (const [a, b] of neighbors.edges) best = Math.min(best, distanceToSegment(point, a, b));
  return best;
}
