import type { CsvColumn } from '../../../shared/utils/csv-export/csv-export';
import type { ProductFields } from '../catalog-rules/catalog.rules';
import {
  PRICE_HEADERS,
  PRODUCT_TEMPLATES,
  downloadProductTemplate,
  productHelpColumns,
} from './product-templates';

describe('product-templates', () => {
  function downloaded(kind: string, firstCategory = '') {
    const download = vi.fn();
    downloadProductTemplate({ download } as never, kind, firstCategory);
    const [rows, columns, filename] = download.mock.calls[0]! as [
      ProductFields[],
      CsvColumn<ProductFields>[],
      string,
    ];
    return { rows, headers: columns.map((column) => column.header), columns, filename };
  }

  it('ofrece la plantilla completa y la de sólo precios', () => {
    expect(PRODUCT_TEMPLATES.map((template) => template.testId)).toEqual([
      'import-template',
      'import-template-prices',
    ]);
  });

  it('la plantilla completa trae todas las columnas y la primera categoría de la farmacia', () => {
    const { headers, rows, filename } = downloaded('catalog', 'Ortopedia');

    expect(filename).toBe('plantilla-catalogo-farmacia.csv');
    expect(headers[0]).toBe('codigo');
    expect(headers).toContain('precio');
    expect(headers).toContain('disponible');
    expect(rows.every((row) => row.categoria === 'Ortopedia')).toBe(true);
  });

  it('la de precios trae sólo «codigo» y «precio», con valores de ejemplo', () => {
    const { headers, rows, columns, filename } = downloaded('prices');

    expect(filename).toBe('plantilla-precios.csv');
    expect(headers).toEqual([...PRICE_HEADERS]);
    expect(columns[1]!.value(rows[0]!)).not.toBe('');
  });

  it('la guía lista las columnas y, con categorías cargadas, dice cuáles valen', () => {
    expect(productHelpColumns(null).map((column) => column.header)[0]).toBe('codigo');
    const category = productHelpColumns(['Vitaminas', 'Bebés']).find((column) => column.header === 'categoria');
    expect(category?.description).toBe('Una de las suyas: Vitaminas · Bebés.');
    const none = productHelpColumns([]).find((column) => column.header === 'categoria');
    expect(none?.description).toContain('todavía no tiene categorías');
  });
});
