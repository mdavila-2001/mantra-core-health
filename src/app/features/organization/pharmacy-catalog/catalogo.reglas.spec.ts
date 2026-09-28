import {
  ArchivoInvalido,
  CAMPOS_VACIOS,
  FILAS_MAXIMAS_POR_CARGA,
  esGtinValido,
  leerCsv,
  revisarCarga,
  revisarProducto,
  type CamposDelProducto,
} from './catalogo.reglas';

function campos(parciales: Partial<CamposDelProducto>): CamposDelProducto {
  return { ...CAMPOS_VACIOS, ...parciales };
}

describe('revisarProducto', () => {
  it('arma el alta con sólo lo que se escribió', () => {
    const revision = revisarProducto(
      campos({ codigo: ' PAR-500 ', generico: 'Paracetamol', concentracion: '500 mg' }),
    );

    expect(revision).toEqual({
      valido: true,
      borrador: { productCode: 'PAR-500', genericName: 'Paracetamol', strengthText: '500 mg' },
    });
  });

  it('traduce sí/no a booleanos y deja fuera lo que no se declaró', () => {
    const revision = revisarProducto(
      campos({ codigo: 'A1', marca: 'Marca', receta: 'Sí', cadenaDeFrio: '' }),
    );

    expect(revision.valido && revision.borrador.requiresPrescription).toBe(true);
    expect(revision.valido && 'coldChainRequired' in revision.borrador).toBe(false);
  });

  it('devuelve todos los problemas de una vez', () => {
    const revision = revisarProducto(
      campos({ codigo: '', receta: 'quizás', codigoDeBarras: '123' }),
    );

    expect(revision.valido).toBe(false);
    expect(!revision.valido && revision.errores).toHaveLength(4);
  });

  it('rechaza un código con espacios o que empieza con un signo', () => {
    expect(revisarProducto(campos({ codigo: 'A 1', marca: 'x' })).valido).toBe(false);
    expect(revisarProducto(campos({ codigo: '-A1', marca: 'x' })).valido).toBe(false);
    expect(revisarProducto(campos({ codigo: 'FAR/01.a_b-2', marca: 'x' })).valido).toBe(true);
  });

  it('respeta los topes del DTO del backend', () => {
    const largo = 'x'.repeat(301);
    const revision = revisarProducto(campos({ codigo: 'A1', marca: largo }));

    expect(revision.valido).toBe(false);
  });

  it('manda el código de barras como identificador GTIN', () => {
    const revision = revisarProducto(
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
    (gtin) => expect(esGtinValido(gtin)).toBe(true),
  );

  it.each(['7501031311308', '1234567', 'ABCDEFGHIJKLM', '123456789012345'])(
    'rechaza %s',
    (gtin) => expect(esGtinValido(gtin)).toBe(false),
  );
});

describe('leerCsv', () => {
  it('lee coma, con BOM, CRLF y comillas escapadas', () => {
    const lectura = leerCsv(
      '\uFEFFcodigo,marca,presentacion\r\nA1,"Gel ""Frío""","Caja x 20, blíster"\r\n',
    );

    expect(lectura.filas).toEqual([
      {
        numero: 1,
        campos: campos({ codigo: 'A1', marca: 'Gel "Frío"', presentacion: 'Caja x 20, blíster' }),
      },
    ]);
  });

  it('detecta el punto y coma de Excel en castellano', () => {
    const lectura = leerCsv('Código;Principio activo;Receta\nA1;Ibuprofeno;sí\n');

    expect(lectura.filas[0]!.campos).toEqual(
      campos({ codigo: 'A1', generico: 'Ibuprofeno', receta: 'sí' }),
    );
  });

  it('acepta alias y avisa las columnas que ignora', () => {
    const lectura = leerCsv('SKU,nombre,stock\nA1,Algo,12\n');

    expect(lectura.filas[0]!.campos.codigo).toBe('A1');
    expect(lectura.filas[0]!.campos.marca).toBe('Algo');
    expect(lectura.ignoradas).toEqual(['stock']);
  });

  it('salta las filas en blanco', () => {
    const lectura = leerCsv('codigo,marca\nA1,x\n,\n\nA2,y\n');

    expect(lectura.filas.map((fila) => fila.campos.codigo)).toEqual(['A1', 'A2']);
  });

  it('deshace el apóstrofo anti-fórmula del informe de errores', () => {
    const lectura = leerCsv("codigo,marca\nA1,'=Marca\n");

    expect(lectura.filas[0]!.campos.marca).toBe('=Marca');
  });

  it.each([
    ['', 'vacío'],
    ['marca\nx\n', 'codigo'],
    ['codigo\n', 'ningún producto'],
    ['codigo,codigo\nA,B\n', 'mismo encabezado'],
    ['codigo,sku\nA,B\n', 'mismo dato'],
    ['codigo,marca\nA1\n', 'columnas'],
    ['codigo,marca\nA1,"sin cerrar\n', 'comillas'],
  ])('rechaza el archivo entero: %j', (contenido, pista) => {
    expect(() => leerCsv(contenido)).toThrow(ArchivoInvalido);
    expect(() => leerCsv(contenido)).toThrow(new RegExp(pista));
  });

  it(`corta en ${FILAS_MAXIMAS_POR_CARGA} filas`, () => {
    const filas = Array.from({ length: FILAS_MAXIMAS_POR_CARGA + 1 }, (_, i) => `A${i},x`);

    expect(() => leerCsv(['codigo,marca', ...filas].join('\n'))).toThrow(/tope por carga/);
  });
});

describe('revisarCarga', () => {
  const fila = (numero: number, parciales: Partial<CamposDelProducto>) => ({
    numero,
    campos: campos(parciales),
  });

  it('rechaza en todas sus filas un código repetido dentro del archivo', () => {
    const revisadas = revisarCarga(
      [fila(1, { codigo: 'A1', marca: 'x' }), fila(2, { codigo: 'A1', marca: 'y' }), fila(3, { codigo: 'B1', marca: 'z' })],
      new Set(),
    );

    expect(revisadas.map((r) => r.lista)).toEqual([false, false, true]);
    expect(revisadas[0]!.lista === false && revisadas[0]!.motivo).toBe('REPETIDA_EN_EL_ARCHIVO');
  });

  it('rechaza lo que ya está en el catálogo: no hay edición en el backend', () => {
    const revisadas = revisarCarga([fila(1, { codigo: 'A1', marca: 'x' })], new Set(['A1']));

    expect(revisadas[0]!.lista === false && revisadas[0]!.motivo).toBe('YA_EN_EL_CATALOGO');
  });

  it('una fila inválida conserva sus errores', () => {
    const revisadas = revisarCarga([fila(1, { codigo: 'A1' })], new Set());

    expect(revisadas[0]!.lista === false && revisadas[0]!.motivo).toBe('INVALIDA');
  });
});
