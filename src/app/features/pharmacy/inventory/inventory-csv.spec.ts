import { describe, expect, it } from 'vitest';

import type { PharmacyProduct } from '../../../core/data-access/pharmacy/pharmacy.types';
import { ArchivoInvalido, leerTablaCsv } from '../catalog-rules/catalog.rules';
import { inventoryCsvRows, reviewInventoryCsv } from './inventory-csv';

/**
 * La revisión del CSV de inventario: qué cambia, qué ya está igual y qué fila
 * no vale — todo antes de mandar nada.
 */
function product(partial: Partial<PharmacyProduct>): PharmacyProduct {
  return {
    id: 'p-1',
    pharmacyId: 'f-1',
    pharmacyName: 'Farmacia',
    productCode: 'PAR-500',
    brandName: 'Paracetamol Bagó',
    genericName: null,
    strengthText: null,
    packageSizeText: null,
    dosageForm: null,
    medication: null,
    requiresPrescription: false,
    status: 'PUBLISHED',
    stock: 20,
    minStock: 5,
    inStock: true,
    ...partial,
  };
}

const CATALOG = [
  product({}),
  product({ id: 'p-2', productCode: 'IBU-400', brandName: 'Ibuprofeno', stock: 0, inStock: false }),
  product({ id: 'p-3', productCode: 'OLD-1', brandName: 'Retirado', status: 'WITHDRAWN' }),
];

describe('leerTablaCsv', () => {
  it('detecta el separador, normaliza los encabezados y respeta las comillas', () => {
    const table = leerTablaCsv('Código;Stock mínimo\n"A;1";5\n');

    expect(table.encabezados).toEqual(['codigo', 'stock_minimo']);
    expect(table.renglones[0]!.celdas).toEqual(['A;1', '5']);
  });

  it.each([
    ['', 'vacío'],
    ['codigo;codigo\nA;B', 'dos columnas con el mismo encabezado'],
    ['codigo;;existencias\nA;;B', 'Todas las columnas necesitan un encabezado'],
    ['codigo;existencias', 'ninguna fila'],
  ])('rechaza el archivo entero: %j', (content, fragment) => {
    expect(() => leerTablaCsv(content)).toThrowError(ArchivoInvalido);
    expect(() => leerTablaCsv(content)).toThrowError(new RegExp(fragment, 'i'));
  });
});

describe('reviewInventoryCsv · con cantidades', () => {
  it('arma una línea por producto que cambia, con existencias y umbral', () => {
    const review = reviewInventoryCsv('codigo;existencias;umbral\nPAR-500;3;10\nIBU-400;50;8\n', CATALOG);

    expect(review.problems).toEqual([]);
    expect(review.lines).toEqual([
      { productId: 'p-1', stock: 3, minStock: 10 },
      { productId: 'p-2', stock: 50, minStock: 8 },
    ]);
  });

  it('una celda vacía deja ese dato como está', () => {
    const review = reviewInventoryCsv('codigo;existencias;umbral\nPAR-500;3;\n', CATALOG);

    expect(review.lines).toEqual([{ productId: 'p-1', stock: 3 }]);
  });

  it('lo que ya está igual no se manda y se cuenta aparte', () => {
    const review = reviewInventoryCsv('codigo;existencias;umbral\nPAR-500;20;5\nIBU-400;7;5\n', CATALOG);

    expect(review.unchanged).toBe(1);
    expect(review.lines).toEqual([{ productId: 'p-2', stock: 7, minStock: 5 }]);
  });

  it('el inventario exportado, sin tocar, no cambia nada', () => {
    const rows = inventoryCsvRows(CATALOG);
    const csv = [
      'codigo;producto;existencias;umbral;disponible',
      ...rows.map((r) => [r.code, r.name, r.stock, r.minimum, r.available].join(';')),
    ].join('\n');

    const review = reviewInventoryCsv(csv, CATALOG);

    expect(review.lines).toEqual([]);
    expect(review.problems).toEqual([]);
    expect(review.unchanged).toBe(2);
    // «producto» es del archivo exportado: se entiende, no se avisa como ignorada.
    expect(review.ignoredColumns).toEqual([]);
  });

  it('los retirados no se exportan y responden como un código que no está', () => {
    expect(inventoryCsvRows(CATALOG).map((r) => r.code)).toEqual(['PAR-500', 'IBU-400']);

    const review = reviewInventoryCsv('codigo;existencias\nOLD-1;5\n', CATALOG);
    expect(review.problems.map((p) => p.problem)).toEqual(['NOT_IN_CATALOG']);
  });
});

describe('reviewInventoryCsv · hay / no hay', () => {
  it('con sólo «disponible» arma líneas booleanas, sin cantidades', () => {
    const review = reviewInventoryCsv('codigo;disponible\nPAR-500;no\nIBU-400;sí\n', CATALOG);

    expect(review.columns).toEqual(['available']);
    expect(review.lines).toEqual([
      { productId: 'p-1', inStock: false },
      { productId: 'p-2', inStock: true },
    ]);
  });

  it.each([
    ['hay', true],
    ['SÍ', true],
    ['1', true],
    ['no hay', false],
    ['agotado', false],
    ['Sin stock', false],
  ])('entiende «%s»', (word, expected) => {
    const review = reviewInventoryCsv(`codigo;disponible\nPAR-500;${word}\nIBU-400;${expected ? 'no' : 'sí'}\n`, [
      product({ inStock: !expected }),
      product({ id: 'p-2', productCode: 'IBU-400', inStock: expected }),
    ]);

    expect(review.lines[0]).toEqual({ productId: 'p-1', inStock: expected });
  });

  it('un booleano que ya coincide con lo cargado no cambia nada', () => {
    const review = reviewInventoryCsv('codigo;disponible\nPAR-500;sí\nIBU-400;no\n', CATALOG);

    expect(review.lines).toEqual([]);
    expect(review.unchanged).toBe(2);
  });

  it('«disponible» junto con existencias: manda la cantidad si no se contradicen', () => {
    const review = reviewInventoryCsv('codigo;existencias;disponible\nPAR-500;9;sí\n', CATALOG);

    expect(review.lines).toEqual([{ productId: 'p-1', stock: 9 }]);
    expect(review.problems).toEqual([]);
  });

  it('si se contradicen, la fila se rechaza y no se adivina', () => {
    const review = reviewInventoryCsv('codigo;existencias;disponible\nPAR-500;20;no\nIBU-400;0;sí\n', CATALOG);

    expect(review.lines).toEqual([]);
    expect(review.problems.map((p) => p.problem)).toEqual(['CONTRADICTION', 'CONTRADICTION']);
  });
});

describe('reviewInventoryCsv · lo que no vale', () => {
  it('cada problema dice su línea del archivo y sigue con las demás filas', () => {
    const review = reviewInventoryCsv(
      [
        'codigo;existencias;umbral',
        'PAR-500;abc;5', // línea 2
        'NOPE;1;1', // línea 3
        'IBU-400;-4;1', // línea 4
        'PAR-500;9;1', // línea 5: la primera de PAR-500 ya fue rechazada, pero cuenta como vista
      ].join('\n'),
      CATALOG,
    );

    expect(review.problems.map((p) => [p.line, p.problem])).toEqual([
      [2, 'INVALID_STOCK'],
      [3, 'NOT_IN_CATALOG'],
      [4, 'INVALID_STOCK'],
      [5, 'DUPLICATE'],
    ]);
    expect(review.lines).toEqual([]);
  });

  it('un umbral inválido se dice con su propio motivo', () => {
    const review = reviewInventoryCsv('codigo;existencias;umbral\nPAR-500;5;x\n', CATALOG);

    expect(review.problems[0]!.problem).toBe('INVALID_MINIMUM');
  });

  it('una fila sin nada para cambiar es un problema, no un cambio vacío', () => {
    const review = reviewInventoryCsv('codigo;existencias;umbral\nPAR-500;;\n', CATALOG);

    expect(review.problems[0]!.problem).toBe('EMPTY_ROW');
  });

  it('el tope de existencias es el del servidor', () => {
    const review = reviewInventoryCsv('codigo;existencias\nPAR-500;1000001\nIBU-400;1000000\n', CATALOG);

    expect(review.problems.map((p) => p.problem)).toEqual(['INVALID_STOCK']);
    expect(review.lines).toEqual([{ productId: 'p-2', stock: 1_000_000 }]);
  });

  it('el código se compara sin importar mayúsculas ni espacios', () => {
    const review = reviewInventoryCsv('codigo;existencias\n  par-500 ;3\n', CATALOG);

    expect(review.lines).toEqual([{ productId: 'p-1', stock: 3 }]);
  });

  it('avisa las columnas que no entiende', () => {
    const review = reviewInventoryCsv('codigo;existencias;color\nPAR-500;3;rojo\n', CATALOG);

    expect(review.ignoredColumns).toEqual(['color']);
  });

  it.each([
    ['existencias\n3', 'codigo'],
    ['codigo\nPAR-500', 'existencias'],
  ])('rechaza el archivo si le falta lo básico: %j', (content, fragment) => {
    expect(() => reviewInventoryCsv(content, CATALOG)).toThrowError(new RegExp(fragment));
  });
});
