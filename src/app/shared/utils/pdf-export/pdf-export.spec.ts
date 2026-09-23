/**
 * `jspdf` resuelve a un build distinto bajo Vitest (condición `node`) que bajo
 * el build real de la aplicación (condición `browser`) — el propio
 * `package.json` de la librería lo declara así. Comparar contra la clase real
 * o espiar su prototipo queda atado a cuál de los dos builds resolvió el
 * entorno de pruebas en cada corrida. Se mockea el módulo entero: además de
 * esquivar ese acoplamiento, aísla mejor lo que este archivo tiene que
 * probar de verdad — la extracción de bloques, la paginación y el membrete de
 * marca — de un motor de render que no es código propio.
 *
 * `DocumentoFalso` se declara dentro de `vi.hoisted`: el factory de `vi.mock`
 * se iza por encima de todo el archivo, así que referenciar la clase desde
 * afuera de `vi.hoisted` fallaría con «Cannot access before initialization».
 *
 * El doble anota **todo** lo que el maquetador le pide —colores, filetes,
 * rellenos, opacidad, trazos del isotipo— porque el membrete es parte del
 * contrato: un PDF sin logo ni numeración de páginas no es el documento que
 * este motor promete.
 */
const { DocumentoFalso } = vi.hoisted(() => {
  class DocumentoFalso {
    static instancias: DocumentoFalso[] = [];

    /** La página en la que se está escribiendo; `setPage` la mueve. */
    paginaActual = 1;

    readonly llamadas: {
      setFont: [string, string][];
      setFontSize: number[];
      text: [string, number, number][];
      addPage: number;
      setProperties: [{ title?: string }][];
      save: string[];
      /** Un trazo del isotipo: cuántos segmentos, dónde y con qué escala. */
      lines: { segmentos: number; x: number; y: number; escala: number }[];
      rect: [number, number, number, number, string][];
      line: [number, number, number, number][];
      gState: { opacity?: number }[];
      charSpace: number[];
      setPage: number[];
    } = {
      setFont: [],
      setFontSize: [],
      text: [],
      addPage: 0,
      setProperties: [],
      save: [],
      lines: [],
      rect: [],
      line: [],
      gState: [],
      charSpace: [],
      setPage: [],
    };

    readonly internal = {
      // A4 en puntos, que es el formato que el maquetador pide de verdad.
      pageSize: { getWidth: () => 595, getHeight: () => 842 },
    };

    private paginas = 1;

    constructor() {
      DocumentoFalso.instancias.push(this);
    }

    setFont(family: string, style: string): this {
      this.llamadas.setFont.push([family, style]);
      return this;
    }

    setFontSize(size: number): this {
      this.llamadas.setFontSize.push(size);
      return this;
    }

    /** Una línea por llamada: mantiene la altura de cada bloque predecible. */
    splitTextToSize(text: string): string[] {
      return [text];
    }

    /** Un ancho proporcional al largo alcanza para repartir columnas. */
    getTextWidth(text: string): number {
      return text.length * 5;
    }

    text(line: string, x: number, y: number): this {
      this.llamadas.text.push([line, x, y]);
      return this;
    }

    addPage(): this {
      this.llamadas.addPage += 1;
      this.paginas += 1;
      this.paginaActual = this.paginas;
      return this;
    }

    getNumberOfPages(): number {
      return this.paginas;
    }

    setPage(pagina: number): this {
      this.llamadas.setPage.push(pagina);
      this.paginaActual = pagina;
      return this;
    }

    setProperties(props: { title?: string }): this {
      this.llamadas.setProperties.push([props]);
      return this;
    }

    save(filename: string): this {
      this.llamadas.save.push(filename);
      return this;
    }

    lines(
      segmentos: number[][],
      x: number,
      y: number,
      escala: [number, number],
    ): this {
      this.llamadas.lines.push({ segmentos: segmentos.length, x, y, escala: escala[0] });
      return this;
    }

    rect(x: number, y: number, ancho: number, alto: number, estilo: string): this {
      this.llamadas.rect.push([x, y, ancho, alto, estilo]);
      return this;
    }

    line(x1: number, y1: number, x2: number, y2: number): this {
      this.llamadas.line.push([x1, y1, x2, y2]);
      return this;
    }

    setCharSpace(espacio: number): this {
      this.llamadas.charSpace.push(espacio);
      return this;
    }

    GState(parametros: { opacity?: number }): { opacity?: number } {
      return parametros;
    }

    setGState(estado: { opacity?: number }): this {
      this.llamadas.gState.push(estado);
      return this;
    }

    setTextColor(): this {
      return this;
    }

    setDrawColor(): this {
      return this;
    }

    setFillColor(): this {
      return this;
    }

    setLineWidth(): this {
      return this;
    }

    saveGraphicsState(): this {
      return this;
    }

    restoreGraphicsState(): this {
      return this;
    }
  }

  return { DocumentoFalso };
});

vi.mock('jspdf', () => ({ jsPDF: DocumentoFalso }));

/**
 * El sujeto se importa **dentro de cada prueba**, no arriba del archivo.
 *
 * ## El defecto que esto cierra
 *
 * `pdf-export.ts` hace `import { jsPDF } from 'jspdf'` y resuelve ese binding
 * **una sola vez, cuando el módulo se evalúa**. Con un `import` estático acá,
 * quien evalúe `pdf-export.ts` primero decide con qué jsPDF se queda para toda
 * la corrida — y este archivo no es el único que lo arrastra:
 *
 * ```
 * clinical-pdf.spec.ts → clinical-pdf.ts → pdf-export.ts → jspdf REAL
 * ```
 *
 * `clinical-pdf.spec.ts` y `pdf-export-button.spec.ts` ejercitan jsPDF de
 * verdad **a propósito** —comprueban que el documento se genera, que es el
 * criterio del contrato de receta— así que no lo mockean. Si alguno de los dos
 * corre antes que éste en el mismo trabajador, `pdf-export.ts` ya está en el
 * caché con el jsPDF real y `vi.mock` llega tarde: las pruebas de este archivo
 * fallan con «Ningún documento se construyó».
 *
 * Se midió: pasa en la suite completa, según cómo Vitest reparta los archivos
 * entre trabajadores, y no se reproduce corriendo estos archivos sueltos
 * —cuando son pocos, cada uno recibe su propio entorno—. O sea: **rojo
 * intermitente que no se puede reproducir a demanda**, que es la peor clase.
 *
 * ## Por qué así y no mockeando en los otros dos
 *
 * Porque el mock allá borraría justo lo que esas pruebas existen para
 * comprobar. El problema no es de ellas: es que este archivo dependía de ser el
 * primero. Con `resetModules` + import dinámico deja de depender de nadie.
 */
let buildPdfDocument: typeof import('./pdf-export').buildPdfDocument;
let buildBlocksPdf: typeof import('./pdf-export').buildBlocksPdf;
let exportElementToPdf: typeof import('./pdf-export').exportElementToPdf;

/** Un elemento con encabezado, párrafo y una tabla de dos filas. */
function elementoDeEjemplo(): HTMLElement {
  const el = document.createElement('div');
  el.innerHTML = `
    <h2>Presupuesto</h2>
    <p>Paciente: Ana Pérez</p>
    <table>
      <tr><th>Servicio</th><th>Precio</th></tr>
      <tr><td>Consulta general</td><td>100.00</td></tr>
      <tr><td>Limpieza dental</td><td>80.00</td></tr>
    </table>
  `;
  return el;
}

function ultimoDocumento(): InstanceType<typeof DocumentoFalso> {
  const doc = DocumentoFalso.instancias.at(-1);
  if (doc === undefined) {
    throw new Error('Ningún documento se construyó.');
  }
  return doc;
}

/**
 * Lo que se escribió en la hoja **sin el membrete ni el pie**.
 *
 * El maquetador estampa la marca, la clase de documento y la numeración de
 * páginas en cada carilla; una prueba de contenido que las mire tendría que
 * reescribirse cada vez que el membrete cambie de forma. Se descartan por lo
 * que son —chrome de la hoja—, no por su texto.
 */
function textosDelCuerpo(): string[] {
  const doc = ultimoDocumento();
  const titulos = doc.llamadas.setProperties.flatMap(([props]) =>
    props.title === undefined ? [] : [props.title, props.title.toLocaleUpperCase('es')],
  );
  return doc.llamadas.text
    .map(([linea]) => linea)
    .filter(
      (linea) =>
        linea !== 'ALOVIDA' &&
        !linea.startsWith('Página ') &&
        !linea.includes('Documento confidencial') &&
        !titulos.includes(linea),
    );
}

beforeEach(async () => {
  DocumentoFalso.instancias = [];

  // `resetModules` vacía el registro y el `import()` de abajo vuelve a evaluar
  // `pdf-export.ts` — esta vez con el `vi.mock` de arriba ya registrado, corra
  // lo que corra antes en este trabajador.
  vi.resetModules();
  ({ buildPdfDocument, buildBlocksPdf, exportElementToPdf } = await import('./pdf-export'));
});

describe('buildPdfDocument', () => {
  it('extrae encabezado, párrafo y filas de tabla, en orden', () => {
    buildPdfDocument(elementoDeEjemplo());

    // La tabla se maqueta por columnas, así que cada celda es una llamada
    // aparte: lo que se comprueba es que estén todas y en orden de lectura.
    expect(textosDelCuerpo()).toEqual([
      'PRESUPUESTO',
      'Paciente: Ana Pérez',
      'Servicio',
      'Precio',
      'Consulta general',
      '100.00',
      'Limpieza dental',
      '80.00',
    ]);
  });

  it('ignora los bloques sin texto', () => {
    const el = document.createElement('div');
    el.innerHTML = '<h2></h2><p>   </p><p>Contenido real</p>';

    buildPdfDocument(el);

    expect(textosDelCuerpo()).toEqual(['Contenido real']);
  });

  it('toma los pares de una lista de definiciones como datos con etiqueta', () => {
    const el = document.createElement('div');
    el.innerHTML = '<dl><dt>Paciente</dt><dd>Ana Pérez</dd><dt>Sin valor</dt></dl>';

    buildPdfDocument(el);

    // La etiqueta va en versalitas en su columna, y el valor en la suya.
    expect(textosDelCuerpo()).toEqual(['PACIENTE', 'Ana Pérez']);
  });

  it('imprime el título arriba y lo guarda en las propiedades del documento', () => {
    buildPdfDocument(elementoDeEjemplo(), { title: 'Presupuesto de Ana Pérez' });

    const doc = ultimoDocumento();
    expect(doc.llamadas.setProperties).toEqual([[{ title: 'Presupuesto de Ana Pérez' }]]);
    expect(doc.llamadas.text.map(([linea]) => linea)).toContain('Presupuesto de Ana Pérez');
  });

  it('agrega una página nueva cuando el contenido no entra en la primera', () => {
    const el = document.createElement('div');
    // Cada párrafo ocupa una línea de 14pt más 9 de aire; en una A4 con el
    // membrete arriba entran menos de treinta, así que ochenta desbordan.
    el.innerHTML = Array.from({ length: 80 }, (_, i) => `<p>Línea ${i}</p>`).join('');

    buildPdfDocument(el);

    expect(ultimoDocumento().llamadas.addPage).toBeGreaterThan(0);
  });

  it('no agrega páginas de más cuando el contenido entra en una sola', () => {
    buildPdfDocument(elementoDeEjemplo());

    expect(ultimoDocumento().llamadas.addPage).toBe(0);
  });
});

describe('el membrete de marca', () => {
  it('estampa el isotipo dos veces por página: el del membrete y la filigrana', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }], { title: 'Receta médica' });

    const doc = ultimoDocumento();
    // Cuatro contornos por isotipo; dos isotipos en la única página.
    expect(doc.llamadas.lines).toHaveLength(8);
    // La filigrana es la grande, y va con opacidad: es el fondo, no un sello
    // encima del texto.
    const anchos = doc.llamadas.lines.map((trazo) => trazo.escala);
    expect(Math.max(...anchos)).toBeGreaterThan(Math.min(...anchos));
    expect(doc.llamadas.gState.map((estado) => estado.opacity)).toContain(0.05);
  });

  it('la marca y la clase de documento se escriben con las letras separadas', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }], {
      title: 'Receta médica',
      kind: 'Receta médica',
    });

    const doc = ultimoDocumento();
    expect(doc.llamadas.text.map(([linea]) => linea)).toContain('RECETA MÉDICA');
    // El espaciado vuelve a cero después de cada texto espaciado: en un PDF es
    // un ajuste global y dejarlo puesto abriría las letras del cuerpo.
    expect(doc.llamadas.charSpace.at(-1)).toBe(0);
  });

  it('numera todas las páginas sobre el total, al final', () => {
    buildBlocksPdf(
      Array.from({ length: 80 }, (_, i) => ({ kind: 'paragraph' as const, text: `Línea ${i}` })),
      { title: 'Historia clínica' },
    );

    const doc = ultimoDocumento();
    const paginas = doc.llamadas.text
      .map(([linea]) => linea)
      .filter((linea) => linea.startsWith('Página '));
    expect(paginas.length).toBeGreaterThan(1);
    // El total es el mismo en todas: se sella cuando ya se sabe cuántas hay.
    expect(paginas[0]).toBe(`Página 1 de ${paginas.length}`);
    expect(paginas.at(-1)).toBe(`Página ${paginas.length} de ${paginas.length}`);
    expect(doc.llamadas.setPage).toEqual(
      Array.from({ length: paginas.length }, (_, i) => i + 1),
    );
  });

  it('el pie dice la línea legal que el documento pida', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }], {
      title: 'Comprobante',
      footerNote: 'No válido como factura',
    });

    expect(ultimoDocumento().llamadas.text.map(([linea]) => linea)).toContain(
      'No válido como factura',
    );
  });
});

describe('las tablas', () => {
  it('alinea las columnas y manda a la derecha la de importes', () => {
    buildBlocksPdf([
      { kind: 'row', text: 'Concepto\tImporte', cells: ['Concepto', 'Importe'], header: true },
      { kind: 'row', text: 'Consulta\t100.00', cells: ['Consulta', '100.00'] },
      { kind: 'row', text: 'Limpieza\t80.00', cells: ['Limpieza', '80.00'] },
    ]);

    const doc = ultimoDocumento();
    const x = new Map(doc.llamadas.text.map(([linea, posicion]) => [linea, posicion]));
    // Las dos filas del cuerpo comparten el borde de cada columna.
    expect(x.get('Consulta')).toBe(x.get('Limpieza'));
    expect(x.get('100.00')).toBe(x.get('80.00'));
    // Y los importes terminan a la derecha de donde arranca su columna.
    expect(x.get('100.00')).toBeGreaterThan(x.get('Consulta') ?? 0);
    // La cabecera se dibuja sobre un panel: un relleno más que los filetes.
    expect(doc.llamadas.rect.length).toBeGreaterThan(0);
  });

  /**
   * El defecto que esto cierra: una tabla larga seguía en la carilla siguiente
   * **sin sus nombres de columna**. En un plan de 36 cuotas, la página 2 quedaba
   * con cuatro columnas de números y ninguna forma de saber cuál era el capital
   * y cuál el interés sin volver a la página 1 — que en un papel impreso a veces
   * ya no está.
   */
  it('repite la fila de encabezado cuando la tabla sigue en otra página', () => {
    const filas = Array.from({ length: 60 }, (_, i) => ({
      kind: 'row' as const,
      text: `Cuota ${i + 1}	100.00`,
      cells: [`Cuota ${i + 1}`, '100.00'],
    }));

    buildBlocksPdf([
      { kind: 'row', text: 'Concepto	Importe', cells: ['Concepto', 'Importe'], header: true },
      ...filas,
    ]);

    const doc = ultimoDocumento();
    expect(doc.llamadas.addPage).toBeGreaterThan(0);
    const vecesQueSeNombraLaColumna = doc.llamadas.text.filter(
      ([linea]) => linea === 'Importe',
    ).length;
    expect(vecesQueSeNombraLaColumna).toBe(doc.llamadas.addPage + 1);
  });

  /**
   * El defecto que esto cierra: con una tabla que no entra a lo ancho, repartir
   * la falta entre todas las columnas por igual partía en dos renglones un
   * encabezado de una sola palabra («Atencion / es»), que es lo primero que se
   * lee como descuido en un documento.
   */
  it('no achica la columna angosta cuando la tabla no entra a lo ancho', () => {
    const largo = 'Motivo de consulta con una descripción muy larga que no entra de ninguna forma';
    buildBlocksPdf([
      { kind: 'row', text: '', cells: ['Paciente', 'Motivo', 'Atenciones'], header: true },
      { kind: 'row', text: '', cells: [`Paciente ${largo}`, largo, '2'] },
    ]);

    const doc = ultimoDocumento();
    // El rótulo entra entero: se escribió en una sola llamada y no en dos.
    const veces = doc.llamadas.text.filter(([linea]) => linea === 'Atenciones').length;
    expect(veces).toBe(1);
  });

  /**
   * Los renglones en blanco son de los documentos que se completan a mano —un
   * formulario impreso—. Se cuentan contra el mismo documento sin ellos: el
   * membrete y el pie también dibujan filetes, y un conteo absoluto se
   * rompería con el próximo retoque del membrete.
   */
  it('dibuja un filete por cada renglón en blanco que se le pida', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Motivo de consulta' }]);
    const sinRenglones = ultimoDocumento().llamadas.line.length;

    buildBlocksPdf([
      { kind: 'paragraph', text: 'Motivo de consulta' },
      { kind: 'blank', text: '', lines: 3 },
    ]);

    expect(ultimoDocumento().llamadas.line).toHaveLength(sinRenglones + 3);
  });

  it('un renglón en blanco sin cantidad declarada es uno solo', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Alergias' }]);
    const sinRenglones = ultimoDocumento().llamadas.line.length;

    buildBlocksPdf([
      { kind: 'paragraph', text: 'Alergias' },
      { kind: 'blank', text: '' },
    ]);

    expect(ultimoDocumento().llamadas.line).toHaveLength(sinRenglones + 1);
  });

  it('un corte de hoja abre una página nueva', () => {
    buildBlocksPdf([
      { kind: 'paragraph', text: 'Primera hoja' },
      { kind: 'pagebreak', text: '' },
      { kind: 'paragraph', text: 'Segunda hoja' },
    ]);

    expect(ultimoDocumento().llamadas.addPage).toBe(1);
  });

  /**
   * Un corte sobre una hoja recién abierta dejaría una carilla en blanco, que
   * en un documento impreso se lee como una falla de la impresora.
   */
  it('un corte de hoja sobre una hoja vacía no hace nada', () => {
    buildBlocksPdf([
      { kind: 'pagebreak', text: '' },
      { kind: 'paragraph', text: 'Única hoja' },
      { kind: 'pagebreak', text: '' },
      { kind: 'pagebreak', text: '' },
      { kind: 'paragraph', text: 'Segunda hoja' },
    ]);

    expect(ultimoDocumento().llamadas.addPage).toBe(1);
  });

  it('no manda a la derecha una columna que no es de números', () => {
    buildBlocksPdf([
      { kind: 'row', text: 'Estudio\tPreparación', cells: ['Estudio', 'Preparación'], header: true },
      { kind: 'row', text: 'Hemograma\tAyuno de 8 horas', cells: ['Hemograma', 'Ayuno de 8 horas'] },
    ]);

    const doc = ultimoDocumento();
    const encabezado = doc.llamadas.text.find(([linea]) => linea === 'Preparación');
    const celda = doc.llamadas.text.find(([linea]) => linea === 'Ayuno de 8 horas');
    // Alineadas a la izquierda las dos: comparten el borde de la columna.
    expect(encabezado?.[1]).toBe(celda?.[1]);
  });
});

describe('exportElementToPdf', () => {
  it('guarda con el nombre de archivo dado', () => {
    exportElementToPdf(elementoDeEjemplo(), 'presupuesto-ana-perez.pdf');

    expect(ultimoDocumento().llamadas.save).toEqual(['presupuesto-ana-perez.pdf']);
  });

  it('agrega la extensión .pdf si falta', () => {
    exportElementToPdf(elementoDeEjemplo(), 'presupuesto-ana-perez');

    expect(ultimoDocumento().llamadas.save).toEqual(['presupuesto-ana-perez.pdf']);
  });
});
