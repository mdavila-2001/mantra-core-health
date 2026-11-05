import type { SortState } from '../../../shared/components/organisms/data-table/data-table.types';

/** Lo que se compara de una fila: un texto, un número o nada. */
export type SortValue = string | number | null | undefined;

/** Cómo se lee, por cada clave de columna ordenable, el valor que la ordena. */
export type SortAccessors<Row> = Readonly<Record<string, (row: Row) => SortValue>>;

/**
 * Ordena en memoria las filas de una tabla del catálogo.
 *
 * Las pantallas del catálogo leen la farmacia entera (hasta 500) y filtran y
 * paginan acá, así que ordenar también es local: la tabla emite la clave de
 * la columna y esto devuelve una copia ordenada. Los textos se comparan como
 * los lee una persona (`es`, sin distinguir mayúsculas ni tildes, «PAR-2»
 * antes que «PAR-10»), los números como números, y **lo vacío va siempre al
 * final**, en las dos direcciones: un producto sin precio no es el más barato.
 *
 * Sin orden, o con una clave sin lector, devuelve las filas tal cual.
 */
export function sortRows<Row>(
  rows: readonly Row[],
  sort: SortState | null,
  accessors: SortAccessors<Row>,
): readonly Row[] {
  const read = sort === null ? undefined : accessors[sort.key];
  if (sort === null || read === undefined) {
    return rows;
  }
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const left = read(a);
    const right = read(b);
    const leftEmpty = isEmpty(left);
    const rightEmpty = isEmpty(right);
    if (leftEmpty || rightEmpty) {
      return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1;
    }
    if (typeof left === 'number' && typeof right === 'number') {
      return (left - right) * factor;
    }
    return String(left).localeCompare(String(right), 'es', { numeric: true, sensitivity: 'base' }) * factor;
  });
}

function isEmpty(value: SortValue): boolean {
  return value === null || value === undefined || value === '' || Number.isNaN(value);
}
