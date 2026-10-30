import { describe, expect, it } from 'vitest';

import { etiquetaUnidad, tableToCsv, type ChartTableData } from './chart-table';

const TABLA: ChartTableData = {
  columnas: ['Categoría', 'Ingreso'],
  filas: [['Pro', 'Bs 100,00']],
  crudo: [
    ['Pro', 100],
    ['Esencial', null],
  ],
};

const withoutBom = (csv: string): string => csv.replace(/^\uFEFF/, '');

describe('tableToCsv', () => {
  it('sin unidad conserva el encabezado tal cual', () => {
    expect(withoutBom(tableToCsv(TABLA)).split('\r\n')[0]).toBe('Categoría,Ingreso');
  });

  it('con unidad, cada columna de valores la lleva en el encabezado y la de rótulos no', () => {
    const csv = withoutBom(tableToCsv(TABLA, { tipo: 'moneda', moneda: 'BOB' }));
    expect(csv.split('\r\n')[0]).toBe('Categoría,Ingreso (BOB)');
  });

  it('un valor ausente sale vacío, no como 0', () => {
    const filas = withoutBom(tableToCsv(TABLA, { tipo: 'numero' })).split('\r\n');
    expect(filas[2]).toBe('Esencial,');
  });

  it('empieza con BOM para que Excel lea las tildes', () => {
    expect(tableToCsv(TABLA).startsWith('\uFEFF')).toBe(true);
  });
});

describe('etiquetaUnidad', () => {
  it('nombra la unidad de cada tipo', () => {
    expect(etiquetaUnidad({ tipo: 'moneda', moneda: 'USD' })).toBe('USD');
    expect(etiquetaUnidad({ tipo: 'porcentaje' })).toBe('%');
    expect(etiquetaUnidad({ tipo: 'razon', sufijo: '×' })).toBe('×');
    expect(etiquetaUnidad({ tipo: 'numero' })).toBe('cantidad');
  });
});
