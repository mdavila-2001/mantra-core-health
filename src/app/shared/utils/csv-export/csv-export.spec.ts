import { toCsv, type CsvColumn } from './csv-export';

interface Fila {
  readonly nombre: string;
  readonly importe: string;
}

const COLUMNAS: readonly CsvColumn<Fila>[] = [
  { header: 'Nombre', value: (f) => f.nombre },
  { header: 'Importe', value: (f) => f.importe },
];

describe('toCsv', () => {
  it('arma encabezado y filas separados por coma y CRLF', () => {
    const filas: Fila[] = [
      { nombre: 'Caja', importe: '120.50' },
      { nombre: 'Banco', importe: '980.00' },
    ];

    expect(toCsv(filas, COLUMNAS)).toBe(
      'Nombre,Importe\r\nCaja,120.50\r\nBanco,980.00',
    );
  });

  it('entrecomilla una celda que trae el separador', () => {
    const filas: Fila[] = [{ nombre: 'Ingresos, netos', importe: '10.00' }];

    expect(toCsv(filas, COLUMNAS)).toContain('"Ingresos, netos",10.00');
  });

  it('duplica las comillas internas de una celda que ya trae comillas', () => {
    const filas: Fila[] = [{ nombre: 'Cuenta "principal"', importe: '5.00' }];

    expect(toCsv(filas, COLUMNAS)).toContain('"Cuenta ""principal""",5.00');
  });

  it('sin filas, sólo queda el encabezado', () => {
    expect(toCsv([], COLUMNAS)).toBe('Nombre,Importe');
  });
});
