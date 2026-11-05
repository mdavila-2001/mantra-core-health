import type {
  BulkCategoryRow,
  BulkEntity,
  BulkPriceRow,
  BulkSiteRow,
} from '../../../../core/data-access/pharmacy/pharmacy-bulk.types';
import { BULK_MAX_ROWS } from '../../../../core/data-access/pharmacy/pharmacy-bulk.types';
import {
  ArchivoInvalido,
  leerTablaCsv,
  parsePrice,
  withoutAccents,
} from '../../catalog-rules/catalog.rules';

/* ============================================================================
    Los CSV de categorías, precios y sucursales de la pestaña «Importación».

    Los encabezados van en castellano, como el de productos:

    - categorías: `nombre`;
    - precios: `codigo,precio`;
    - sucursales: `codigo,nombre,direccion,latitud,longitud,retiro,envio`, con
      `si`/`no` en retiro y envío.

    Esta capa sólo lleva cada renglón a la fila que espera la API: un número
    con coma decimal, un `si`/`no`. Qué fila vale lo decide el servidor en la
    vista previa (`dryRun`): un nombre vacío, un código que no existe o una
    latitud sin longitud vuelven rechazados con su motivo. Lo que se frena acá
    es lo que no se puede ni mandar (un precio o una latitud que no son un
    número) y la **clave repetida en el archivo**, con su línea.

    La clave repetida se frena acá porque el servidor sólo la ve dentro de un
    pedido y el archivo viaja en lotes de 250: una clave que caía en dos lotes
    se aplicaba dos veces (la segunda pisaba a la primera) mientras la vista
    previa la daba por buena. La regla es la del asistente de productos: no se
    manda **ninguna** de las filas repetidas, porque elegir una por el orden
    sería decidir en silencio cuál vale.
    ========================================================================== */

/** Lo que importa el componente genérico; los productos tienen su propio asistente. */
export type ImportEntity = Exclude<BulkEntity, 'products'>;

export type EntityRowPayload = BulkCategoryRow | BulkPriceRow | BulkSiteRow;

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
  prices: [
    { header: 'codigo', description: 'Obligatorio. El código de un producto de su catálogo.', required: true },
    { header: 'precio', description: 'Obligatorio. En Bs, con punto o coma. Ej. 18,50.', required: true },
  ],
  sites: [
    { header: 'codigo', description: 'Obligatorio. Único en su farmacia.', required: true },
    { header: 'nombre', description: 'Obligatorio. Ej. Sucursal Sur.', required: true },
    { header: 'direccion', description: 'Calle y número (sólo al crear).', required: false },
    { header: 'latitud', description: 'Ej. -17,7833 (sólo al crear, junto con la longitud).', required: false },
    { header: 'longitud', description: 'Ej. -63,1821 (sólo al crear, junto con la latitud).', required: false },
    { header: 'retiro', description: 'si / no: si se puede retirar en mostrador.', required: false },
    { header: 'envio', description: 'si / no: si hace envíos a domicilio.', required: false },
  ],
};

/** Las filas de ejemplo de cada plantilla, en el orden de sus columnas. */
export const ENTITY_TEMPLATE_ROWS: Readonly<Record<ImportEntity, readonly (readonly string[])[]>> = {
  categories: [['Vitaminas'], ['Cuidado del bebé']],
  prices: [
    ['PAR-500-20', '18,50'],
    ['AMX-500-21', '42'],
  ],
  sites: [
    ['SUR', 'Sucursal Sur', 'Av. Ejemplo 123', '-17,7833', '-63,1821', 'si', 'no'],
    ['NORTE-2', 'Sucursal Norte 2', '', '', '', 'si', 'si'],
  ],
};

export const ENTITY_TEMPLATE_FILENAME: Readonly<Record<ImportEntity, string>> = {
  categories: 'plantilla-categorias.csv',
  prices: 'plantilla-precios.csv',
  sites: 'plantilla-sucursales.csv',
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
    rows: markRepeatedKeys(entity, rows),
    ignored: table.encabezados.filter((header) => !known.has(header)),
  };
}

/** Largo máximo de un nombre de categoría; más largo no tiene clave (lo rechaza el servidor). */
const CATEGORY_NAME_MAX = 60;

/**
 * La clave de upsert de una fila, la misma que usa el servidor para
 * `DUPLICATE_IN_FILE` (`keyOf` de cada manejador de la carga masiva):
 *
 * - categorías: el nombre sin espacios de más, mayúsculas ni tildes;
 * - precios: el código del producto, tal cual (distingue mayúsculas);
 * - sucursales: el código de la sede, tal cual.
 *
 * `null` si la fila no tiene clave: la vacía o la de un nombre demasiado largo
 * se mandan igual y las rechaza el servidor con su motivo.
 */
export function upsertKeyOf(entity: ImportEntity, payload: EntityRowPayload): string | null {
  if (entity === 'categories') {
    const name = (payload as BulkCategoryRow).name.trim().replace(/\s+/g, ' ');
    return name.length >= 1 && name.length <= CATEGORY_NAME_MAX ? withoutAccents(name) : null;
  }
  const code =
    entity === 'prices' ? (payload as BulkPriceRow).productCode : (payload as BulkSiteRow).code;
  return code.trim() === '' ? null : code.trim();
}

/**
 * Frena **todas** las filas que comparten su clave con otra **del archivo
 * entero**, no sólo del lote. Sólo cuentan las filas que se mandarían: una que
 * no sale (un precio ilegible) ya tiene su error y el servidor nunca la vería.
 */
function markRepeatedKeys(entity: ImportEntity, rows: readonly EntityCsvRow[]): EntityCsvRow[] {
  const linesOf = new Map<string, number[]>();
  const keys = rows.map((row) => (row.payload === null ? null : upsertKeyOf(entity, row.payload)));
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
  prices: (cell) => {
    const productCode = cell('codigo');
    const price = parsePrice(cell('precio'));
    if (price === 'invalido') {
      return {
        key: productCode,
        payload: null,
        errors: ['El precio va en Bs, mayor que 0, con punto o coma y hasta dos decimales (sin separador de miles).'],
      };
    }
    // Un precio vacío viaja igual: el servidor dice que falta, con su motivo.
    return { key: productCode, payload: { productCode, unitPrice: price ?? '' }, errors: [] };
  },
  sites: (cell) => {
    const errors: string[] = [];
    const latitude = coordinate(cell('latitud'), 'La latitud', errors);
    const longitude = coordinate(cell('longitud'), 'La longitud', errors);
    const pickup = yesNo(cell('retiro'), '«retiro»', errors);
    const delivery = yesNo(cell('envio'), '«envio»', errors);
    const address = cell('direccion');
    const payload: BulkSiteRow = {
      code: cell('codigo'),
      name: cell('nombre'),
      ...(address === '' ? {} : { addressLines: address }),
      ...(latitude === null ? {} : { latitude }),
      ...(longitude === null ? {} : { longitude }),
      ...(pickup === null ? {} : { pickupAvailable: pickup }),
      ...(delivery === null ? {} : { homeDeliveryAvailable: delivery }),
    };
    return { key: payload.code, payload: errors.length === 0 ? payload : null, errors };
  },
};

/** Un número con punto o coma decimal; `null` si está vacío. */
function coordinate(text: string, label: string, errors: string[]): number | null {
  if (text === '') {
    return null;
  }
  const value = /^-?\d+([.,]\d+)?$/.test(text) ? Number(text.replace(',', '.')) : Number.NaN;
  if (Number.isNaN(value)) {
    errors.push(`${label} tiene que ser un número, con punto o coma decimal.`);
    return null;
  }
  return value;
}

const YES = new Set(['si', 'sí', 's', 'true', '1', 'x', 'yes']);
const NO = new Set(['no', 'n', 'false', '0']);

/** `si`/`no` en cualquiera de sus grafías; `null` si está vacío. */
function yesNo(text: string, label: string, errors: string[]): boolean | null {
  const value = text.toLowerCase();
  if (value === '') {
    return null;
  }
  if (YES.has(value) || NO.has(value)) {
    return YES.has(value);
  }
  errors.push(`${label} se responde con si o no.`);
  return null;
}
