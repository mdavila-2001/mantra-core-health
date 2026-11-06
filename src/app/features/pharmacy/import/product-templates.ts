import type { CsvColumn, CsvExportService } from '../../../shared/utils/csv-export/csv-export';
import { EXAMPLE_ROWS } from '../catalog-rules/catalog-example-rows';
import { CSV_COLUMNS, type ProductFields } from '../catalog-rules/catalog.rules';
import type { ImportHelpColumn, ImportTemplateLink } from './import-columns-help/import-columns-help';

/*
  The templates of the products import. Prices are not a separate import: a
  file with only `codigo` and `precio` is a products file that updates just the
  price, so its template is the same columns, trimmed to those two.
*/

export const PRICE_HEADERS = ['codigo', 'precio'] as const;

export const PRODUCT_TEMPLATES: readonly ImportTemplateLink[] = [
  { value: 'catalog', label: 'Descargar plantilla', testId: 'import-template' },
  { value: 'prices', label: 'Plantilla sólo de precios', testId: 'import-template-prices' },
];

export const PRICE_UPDATE_NOTE =
  '¿Sólo precios? Suba un archivo con «codigo» y «precio»: cada producto que ya está en su ' +
  'catálogo cambia el precio y nada más; su nombre y su disponibilidad quedan como están.';

/** The columns of the guide; `categoria` lists this pharmacy's categories once loaded. */
export function productHelpColumns(categories: readonly string[] | null): ImportHelpColumn[] {
  return CSV_COLUMNS.map((column) => ({
    header: column.encabezado,
    description:
      column.campo !== 'categoria' || categories === null
        ? column.descripcion
        : categories.length === 0
          ? 'Su farmacia todavía no tiene categorías: déjela vacía.'
          : `Una de las suyas: ${categories.join(' · ')}.`,
  }));
}

/**
 * Downloads a products template. The example rows carry the pharmacy's first
 * category (or none): with a fixed one, the template uploaded as is would be
 * rejected by a pharmacy that lacks it.
 */
export function downloadProductTemplate(csv: CsvExportService, kind: string, firstCategory: string): void {
  const rows: ProductFields[] = EXAMPLE_ROWS.map((row) => ({ ...row, categoria: firstCategory }));
  const prices = kind === 'prices';
  const columns: CsvColumn<ProductFields>[] = CSV_COLUMNS.filter(
    (column) => !prices || (PRICE_HEADERS as readonly string[]).includes(column.encabezado),
  ).map((column) => ({ header: column.encabezado, value: (row) => row[column.campo] ?? '' }));
  csv.download(rows, columns, prices ? 'plantilla-precios.csv' : 'plantilla-catalogo-farmacia.csv');
}
