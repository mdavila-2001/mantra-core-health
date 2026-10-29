import { GridIndex } from './spatial-index';
import { nextInDirection, readingOrder, type NavItem } from './spatial-nav';
import { snapPoint, snapToGrid } from './snap';

describe('índice de rejilla', () => {
  it('devuelve solo lo que toca la ventana, sin repetir lo que cruza varias celdas', () => {
    const index = new GridIndex(100, 100, 10);
    index.insert('grande', [0, 0, 55, 5]);
    index.insert('lejos', [90, 90, 95, 95]);
    index.insert('cerca', [20, 0, 25, 4]);
    expect(index.query([18, 0, 30, 10]).sort()).toEqual(['cerca', 'grande']);
    expect(index.query([0, 0, 100, 100]).sort()).toEqual(['cerca', 'grande', 'lejos']);
    expect(index.query([60, 60, 70, 70])).toEqual([]);
  });

  it('una caja fuera del lienzo no rompe el índice', () => {
    const index = new GridIndex(50, 50, 10);
    index.insert('fuera', [-5, -5, 60, 2]);
    expect(index.query([0, 0, 5, 5])).toEqual(['fuera']);
  });

  it('resuelve 1 600 locales contiguos con una consulta de ventana rápida', () => {
    const index = new GridIndex(160, 160, 8);
    for (let i = 0; i < 1600; i += 1) {
      const x = (i % 40) * 4;
      const y = Math.floor(i / 40) * 4;
      index.insert(`s${i}`, [x, y, x + 4, y + 4]);
    }
    const started = performance.now();
    const hits = index.query([0, 0, 12, 12]);
    expect(performance.now() - started).toBeLessThan(50);
    expect(hits.length).toBe(16);
  });
});

describe('navegación espacial por teclado', () => {
  // Una grilla de 3 × 2:   a b c  /  d e f
  const items: NavItem[] = [
    { id: 'a', bbox: [0, 0, 4, 4] },
    { id: 'b', bbox: [4, 0, 8, 4] },
    { id: 'c', bbox: [8, 0, 12, 4] },
    { id: 'd', bbox: [0, 4, 4, 8] },
    { id: 'e', bbox: [4, 4, 8, 8] },
    { id: 'f', bbox: [8, 4, 12, 8] },
  ];

  it('las flechas van al vecino alineado', () => {
    expect(nextInDirection('a', 'right', items)).toBe('b');
    expect(nextInDirection('b', 'down', items)).toBe('e');
    expect(nextInDirection('e', 'left', items)).toBe('d');
    expect(nextInDirection('f', 'up', items)).toBe('c');
  });

  it('en el borde no da la vuelta: devuelve null', () => {
    expect(nextInDirection('a', 'left', items)).toBeNull();
    expect(nextInDirection('a', 'up', items)).toBeNull();
    expect(nextInDirection('f', 'right', items)).toBeNull();
  });

  it('prefiere el alineado sobre uno apenas más cerca pero en diagonal', () => {
    const mixed: NavItem[] = [
      { id: 'origen', bbox: [0, 0, 4, 4] },
      { id: 'diagonal', bbox: [3, 6, 7, 10] }, // avance 3 en x, 6 en y
      { id: 'alineado', bbox: [10, 0, 14, 4] }, // avance 10 en x, 0 lateral
    ];
    expect(nextInDirection('origen', 'right', mixed)).toBe('alineado');
  });

  it('un id desconocido no navega', () => {
    expect(nextInDirection('zzz', 'right', items)).toBeNull();
  });

  it('el orden de lectura va por franjas de arriba abajo y de izquierda a derecha', () => {
    const shuffled = [items[4]!, items[0]!, items[5]!, items[2]!, items[3]!, items[1]!];
    expect(readingOrder(shuffled, 2)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });
});

describe('snap', () => {
  it('redondea a la grilla', () => {
    expect(snapToGrid(1.26, 0.5)).toBe(1.5);
    expect(snapToGrid(1.24, 0.5)).toBe(1);
    expect(snapToGrid(7.3, 0)).toBe(7.3);
  });

  it('el vértice de un vecino gana sobre la grilla', () => {
    const result = snapPoint([10.03, 4.02], { gridSizeM: 0.5, vertices: [[10.04, 4.01]], radiusM: 0.2 });
    expect(result.kind).toBe('vertex');
    expect(result.point).toEqual([10.04, 4.01]);
  });

  it('se imanta a una arista y cae sobre ella', () => {
    const result = snapPoint([5, 1.1], { gridSizeM: null, edges: [[[0, 1], [10, 1]]], radiusM: 0.3 });
    expect(result.kind).toBe('edge');
    expect(result.point[1]).toBeCloseTo(1, 9);
  });

  it('Alt suspende el snap y Shift fuerza ortogonal', () => {
    expect(snapPoint([1.26, 3.3], { gridSizeM: 0.5, radiusM: 1, suspended: true }).kind).toBe('none');
    const orth = snapPoint([5, 1], { gridSizeM: null, radiusM: 0.1, orthogonalFrom: [0, 0] });
    expect(orth.point).toEqual([5, 0]);
  });

  it('sin nada a qué imantar deja el punto en paz', () => {
    expect(snapPoint([1.234, 5.678], { gridSizeM: null, radiusM: 0.1 })).toEqual({ point: [1.234, 5.678], kind: 'none' });
  });
});
