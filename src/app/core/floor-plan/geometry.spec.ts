import {
  bboxOf,
  containedWithin,
  contactOverlapArea,
  insetPolygon,
  intersectionArea,
  pointAlongPolyline,
  pointInPolygon,
  polygonArea,
  projectOnPolyline,
  rectVertices,
  rotateVertices,
  signedArea,
  triangulate,
  validatePolygon,
  withinCanvas,
  type Point,
} from './geometry';

const square = (x: number, y: number, size: number): Point[] => [
  [x, y],
  [x + size, y],
  [x + size, y + size],
  [x, y + size],
];

/** Una L: cuadrado de 10 con la esquina superior derecha de 5×5 recortada. */
const L: Point[] = [
  [0, 0],
  [5, 0],
  [5, 5],
  [10, 5],
  [10, 10],
  [0, 10],
];

describe('geometría del plano', () => {
  describe('rectángulos', () => {
    it('un rectángulo sin rotar tiene sus cuatro esquinas y el área de ancho × fondo', () => {
      const v = rectVertices(5, 3, 4, 2, 0);
      expect(v).toEqual([
        [3, 2],
        [7, 2],
        [7, 4],
        [3, 4],
      ]);
      expect(polygonArea(v)).toBeCloseTo(8, 9);
    });

    it('rotar 90° horario en pantalla lleva la esquina superior izquierda a la superior derecha', () => {
      const [first] = rectVertices(0, 0, 4, 2, 90);
      // (-2,-1) rotado 90° horario con y abajo => (1,-2)
      expect(first![0]).toBeCloseTo(1, 9);
      expect(first![1]).toBeCloseTo(-2, 9);
    });

    it('rotar no cambia el área', () => {
      expect(polygonArea(rectVertices(10, 10, 6, 3, 37))).toBeCloseTo(18, 9);
    });

    it('el recorrido es horario en pantalla: área con signo positiva', () => {
      expect(signedArea(rectVertices(0, 0, 2, 2, 0))).toBeGreaterThan(0);
    });
  });

  describe('polígonos simples (INV-PL-02)', () => {
    it('acepta un cuadrado y una L', () => {
      expect(validatePolygon(square(0, 0, 4))).toBeNull();
      expect(validatePolygon(L)).toBeNull();
    });

    it('rechaza menos de tres vértices', () => {
      expect(
        validatePolygon([
          [0, 0],
          [1, 1],
        ]),
      ).toBe('TOO_FEW_VERTICES');
    });

    it('rechaza una corbata (aristas que se cruzan)', () => {
      expect(
        validatePolygon([
          [0, 0],
          [4, 4],
          [4, 0],
          [0, 4],
        ]),
      ).toBe('SELF_INTERSECTION');
    });

    it('rechaza un vértice repetido', () => {
      expect(
        validatePolygon([
          [0, 0],
          [4, 0],
          [4, 0],
          [4, 4],
        ]),
      ).toBe('REPEATED_VERTEX');
    });

    it('rechaza un giro de 180° (tres puntos alineados)', () => {
      expect(
        validatePolygon([
          [0, 0],
          [2, 0],
          [4, 0],
          [4, 4],
        ]),
      ).toBe('STRAIGHT_ANGLE');
    });

    it('rechaza más de 64 vértices', () => {
      const many: Point[] = Array.from({ length: 65 }, (_, i) => {
        const a = (i / 65) * Math.PI * 2;
        return [50 + 40 * Math.cos(a), 50 + 40 * Math.sin(a)] as Point;
      });
      expect(validatePolygon(many)).toBe('TOO_MANY_VERTICES');
    });

    it('rechaza coordenadas fuera de ±100 000 m', () => {
      expect(
        validatePolygon([
          [0, 0],
          [200_000, 0],
          [0, 5],
        ]),
      ).toBe('NON_FINITE');
    });
  });

  describe('área, contención y punto dentro', () => {
    it('calcula el área de una L', () => {
      expect(polygonArea(L)).toBeCloseTo(75, 9);
    });

    it('el punto en la muesca de la L está fuera; en el brazo, dentro', () => {
      expect(pointInPolygon([8, 2], L)).toBe(false);
      expect(pointInPolygon([2, 2], L)).toBe(true);
      expect(pointInPolygon([8, 8], L)).toBe(true);
    });

    it('un punto sobre el borde cuenta con holgura', () => {
      expect(pointInPolygon([10.001, 8], L, 0.01)).toBe(true);
      expect(pointInPolygon([10.5, 8], L, 0.01)).toBe(false);
    });

    it('triangular una L cubre exactamente su área', () => {
      const total = triangulate(L).reduce((acc, t) => acc + polygonArea(t), 0);
      expect(total).toBeCloseTo(75, 9);
    });

    it('límites del lienzo con tolerancia de contacto', () => {
      expect(withinCanvas(square(0, 0, 10), 10, 10, 0.01)).toBe(true);
      expect(withinCanvas(square(0.005, -0.005, 10), 10, 10, 0.01)).toBe(true);
      expect(withinCanvas(square(1, 0, 10), 10, 10, 0.01)).toBe(false);
    });

    it('un local cabe en su padre y uno que sobresale no', () => {
      const parent = square(0, 0, 10);
      expect(containedWithin(square(2, 2, 3), parent, 0.01)).toBe(true);
      expect(containedWithin(square(8, 8, 3), parent, 0.01)).toBe(false);
    });

    it('un hijo pegado al borde del padre cabe (pared compartida)', () => {
      expect(containedWithin(square(0, 0, 3), square(0, 0, 10), 0.01)).toBe(true);
    });
  });

  describe('intersección y solape con tolerancia de contacto (INV-PL-04)', () => {
    it('intersección de dos cuadrados desplazados', () => {
      expect(intersectionArea(square(0, 0, 4), square(2, 2, 4))).toBeCloseTo(4, 9);
    });

    it('dos locales con pared compartida se tocan y no se solapan', () => {
      expect(contactOverlapArea(square(0, 0, 4), square(4, 0, 4), 0.01)).toBe(0);
    });

    it('un traslape de 0,5 cm queda dentro de la tolerancia de 1 cm', () => {
      expect(contactOverlapArea(square(0, 0, 4), square(3.995, 0, 4), 0.01)).toBe(0);
    });

    it('un traslape de 1 m se reporta con su área', () => {
      expect(contactOverlapArea(square(0, 0, 4), square(3, 0, 4), 0.01)).toBeCloseTo(4 * 1 - 0.02 * 3.98 - 0, 1);
    });

    it('un local dentro de la muesca de la L no se solapa (exacto, no por caja envolvente)', () => {
      const inNotch = square(6, 0.5, 3);
      // La caja envolvente de la L cubre la muesca; el solape exacto no.
      expect(contactOverlapArea(L, inNotch, 0.01)).toBe(0);
    });

    it('un local que entra al brazo de la L sí se solapa', () => {
      expect(contactOverlapArea(L, square(4, 4, 3), 0.01)).toBeGreaterThan(0.5);
    });

    it('un solape entre figuras rotadas se detecta', () => {
      const a = rectVertices(5, 5, 6, 2, 45);
      const b = rectVertices(5, 5, 6, 2, -45);
      expect(contactOverlapArea(a, b, 0.01)).toBeGreaterThan(1);
    });
  });

  describe('achicar un polígono', () => {
    it('achicar un cuadrado de 4 por 0,5 deja uno de 3 × 3', () => {
      const inner = insetPolygon(square(0, 0, 4), 0.5)!;
      expect(polygonArea(inner)).toBeCloseTo(9, 9);
      expect(bboxOf(inner)).toEqual([0.5, 0.5, 3.5, 3.5]);
    });

    it('si la figura desaparece devuelve null', () => {
      expect(insetPolygon(square(0, 0, 1), 0.6)).toBeNull();
    });

    it('funciona igual con el recorrido en sentido contrario', () => {
      const inner = insetPolygon([...square(0, 0, 4)].reverse(), 0.5)!;
      expect(polygonArea(inner)).toBeCloseTo(9, 9);
    });
  });

  describe('polilíneas y rotación', () => {
    const wall: Point[] = [
      [0, 0],
      [10, 0],
      [10, 5],
    ];

    it('ubica un punto a una distancia a lo largo del muro', () => {
      expect(pointAlongPolyline(wall, 12)!.point).toEqual([10, 2]);
      expect(pointAlongPolyline(wall, 3)!.tangent).toEqual([1, 0]);
      expect(pointAlongPolyline(wall, 99)).toBeNull();
    });

    it('proyecta un punto sobre el muro: offset y distancia lateral', () => {
      const projection = projectOnPolyline(wall, [4, 2])!;
      expect(projection.offset).toBeCloseTo(4, 9);
      expect(projection.distance).toBeCloseTo(2, 9);
    });

    it('rotar 90° alrededor del centro conserva el área', () => {
      const rotated = rotateVertices(square(0, 0, 4), [2, 2], 90);
      expect(polygonArea(rotated)).toBeCloseTo(16, 9);
    });
  });
});
