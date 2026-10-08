import {
  ArchivoInvalido,
  CAMPOS_VACIOS,
  CATEGORIAS,
  COLUMNAS_DEL_CSV,
  ETIQUETAS_DE_CAMPO,
  cambiosDelBorrador,
  decodificarCsv,
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
      borrador: { productCode: 'PAR-500', genericName: 'Paracetamol', strengthText: '500 mg', inStock: true },
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

describe('revisarProducto · vinculado al catálogo oficial', () => {
  const vinculo = { catalogProductId: 'cat-1', presentationCode: '650047' };

  it('manda el id del catálogo y la presentación, y ningún dato oficial aunque esté escrito', () => {
    const resultado = revisarProducto(
      campos({ codigo: 'SKU-1', marca: 'Otra', generico: 'Otro', concentracion: '1 mg', receta: 'sí', precio: '12,50' }),
      undefined,
      vinculo,
    );
    expect(resultado).toEqual({
      valido: true,
      borrador: {
        productCode: 'SKU-1',
        catalogProductId: 'cat-1',
        catalogPresentationCode: '650047',
        unitPrice: 12.5,
        inStock: true,
      },
    });
  });

  it('no exige marca ni genérico, pero sigue exigiendo el SKU', () => {
    const resultado = revisarProducto(campos({}), undefined, vinculo);
    expect(resultado).toEqual({ valido: false, errores: ['Falta el código del producto.'] });
  });

  it('lo propio se sigue validando: precio y código de barras', () => {
    const resultado = revisarProducto(
      campos({ codigo: 'SKU-1', precio: 'mucho', codigoDeBarras: '123' }),
      undefined,
      vinculo,
    );
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) expect(resultado.errores).toHaveLength(2);
  });

  it('sin vínculo se comporta como siempre: el nombre es obligatorio', () => {
    const resultado = revisarProducto(campos({ codigo: 'SKU-1' }));
    expect(resultado.valido).toBe(false);
  });

  it('al editar un producto del catálogo no se vacían ni se mandan los datos oficiales', () => {
    const resultado = revisarProducto(campos({ codigo: 'SKU-1', precio: '20' }), undefined, vinculo);
    if (!resultado.valido) throw new Error('debía ser válido');
    const cambios = cambiosDelBorrador(resultado.borrador, true, true);
    expect(cambios).toEqual({ unitPrice: 20, category: null, description: null, inStock: true });
    for (const oficial of ['brandName', 'genericName', 'strengthText', 'packageSizeText', 'requiresPrescription']) {
      expect(cambios).not.toHaveProperty(oficial);
    }
  });

  it('al editar uno cargado a mano, vaciar el nombre sí lo borra (comportamiento de siempre)', () => {
    const resultado = revisarProducto(campos({ codigo: 'SKU-1', generico: 'X' }));
    if (!resultado.valido) throw new Error('debía ser válido');
    const cambios = cambiosDelBorrador(resultado.borrador, true);
    expect(cambios).toHaveProperty('brandName', null);
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
        numero: 2,
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
    const lectura = leerCsv('SKU,nombre,lote\nA1,Algo,L-12\n');

    expect(lectura.filas[0]!.campos.codigo).toBe('A1');
    expect(lectura.filas[0]!.campos.marca).toBe('Algo');
    expect(lectura.ignoradas).toEqual(['lote']);
  });

  describe('asignación de columnas', () => {
    it('dice a qué campo fue cada encabezado, en el orden del archivo, y si fue por alias', () => {
      const lectura = leerCsv('SKU,Nombre,precio,lote\nA1,Algo,10,L-12\n');

      expect(lectura.columns).toEqual([
        { header: 'SKU', field: 'codigo', canonicalHeader: 'codigo', matchedBy: 'ALIAS' },
        { header: 'Nombre', field: 'marca', canonicalHeader: 'marca', matchedBy: 'ALIAS' },
        { header: 'precio', field: 'precio', canonicalHeader: 'precio', matchedBy: 'HEADER' },
        { header: 'lote', field: null, canonicalHeader: null, matchedBy: null },
      ]);
    });

    it('los encabezados con mayúsculas, tildes o espacios cuentan como el de la plantilla, no como alias', () => {
      const lectura = leerCsv('Código;Cadena frío;Código de barras\nA1;no;\n');

      expect(lectura.columns.map((c) => [c.field, c.matchedBy])).toEqual([
        ['codigo', 'HEADER'],
        ['cadenaDeFrio', 'HEADER'],
        ['codigoDeBarras', 'ALIAS'],
      ]);
    });

    it('las columnas ignoradas de `ignoradas` son exactamente las que quedan sin campo', () => {
      const lectura = leerCsv('codigo,lote,vence,marca\nA1,L,2027,x\n');

      expect(lectura.columns.filter((c) => c.field === null).map((c) => c.header)).toEqual(lectura.ignoradas);
      expect(lectura.ignoradas).toEqual(['lote', 'vence']);
    });

    it('no cuenta las columnas vacías que Excel deja al final', () => {
      const lectura = leerCsv('codigo;marca;;\nA1;x;;\n');

      expect(lectura.columns.map((c) => c.header)).toEqual(['codigo', 'marca']);
    });

    it('cada campo del producto tiene su etiqueta para mostrarlo', () => {
      for (const columna of COLUMNAS_DEL_CSV) {
        expect(ETIQUETAS_DE_CAMPO[columna.campo]).toBeTruthy();
      }
    });
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
    ['codigo,marca\nA1,"sin cerrar\n', 'comillas'],
  ])('rechaza el archivo entero: %j', (contenido, pista) => {
    expect(() => leerCsv(contenido)).toThrow(ArchivoInvalido);
    expect(() => leerCsv(contenido)).toThrow(new RegExp(pista));
  });

  it('numera cada fila con su línea del archivo, contando encabezado, blancos y saltos entre comillas', () => {
    const lectura = leerCsv('codigo,marca\nA1,x\n\nA2,"dos\nlíneas"\nA3,y\n');

    expect(lectura.filas.map((fila) => fila.numero)).toEqual([2, 4, 6]);
  });

  it('una fila con otra cantidad de columnas se rechaza sola, no el archivo', () => {
    const lectura = leerCsv('codigo,marca\nA1\nA2,x\n');
    const revisadas = revisarCarga(lectura.filas, new Map());

    expect(revisadas.map((fila) => fila.lista)).toEqual([false, true]);
    expect(revisadas[0]!.lista === false && revisadas[0]!.errores[0]).toMatch(/columnas/);
  });

  it('ignora las columnas vacías que Excel deja al final', () => {
    const lectura = leerCsv('codigo;marca;;\nA1;x;;\n');

    expect(lectura.filas[0]!.errorDeForma).toBeUndefined();
    expect(lectura.filas[0]!.campos.marca).toBe('x');
  });

  it('deshace también el apóstrofo delante de un tabulador', () => {
    expect(leerCsv("codigo,marca\nA1,'\tx\n").filas[0]!.campos.marca).toBe('\tx');
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
      new Map(),
    );

    expect(revisadas.map((r) => r.lista)).toEqual([false, false, true]);
    expect(revisadas[0]!.lista === false && revisadas[0]!.motivo).toBe('REPETIDA_EN_EL_ARCHIVO');
  });

  it('en «crear y actualizar», lo que ya está en el catálogo se actualiza con su id', () => {
    const revisadas = revisarCarga([fila(1, { codigo: 'A1', marca: 'x' })], new Map([['A1', 'p-1']]));

    expect(revisadas[0]).toMatchObject({ lista: true, accion: 'ACTUALIZAR', productId: 'p-1' });
  });

  it('en «sólo crear», lo que ya está en el catálogo se rechaza', () => {
    const revisadas = revisarCarga(
      [fila(1, { codigo: 'A1', marca: 'x' })],
      new Map([['A1', 'p-1']]),
      'SOLO_CREAR',
    );

    expect(revisadas[0]!.lista === false && revisadas[0]!.motivo).toBe('YA_EN_EL_CATALOGO');
  });

  it('una fila inválida conserva sus errores', () => {
    const revisadas = revisarCarga([fila(1, { codigo: 'A1' })], new Map());

    expect(revisadas[0]!.lista === false && revisadas[0]!.motivo).toBe('INVALIDA');
  });

  describe('«sólo actualizar»', () => {
    it('actualiza lo que ya está en el catálogo, con su id', () => {
      const revisadas = revisarCarga(
        [fila(1, { codigo: 'A1', marca: 'x' })],
        new Map([['A1', 'p-1']]),
        'SOLO_ACTUALIZAR',
      );

      expect(revisadas[0]).toMatchObject({ lista: true, accion: 'ACTUALIZAR', productId: 'p-1' });
    });

    it('rechaza un código que no está en el catálogo, con un motivo propio y un mensaje que lo dice', () => {
      const revisadas = revisarCarga(
        [fila(1, { codigo: 'NUEVO-1', marca: 'x' })],
        new Map([['A1', 'p-1']]),
        'SOLO_ACTUALIZAR',
      );

      const rechazada = revisadas[0]!;
      expect(rechazada.lista).toBe(false);
      expect(rechazada.lista === false && rechazada.motivo).toBe('NO_EN_EL_CATALOGO');
      expect(rechazada.lista === false && rechazada.errores[0]).toContain('NUEVO-1 no está en su catálogo');
    });

    it('con el catálogo vacío rechaza todas las filas válidas', () => {
      const revisadas = revisarCarga(
        [fila(1, { codigo: 'A1', marca: 'x' }), fila(2, { codigo: 'A2', marca: 'y' })],
        new Map(),
        'SOLO_ACTUALIZAR',
      );

      expect(revisadas.map((r) => r.lista)).toEqual([false, false]);
    });

    it('una fila inválida o repetida sigue rechazándose por su propio motivo, no por «no está»', () => {
      const revisadas = revisarCarga(
        [
          fila(1, { codigo: 'A1' }),
          fila(2, { codigo: 'B1', marca: 'x' }),
          fila(3, { codigo: 'B1', marca: 'y' }),
        ],
        new Map(),
        'SOLO_ACTUALIZAR',
      );

      expect(revisadas.map((r) => r.lista === false && r.motivo)).toEqual([
        'INVALIDA',
        'REPETIDA_EN_EL_ARCHIVO',
        'REPETIDA_EN_EL_ARCHIVO',
      ]);
    });

    it('los otros dos modos no cambian: crear y actualizar acepta el código nuevo', () => {
      const nueva = [fila(1, { codigo: 'NUEVO-1', marca: 'x' })];

      expect(revisarCarga(nueva, new Map(), 'CREAR_Y_ACTUALIZAR')[0]).toMatchObject({ lista: true, accion: 'CREAR' });
      expect(revisarCarga(nueva, new Map(), 'SOLO_CREAR')[0]).toMatchObject({ lista: true, accion: 'CREAR' });
    });
  });

  describe('categorías de la farmacia', () => {
    const conCategoria = (categoria: string) => [fila(1, { codigo: 'A1', marca: 'x', categoria })];

    it('sin la lista, valida contra las categorías fijas de siempre', () => {
      expect(revisarCarga(conCategoria('Bienestar'), new Map())[0]!.lista).toBe(true);
      expect(revisarCarga(conCategoria('Ferretería'), new Map())[0]!.lista).toBe(false);
    });

    it('con la lista de la farmacia acepta las suyas y ya no las fijas', () => {
      const propias = ['Ortopedia', 'Óptica'];

      expect(revisarCarga(conCategoria('Ortopedia'), new Map(), 'CREAR_Y_ACTUALIZAR', propias)[0]!.lista).toBe(true);
      expect(revisarCarga(conCategoria('Medicamentos'), new Map(), 'CREAR_Y_ACTUALIZAR', propias)[0]!.lista).toBe(false);
    });

    it('la categoría se reconoce sin mayúsculas ni tildes y se guarda con la grafía de la farmacia', () => {
      const revisada = revisarCarga(conCategoria('optica'), new Map(), 'CREAR_Y_ACTUALIZAR', ['Ortopedia', 'Óptica'])[0]!;

      expect(revisada.lista && revisada.borrador.category).toBe('Óptica');
    });

    it('una categoría desconocida es un error de fila con el mensaje de siempre, con las de la farmacia', () => {
      const revisada = revisarCarga(conCategoria('Ferretería'), new Map(), 'CREAR_Y_ACTUALIZAR', ['Ortopedia', 'Óptica'])[0]!;

      expect(revisada.lista === false && revisada.motivo).toBe('INVALIDA');
      expect(revisada.lista === false && revisada.errores).toEqual([
        'La categoría tiene que ser una de estas: Ortopedia, Óptica.',
      ]);
    });

    it('dejar la categoría vacía sigue siendo válido aunque la farmacia no tenga ninguna', () => {
      const sinCategoria = [fila(1, { codigo: 'A1', marca: 'x' })];

      expect(revisarCarga(sinCategoria, new Map(), 'CREAR_Y_ACTUALIZAR', [])[0]!.lista).toBe(true);
    });

    it('con una farmacia sin categorías, poner una dice que primero hay que crearla', () => {
      const revisada = revisarCarga(conCategoria('Bienestar'), new Map(), 'CREAR_Y_ACTUALIZAR', [])[0]!;

      expect(revisada.lista === false && revisada.errores[0]).toMatch(/todavía no tiene categorías/);
    });
  });
});

describe('decodificarCsv', () => {
  it('lee UTF-8 tal cual', () => {
    const bytes = new TextEncoder().encode('codigo,marca\nA1,Cápsulas ñandú\n');

    expect(decodificarCsv(bytes)).toEqual({
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

    const { texto, codificacion } = decodificarCsv(bytes);
    expect(codificacion).toBe('windows-1252');
    expect(texto).toBe('codigo,marca\nA1,Cápsulas ñ\n');
    expect(texto).not.toContain('\uFFFD');
  });
});

describe('precio, categoría y disponibilidad', () => {
  it('acepta coma decimal, la categoría sin tildes y «agotado» como sin stock', () => {
    const revision = revisarProducto(
      campos({ codigo: 'A1', marca: 'x', precio: 'Bs 18,5', categoria: 'dermocosmetica', disponible: 'agotado' }),
    );

    expect(revision.valido && revision.borrador).toMatchObject({
      unitPrice: 18.5,
      category: 'Dermocosmética',
      inStock: false,
    });
  });

  it('una cantidad en «disponible» se lee como stock: 0 es sin stock', () => {
    const cero = revisarProducto(campos({ codigo: 'A1', marca: 'x', disponible: '0' }));
    const doce = revisarProducto(campos({ codigo: 'A1', marca: 'x', disponible: '12' }));

    expect(cero.valido && cero.borrador.inStock).toBe(false);
    expect(doce.valido && doce.borrador.inStock).toBe(true);
  });

  it('vacío es disponible: se carga lo que se vende', () => {
    const revision = revisarProducto(campos({ codigo: 'A1', marca: 'x' }));

    expect(revision.valido && revision.borrador.inStock).toBe(true);
  });

  it.each([['1.234,50'], ['-3'], ['0'], ['abc'], ['2000000']])('rechaza el precio %j', (precio) => {
    expect(revisarProducto(campos({ codigo: 'A1', marca: 'x', precio })).valido).toBe(false);
  });

  it('rechaza una categoría que no existe', () => {
    expect(revisarProducto(campos({ codigo: 'A1', marca: 'x', categoria: 'Ferretería' })).valido).toBe(false);
  });

  it('el formulario, sin lista, sigue validando contra las categorías fijas', () => {
    const revision = revisarProducto(campos({ codigo: 'A1', marca: 'x', categoria: CATEGORIAS[1] }));

    expect(revision.valido).toBe(true);
  });

  it('con una lista propia, la categoría se valida contra ella', () => {
    const propias = ['Ortopedia'];

    expect(revisarProducto(campos({ codigo: 'A1', marca: 'x', categoria: 'ortopedia' }), propias)).toMatchObject({
      valido: true,
      borrador: { category: 'Ortopedia' },
    });
    expect(revisarProducto(campos({ codigo: 'A1', marca: 'x', categoria: 'Bienestar' }), propias).valido).toBe(false);
  });

  it('la columna «stock» de otra planilla se lee como disponibilidad', () => {
    const lectura = leerCsv('sku,nombre,stock,precio\nA1,Uno,0,10\n');

    expect(lectura.ignoradas).toEqual([]);
    expect(lectura.filas[0]!.campos).toMatchObject({ disponible: '0', precio: '10' });
  });
});

describe('cambiosDelBorrador', () => {
  const borrador = { productCode: 'A1', brandName: 'Uno', unitPrice: 10, inStock: true } as const;

  it('desde el formulario, lo vacío se borra', () => {
    expect(cambiosDelBorrador(borrador, true)).toEqual({
      brandName: 'Uno',
      genericName: null,
      strengthText: null,
      packageSizeText: null,
      requiresPrescription: null,
      unitPrice: 10,
      category: null,
      description: null,
      inStock: true,
    });
  });

  it('desde el CSV, lo vacío se deja como está', () => {
    expect(cambiosDelBorrador(borrador, false)).toEqual({ brandName: 'Uno', unitPrice: 10, inStock: true });
  });
});
