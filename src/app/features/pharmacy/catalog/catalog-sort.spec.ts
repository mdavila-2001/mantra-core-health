import { describe, expect, it } from 'vitest';

import { sortRows, type SortAccessors } from './catalog-sort';

interface Row {
  readonly name: string;
  readonly price: number | null;
}

const ROWS: readonly Row[] = [
  { name: 'Ibuprofeno', price: 12 },
  { name: 'amoxicilina', price: null },
  { name: 'Ácido fólico', price: 3.5 },
  { name: 'Paracetamol 10', price: 30 },
  { name: 'Paracetamol 2', price: 9 },
];

const ACCESSORS: SortAccessors<Row> = {
  name: (row) => row.name,
  price: (row) => row.price,
};

const names = (rows: readonly Row[]): string[] => rows.map((row) => row.name);

describe('sortRows', () => {
  it('sin orden devuelve las filas tal cual, sin copiarlas', () => {
    expect(sortRows(ROWS, null, ACCESSORS)).toBe(ROWS);
  });

  it('con una clave sin lector tampoco toca nada', () => {
    expect(sortRows(ROWS, { key: 'actions', direction: 'asc' }, ACCESSORS)).toBe(ROWS);
  });

  it('ordena textos como los lee una persona: sin mayúsculas ni tildes, y 2 antes que 10', () => {
    expect(names(sortRows(ROWS, { key: 'name', direction: 'asc' }, ACCESSORS))).toEqual([
      'Ácido fólico',
      'amoxicilina',
      'Ibuprofeno',
      'Paracetamol 2',
      'Paracetamol 10',
    ]);
    expect(names(sortRows(ROWS, { key: 'name', direction: 'desc' }, ACCESSORS))[0]).toBe('Paracetamol 10');
  });

  it('ordena números como números y deja lo vacío al final en las dos direcciones', () => {
    expect(sortRows(ROWS, { key: 'price', direction: 'asc' }, ACCESSORS).map((row) => row.price)).toEqual([
      3.5, 9, 12, 30, null,
    ]);
    expect(sortRows(ROWS, { key: 'price', direction: 'desc' }, ACCESSORS).map((row) => row.price)).toEqual([
      30, 12, 9, 3.5, null,
    ]);
  });

  it('no cambia el arreglo de entrada', () => {
    const before = names(ROWS);
    sortRows(ROWS, { key: 'name', direction: 'desc' }, ACCESSORS);
    expect(names(ROWS)).toEqual(before);
  });
});
