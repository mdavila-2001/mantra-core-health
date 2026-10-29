import { rectVertices } from './geometry';
import { validateLayout, type LayoutShape, type LayoutValidationInput } from './layout-validation';

const rect = (spaceId: string, parentId: string | null, x: number, y: number, w: number, d: number): LayoutShape => ({
  spaceId,
  code: spaceId.toUpperCase(),
  name: `Local ${spaceId}`,
  parentId,
  vertices: rectVertices(x + w / 2, y + d / 2, w, d, 0),
});

function input(shapes: LayoutShape[], extra: Partial<LayoutValidationInput> = {}): LayoutValidationInput {
  return {
    canvas: { widthM: 64, heightM: 26, contactToleranceM: 0.01, anchorSpaceId: 'piso' },
    shapes,
    ...extra,
  };
}

describe('validación local del dibujo', () => {
  it('un dibujo con paredes compartidas y camas dentro de la habitación no tiene errores', () => {
    const issues = validateLayout(
      input([
        rect('area', 'piso', 2, 2, 20, 8.5),
        rect('h1', 'area', 2, 2, 5, 8.5),
        rect('h2', 'area', 7, 2, 5, 8.5),
        rect('cama', 'h1', 3, 3, 1, 2),
      ]),
    );
    expect(issues).toEqual([]);
  });

  it('dos hermanos que se pisan dan PLAN_SIBLING_OVERLAP con el vecino y el área', () => {
    const issues = validateLayout(
      input([rect('area', 'piso', 0, 0, 30, 10), rect('a', 'area', 0, 0, 6, 6), rect('b', 'area', 4, 0, 6, 6)]),
    );
    const overlap = issues.filter((i) => i.code === 'PLAN_SIBLING_OVERLAP');
    expect(overlap).toHaveLength(2);
    const first = overlap.find((i) => i.id === 'a')!;
    expect(first.conflictsWith?.[0]).toMatchObject({ id: 'b', code: 'B' });
    expect(first.conflictsWith?.[0]?.overlapAreaM2).toBeCloseTo(12, 0);
    expect(first.nextAction?.label).toBeTruthy();
  });

  it('los no hermanos pueden estar uno sobre otro (una cama sobre su habitación)', () => {
    const issues = validateLayout(
      input([rect('h1', 'piso', 0, 0, 10, 10), rect('cama', 'h1', 2, 2, 1, 2)]),
    );
    expect(issues).toEqual([]);
  });

  it('un hijo fuera de su padre da PLAN_CHILD_OUTSIDE_PARENT con el padre señalado', () => {
    const issues = validateLayout(input([rect('h1', 'piso', 0, 0, 10, 10), rect('cama', 'h1', 9.5, 2, 1, 2)]));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ id: 'cama', code: 'PLAN_CHILD_OUTSIDE_PARENT' });
    expect(issues[0]!.conflictsWith?.[0]?.id).toBe('h1');
  });

  it('un hijo cuyo padre no está dibujado ni es el ancla da PLAN_PARENT_NOT_PLACED', () => {
    const issues = validateLayout(input([rect('cama', 'otra-sala', 1, 1, 1, 2)]));
    expect(issues[0]).toMatchObject({ id: 'cama', code: 'PLAN_PARENT_NOT_PLACED' });
  });

  it('un local fuera del lienzo da PLAN_OUT_OF_BOUNDS', () => {
    const issues = validateLayout(input([rect('a', 'piso', 60, 0, 10, 5)]));
    expect(issues[0]).toMatchObject({ code: 'PLAN_OUT_OF_BOUNDS' });
  });

  it('una figura inválida da PLAN_GEOMETRY_INVALID y no revienta el resto', () => {
    const bowtie: LayoutShape = {
      spaceId: 'x',
      code: 'X',
      name: 'X',
      parentId: 'piso',
      vertices: [
        [0, 0],
        [4, 4],
        [4, 0],
        [0, 4],
      ],
    };
    const issues = validateLayout(input([bowtie, rect('a', 'piso', 10, 10, 3, 3)]));
    expect(issues.map((i) => i.code)).toEqual(['PLAN_GEOMETRY_INVALID']);
  });

  it('con focusIds solo revisa lo que toca lo que se arrastra (y a su vecino de solape)', () => {
    const shapes = [rect('a', 'piso', 0, 0, 6, 6), rect('b', 'piso', 4, 0, 6, 6), rect('c', 'piso', 20, 0, 6, 6), rect('d', 'piso', 24, 0, 6, 6)];
    const all = validateLayout(input(shapes));
    const focused = validateLayout(input(shapes), new Set(['c']));
    expect(all.map((i) => i.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(focused.map((i) => i.id).sort()).toEqual(['c', 'd']);
  });

  it('una puerta que no cabe en su muro da PLAN_OPENING_OUTSIDE_WALL', () => {
    const issues = validateLayout(
      input([], {
        walls: [{ id: 'm1', vertices: [[0, 0], [3, 0]] }],
        openings: [
          { id: 'p1', hostId: 'm1', offsetM: 0.5, widthM: 1 },
          { id: 'p2', hostId: 'm1', offsetM: 2.5, widthM: 1 },
          { id: 'p3', hostId: 'no-existe', offsetM: 0, widthM: 1 },
        ],
      }),
    );
    expect(issues.map((i) => [i.id, i.code])).toEqual([
      ['p2', 'PLAN_OPENING_OUTSIDE_WALL'],
      ['p3', 'PLAN_HOST_NOT_WALL'],
    ]);
  });

  it('rinde con 1 600 locales contiguos (medido, no supuesto)', () => {
    const shapes: LayoutShape[] = [];
    for (let i = 0; i < 1600; i += 1) {
      shapes.push(rect(`s${i}`, 'piso', (i % 40) * 1.5, Math.floor(i / 40) * 0.6, 1.5, 0.6));
    }
    const started = performance.now();
    const issues = validateLayout({ canvas: { widthM: 64, heightM: 26, contactToleranceM: 0.01, anchorSpaceId: 'piso' }, shapes });
    const elapsed = performance.now() - started;
    expect(issues).toEqual([]);
    // Cota generosa: se informa el número real en el REPORTE, esto solo evita una regresión grosera.
    expect(elapsed).toBeLessThan(8000);
  });
});
