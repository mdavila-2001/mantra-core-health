/* ============================================================================
    Geometría del plano de planta — funciones puras, sin DOM ni Angular.

    Coordenadas en **metros**, x hacia la derecha, y hacia abajo, origen arriba a
    la izquierda (convención SVG; CONTRATO-PLANO §0 P3). La rotación de un
    rectángulo es horaria **en pantalla**, igual que `rotate()` de SVG, y el
    ancho va sobre el eje x local.

    Esto es la **ayuda inmediata** del editor y del visor: la autoridad del
    solape y de la contención es la base de datos y la API (`dryRun` + guardado,
    CONTRATO-PLANO §5.3). Las funciones de acá reproducen la definición del
    servidor para que lo que se pinta de error coincida con lo que se rechaza:

    - «solapar» se mide sobre el **contorno de contacto** (la figura achicada
      por la tolerancia de contacto), de modo que dos locales con pared
      compartida se tocan y no se solapan (INV-PL-04);
    - «caber» tolera esa misma holgura (INV-PL-03 e INV-PL-05).
    ========================================================================== */

/** Un punto del plano en metros. */
export type Point = readonly [number, number];

/** Caja envolvente `[x0, y0, x1, y1]`, con `x0 <= x1` e `y0 <= y1`. */
export type BBox = readonly [number, number, number, number];

/** Tolerancia numérica para comparaciones de coma flotante (1 µm). */
export const EPSILON = 1e-6;

/** Radianes de un ángulo en grados. */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Normaliza un ángulo al intervalo [0, 360). */
export function normalizeDegrees(degrees: number): number {
  const wrapped = degrees % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/**
 * Esquinas de un rectángulo rotado, en orden horario en pantalla empezando por
 * la esquina superior izquierda del rectángulo sin rotar.
 */
export function rectVertices(
  centerX: number,
  centerY: number,
  width: number,
  depth: number,
  rotationDeg: number,
): Point[] {
  const halfWidth = width / 2;
  const halfDepth = depth / 2;
  const angle = toRadians(rotationDeg);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const corners: Point[] = [
    [-halfWidth, -halfDepth],
    [halfWidth, -halfDepth],
    [halfWidth, halfDepth],
    [-halfWidth, halfDepth],
  ];
  return corners.map(([x, y]) => [centerX + x * cosine - y * sine, centerY + x * sine + y * cosine] as Point);
}

/** Área con signo (shoelace). Positiva si el recorrido es horario en pantalla (y hacia abajo). */
export function signedArea(vertices: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const [x1, y1] = vertices[i]!;
    const [x2, y2] = vertices[(i + 1) % vertices.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return sum / 2;
}

/** Área absoluta de un polígono simple. */
export function polygonArea(vertices: readonly Point[]): number {
  return Math.abs(signedArea(vertices));
}

/** Perímetro de un polígono cerrado. */
export function polygonPerimeter(vertices: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    total += distance(vertices[i]!, vertices[(i + 1) % vertices.length]!);
  }
  return total;
}

/** Largo de una polilínea abierta. */
export function polylineLength(vertices: readonly Point[]): number {
  let total = 0;
  for (let i = 0; i + 1 < vertices.length; i += 1) {
    total += distance(vertices[i]!, vertices[i + 1]!);
  }
  return total;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

/** Caja envolvente de un conjunto de puntos. Lanza si no hay ninguno. */
export function bboxOf(points: readonly Point[]): BBox {
  if (points.length === 0) {
    throw new Error('bboxOf: no hay puntos');
  }
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  return [x0, y0, x1, y1];
}

export function bboxUnion(a: BBox, b: BBox): BBox {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
}

export function bboxIntersects(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];
}

export function bboxContainsPoint(box: BBox, point: Point): boolean {
  return point[0] >= box[0] && point[0] <= box[2] && point[1] >= box[1] && point[1] <= box[3];
}

export function bboxCenter(box: BBox): Point {
  return [(box[0] + box[2]) / 2, (box[1] + box[3]) / 2];
}

export function bboxSize(box: BBox): { width: number; height: number } {
  return { width: box[2] - box[0], height: box[3] - box[1] };
}

/** Agranda (o achica, con valor negativo) una caja por todos sus lados. */
export function bboxInflate(box: BBox, margin: number): BBox {
  return [box[0] - margin, box[1] - margin, box[2] + margin, box[3] + margin];
}

/** Centroide del área de un polígono (cae en el promedio de vértices si el área es ~0). */
export function centroid(vertices: readonly Point[]): Point {
  const area = signedArea(vertices);
  if (Math.abs(area) < EPSILON) {
    const sum = vertices.reduce<[number, number]>((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0]);
    return [sum[0] / vertices.length, sum[1] / vertices.length];
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < vertices.length; i += 1) {
    const [x1, y1] = vertices[i]!;
    const [x2, y2] = vertices[(i + 1) % vertices.length]!;
    const cross = x1 * y2 - x2 * y1;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  return [cx / (6 * area), cy / (6 * area)];
}

/** ¿El punto está dentro del polígono (borde incluido, con holgura `slack`)? */
export function pointInPolygon(point: Point, vertices: readonly Point[], slack = 0): boolean {
  if (slack > 0 && distanceToPolygonBoundary(point, vertices) <= slack) {
    return true;
  }
  const [px, py] = point;
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const [xi, yi] = vertices[i]!;
    const [xj, yj] = vertices[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Distancia de un punto al segmento ab. */
export function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < EPSILON * EPSILON) {
    return distance(point, a);
  }
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(point[0] - (a[0] + t * dx), point[1] - (a[1] + t * dy));
}

export function distanceToPolygonBoundary(point: Point, vertices: readonly Point[]): number {
  let best = Infinity;
  for (let i = 0; i < vertices.length; i += 1) {
    best = Math.min(best, distanceToSegment(point, vertices[i]!, vertices[(i + 1) % vertices.length]!));
  }
  return best;
}

/** Producto cruz (b-a)×(c-a). */
function cross(a: Point, b: Point, c: Point): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return (
    Math.min(a[0], b[0]) - EPSILON <= p[0] &&
    p[0] <= Math.max(a[0], b[0]) + EPSILON &&
    Math.min(a[1], b[1]) - EPSILON <= p[1] &&
    p[1] <= Math.max(a[1], b[1]) + EPSILON
  );
}

/** ¿Los segmentos ab y cd comparten algún punto (tocarse cuenta)? */
export function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > EPSILON && d2 < -EPSILON) || (d1 < -EPSILON && d2 > EPSILON)) &&
      ((d3 > EPSILON && d4 < -EPSILON) || (d3 < -EPSILON && d4 > EPSILON))) {
    return true;
  }
  if (Math.abs(d1) <= EPSILON && onSegment(c, d, a)) return true;
  if (Math.abs(d2) <= EPSILON && onSegment(c, d, b)) return true;
  if (Math.abs(d3) <= EPSILON && onSegment(a, b, c)) return true;
  if (Math.abs(d4) <= EPSILON && onSegment(a, b, d)) return true;
  return false;
}

/** Por qué un polígono no es válido como figura de un local. */
export type PolygonProblem =
  | 'TOO_FEW_VERTICES'
  | 'TOO_MANY_VERTICES'
  | 'NON_FINITE'
  | 'REPEATED_VERTEX'
  | 'SELF_INTERSECTION'
  | 'STRAIGHT_ANGLE'
  | 'ZERO_AREA';

export const MAX_POLYGON_VERTICES = 64;
export const MAX_COORDINATE_M = 100_000;

/**
 * Valida un polígono contra las reglas de INV-PL-02: de 3 a 64 vértices
 * finitos, sin vértices repetidos, sin cruces ni contactos entre aristas no
 * contiguas, sin giros de 180° y con área positiva.
 */
export function validatePolygon(vertices: readonly Point[]): PolygonProblem | null {
  const n = vertices.length;
  if (n < 3) return 'TOO_FEW_VERTICES';
  if (n > MAX_POLYGON_VERTICES) return 'TOO_MANY_VERTICES';
  for (const [x, y] of vertices) {
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > MAX_COORDINATE_M || Math.abs(y) > MAX_COORDINATE_M) {
      return 'NON_FINITE';
    }
  }
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      if (distance(vertices[i]!, vertices[j]!) < EPSILON) return 'REPEATED_VERTEX';
    }
  }
  for (let i = 0; i < n; i += 1) {
    const previous = vertices[(i + n - 1) % n]!;
    const current = vertices[i]!;
    const next = vertices[(i + 1) % n]!;
    if (Math.abs(cross(previous, current, next)) <= EPSILON) return 'STRAIGHT_ANGLE';
  }
  for (let i = 0; i < n; i += 1) {
    const a = vertices[i]!;
    const b = vertices[(i + 1) % n]!;
    for (let j = i + 1; j < n; j += 1) {
      // Aristas contiguas comparten un vértice y se excluyen.
      if (j === i || (j + 1) % n === i || (i + 1) % n === j) continue;
      if (segmentsIntersect(a, b, vertices[j]!, vertices[(j + 1) % n]!)) return 'SELF_INTERSECTION';
    }
  }
  if (polygonArea(vertices) < EPSILON) return 'ZERO_AREA';
  return null;
}

/** Orienta el polígono con área con signo positiva (horario en pantalla). */
export function orientClockwise(vertices: readonly Point[]): Point[] {
  return signedArea(vertices) >= 0 ? [...vertices] : [...vertices].reverse();
}

/**
 * Achica un polígono simple por `amount` metros (offset hacia adentro con
 * empalme en inglete). Devuelve `null` si la figura desaparece o se vuelve
 * inválida: un local más angosto que dos veces la tolerancia no tiene contorno
 * de contacto.
 */
export function insetPolygon(vertices: readonly Point[], amount: number): Point[] | null {
  if (amount <= 0) return [...vertices];
  const cw = orientClockwise(vertices);
  const n = cw.length;
  // En pantalla (y abajo) y recorrido horario, el interior queda a la derecha de cada arista:
  // la normal interior de la arista (dx, dy) es (-dy, dx) normalizada.
  const lines: { point: Point; direction: Point }[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = cw[i]!;
    const b = cw[(i + 1) % n]!;
    const length = distance(a, b);
    if (length < EPSILON) return null;
    const dx = (b[0] - a[0]) / length;
    const dy = (b[1] - a[1]) / length;
    lines.push({ point: [a[0] - dy * amount, a[1] + dx * amount], direction: [dx, dy] });
  }
  const result: Point[] = [];
  for (let i = 0; i < n; i += 1) {
    const previous = lines[(i + n - 1) % n]!;
    const current = lines[i]!;
    const denominator = previous.direction[0] * current.direction[1] - previous.direction[1] * current.direction[0];
    if (Math.abs(denominator) < 1e-9) {
      result.push(current.point);
      continue;
    }
    const t =
      ((current.point[0] - previous.point[0]) * current.direction[1] -
        (current.point[1] - previous.point[1]) * current.direction[0]) /
      denominator;
    result.push([previous.point[0] + previous.direction[0] * t, previous.point[1] + previous.direction[1] * t]);
  }
  if (signedArea(result) <= EPSILON || validatePolygon(result) !== null) return null;
  // Con un offset mayor que la mitad del ancho las aristas se cruzan y el resultado queda
  // «al revés»: cada vértice de un inset legítimo está a `amount` o más de todo el contorno.
  for (const vertex of result) {
    if (distanceToPolygonBoundary(vertex, cw) < amount - 1e-6 || !pointInPolygon(vertex, cw)) return null;
  }
  return result;
}

type Triangle = readonly [Point, Point, Point];

/** Triangulación por recorte de orejas de un polígono simple. */
export function triangulate(vertices: readonly Point[]): Triangle[] {
  const polygon = orientClockwise(vertices);
  const indices = polygon.map((_, i) => i);
  const triangles: Triangle[] = [];
  let guard = polygon.length * polygon.length + 8;
  while (indices.length > 3 && guard > 0) {
    guard -= 1;
    let clipped = false;
    for (let k = 0; k < indices.length; k += 1) {
      const ia = indices[(k + indices.length - 1) % indices.length]!;
      const ib = indices[k]!;
      const ic = indices[(k + 1) % indices.length]!;
      const a = polygon[ia]!;
      const b = polygon[ib]!;
      const c = polygon[ic]!;
      // Vértice convexo en un recorrido horario en pantalla: producto cruz positivo.
      if (cross(a, b, c) <= EPSILON) continue;
      let hasInside = false;
      for (const other of indices) {
        if (other === ia || other === ib || other === ic) continue;
        if (pointInTriangle(polygon[other]!, a, b, c)) {
          hasInside = true;
          break;
        }
      }
      if (hasInside) continue;
      triangles.push([a, b, c]);
      indices.splice(k, 1);
      clipped = true;
      break;
    }
    if (!clipped) break;
  }
  if (indices.length === 3) {
    triangles.push([polygon[indices[0]!]!, polygon[indices[1]!]!, polygon[indices[2]!]!]);
  }
  return triangles;
}

function pointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const d1 = cross(a, b, p);
  const d2 = cross(b, c, p);
  const d3 = cross(c, a, p);
  const hasNegative = d1 < -EPSILON || d2 < -EPSILON || d3 < -EPSILON;
  const hasPositive = d1 > EPSILON || d2 > EPSILON || d3 > EPSILON;
  return !(hasNegative && hasPositive);
}

/** Recorta `subject` contra el polígono convexo `clip` (Sutherland–Hodgman). Ambos horarios en pantalla. */
function clipConvex(subject: readonly Point[], clip: readonly Point[]): Point[] {
  let output: Point[] = [...subject];
  for (let i = 0; i < clip.length && output.length > 0; i += 1) {
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const input = output;
    output = [];
    for (let j = 0; j < input.length; j += 1) {
      const current = input[j]!;
      const previous = input[(j + input.length - 1) % input.length]!;
      // El interior de un recorrido horario en pantalla está a la derecha (cross > 0 con y abajo).
      const currentInside = cross(a, b, current) >= -EPSILON;
      const previousInside = cross(a, b, previous) >= -EPSILON;
      if (currentInside) {
        if (!previousInside) output.push(lineIntersection(previous, current, a, b));
        output.push(current);
      } else if (previousInside) {
        output.push(lineIntersection(previous, current, a, b));
      }
    }
  }
  return output;
}

function lineIntersection(p1: Point, p2: Point, p3: Point, p4: Point): Point {
  const x1 = p1[0];
  const y1 = p1[1];
  const x2 = p2[0];
  const y2 = p2[1];
  const x3 = p3[0];
  const y3 = p3[1];
  const x4 = p4[0];
  const y4 = p4[1];
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denominator) < 1e-12) return p2;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  return [x1 + t * (x2 - x1), y1 + t * (y2 - y1)];
}

/** Área de la intersección de dos polígonos simples (cualquier forma). */
export function intersectionArea(a: readonly Point[], b: readonly Point[]): number {
  if (!bboxIntersects(bboxOf(a), bboxOf(b))) return 0;
  const trianglesA = triangulate(a);
  const trianglesB = triangulate(b);
  let total = 0;
  for (const ta of trianglesA) {
    const boxA = bboxOf(ta);
    for (const tb of trianglesB) {
      if (!bboxIntersects(boxA, bboxOf(tb))) continue;
      const clipped = clipConvex(ta, tb);
      if (clipped.length >= 3) total += polygonArea(clipped);
    }
  }
  return total;
}

/**
 * Área en que dos figuras se solapan **descontando la tolerancia de contacto**:
 * es el área de la intersección de sus contornos de contacto (INV-PL-04). Dos
 * locales con pared compartida dan 0.
 */
export function contactOverlapArea(a: readonly Point[], b: readonly Point[], toleranceM: number): number {
  const insetA = insetPolygon(a, toleranceM);
  const insetB = insetPolygon(b, toleranceM);
  if (insetA === null || insetB === null) return 0;
  const area = intersectionArea(insetA, insetB);
  return area < EPSILON ? 0 : area;
}

/**
 * ¿`child` cabe dentro de `parent` con la holgura `toleranceM`? (INV-PL-05).
 * Se mide por área: lo que sobresale del padre debe ser menor que una franja de
 * ancho `toleranceM` a lo largo del perímetro del hijo.
 */
export function containedWithin(child: readonly Point[], parent: readonly Point[], toleranceM: number): boolean {
  const childArea = polygonArea(child);
  const inside = intersectionArea(child, parent);
  const allowedSpill = toleranceM * polygonPerimeter(child);
  return childArea - inside <= allowedSpill + EPSILON;
}

/** Cantidad de metros cuadrados de `child` que quedan fuera de `parent`. */
export function spillArea(child: readonly Point[], parent: readonly Point[]): number {
  return Math.max(0, polygonArea(child) - intersectionArea(child, parent));
}

/** ¿Todo el polígono cabe en el lienzo `[0,width]×[0,height]` con holgura? (INV-PL-03). */
export function withinCanvas(vertices: readonly Point[], width: number, height: number, toleranceM: number): boolean {
  const [x0, y0, x1, y1] = bboxOf(vertices);
  return x0 >= -toleranceM && y0 >= -toleranceM && x1 <= width + toleranceM && y1 <= height + toleranceM;
}

export function translateVertices(vertices: readonly Point[], dx: number, dy: number): Point[] {
  return vertices.map(([x, y]) => [x + dx, y + dy] as Point);
}

export function rotateVertices(vertices: readonly Point[], pivot: Point, degrees: number): Point[] {
  const angle = toRadians(degrees);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return vertices.map(([x, y]) => {
    const rx = x - pivot[0];
    const ry = y - pivot[1];
    return [pivot[0] + rx * cosine - ry * sine, pivot[1] + rx * sine + ry * cosine] as Point;
  });
}

/** Redondea a milímetros, la precisión del contrato (`numeric(10,3)`). */
export function roundToMillimeter(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Punto a distancia `offset` sobre una polilínea, con su tangente unitaria. */
export function pointAlongPolyline(
  vertices: readonly Point[],
  offset: number,
): { point: Point; tangent: Point } | null {
  let remaining = offset;
  for (let i = 0; i + 1 < vertices.length; i += 1) {
    const a = vertices[i]!;
    const b = vertices[i + 1]!;
    const length = distance(a, b);
    if (length < EPSILON) continue;
    if (remaining <= length + EPSILON) {
      const t = Math.max(0, Math.min(1, remaining / length));
      return {
        point: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t],
        tangent: [(b[0] - a[0]) / length, (b[1] - a[1]) / length],
      };
    }
    remaining -= length;
  }
  return null;
}

/** Proyección de un punto sobre una polilínea: distancia a lo largo y distancia lateral. */
export function projectOnPolyline(
  vertices: readonly Point[],
  point: Point,
): { offset: number; distance: number; segmentIndex: number } | null {
  let best: { offset: number; distance: number; segmentIndex: number } | null = null;
  let accumulated = 0;
  for (let i = 0; i + 1 < vertices.length; i += 1) {
    const a = vertices[i]!;
    const b = vertices[i + 1]!;
    const length = distance(a, b);
    if (length >= EPSILON) {
      const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * (b[0] - a[0]) + (point[1] - a[1]) * (b[1] - a[1])) / (length * length)));
      const projected: Point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const lateral = distance(point, projected);
      if (best === null || lateral < best.distance) {
        best = { offset: accumulated + t * length, distance: lateral, segmentIndex: i };
      }
    }
    accumulated += length;
  }
  return best;
}
