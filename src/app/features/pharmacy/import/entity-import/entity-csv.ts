import type { BulkCategoryRow } from '../../../../core/data-access/pharmacy/pharmacy-bulk.types';
import { BULK_MAX_ROWS } from '../../../../core/data-access/pharmacy/pharmacy-bulk.types';
import { ArchivoInvalido, leerTablaCsv, withoutAccents } from '../../catalog-rules/catalog.rules';

/* ============================================================================
    The categories CSV of the catalog «Importar CSV» modal: one `nombre` column.
    Prices travel in the products file (`codigo,precio`), so the generic
    import only handles categories.

    This layer only turns each line into the row the API expects; which row
    is valid is decided by the server preview (`dryRun`). What is stopped here
    is a **key repeated in the file**, with its lines: the server only sees
    repeats inside one request and the file travels in batches of 250, so a
    key split across two batches was applied twice. As in the products
    wizard, none of the repeated rows is sent.
    ========================================================================== */

/** Lo que importa el componente genérico; los productos tienen su propio asistente. */
export type ImportEntity = 'categories';

export type EntityRowPayload = BulkCategoryRow;

/** Una columna del archivo: su encabezado y lo que se escribe en ella. */
export interface EntityColumn {
  readonly header: string;
  readonly description: string;
  /** Sin esta columna el archivo no se puede usar. */
  readonly required: boolean;
}

export const ENTITY_COLUMNS: Readonly<Record<ImportEntity, readonly EntityColumn[]>> = {
  categories: [
    { header: 'nombre', description: 'Obligatorio. Otra grafía del mismo nombre la renombra.', required: true },
  ],
};

/** Las filas de ejemplo de cada plantilla, en el orden de sus columnas. */
export const ENTITY_TEMPLATE_ROWS: Readonly<Record<ImportEntity, readonly (readonly string[])[]>> = {
  categories: [['Vitaminas'], ['Cuidado del bebé']],
};

export const ENTITY_TEMPLATE_FILENAME: Readonly<Record<ImportEntity, string>> = {
  categories: 'plantilla-categorias.csv',
};

/** Un renglón del archivo, listo para mandar o frenado acá con su motivo. */
export interface EntityCsvRow {
  /** La línea del archivo (el encabezado es la 1). */
  readonly line: number;
  /** Lo que identifica la fila para la persona: el nombre o el código. */
  readonly key: string;
  /** La fila para la API; `null` si no se puede mandar. */
  readonly payload: EntityRowPayload | null;
  /** Por qué no se puede mandar; vacío si se manda. */
  readonly errors: readonly string[];
  /**
   * Sólo si otra fila del archivo trae la misma clave: las líneas de todas
   * ellas. Ninguna se manda (`payload` es `null`).
   */
  readonly repeatedOnLines?: readonly number[];
}

export interface EntityCsvReading {
  readonly rows: readonly EntityCsvRow[];
  /** Encabezados que no son de esta plantilla: se avisan y se ignoran. */
  readonly ignored: readonly string[];
}

/**
 * Lee el CSV de una entidad. Lanza {@link ArchivoInvalido} si el archivo no se
 * puede usar en absoluto (vacío, sin una columna obligatoria, más de 1000
 * filas); los problemas de una fila no lanzan: quedan en sus `errors`.
 */
export function readEntityCsv(entity: ImportEntity, content: string): EntityCsvReading {
  const table = leerTablaCsv(content, BULK_MAX_ROWS);
  const columns = ENTITY_COLUMNS[entity];
  const missing = columns.find((column) => column.required && !table.encabezados.includes(column.header));
  if (missing !== undefined) {
    throw new ArchivoInvalido(
      `Falta la columna «${missing.header}». Descargue la plantilla para ver los encabezados.`,
    );
  }
  const known = new Set(columns.map((column) => column.header));
  const rows = table.renglones.map(({ linea, celdas }): EntityCsvRow => {
    const cell = (header: string): string => {
      const index = table.encabezados.indexOf(header);
      return index === -1 ? '' : (celdas[index] ?? '').trim();
    };
    return { line: linea, ...ROW_READERS[entity](cell) };
  });
  return {
    rows: markRepeatedKeys(rows),
    ignored: table.encabezados.filter((header) => !known.has(header)),
  };
}

/** Largo máximo de un nombre de categoría; más largo no tiene clave (lo rechaza el servidor). */
const CATEGORY_NAME_MAX = 60;

/**
 * The upsert key of a row, the same the server uses for `DUPLICATE_IN_FILE`:
 * the name without extra spaces, case or accents. `null` when the row has no
 * key (empty or too long): it is sent anyway and the server rejects it.
 */
export function upsertKeyOf(payload: EntityRowPayload): string | null {
  const name = payload.name.trim().replace(/\s+/g, ' ');
  return name.length >= 1 && name.length <= CATEGORY_NAME_MAX ? withoutAccents(name) : null;
}

/**
 * Frena **todas** las filas que comparten su clave con otra **del archivo
 * entero**, no sólo del lote. Sólo cuentan las filas que se mandarían: una que
 * no sale ya tiene su error y el servidor nunca la vería.
 */
function markRepeatedKeys(rows: readonly EntityCsvRow[]): EntityCsvRow[] {
  const linesOf = new Map<string, number[]>();
  const keys = rows.map((row) => (row.payload === null ? null : upsertKeyOf(row.payload)));
  keys.forEach((key, index) => {
    if (key !== null) {
      linesOf.set(key, [...(linesOf.get(key) ?? []), rows[index]!.line]);
    }
  });
  return rows.map((row, index) => {
    const lines = keys[index] === null ? undefined : linesOf.get(keys[index]!);
    if (lines === undefined || lines.length < 2) {
      return row;
    }
    return {
      ...row,
      payload: null,
      errors: [
        `La misma clave está en las líneas ${lines.join(', ')}: no se envía ninguna. Deje una sola.`,
      ],
      repeatedOnLines: lines,
    };
  });
}

type RowReader = (cell: (header: string) => string) => Omit<EntityCsvRow, 'line'>;

const ROW_READERS: Readonly<Record<ImportEntity, RowReader>> = {
  categories: (cell) => ({ key: cell('nombre'), payload: { name: cell('nombre') }, errors: [] }),
};
