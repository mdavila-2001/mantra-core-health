import type { ColumnDef } from './data-table.types';

/**
 * Las columnas que no explican qué son (sin `hint`). Pensada para las pruebas de
 * cada pantalla: regla del cliente, **cada columna lleva su «i»**.
 *
 * ```ts
 * expect(columnsWithoutHint(columns())).toEqual([]);
 * ```
 */
export function columnsWithoutHint<Row>(columns: readonly ColumnDef<Row>[]): string[] {
  return columns.filter((c) => (c.hint ?? '').trim().length === 0).map((c) => c.key);
}
