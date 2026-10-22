import type {
  PharmacyInventoryLine,
  PharmacyProduct,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import {
  ArchivoInvalido,
  leerTablaCsv,
  withoutAccents,
} from '../catalog-rules/catalog.rules';
import { productName, productStatus } from '../products/product-view';

/** Tope de existencias y de umbral: el mismo del servidor. */
export const INVENTORY_STOCK_MAX = 1_000_000;
/** Umbral que se asume mientras la farmacia no fije el suyo. */
export const INVENTORY_DEFAULT_MINIMUM = 5;

/** Los encabezados que se entienden, ya normalizados (`Stock mínimo` → `stock_minimo`). */
const HEADERS = {
  code: ['codigo', 'sku', 'code', 'codigo_interno'],
  stock: ['existencias', 'stock', 'cantidad', 'unidades'],
  minimum: ['umbral', 'minimo', 'stock_minimo', 'umbral_de_alerta', 'alerta'],
  available: ['disponible', 'hay', 'disponibilidad', 'en_stock'],
} as const;

type Field = keyof typeof HEADERS;

const YES = new Set(['si', 's', 'sí', '1', 'true', 'x', 'yes', 'hay', 'disponible', 'con stock', 'en stock']);
const NO = new Set(['no', 'n', '0', 'false', 'agotado', 'no hay', 'sin stock', 'no disponible']);

/** Por qué una fila no se va a mandar. */
export type InventoryCsvProblemCode =
  | 'NOT_IN_CATALOG'
  | 'DUPLICATE'
  | 'EMPTY_ROW'
  | 'INVALID_STOCK'
  | 'INVALID_MINIMUM'
  | 'INVALID_AVAILABLE'
  | 'CONTRADICTION';

export interface InventoryCsvProblem {
  /** La línea del archivo (la 1 es el encabezado). */
  readonly line: number;
  readonly code: string;
  readonly problem: InventoryCsvProblemCode;
  readonly message: string;
}

export interface InventoryCsvReview {
  /** Lo que cambia de verdad: se manda tal cual a `PATCH …/inventory`. */
  readonly lines: readonly PharmacyInventoryLine[];
  /** Filas válidas que no cambian nada respecto de lo que hay. */
  readonly unchanged: number;
  readonly problems: readonly InventoryCsvProblem[];
  /** Columnas del archivo que no se entienden y se ignoran. */
  readonly ignoredColumns: readonly string[];
  /** Con qué columnas vino el archivo, para decirlo en pantalla. */
  readonly columns: readonly Field[];
}

/**
 * Revisa un CSV de inventario contra el catálogo **antes de mandar nada**.
 *
 * ## Qué entiende
 *
 * Una columna de código (`codigo`, `sku`…) y una o más de: `existencias`
 * (entero), `umbral` (entero) y `disponible` (sí/no, hay/no hay, agotado…).
 * Con `existencias` la fila lleva cantidades; con sólo `disponible`, es el
 * booleano «hay / no hay» sin conteo. Si el archivo trae las dos y se
 * contradicen (`existencias` 0 y «sí hay», o 20 y «no hay»), la fila se rechaza:
 * elegir por la persona sería adivinar.
 *
 * ## Qué hace con lo que ya está igual
 *
 * Las filas idénticas a lo cargado no se mandan y se cuentan aparte, así el
 * informe de un archivo que es el inventario exportado sin tocar dice «0
 * cambios» y no «300 actualizaciones».
 *
 * Los retirados no se pueden actualizar: no tienen inventario que llevar, y
 * responden como un código que no está.
 *
 * Lanza {@link ArchivoInvalido} cuando el archivo entero no sirve.
 */
export function reviewInventoryCsv(
  content: string,
  products: readonly PharmacyProduct[],
): InventoryCsvReview {
  const table = leerTablaCsv(content);
  const columnOf = (field: Field): number =>
    table.encabezados.findIndex((header) => (HEADERS[field] as readonly string[]).includes(header));
  const index: Record<Field, number> = {
    code: columnOf('code'),
    stock: columnOf('stock'),
    minimum: columnOf('minimum'),
    available: columnOf('available'),
  };

  if (index.code < 0) {
    throw new ArchivoInvalido('Falta la columna «codigo». Descargue el inventario para ver los encabezados.');
  }
  const columns = (['stock', 'minimum', 'available'] as const).filter((field) => index[field] >= 0);
  if (columns.length === 0) {
    throw new ArchivoInvalido('Falta qué actualizar: agregue «existencias», «umbral» o «disponible».');
  }
  // «producto» es el nombre que trae el archivo exportado: se entiende y no se usa.
  const nameColumn = table.encabezados.findIndex((header) => ['producto', 'nombre', 'name'].includes(header));
  const understood = new Set([...Object.values(index), nameColumn].filter((position) => position >= 0));
  const ignoredColumns = table.encabezados.filter((_, position) => !understood.has(position));

  const alive = new Map(
    products
      .filter((product) => productStatus(product) !== 'WITHDRAWN')
      .map((product) => [product.productCode.trim().toLowerCase(), product] as const),
  );

  const lines: PharmacyInventoryLine[] = [];
  const problems: InventoryCsvProblem[] = [];
  const seen = new Set<string>();
  let unchanged = 0;

  for (const row of table.renglones) {
    const cell = (field: Field): string => (index[field] < 0 ? '' : (row.celdas[index[field]] ?? ''));
    const code = cell('code');
    const fail = (problem: InventoryCsvProblemCode, message: string): void => {
      problems.push({ line: row.linea, code, problem, message });
    };

    const product = alive.get(code.toLowerCase());
    if (code === '' || product === undefined) {
      fail('NOT_IN_CATALOG', `El código «${code}» no está en su catálogo.`);
      continue;
    }
    if (seen.has(product.id)) {
      fail('DUPLICATE', `El código «${code}» aparece más de una vez: se toma la primera fila.`);
      continue;
    }
    seen.add(product.id);

    const stock = wholeNumber(cell('stock'));
    const minimum = wholeNumber(cell('minimum'));
    const available = availability(cell('available'));
    if (stock === 'invalid') {
      fail('INVALID_STOCK', `Las existencias de «${code}» son un número entero de 0 a ${INVENTORY_STOCK_MAX}.`);
      continue;
    }
    if (minimum === 'invalid') {
      fail('INVALID_MINIMUM', `El umbral de «${code}» es un número entero de 0 a ${INVENTORY_STOCK_MAX}.`);
      continue;
    }
    if (available === 'invalid') {
      fail('INVALID_AVAILABLE', `«Disponible» de «${code}» es sí o no (hay / no hay).`);
      continue;
    }
    if (stock !== null && available !== null && (stock > 0) !== available) {
      fail('CONTRADICTION', `«${code}» dice ${stock} unidades y a la vez ${available ? 'que hay' : 'que no hay'}: corrija una de las dos.`);
      continue;
    }
    if (stock === null && minimum === null && available === null) {
      fail('EMPTY_ROW', `La fila de «${code}» no trae nada para cambiar.`);
      continue;
    }

    // Con existencias manda la cantidad; sin ellas, el booleano.
    const line: PharmacyInventoryLine = {
      productId: product.id,
      ...(stock !== null ? { stock } : available !== null ? { inStock: available } : {}),
      ...(minimum !== null ? { minStock: minimum } : {}),
    };
    if (isSameAsCurrent(line, product)) {
      unchanged += 1;
    } else {
      lines.push(line);
    }
  }

  return { lines, unchanged, problems, ignoredColumns, columns };
}

/** Lo que ya tiene el producto, dicho como una línea, para no mandar lo que no cambia. */
function isSameAsCurrent(line: PharmacyInventoryLine, product: PharmacyProduct): boolean {
  const sameStock = line.stock === undefined || line.stock === (product.stock ?? 0);
  const sameMinimum =
    line.minStock === undefined || line.minStock === (product.minStock ?? INVENTORY_DEFAULT_MINIMUM);
  const sameAvailability = line.inStock === undefined || line.inStock === (product.inStock !== false);
  return sameStock && sameMinimum && sameAvailability;
}

/** Un entero de 0 a {@link INVENTORY_STOCK_MAX}; `null` si la celda está vacía. */
function wholeNumber(text: string): number | null | 'invalid' {
  if (text === '') {
    return null;
  }
  if (!/^\d+$/.test(text)) {
    return 'invalid';
  }
  const value = Number(text);
  return value <= INVENTORY_STOCK_MAX ? value : 'invalid';
}

/** Hay / no hay en cualquiera de sus grafías; `null` si la celda está vacía. */
function availability(text: string): boolean | null | 'invalid' {
  const clean = withoutAccents(text.trim());
  if (clean === '') {
    return null;
  }
  if (YES.has(clean)) {
    return true;
  }
  return NO.has(clean) ? false : 'invalid';
}

/** Una fila del inventario exportado: se puede corregir y volver a subir tal cual. */
export interface InventoryCsvRow {
  readonly code: string;
  readonly name: string;
  readonly stock: string;
  readonly minimum: string;
  readonly available: string;
}

/** El inventario actual como filas de CSV (sin los retirados). */
export function inventoryCsvRows(products: readonly PharmacyProduct[]): readonly InventoryCsvRow[] {
  return products
    .filter((product) => productStatus(product) !== 'WITHDRAWN')
    .map((product) => ({
      code: product.productCode,
      name: productName(product),
      stock: String(product.stock ?? 0),
      minimum: String(product.minStock ?? INVENTORY_DEFAULT_MINIMUM),
      available: product.inStock === false ? 'no' : 'sí',
    }));
}

/** Los encabezados del archivo exportado: los mismos que la carga entiende. */
export const INVENTORY_CSV_HEADERS = {
  code: 'codigo',
  name: 'producto',
  stock: 'existencias',
  minimum: 'umbral',
  available: 'disponible',
} as const;
