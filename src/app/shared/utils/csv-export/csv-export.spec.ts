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

/**
 * Inyección de fórmulas (CSV injection).
 *
 * Los textos vienen de respuestas de pacientes y de títulos que escribe quien
 * usa el sistema: si la celda empieza con uno de los caracteres de fórmula, la
 * planilla la evalúa al abrir el archivo. Cada caso de acá comprueba que el
 * valor queda neutralizado con el apóstrofo inicial que recomienda OWASP.
 */
describe('toCsv — inyección de fórmulas', () => {
  const casos: readonly { readonly nombre: string; readonly peligroso: string }[] = [
    { nombre: 'igual', peligroso: '=1+1' },
    { nombre: 'más', peligroso: '+1+1' },
    { nombre: 'menos', peligroso: '-1+1' },
    { nombre: 'arroba', peligroso: '@SUM(A1:A9)' },
    { nombre: 'tabulador', peligroso: '\t=1+1' },
    { nombre: 'retorno de carro', peligroso: '\r=1+1' },
  ];

  for (const { nombre, peligroso } of casos) {
    it(`antepone un apóstrofo a una celda que empieza con ${nombre}`, () => {
      const filas: Fila[] = [{ nombre: peligroso, importe: '0.00' }];

      const celda = toCsv(filas, COLUMNAS).split('\r\n')[1]?.split(',')[0] ?? '';
      // Tabulador y CR además disparan el entrecomillado de RFC 4180, así que
      // se compara sobre el contenido sin comillas: lo que mira la planilla.
      const contenido = celda.startsWith('"') ? celda.slice(1, -1) : celda;
      expect(contenido).toBe(`'${peligroso}`);
    });
  }

  it('neutraliza también el encabezado, que también lo escribe un usuario', () => {
    const columnas: readonly CsvColumn<Fila>[] = [
      { header: '=HYPERLINK("http://x")', value: (f) => f.nombre },
    ];

    expect(toCsv([], columnas)).toBe(`"'=HYPERLINK(""http://x"")"`);
  });

  it('el apóstrofo va dentro de las comillas cuando la celda además trae coma y comillas', () => {
    const filas: Fila[] = [{ nombre: '=SUM(1,2) "total"', importe: '0.00' }];

    expect(toCsv(filas, COLUMNAS)).toContain(`"'=SUM(1,2) ""total"""`);
  });

  it('control negativo: un texto normal no lleva apóstrofo', () => {
    const filas: Fila[] = [{ nombre: 'Caja chica', importe: '120.50' }];

    expect(toCsv(filas, COLUMNAS)).toBe('Nombre,Importe\r\nCaja chica,120.50');
  });

  it('control negativo: el carácter peligroso en el medio no neutraliza nada', () => {
    const filas: Fila[] = [{ nombre: 'Caja = chica', importe: '1+1' }];

    expect(toCsv(filas, COLUMNAS)).toContain('Caja = chica,1+1');
  });
});
