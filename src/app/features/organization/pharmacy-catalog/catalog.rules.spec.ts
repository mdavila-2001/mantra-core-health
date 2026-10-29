import {
  InvalidFile,
  EMPTY_FIELDS,
  decodeCsv,
  MAX_ROWS_BY_LOAD,
  isValidGtin,
  readCsv,
  reviewLoad,
  reviewProduct,
  type ProductFields,
} from './catalog.rules';

function campos(parciales: Partial<ProductFields>): ProductFields {
  return { ...EMPTY_FIELDS, ...parciales };
}

describe('revisarProducto', () => {
  it('arma el alta con sólo lo que se escribió', () => {
    const revision = reviewProduct(
      campos({ codigo: ' PAR-500 ', generico: 'Paracetamol', concentracion: '500 mg' }),
    );

    expect(revision).toEqual({
      valido: true,
      borrador: { productCode: 'PAR-500', genericName: 'Paracetamol', strengthText: '500 mg' },
    });
  });

  it('traduce sí/no a booleanos y deja fuera lo que no se declaró', () => {
    const revision = reviewProduct(
      campos({ codigo: 'A1', marca: 'Marca', receta: 'Sí', cadenaDeFrio: '' }),
    );

    expect(revision.valido && revision.borrador.requiresPrescription).toBe(true);
    expect(revision.valido && 'coldChainRequired' in revision.borrador).toBe(false);
  });

  it('devuelve todos los problemas de una vez', () => {
    const revision = reviewProduct(
      campos({ codigo: '', receta: 'quizás', codigoDeBarras: '123' }),
    );

    expect(revision.valido).toBe(false);
    expect(!revision.valido && revision.errores).toHaveLength(4);
  });

  it('rechaza un código con espacios o que empieza con un signo', () => {
    expect(reviewProduct(campos({ codigo: 'A 1', marca: 'x' })).valido).toBe(false);
    expect(reviewProduct(campos({ codigo: '-A1', marca: 'x' })).valido).toBe(false);
    expect(reviewProduct(campos({ codigo: 'FAR/01.a_b-2', marca: 'x' })).valido).toBe(true);
  });

  it('respeta los topes del DTO del backend', () => {
    const largo = 'x'.repeat(301);
    const revision = reviewProduct(campos({ codigo: 'A1', marca: largo }));

    expect(revision.valido).toBe(false);
  });

  it('manda el código de barras como identificador GTIN', () => {
    const revision = reviewProduct(
      campos({ codigo: 'A1', marca: 'x', codigoDeBarras: '7 501031 311309' }),
    );

    expect(revision.valido && revision.borrador.identifiers).toEqual([
      { identifierType: 'GTIN', identifierValue: '7501031311309' },
    ]);
  });
});

describe('esGtinValido', () => {
  it.each(['7501031311309', '96385074', '036000291452', '10012345678902'])(
    'acepta %s',
    (gtin) => expect(isValidGtin(gtin)).toBe(true),
  );

  it.each(['7501031311308', '1234567', 'ABCDEFGHIJKLM', '123456789012345'])(
    'rechaza %s',
    (gtin) => expect(isValidGtin(gtin)).toBe(false),
  );
});

describe('leerCsv', () => {
  it('lee coma, con BOM, CRLF y comillas escapadas', () => {
    const lectura = readCsv(
      '\uFEFFcodigo,marca,presentacion\r\nA1,"Gel ""Frío""","Caja x 20, blíster"\r\n',
    );

    expect(lectura.filas).toEqual([
      {
        numero: 2,
        campos: campos({ codigo: 'A1', marca: 'Gel "Frío"', presentacion: 'Caja x 20, blíster' }),
      },
    ]);
  });

  it('detecta el punto y coma de Excel en castellano', () => {
    const lectura = readCsv('Código;Principio activo;Receta\nA1;Ibuprofeno;sí\n');

    expect(lectura.filas[0]!.campos).toEqual(
      campos({ codigo: 'A1', generico: 'Ibuprofeno', receta: 'sí' }),
    );
  });

  it('acepta alias y avisa las columnas que ignora', () => {
    const lectura = readCsv('SKU,nombre,stock\nA1,Algo,12\n');

    expect(lectura.filas[0]!.campos.codigo).toBe('A1');
    expect(lectura.filas[0]!.campos.marca).toBe('Algo');
    expect(lectura.ignoradas).toEqual(['stock']);
  });

  it('salta las filas en blanco', () => {
    const lectura = readCsv('codigo,marca\nA1,x\n,\n\nA2,y\n');

    expect(lectura.filas.map((fila) => fila.campos.codigo)).toEqual(['A1', 'A2']);
  });

  it('deshace el apóstrofo anti-fórmula del informe de errores', () => {
    const lectura = readCsv("codigo,marca\nA1,'=Marca\n");

    expect(lectura.filas[0]!.campos.marca).toBe('=Marca');
  });

  it.each([
    ['', 'vacío'],
    ['marca\nx\n', 'codigo'],
    ['codigo\n', 'ningún producto'],
    ['codigo,codigo\nA,B\n', 'mismo encabezado'],
    ['codigo,sku\nA,B\n', 'mismo dato'],
    ['codigo,marca\nA1,"sin cerrar\n', 'comillas'],
  ])('rechaza el archivo entero: %j', (contenido, pista) => {
    expect(() => readCsv(contenido)).toThrow(InvalidFile);
    expect(() => readCsv(contenido)).toThrow(new RegExp(pista));
  });

  it('numera cada fila con su línea del archivo, contando encabezado, blancos y saltos entre comillas', () => {
    const lectura = readCsv('codigo,marca\nA1,x\n\nA2,"dos\nlíneas"\nA3,y\n');

    expect(lectura.filas.map((fila) => fila.numero)).toEqual([2, 4, 6]);
  });

  it('una fila con otra cantidad de columnas se rechaza sola, no el archivo', () => {
    const lectura = readCsv('codigo,marca\nA1\nA2,x\n');
    const revisadas = reviewLoad(lectura.filas, new Set());

    expect(revisadas.map((fila) => fila.lista)).toEqual([false, true]);
    expect(revisadas[0]!.lista === false && revisadas[0]!.errores[0]).toMatch(/columnas/);
  });

  it('ignora las columnas vacías que Excel deja al final', () => {
    const lectura = readCsv('codigo;marca;;\nA1;x;;\n');

    expect(lectura.filas[0]!.errorDeForma).toBeUndefined();
    expect(lectura.filas[0]!.campos.marca).toBe('x');
  });

  it('deshace también el apóstrofo delante de un tabulador', () => {
    expect(readCsv("codigo,marca\nA1,'\tx\n").filas[0]!.campos.marca).toBe('\tx');
  });

  it(`corta en ${MAX_ROWS_BY_LOAD} filas`, () => {
    const filas = Array.from({ length: MAX_ROWS_BY_LOAD + 1 }, (_, i) => `A${i},x`);

    expect(() => readCsv(['codigo,marca', ...filas].join('\n'))).toThrow(/tope por carga/);
  });
});

describe('revisarCarga', () => {
  const fila = (numero: number, parciales: Partial<ProductFields>) => ({
    numero,
    campos: campos(parciales),
  });

  it('rechaza en todas sus filas un código repetido dentro del archivo', () => {
    const revisadas = reviewLoad(
      [fila(1, { codigo: 'A1', marca: 'x' }), fila(2, { codigo: 'A1', marca: 'y' }), fila(3, { codigo: 'B1', marca: 'z' })],
      new Set(),
    );

    expect(revisadas.map((r) => r.lista)).toEqual([false, false, true]);
    expect(revisadas[0]!.lista === false && revisadas[0]!.motivo).toBe('REPETIDA_EN_EL_ARCHIVO');
  });

  it('rechaza lo que ya está en el catálogo: no hay edición en el backend', () => {
    const revisadas = reviewLoad([fila(1, { codigo: 'A1', marca: 'x' })], new Set(['A1']));

    expect(revisadas[0]!.lista === false && revisadas[0]!.motivo).toBe('YA_EN_EL_CATALOGO');
  });

  it('una fila inválida conserva sus errores', () => {
    const revisadas = reviewLoad([fila(1, { codigo: 'A1' })], new Set());

    expect(revisadas[0]!.lista === false && revisadas[0]!.motivo).toBe('INVALIDA');
  });
});

describe('decodificarCsv', () => {
  it('lee UTF-8 tal cual', () => {
    const bytes = new TextEncoder().encode('codigo,marca\nA1,Cápsulas ñandú\n');

    expect(decodeCsv(bytes)).toEqual({
      texto: 'codigo,marca\nA1,Cápsulas ñandú\n',
      codificacion: 'utf-8',
    });
  });

  it('relee como Windows-1252 lo que guarda Excel en castellano, sin «�»', () => {
    // «Cápsulas ñ» en Windows-1252: á = 0xE1, ñ = 0xF1.
    const bytes = new Uint8Array([
      ...new TextEncoder().encode('codigo,marca\nA1,C'),
      0xe1,
      ...new TextEncoder().encode('psulas '),
      0xf1,
      0x0a,
    ]);

    const { texto, codificacion } = decodeCsv(bytes);
    expect(codificacion).toBe('windows-1252');
    expect(texto).toBe('codigo,marca\nA1,Cápsulas ñ\n');
    expect(texto).not.toContain('\uFFFD');
  });
});
