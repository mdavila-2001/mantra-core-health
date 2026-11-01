import type { BulkSiteAvailabilityRow } from '../../../core/data-access/pharmacy/pharmacy-bulk.types';
import { BULK_MAX_ROWS } from '../../../core/data-access/pharmacy/pharmacy-bulk.types';
import { ArchivoInvalido, leerTablaCsv } from '../catalog-rules/catalog.rules';
import { HEADERS, INVENTORY_STOCK_MAX, availability, wholeNumber } from './inventory-csv';

/** Una línea del archivo, lista para mandar o frenada acá con su motivo. */
export interface SiteAvailabilityCsvRow {
  /** La línea del archivo (el encabezado es la 1). */
  readonly line: number;
  readonly code: string;
  /** La fila para la API; `null` si no se puede mandar. */
  readonly payload: BulkSiteAvailabilityRow | null;
  /** Por qué no se manda; vacío si se manda. */
  readonly errors: readonly string[];
}

export interface SiteAvailabilityCsvReading {
  readonly rows: readonly SiteAvailabilityCsvRow[];
  /** Columnas que no se usan para una sucursal (el umbral es del catálogo). */
  readonly ignoredColumns: readonly string[];
}

/**
 * Lee el CSV del stock de **una sucursal**: el mismo archivo que se exporta del
 * inventario (`codigo`, `existencias`, `disponible`), una fila por producto.
 *
 * No compara contra nada: qué cambia, qué ya está igual y qué código no existe
 * lo dice el servidor en la vista previa (`dryRun`), porque el stock de una
 * sede con stock propio no es el que muestra el catálogo. Acá sólo se frena lo
 * que no se puede ni mandar —una cantidad que no es un entero, un «sí/no»
 * ilegible, una fila que se contradice— y el **código repetido**: no se manda
 * ninguna de esas filas, como en la importación del catálogo, porque elegir una
 * por el orden sería decidir en silencio cuál vale.
 *
 * Con `existencias` la fila lleva la cantidad (0 es «no lo tengo»); con sólo
 * `disponible`, «lo tengo» toma las unidades que dice el servidor.
 */
export function readSiteAvailabilityCsv(content: string): SiteAvailabilityCsvReading {
  const table = leerTablaCsv(content, BULK_MAX_ROWS);
  const columnOf = (field: keyof typeof HEADERS): number =>
    table.encabezados.findIndex((header) => (HEADERS[field] as readonly string[]).includes(header));
  const code = columnOf('code');
  const stock = columnOf('stock');
  const available = columnOf('available');
  if (code < 0) {
    throw new ArchivoInvalido('Falta la columna «codigo». Descargue el inventario para ver los encabezados.');
  }
  if (stock < 0 && available < 0) {
    throw new ArchivoInvalido('Falta qué actualizar: agregue «existencias» o «disponible».');
  }
  const name = table.encabezados.findIndex((header) => ['producto', 'nombre', 'name'].includes(header));
  const understood = new Set([code, stock, available, name]);
  const ignoredColumns = table.encabezados.filter((_, position) => !understood.has(position));

  const rows = table.renglones.map(({ linea, celdas }): SiteAvailabilityCsvRow => {
    const cell = (position: number): string => (position < 0 ? '' : (celdas[position] ?? '').trim());
    const productCode = cell(code);
    const fail = (message: string): SiteAvailabilityCsvRow => ({
      line: linea,
      code: productCode,
      payload: null,
      errors: [message],
    });
    const units = wholeNumber(cell(stock));
    const has = availability(cell(available));
    if (productCode === '') {
      return fail('Falta el código del producto.');
    }
    if (units === 'invalid') {
      return fail(`Las existencias de «${productCode}» son un número entero de 0 a ${INVENTORY_STOCK_MAX}.`);
    }
    if (has === 'invalid') {
      return fail(`«Disponible» de «${productCode}» es sí o no (hay / no hay).`);
    }
    if (units !== null && has !== null && units > 0 !== has) {
      return fail(`«${productCode}» dice ${units} unidades y a la vez ${has ? 'que hay' : 'que no hay'}: corrija una de las dos.`);
    }
    if (units === null && has === null) {
      return fail(`La fila de «${productCode}» no trae nada para cambiar.`);
    }
    const payload: BulkSiteAvailabilityRow =
      units === null
        ? { productCode, available: has === true }
        : units > 0
          ? { productCode, available: true, quantity: units }
          : { productCode, available: false };
    return { line: linea, code: productCode, payload, errors: [] };
  });
  return { rows: withoutRepeatedCodes(rows), ignoredColumns };
}

/** Frena todas las filas que se mandarían con un código que otra también trae. */
function withoutRepeatedCodes(rows: readonly SiteAvailabilityCsvRow[]): SiteAvailabilityCsvRow[] {
  const linesOf = new Map<string, number[]>();
  for (const row of rows) {
    if (row.payload !== null) {
      linesOf.set(row.code, [...(linesOf.get(row.code) ?? []), row.line]);
    }
  }
  return rows.map((row) => {
    const lines = row.payload === null ? undefined : linesOf.get(row.code);
    return lines === undefined || lines.length < 2
      ? row
      : {
          ...row,
          payload: null,
          errors: [`El código «${row.code}» está en las líneas ${lines.join(', ')}: no se envía ninguna. Deje una sola.`],
        };
  });
}
