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
    static lineasForzadas = 0;

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
      /** Un rectángulo redondeado: panel, aviso, caja de totales o marco del QR. */
      roundedRect: [number, number, number, number, string][];
      circle: [number, number, number][];
      /** Los textos rotados: la marca de agua. */
      rotated: string[];
      /** Todo lo escrito, rotado o no, en el orden en que se escribió. */
      orden: string[];
      line: [number, number, number, number][];
      gState: { opacity?: number }[];
      charSpace: number[];
      setPage: number[];
      /** Una imagen: qué formato y en qué caja se dibujó. */
      addImage: { formato: string; x: number; y: number; ancho: number; alto: number }[];
      /** Una fuente registrada: con qué archivo, familia y estilo. */
      addFont: [string, string, string][];
    } = {
      setFont: [],
      setFontSize: [],
      text: [],
      addPage: 0,
      setProperties: [],
      save: [],
      lines: [],
      rect: [],
      roundedRect: [],
      circle: [],
      rotated: [],
      orden: [],
      line: [],
      gState: [],
      charSpace: [],
      setPage: [],
      addImage: [],
      addFont: [],
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
      if (DocumentoFalso.lineasForzadas > 0 && text === 'PÁRRAFO_LARGO') {
        return Array.from({ length: DocumentoFalso.lineasForzadas }, (_, i) => `Renglón ${i + 1}`);
      }
      return [text];
    }

    /** Un ancho proporcional al largo alcanza para repartir columnas. */
    getTextWidth(text: string): number {
      return text.length * 5;
    }

    text(line: string | string[], x: number, y: number, opciones?: { angle?: number }): this {
      if (opciones?.angle !== undefined) {
        this.llamadas.rotated.push(String(line));
        this.llamadas.orden.push(`rotado:${String(line)}`);
        return this;
      }
      this.llamadas.orden.push(...(Array.isArray(line) ? line : [line]));
      for (const [index, value] of (Array.isArray(line) ? line : [line]).entries()) {
        this.llamadas.text.push([value, x, y + index * 14]);
      }
      return this;
    }

    addPage(): this {
      this.llamadas.addPage += 1;
      this.llamadas.orden.push('— hoja nueva —');
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

    lines(segmentos: number[][], x: number, y: number, escala: [number, number]): this {
      this.llamadas.lines.push({ segmentos: segmentos.length, x, y, escala: escala[0] });
      return this;
    }

    rect(x: number, y: number, ancho: number, alto: number, estilo: string): this {
      this.llamadas.rect.push([x, y, ancho, alto, estilo]);
      return this;
    }

    roundedRect(x: number, y: number, ancho: number, alto: number, _rx: number, _ry: number, estilo: string): this {
      this.llamadas.roundedRect.push([x, y, ancho, alto, estilo]);
      return this;
    }

    circle(x: number, y: number, radio: number): this {
      this.llamadas.circle.push([x, y, radio]);
      return this;
    }

    line(x1: number, y1: number, x2: number, y2: number): this {
      this.llamadas.orden.push('— filete —');
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

    /** `fallar` simula una imagen que `jsPDF` no acepta: lanza igual que el real. */
    static fallarAlDibujarImagenes = false;

    addImage(
      _datos: string,
      formato: string,
      x: number,
      y: number,
      ancho: number,
      alto: number,
    ): this {
      if (DocumentoFalso.fallarAlDibujarImagenes) {
        throw new Error('imagen no soportada');
      }
      this.llamadas.addImage.push({ formato, x, y, ancho, alto });
      return this;
    }

    getImageProperties(): { width: number; height: number } {
      if (DocumentoFalso.fallarAlDibujarImagenes) {
        throw new Error('imagen no soportada');
      }
      return { width: 1, height: 1 };
    }

    addFileToVFS(): this {
      return this;
    }

    addFont(archivo: string, familia: string, estilo: string): this {
      this.llamadas.addFont.push([archivo, familia, estilo]);
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

    clip(): this {
      return this;
    }

    discardPath(): this {
      return this;
    }

    restoreGraphicsState(): this {
      return this;
    }
  }

  return { DocumentoFalso };
});

/**
 * Sin `ShadingPattern` ni `advancedAPI`, el maquetador pinta cada degradado con
 * su color del medio: es el camino de respaldo, y deja contar los rellenos.
 */
vi.mock('jspdf', () => ({ jsPDF: DocumentoFalso, ShadingPattern: undefined }));

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
let campoDeBloque: typeof import('./pdf-export').campoDeBloque;
let buildBlocksPdf: typeof import('./pdf-export').buildBlocksPdf;
let exportElementToPdf: typeof import('./pdf-export').exportElementToPdf;
let establecerLogoDeDocumentos: typeof import('../../../core/pdf-branding/pdf-logo').establecerLogoDeDocumentos;
let setDocumentSignature: typeof import('../../../core/pdf-branding/pdf-signature').setDocumentSignature;
let setDocumentFonts: typeof import('../../../core/pdf-branding/pdf-fonts').setDocumentFonts;

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

/** Lo que es una fecha de emisión tal como la escribe el papel: `24/10/2026, 10:32`. */
const FECHA_DE_EMISION = /^\d{2}\/\d{2}\/\d{4}, \d{2}:\d{2}$/;

/**
 * Lo que se escribió en la hoja **sin el membrete ni el pie**.
 *
 * El maquetador estampa la marca, la fecha de emisión, el emisor y la
 * numeración en cada carilla; una prueba de contenido que las mire tendría que
 * reescribirse cada vez que el membrete cambie de forma. Se descartan por lo
 * que son —chrome de la hoja—, no por su posición.
 */
function textosDelCuerpo(): string[] {
  const doc = ultimoDocumento();
  const titulos = doc.llamadas.setProperties.flatMap(([props]) =>
    props.title === undefined ? [] : [props.title],
  );
  return doc.llamadas.text
    .map(([linea]) => linea)
    .filter(
      (linea) =>
        linea !== 'AloVida' &&
        linea !== 'FECHA DE EMISIÓN' &&
        linea !== 'FECHA DE GENERACIÓN' &&
        !FECHA_DE_EMISION.test(linea) &&
        !linea.startsWith('Página ') &&
        !linea.includes('Emitido el') &&
        !linea.includes('Generado el') &&
        !titulos.includes(linea),
    );
}

beforeEach(async () => {
  DocumentoFalso.instancias = [];
  DocumentoFalso.lineasForzadas = 0;

  // `resetModules` vacía el registro y el `import()` de abajo vuelve a evaluar
  // `pdf-export.ts` — esta vez con el `vi.mock` de arriba ya registrado, corra
  // lo que corra antes en este trabajador.
  vi.resetModules();
  ({ buildPdfDocument, buildBlocksPdf, exportElementToPdf, campoDeBloque } = await import('./pdf-export'));
  ({ establecerLogoDeDocumentos } = await import('../../../core/pdf-branding/pdf-logo'));
  ({ setDocumentSignature } = await import('../../../core/pdf-branding/pdf-signature'));
  ({ setDocumentFonts } = await import('../../../core/pdf-branding/pdf-fonts'));
  setDocumentSignature(null);
  setDocumentFonts(null);
  DocumentoFalso.fallarAlDibujarImagenes = false;
  establecerLogoDeDocumentos(null);
});

/**
 * Al terminar este archivo, `jspdf` vuelve a ser el de verdad y no queda nada
 * de la sesión en los holders del papel.
 *
 * Con el empaquetado del corredor de Angular, el `vi.mock` de arriba no queda
 * dentro de este archivo: cualquier prueba que importe el motor de PDF después
 * —la receta del simulador, la factura— recibía `DocumentoFalso` y reventaba con
 * «output is not a function» o «widths» de `undefined`, según el orden en que el
 * trabajador recorriera los archivos. `doUnmock` no se eleva como `vi.mock`, así
 * que corre acá, al final, y `resetModules` descarta lo ya evaluado con el falso.
 * Lo que el archivo deja fijado —el logo o la firma de la sesión— se limpia
 * también tras cada prueba.
 */
afterEach(() => {
  establecerLogoDeDocumentos(null);
  setDocumentSignature(null);
  setDocumentFonts(null);
});

afterAll(() => {
  vi.doUnmock('jspdf');
  vi.resetModules();
});

/**
 * El builder de Angular corre todos los archivos en el mismo entorno, sin
 * aislar módulos: lo que este archivo deja —el logo o la firma de la sesión
 * fijados en un holder, `pdf-export.ts` evaluado con el jsPDF falso en la
 * caché— lo heredaría el archivo siguiente. Se limpia al salir.
 */
afterEach(() => {
  establecerLogoDeDocumentos(null);
  setDocumentSignature(null);
  setDocumentFonts(null);
});

afterAll(() => {
  vi.resetModules();
});


describe('buildPdfDocument', () => {
  it('extrae encabezado, párrafo y filas de tabla, en orden', () => {
    buildPdfDocument(elementoDeEjemplo());

    // La tabla se maqueta por columnas, así que cada celda es una llamada
    // aparte: lo que se comprueba es que estén todas y en orden de lectura. La
    // cabecera va en versalitas.
    expect(textosDelCuerpo()).toEqual([
      'Presupuesto',
      'Paciente: Ana Pérez',
      'SERVICIO',
      'PRECIO',
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

  /**
   * El defecto que esto cierra: el balance contable salía con el rótulo del
   * propio botón «Exportar a PDF» como primer párrafo, una columna
   * «Seleccionar las filas visibles» y las flechas de orden pegadas a cada
   * encabezado. Lo que es control o texto sólo para lectores de pantalla no es
   * contenido del papel.
   */
  it('no copia los controles ni el texto oculto de la pantalla', () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="informe-encabezado">
        <h2>Balance de sumas y saldos</h2>
        <app-pdf-export-button><button type="button">Exportar a PDF</button></app-pdf-export-button>
        <button type="button">Exportar a CSV</button>
      </div>
      <table>
        <caption class="sr-only">Saldos por cuenta</caption>
        <thead>
          <tr>
            <th data-pdf-ignore><input type="checkbox" aria-label="Seleccionar las filas visibles" /></th>
            <th><button type="button">Cuenta <span aria-hidden="true">↕</span></button></th>
            <th>Saldo</th>
            <th data-pdf-ignore><span class="sr-only">Ver el detalle de la fila</span></th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td data-pdf-ignore><input type="checkbox" /></td>
            <td>Caja</td>
            <td>1.500,00</td>
            <td data-pdf-ignore><button type="button"><span aria-hidden="true">▼</span></button></td>
          </tr>
        </tbody>
      </table>
    `;

    buildPdfDocument(el);

    expect(textosDelCuerpo()).toEqual([
      'Balance de sumas y saldos',
      'CUENTA',
      'SALDO',
      'Caja',
      '1.500,00',
    ]);
  });

  /**
   * El defecto que esto cierra: el balance contable salía con «Balance de
   * sumas y saldos» como título grande y, dos renglones abajo, la misma frase
   * como sección — el `h2` de la pantalla y el `title` del botón son el mismo
   * texto. Sólo se quita el primer encabezado, y sólo si coincide.
   */
  it('no repite como sección el encabezado de la pantalla que ya es el título', () => {
    const el = document.createElement('div');
    el.innerHTML =
      '<h2>Balance de sumas y saldos</h2><p>Saldos</p><h2>Balance de sumas y saldos</h2>';

    buildPdfDocument(el, { title: 'Balance de sumas y saldos' });

    // Una vez en la portada y una vez el segundo `h2`, que es contenido: el
    // primero se fue. Las hojas de continuación no hay: entra en una.
    const lineas = ultimoDocumento().llamadas.text.map(([linea]) => linea);
    expect(ultimoDocumento().llamadas.addPage).toBe(0);
    expect(lineas.filter((linea) => linea === 'Balance de sumas y saldos')).toHaveLength(2);
    expect(textosDelCuerpo()).toEqual(['Saldos']);
  });

  it('conserva el primer encabezado cuando no coincide con el título', () => {
    buildPdfDocument(elementoDeEjemplo(), { title: 'Presupuesto de Ana Pérez' });

    expect(textosDelCuerpo()[0]).toBe('Presupuesto');
  });

  it('imprime el título en la portada y lo guarda en las propiedades del documento', () => {
    buildPdfDocument(elementoDeEjemplo(), {
      title: 'Presupuesto de Ana Pérez',
      subtitle: 'Consultorio Illimani',
    });

    const doc = ultimoDocumento();
    expect(doc.llamadas.setProperties).toEqual([
      [
        // La bajada no va a los metadatos: en un papel clínico dice de quién es.
        { title: 'Presupuesto de Ana Pérez', author: 'AloVida', creator: 'AloVida' },
      ],
    ]);
    expect(doc.llamadas.text.map(([linea]) => linea)).toContain('Presupuesto de Ana Pérez');
  });

  it('agrega una página nueva cuando el contenido no entra en la primera', () => {
    const el = document.createElement('div');
    el.innerHTML = Array.from({ length: 80 }, (_, i) => `<p>Línea ${i}</p>`).join('');

    buildPdfDocument(el);

    expect(ultimoDocumento().llamadas.addPage).toBeGreaterThan(0);
  });

  it('no agrega páginas de más cuando el contenido entra en una sola', () => {
    buildPdfDocument(elementoDeEjemplo());

    expect(ultimoDocumento().llamadas.addPage).toBe(0);
  });
});

describe('las fuentes de marca', () => {
  const FUENTES = {
    titulos: { archivo: 'poppins-600.ttf', base64: 'AA==' },
    rotulos: { archivo: 'poppins-500.ttf', base64: 'AA==' },
    cuerpo: { archivo: 'nunito-sans-400.ttf', base64: 'AA==' },
    cuerpoDestacado: { archivo: 'nunito-sans-700.ttf', base64: 'AA==' },
  };

  it('sin fuentes cargadas todo el papel va en Helvetica', () => {
    buildBlocksPdf([
      { kind: 'heading', text: 'Sección', level: 2 },
      { kind: 'paragraph', text: 'Cuerpo' },
    ]);

    const doc = ultimoDocumento();
    expect(doc.llamadas.addFont).toEqual([]);
    expect(new Set(doc.llamadas.setFont.map(([familia]) => familia))).toEqual(
      new Set(['helvetica']),
    );
    // Lo destacado en negrita, la lectura en normal.
    expect(doc.llamadas.setFont).toContainEqual(['helvetica', 'bold']);
    expect(doc.llamadas.setFont).toContainEqual(['helvetica', 'normal']);
  });

  it('con fuentes cargadas registra las cuatro de AloVida y escribe títulos en Poppins y lectura en Nunito Sans', () => {
    setDocumentFonts(FUENTES);
    buildBlocksPdf([
      { kind: 'heading', text: 'Sección', level: 2 },
      { kind: 'paragraph', text: 'Cuerpo' },
    ]);

    const doc = ultimoDocumento();
    expect(doc.llamadas.addFont).toEqual([
      ['poppins-600.ttf', 'Poppins-SemiBold', 'normal'],
      ['poppins-500.ttf', 'Poppins-Medium', 'normal'],
      ['nunito-sans-400.ttf', 'NunitoSans-Regular', 'normal'],
      ['nunito-sans-700.ttf', 'NunitoSans-Bold', 'normal'],
    ]);
    const familias = doc.llamadas.setFont.map(([familia]) => familia);
    expect(familias).toContain('Poppins-SemiBold');
    expect(familias).toContain('NunitoSans-Regular');
    expect(familias).not.toContain('helvetica');
    // El título de sección se escribió justo después de poner Poppins.
    const indiceDelTitulo = doc.llamadas.text.findIndex(([linea]) => linea === 'Sección');
    expect(indiceDelTitulo).toBeGreaterThan(-1);
  });

  /** Cada `jsPDF` guarda sus fuentes: un segundo documento las registra de nuevo. */
  it('registra las fuentes en cada documento, no una vez por sesión', () => {
    setDocumentFonts(FUENTES);
    buildBlocksPdf([{ kind: 'paragraph', text: 'Uno' }]);
    buildBlocksPdf([{ kind: 'paragraph', text: 'Dos' }]);

    expect(DocumentoFalso.instancias.map((doc) => doc.llamadas.addFont.length)).toEqual([4, 4]);
  });
});

describe('la portada, el membrete y el pie', () => {
  const ANCHO = 595;

  it('la primera hoja abre con la portada a sangre y el isotipo en el membrete', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }], { title: 'Receta médica' });

    const doc = ultimoDocumento();
    // La banda de la portada cruza la hoja de borde a borde desde arriba.
    expect(doc.llamadas.rect.some(([x, y, ancho]) => x === 0 && y === 0 && ancho === ANCHO)).toBe(true);
    // Dos isotipos: el de la marca y el grande y tenue que firma la portada.
    expect(doc.llamadas.lines).toHaveLength(8);
    expect(doc.llamadas.gState.map((estado) => estado.opacity)).toContain(0.07);
    expect(doc.llamadas.text.map(([linea]) => linea)).toContain('AloVida');
  });

  it('las hojas siguientes llevan un membrete corto con la marca, el título y el folio', () => {
    buildBlocksPdf(
      Array.from({ length: 80 }, (_, i) => ({ kind: 'paragraph' as const, text: `Línea ${i}` })),
      { title: 'Historia clínica', reference: 'N.º 0042' },
    );

    const doc = ultimoDocumento();
    const paginas = doc.llamadas.addPage + 1;
    const lineas = doc.llamadas.text.map(([linea]) => linea);
    // La marca en el membrete de cada hoja, y AloVida como emisor en cada pie.
    expect(lineas.filter((linea) => linea === 'AloVida')).toHaveLength(paginas * 2);
    expect(lineas.filter((linea) => linea === 'Historia clínica  ·  N.º 0042')).toHaveLength(paginas - 1);
    // Un isotipo por hoja de continuación, más los dos de la portada.
    expect(doc.llamadas.lines).toHaveLength((paginas - 1) * 4 + 8);
  });

  it('la clase de documento se escribe en versalitas espaciadas y el espaciado vuelve a cero', () => {
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

  it('la portada dice la fecha de emisión y los metadatos que el documento pida', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }], {
      title: 'Cotización',
      reference: 'N.º 0042',
      issuedAt: new Date(2026, 9, 24, 10, 32),
      meta: [
        { label: 'Válida hasta', value: '23/11/2026' },
        { label: 'Sin valor', value: '  ' },
      ],
    });

    const lineas = ultimoDocumento().llamadas.text.map(([linea]) => linea);
    expect(lineas).toContain('N.º 0042');
    expect(lineas).toContain('FECHA DE EMISIÓN');
    expect(lineas).toContain('24/10/2026, 10:32');
    expect(lineas).toContain('VÁLIDA HASTA');
    expect(lineas).toContain('23/11/2026');
    // Un dato vacío no imprime un rótulo con un hueco debajo.
    expect(lineas).not.toContain('SIN VALOR');
  });

  it('el folio y los metadatos van alineados al margen derecho', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }], { reference: 'N.º 0042' });

    // El doble mide 5 pt por letra: el folio termina exactamente en el margen.
    const folio = ultimoDocumento().llamadas.text.find(([linea]) => linea === 'N.º 0042')!;
    expect(folio[1] + 'N.º 0042'.length * 5).toBeCloseTo(ANCHO - 48, 5);
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
    // Se recorren todas las hojas y se vuelve a la última.
    expect(doc.llamadas.setPage).toEqual([
      ...Array.from({ length: paginas.length }, (_, i) => i + 1),
      paginas.length,
    ]);
  });

  it('el pie dice el emisor, la línea legal y la fecha de emisión', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }], {
      title: 'Comprobante',
      footerNote: 'No válido como factura',
      issuedAt: new Date(2026, 9, 24, 10, 32),
      issuer: { name: 'Consultorio Illimani', details: ['NIT 0000000000', 'La Paz'] },
    });

    const lineas = ultimoDocumento().llamadas.text.map(([linea]) => linea);
    expect(lineas).toContain('Consultorio Illimani');
    expect(lineas).toContain('  ·  NIT 0000000000  ·  La Paz');
    expect(lineas).toContain('No válido como factura  ·  Emitido el 24/10/2026, 10:32');
  });

  it('sin emisor declarado, el papel lo emite AloVida', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }]);

    const lineas = ultimoDocumento().llamadas.text.map(([linea]) => linea);
    expect(lineas.filter((linea) => linea === 'AloVida')).toHaveLength(2);
    expect(lineas.some((linea) => linea.startsWith('Documento confidencial  ·  Generado el '))).toBe(true);
  });

  /**
   * El defecto que esto cierra: sin fecha declarada, el papel ponía la de la
   * descarga como «Fecha de emisión», y una factura del 15/09 bajada el 24/10
   * decía dos fechas de emisión distintas.
   */
  it('sin fecha de emisión declarada rotula la fecha como de generación', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }], { title: 'Receta' });

    const lineas = ultimoDocumento().llamadas.text.map(([linea]) => linea);
    expect(lineas).toContain('FECHA DE GENERACIÓN');
    expect(lineas).not.toContain('FECHA DE EMISIÓN');
    expect(lineas.some((linea) => linea.includes('Emitido el'))).toBe(false);
  });

  it('con `plainPaper` la portada es clara: ni banda a sangre ni franjas de borde', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }], { title: 'Artículo', plainPaper: true });
    const claro = ultimoDocumento().llamadas;
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }], { title: 'Artículo' });
    const oscuro = ultimoDocumento().llamadas;

    const aSangre = (rect: [number, number, number, number, string]): boolean => rect[0] === 0 && rect[2] === 595;
    expect(oscuro.rect.filter(aSangre).length).toBeGreaterThan(0);
    expect(claro.rect.filter(aSangre)).toHaveLength(0);
    // Sin el isotipo grande de la portada: sólo el de la marca.
    expect(claro.lines).toHaveLength(4);
    expect(claro.text.map(([linea]) => linea)).toContain('Artículo');
  });

  it('en las hojas siguientes, un título larguísimo se recorta y no pisa la marca', () => {
    const titulo = 'Historia clínica completa '.repeat(12).trim();
    buildBlocksPdf(
      Array.from({ length: 80 }, (_, i) => ({ kind: 'paragraph' as const, text: `Línea ${i}` })),
      { title: titulo },
    );

    const corto = ultimoDocumento().llamadas.text.find(([linea]) => linea.endsWith('…'))!;
    expect(corto).toBeDefined();
    expect(corto[1]).toBeGreaterThan(48 + 100);
  });

  it('la marca de agua va en diagonal en cada hoja, en mayúsculas', () => {
    buildBlocksPdf(
      Array.from({ length: 80 }, (_, i) => ({ kind: 'paragraph' as const, text: `Línea ${i}` })),
      { watermark: 'Sin validez fiscal' },
    );

    const doc = ultimoDocumento();
    expect(doc.llamadas.rotated).toEqual(
      Array.from({ length: doc.llamadas.addPage + 1 }, () => 'SIN VALIDEZ FISCAL'),
    );
  });

  /**
   * El defecto que esto cierra: dibujada antes que el contenido, cualquier
   * bloque opaco —una tarjeta, la cabecera de una tabla— la tapaba, y «SIN
   * VALIDEZ» se leía «SIN V… DEZ». Va encima de todo, con poca opacidad.
   */
  it('la marca de agua va encima del contenido, con poca opacidad', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Contenido de la hoja' }], { watermark: 'Sin validez' });

    const { orden, gState } = ultimoDocumento().llamadas;
    expect(orden.indexOf('rotado:SIN VALIDEZ')).toBeGreaterThan(orden.indexOf('Contenido de la hoja'));
    expect(gState.map((estado) => estado.opacity)).toContain(0.14);
  });

  it('sin marca de agua no escribe nada rotado', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Una línea' }]);

    expect(ultimoDocumento().llamadas.rotated).toEqual([]);
  });
});

describe('el logo del consultorio en la portada', () => {
  const DERECHA = 595 - 48;
  const PNG = 'data:image/png;base64,AAAA';
  const logo = (ancho: number, alto: number) => ({
    dataUrl: PNG,
    formato: 'PNG' as const,
    ancho,
    alto,
  });

  /** Dónde se escribió una línea: es lo que no puede moverse. */
  const yDe = (texto: string): number =>
    ultimoDocumento().llamadas.text.find(([linea]) => linea === texto)![2];
  const xDe = (texto: string): number =>
    ultimoDocumento().llamadas.text.find(([linea]) => linea === texto)![1];

  const CUERPO = [{ kind: 'paragraph' as const, text: 'Una línea' }];
  const OPCIONES = { title: 'Receta médica', kind: 'Receta médica', reference: 'N.º 0042' };

  it('sin logo no dibuja ninguna imagen ni ficha', () => {
    buildBlocksPdf(CUERPO, OPCIONES);

    expect(ultimoDocumento().llamadas.addImage).toHaveLength(0);
    // Ninguna ficha blanca en el rincón del logo.
    expect(ultimoDocumento().llamadas.roundedRect.some(([, y]) => y === 24)).toBe(false);
  });

  it('con logo lo dibuja una vez, dentro de su ficha y contra el margen derecho', () => {
    buildBlocksPdf(CUERPO, { ...OPCIONES, logo: logo(360, 120) });

    const [imagen, ...resto] = ultimoDocumento().llamadas.addImage;
    expect(resto).toHaveLength(0);
    expect(imagen!.formato).toBe('PNG');
    expect(imagen!.ancho).toBeLessThanOrEqual(120);
    expect(imagen!.alto).toBeLessThanOrEqual(34);
    // La ficha tiene 7 pt de aire alrededor del logo y termina en el margen.
    expect(imagen!.x + imagen!.ancho).toBeCloseTo(DERECHA - 7, 5);
    const ficha = ultimoDocumento().llamadas.roundedRect.find(([, y]) => y === 24)!;
    expect(ficha[0] + ficha[2]).toBeCloseTo(DERECHA, 5);
    expect(imagen!.y).toBeGreaterThanOrEqual(ficha[1]);
    expect(imagen!.y + imagen!.alto).toBeLessThanOrEqual(ficha[1] + ficha[3]);
  });

  it.each([
    ['cuadrado', logo(300, 300)],
    ['apaisado 3:1', logo(360, 120)],
    ['muy apaisado 10:1', logo(1000, 100)],
    ['muy alto 1:3', logo(100, 300)],
    ['diminuto', logo(4, 4)],
  ])(
    'un logo %s no mueve el título, el folio ni el arranque del contenido, y cabe en la ficha',
    (_nombre, forma) => {
      buildBlocksPdf(CUERPO, { ...OPCIONES, subtitle: 'Bajada' });
      const sinLogo = {
        titulo: yDe('Receta médica'),
        bajada: yDe('Bajada'),
        folio: [xDe('N.º 0042'), yDe('N.º 0042')],
        cuerpo: yDe('Una línea'),
      };

      buildBlocksPdf(CUERPO, { ...OPCIONES, subtitle: 'Bajada', logo: forma });
      const conLogo = {
        titulo: yDe('Receta médica'),
        bajada: yDe('Bajada'),
        folio: [xDe('N.º 0042'), yDe('N.º 0042')],
        cuerpo: yDe('Una línea'),
      };
      const [imagen] = ultimoDocumento().llamadas.addImage;

      expect(conLogo).toEqual(sinLogo);
      expect(imagen!.ancho).toBeLessThanOrEqual(120 + 1e-9);
      expect(imagen!.alto).toBeLessThanOrEqual(34 + 1e-9);
      // Conserva la proporción: no se estira.
      expect(imagen!.ancho / imagen!.alto).toBeCloseTo(forma.ancho / forma.alto, 5);
    },
  );

  it('sólo la primera página lleva el logo', () => {
    buildBlocksPdf(
      Array.from({ length: 80 }, (_, i) => ({ kind: 'paragraph' as const, text: `Línea ${i}` })),
      { ...OPCIONES, logo: logo(360, 120) },
    );

    expect(ultimoDocumento().llamadas.addPage).toBeGreaterThan(0);
    expect(ultimoDocumento().llamadas.addImage).toHaveLength(1);
  });

  it('si la imagen no se puede dibujar, el documento sale igual y sin ficha vacía', () => {
    DocumentoFalso.fallarAlDibujarImagenes = true;

    expect(() => buildBlocksPdf(CUERPO, { ...OPCIONES, logo: logo(360, 120) })).not.toThrow();
    expect(ultimoDocumento().llamadas.roundedRect.some(([, y]) => y === 24)).toBe(false);

    expect(xDe('RECETA MÉDICA')).toBe(48);
    expect(yDe('Una línea')).toBeGreaterThan(0);
  });

  it('un logo de proporciones imposibles se omite en vez de romper', () => {
    expect(() => buildBlocksPdf(CUERPO, { ...OPCIONES, logo: logo(0, 0) })).not.toThrow();

    expect(ultimoDocumento().llamadas.addImage).toHaveLength(0);
  });

  it('usa el logo de la sesión por omisión, y `null` lo apaga para ese documento', () => {
    establecerLogoDeDocumentos(logo(360, 120));

    buildBlocksPdf(CUERPO, OPCIONES);
    expect(ultimoDocumento().llamadas.addImage).toHaveLength(1);

    buildBlocksPdf(CUERPO, { ...OPCIONES, logo: null });
    expect(ultimoDocumento().llamadas.addImage).toHaveLength(0);
  });
});

describe('el bloque de firma y sello', () => {
  const PNG = 'data:image/png;base64,AAAA';
  const imagen = (ancho: number, alto: number) => ({
    dataUrl: PNG,
    formato: 'PNG' as const,
    ancho,
    alto,
  });
  const FIRMA_COMPLETA = {
    nombre: 'Dra. Valeria Rojas',
    matricula: 'M-1234',
    firma: imagen(300, 100),
    sello: imagen(160, 160),
  };
  const SIN_IMAGENES = {
    nombre: 'Dra. Valeria Rojas',
    matricula: 'M-1234',
    firma: null,
    sello: null,
  };

  const CUERPO = [{ kind: 'paragraph' as const, text: 'Una línea' }];
  const lineas = (n: number) =>
    Array.from({ length: n }, (_, i) => ({ kind: 'paragraph' as const, text: `Línea ${i}` }));
  const yDe = (texto: string): number =>
    ultimoDocumento().llamadas.text.find(([linea]) => linea === texto)![2];
  const hay = (texto: string): boolean =>
    ultimoDocumento().llamadas.text.some(([linea]) => linea === texto);

  it('sin firma en la sesión ni en el documento no dibuja ningún bloque', () => {
    buildBlocksPdf(CUERPO, { title: 'Receta' });

    expect(hay('Matrícula M-1234')).toBe(false);
    expect(hay('FIRMA Y SELLO')).toBe(false);
    expect(ultimoDocumento().llamadas.addImage).toHaveLength(0);
  });

  it('con firma e imagen dibuja las dos cajas, la línea, el nombre, la matrícula y el rótulo', () => {
    buildBlocksPdf(CUERPO, { title: 'Receta', firma: FIRMA_COMPLETA });

    const imagenes = ultimoDocumento().llamadas.addImage;
    expect(imagenes).toHaveLength(2);
    const [firma, sello] = imagenes;
    // La firma y el sello caben en sus cajas fijas (140×52 y 60×60) sin estirarse.
    expect(firma!.ancho).toBeLessThanOrEqual(140 + 1e-9);
    expect(firma!.alto).toBeLessThanOrEqual(52 + 1e-9);
    expect(sello!.ancho).toBeLessThanOrEqual(60 + 1e-9);
    expect(sello!.alto).toBeLessThanOrEqual(60 + 1e-9);
    expect(firma!.ancho / firma!.alto).toBeCloseTo(3, 5);
    // El sello va al lado de la firma, a la derecha.
    expect(sello!.x).toBeGreaterThanOrEqual(firma!.x + firma!.ancho);
    expect(hay('Dra. Valeria Rojas')).toBe(true);
    expect(hay('Matrícula M-1234')).toBe(true);
    expect(hay('FIRMA Y SELLO')).toBe(true);
    // Nombre, matrícula y rótulo van debajo de las imágenes, en ese orden.
    expect(yDe('Dra. Valeria Rojas')).toBeGreaterThan(firma!.y + firma!.alto);
    expect(yDe('Matrícula M-1234')).toBeGreaterThan(yDe('Dra. Valeria Rojas'));
    expect(yDe('FIRMA Y SELLO')).toBeGreaterThan(yDe('Matrícula M-1234'));
  });

  it('va a la derecha: su línea termina en el margen', () => {
    buildBlocksPdf(CUERPO, { title: 'Receta', firma: SIN_IMAGENES });

    const corta = ultimoDocumento().llamadas.line.filter(([x1, , x2]) => x2 - x1 === 220);
    expect(corta).toHaveLength(1);
    expect(corta[0][2]).toBeCloseTo(595 - 48, 5);
  });

  it('sin imágenes el bloque sale igual, con la línea de firma y sin ninguna imagen', () => {
    buildBlocksPdf(CUERPO, { title: 'Receta', firma: SIN_IMAGENES });

    expect(ultimoDocumento().llamadas.addImage).toHaveLength(0);
    expect(hay('Matrícula M-1234')).toBe(true);
  });

  /** Sin imágenes, reservar el alto del sello mandaba el bloque solo a una hoja nueva. */
  it('sin imágenes el bloque es más bajo: deja sólo el lugar para firmar a mano', () => {
    buildBlocksPdf(CUERPO, { title: 'Receta', firma: FIRMA_COMPLETA });
    const conImagenes = yDe('Dra. Valeria Rojas') - yDe('Una línea');
    buildBlocksPdf(CUERPO, { title: 'Receta', firma: SIN_IMAGENES });
    const sinImagenes = yDe('Dra. Valeria Rojas') - yDe('Una línea');

    expect(conImagenes - sinImagenes).toBeCloseTo(60 - 30, 5);
  });

  it('sin matrícula cargada imprime el nombre y no inventa un número', () => {
    buildBlocksPdf(CUERPO, { title: 'Receta', firma: { ...SIN_IMAGENES, matricula: null } });

    expect(hay('Dra. Valeria Rojas')).toBe(true);
    expect(ultimoDocumento().llamadas.text.some(([linea]) => linea.startsWith('Matrícula'))).toBe(
      false,
    );
  });

  it('no mueve nada de lo escrito antes: el contenido queda donde estaba', () => {
    buildBlocksPdf(CUERPO, { title: 'Receta', subtitle: 'Bajada' });
    const antes = { titulo: yDe('Receta'), bajada: yDe('Bajada'), cuerpo: yDe('Una línea') };

    buildBlocksPdf(CUERPO, { title: 'Receta', subtitle: 'Bajada', firma: FIRMA_COMPLETA });
    const despues = { titulo: yDe('Receta'), bajada: yDe('Bajada'), cuerpo: yDe('Una línea') };

    expect(despues).toEqual(antes);
  });

  /**
   * Antes iba clavado al pie de la última hoja: con poco contenido dejaba un
   * hueco en medio del papel, y con la hoja casi llena mandaba la firma sola a
   * una hoja nueva. Ahora sigue al contenido, siempre debajo de lo último.
   */
  it('sigue al contenido: va debajo de la última línea, con su aire', () => {
    buildBlocksPdf(lineas(3), { title: 'Receta', firma: SIN_IMAGENES });
    const conPoco = yDe('Dra. Valeria Rojas');
    expect(conPoco).toBeGreaterThan(yDe('Línea 2') + 16);

    buildBlocksPdf(lineas(8), { title: 'Receta', firma: SIN_IMAGENES });
    expect(yDe('Dra. Valeria Rojas')).toBeGreaterThan(conPoco);
  });

  /**
   * Si la firma no entra, pasa a una hoja nueva; y como sola en la última hoja
   * se lee como un papel al que le falta algo, se lleva con ella el último
   * bloque del contenido. Lo anterior no se mueve.
   */
  it('si no entra en la hoja, pasa a una nueva con el último bloque, y lo anterior no se mueve', () => {
    const paginas = (n: number, firma: typeof FIRMA_COMPLETA | null): number => {
      buildBlocksPdf(lineas(n), { title: 'Receta', firma });
      return ultimoDocumento().llamadas.addPage;
    };

    // La cantidad de líneas más chica con la que el bloque ya no entra en la hoja.
    const limite = Array.from({ length: 40 }, (_, i) => i + 5).find(
      (n) => paginas(n, FIRMA_COMPLETA) > paginas(n, null),
    );
    expect(limite, 'ningún largo de contenido obligó a abrir una página').toBeDefined();

    buildBlocksPdf(lineas(limite!), { title: 'Receta' });
    const yPenultimaSinFirma = yDe(`Línea ${limite! - 2}`);
    const paginasSinFirma = paginas(limite!, null);

    buildBlocksPdf(lineas(limite!), { title: 'Receta', firma: FIRMA_COMPLETA });
    const { orden, addPage } = ultimoDocumento().llamadas;

    expect(addPage).toBe(paginasSinFirma + 1);
    expect(yDe(`Línea ${limite! - 2}`)).toBe(yPenultimaSinFirma);
    // La última línea y la firma comparten la hoja nueva.
    const hoja = orden.lastIndexOf('— hoja nueva —');
    expect(orden.indexOf(`Línea ${limite! - 1}`)).toBeGreaterThan(hoja);
    expect(orden.indexOf('Dra. Valeria Rojas')).toBeGreaterThan(hoja);
  });

  it('el título del último bloque viaja con él y con la firma', () => {
    for (let n = 5; n <= 45; n += 1) {
      buildBlocksPdf(
        [...lineas(n), { kind: 'heading', level: 2, text: 'Respuestas' }, campoDeBloque('Tabaquismo', 'No')],
        { title: 'Receta', firma: FIRMA_COMPLETA },
      );
      const { orden } = ultimoDocumento().llamadas;
      const titulo = orden.indexOf('Respuestas');
      const dato = orden.indexOf('No');
      // Nunca un corte de hoja entre el título y su dato.
      expect(orden.slice(titulo, dato).includes('— hoja nueva —'), `con ${n} líneas`).toBe(false);
    }
  });

  it('si el último bloque es más alto que lo que entra con la firma, la firma va sola', () => {
    DocumentoFalso.lineasForzadas = 46;
    buildBlocksPdf([{ kind: 'paragraph', text: 'Antes' }, { kind: 'paragraph', text: 'PÁRRAFO_LARGO' }], {
      title: 'Receta',
      firma: SIN_IMAGENES,
    });
    const { orden } = ultimoDocumento().llamadas;
    const hoja = orden.lastIndexOf('— hoja nueva —');
    // El párrafo largo no se arrastra entero: la firma pasa sola.
    expect(orden.indexOf('Renglón 1')).toBeLessThan(hoja);
    expect(orden.indexOf('Dra. Valeria Rojas')).toBeGreaterThan(hoja);
  });

  it('una imagen que no se puede dibujar deja el hueco y el documento sale igual', () => {
    DocumentoFalso.fallarAlDibujarImagenes = true;

    expect(() => buildBlocksPdf(CUERPO, { title: 'Receta', firma: FIRMA_COMPLETA })).not.toThrow();

    expect(ultimoDocumento().llamadas.addImage).toHaveLength(0);
    expect(hay('Matrícula M-1234')).toBe(true);
  });

  it('usa la firma de la sesión por omisión, y `null` la apaga para ese documento', () => {
    setDocumentSignature(SIN_IMAGENES);

    buildBlocksPdf(CUERPO, { title: 'Receta' });
    expect(hay('Matrícula M-1234')).toBe(true);

    buildBlocksPdf(CUERPO, { title: 'Receta', firma: null });
    expect(hay('Matrícula M-1234')).toBe(false);
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
    // Alineados a la derecha: terminan en el mismo borde aunque midan distinto.
    expect(x.get('100.00')! + '100.00'.length * 5).toBeCloseTo(x.get('80.00')! + '80.00'.length * 5, 5);
    expect(x.get('100.00')).toBeGreaterThan(x.get('Consulta') ?? 0);
  });

  /**
   * El defecto que esto cierra: una tabla larga seguía en la carilla siguiente
   * **sin sus nombres de columna**. En un plan de 36 cuotas, la página 2 quedaba
   * con cuatro columnas de números y ninguna forma de saber cuál era el capital
   * y cuál el interés sin volver a la página 1.
   */
  it('repite la fila de encabezado y avisa el corte cuando la tabla sigue en otra página', () => {
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
    const textos = doc.llamadas.text.map(([linea]) => linea);
    expect(textos.filter((linea) => linea === 'IMPORTE')).toHaveLength(doc.llamadas.addPage + 1);
    expect(textos.filter((linea) => linea === 'Continúa en la página siguiente')).toHaveLength(
      doc.llamadas.addPage,
    );
    // Ninguna fila se perdió en el corte.
    for (let i = 1; i <= 60; i += 1) expect(textos).toContain(`Cuota ${i}`);
  });

  /**
   * La última fila sola arriba de una hoja, con su cabecera repetida y nada
   * más, se lee como un error: se lleva la penúltima con ella.
   */
  it('no deja la última fila sola en una hoja nueva', () => {
    const tabla = (n: number) => [
      { kind: 'row' as const, text: '', cells: ['Concepto', 'Importe'], header: true },
      ...Array.from({ length: n }, (_, i) => ({ kind: 'row' as const, text: '', cells: [`Cuota ${i + 1}`, '100.00'] })),
    ];
    for (let n = 30; n <= 60; n += 1) {
      buildBlocksPdf(tabla(n));
      const doc = ultimoDocumento();
      const enLaUltimaHoja = doc.llamadas.text.filter(
        ([linea], indice) =>
          linea.startsWith('Cuota ') &&
          indice > doc.llamadas.text.map(([texto]) => texto).lastIndexOf('IMPORTE'),
      );
      if (doc.llamadas.addPage > 0) expect(enLaUltimaHoja.length, `con ${n} filas`).not.toBe(1);
    }
  });

  /**
   * La caja de totales que cierra una tabla no queda sola arriba de una hoja
   * nueva: se lleva con ella las últimas filas.
   */
  it('los totales que cierran una tabla nunca quedan solos en una hoja', async () => {
    const { totalsBlock } = await import('./pdf-export');
    for (let n = 20; n <= 60; n += 1) {
      buildBlocksPdf([
        { kind: 'row', text: '', cells: ['Concepto', 'Importe'], header: true },
        ...Array.from({ length: n }, (_, i) => ({ kind: 'row' as const, text: '', cells: [`Cuota ${i + 1}`, '100,00'] })),
        totalsBlock([{ label: 'Total a pagar', value: '1,00 Bs', emphasis: true }]),
      ]);
      const { orden } = ultimoDocumento().llamadas;
      const total = orden.indexOf('TOTAL A PAGAR');
      const hoja = orden.lastIndexOf('— hoja nueva —', total);
      const filasEnLaHoja = orden.slice(hoja + 1, total).filter((linea) => linea.startsWith('Cuota '));
      expect(filasEnLaHoja.length, `con ${n} filas`).toBeGreaterThanOrEqual(1);
    }
  });

  it('el aviso que cierra una tabla tampoco queda solo en una hoja', async () => {
    const { noteBlock } = await import('./pdf-export');
    for (let n = 20; n <= 60; n += 1) {
      buildBlocksPdf([
        { kind: 'row', text: '', cells: ['Concepto', 'Importe'], header: true },
        ...Array.from({ length: n }, (_, i) => ({ kind: 'row' as const, text: '', cells: [`Cuota ${i + 1}`, '100,00'] })),
        noteBlock('Falta algún precio publicado.', 'warning', 'Total no disponible'),
      ]);
      const { orden } = ultimoDocumento().llamadas;
      const aviso = orden.indexOf('Total no disponible');
      const hoja = orden.lastIndexOf('— hoja nueva —', aviso);
      expect(orden.slice(hoja + 1, aviso).some((linea) => linea.startsWith('Cuota ')), `con ${n} filas`).toBe(true);
    }
  });

  /**
   * Con una tabla de dos filas la cabecera se reservaba sólo con la primera,
   * que a su vez se reservaba con la última: la cabecera quedaba sola al pie.
   */
  it('una cabecera nunca queda sola al pie de una hoja, ni con una tabla de dos filas', () => {
    for (let relleno = 20; relleno <= 50; relleno += 1) {
      buildBlocksPdf([
        ...Array.from({ length: relleno }, (_, i) => ({ kind: 'paragraph' as const, text: `Línea ${i}` })),
        { kind: 'row', text: '', cells: ['Concepto', 'Importe'], header: true },
        { kind: 'row', text: '', cells: ['Cuota 1', '100,00'] },
        { kind: 'row', text: '', cells: ['Cuota 2', '100,00'] },
      ]);
      const { orden } = ultimoDocumento().llamadas;
      const cabecera = orden.indexOf('CONCEPTO');
      const hoja = orden.indexOf('— hoja nueva —', cabecera);
      const filas = orden.slice(cabecera, hoja === -1 ? undefined : hoja).filter((linea) => linea.startsWith('Cuota '));
      expect(filas.length, `con ${relleno} párrafos antes`).toBe(2);
    }
  });

  it('un negativo con el signo menos es un número y va a la derecha', () => {
    buildBlocksPdf([
      { kind: 'row', text: '', cells: ['Concepto', 'Importe'], header: true },
      { kind: 'row', text: '', cells: ['Consulta', '100,00'] },
      { kind: 'row', text: '', cells: ['Descuento', '−10,00'] },
    ]);
    const x = new Map(ultimoDocumento().llamadas.text.map(([linea, posicion]) => [linea, posicion]));
    expect(x.get('100,00')! + '100,00'.length * 5).toBeCloseTo(x.get('−10,00')! + '−10,00'.length * 5, 5);
  });

  /**
   * El defecto que esto cierra (revisión de código): cada fila marcada como
   * cabecera se dibujaba con el texto de la **primera** cabecera. Con dos
   * cabeceras seguidas, la segunda salía con los nombres de la primera.
   */
  it('cada fila de cabecera dice lo suyo, y al cortar se repite la última', () => {
    buildBlocksPdf([
      { kind: 'row', text: '', cells: ['Pregunta', 'Respuesta'], header: true },
      { kind: 'row', text: '', cells: ['Dolor', 'Sí'] },
      { kind: 'row', text: '', cells: ['Fecha', 'Valor'], header: true },
      ...Array.from({ length: 70 }, (_, i) => ({ kind: 'row' as const, text: '', cells: [`Día ${i + 1}`, '12'] })),
    ]);

    const doc = ultimoDocumento();
    const textos = doc.llamadas.text.map(([linea]) => linea);
    expect(textos.filter((linea) => linea === 'PREGUNTA')).toHaveLength(1);
    expect(textos.filter((linea) => linea === 'FECHA')).toHaveLength(doc.llamadas.addPage + 1);
    expect(textos).toContain('Día 70');
  });

  /**
   * Un `<th scope="row">` es el rótulo de su fila, no el nombre de las
   * columnas: marcarla como cabecera borraba el dato de la fila entera.
   */
  it('desde el DOM, sólo es cabecera la fila de `thead` o la que es toda de `th`', () => {
    const el = document.createElement('div');
    el.innerHTML = `
      <table>
        <thead><tr><th>Sesión</th><th>Peso</th></tr></thead>
        <tbody>
          <tr><th scope="row">12/10/2026</th><td>68 kg</td></tr>
          <tr><th scope="row">19/10/2026</th><td>67 kg</td></tr>
        </tbody>
      </table>`;

    buildPdfDocument(el);

    expect(textosDelCuerpo()).toEqual(['SESIÓN', 'PESO', '12/10/2026', '68 kg', '19/10/2026', '67 kg']);
  });

  /**
   * El defecto que esto cierra: con una tabla que no entra a lo ancho, repartir
   * la falta entre todas las columnas por igual partía en dos renglones un
   * encabezado de una sola palabra, que es lo primero que se lee como descuido.
   */
  it('no achica la columna angosta cuando la tabla no entra a lo ancho', () => {
    const largo = 'Motivo de consulta con una descripción muy larga que no entra de ninguna forma';
    buildBlocksPdf([
      { kind: 'row', text: '', cells: ['Paciente', 'Motivo', 'Atenciones'], header: true },
      { kind: 'row', text: '', cells: [`Paciente ${largo}`, largo, '2'] },
    ]);

    const veces = ultimoDocumento().llamadas.text.filter(([linea]) => linea === 'ATENCIONES').length;
    expect(veces).toBe(1);
  });

  it('no manda a la derecha una columna que no es de números', () => {
    buildBlocksPdf([
      { kind: 'row', text: 'Estudio\tPreparación', cells: ['Estudio', 'Preparación'], header: true },
      { kind: 'row', text: 'Hemograma\tAyuno de 8 horas', cells: ['Hemograma', 'Ayuno de 8 horas'] },
    ]);

    const doc = ultimoDocumento();
    const encabezado = doc.llamadas.text.find(([linea]) => linea === 'PREPARACIÓN');
    const celda = doc.llamadas.text.find(([linea]) => linea === 'Ayuno de 8 horas');
    // Alineadas a la izquierda las dos: comparten el borde de la columna.
    expect(encabezado?.[1]).toBe(celda?.[1]);
  });
});

describe('los bloques', () => {
  /**
   * Los renglones en blanco son de los documentos que se completan a mano. Se
   * cuentan contra el mismo documento sin ellos: el membrete y el pie también
   * dibujan filetes.
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

  /** Una respuesta de pocos renglones partida entre dos hojas obliga a escribirla en dos papeles. */
  it('un hueco de hasta seis renglones no se parte entre hojas', () => {
    for (let relleno = 20; relleno <= 50; relleno += 1) {
      buildBlocksPdf([
        ...Array.from({ length: relleno }, (_, i) => ({ kind: 'paragraph' as const, text: `Línea ${i}` })),
        { kind: 'blank', text: '', lines: 6 },
        { kind: 'paragraph', text: 'Después' },
      ]);
      const { orden } = ultimoDocumento().llamadas;
      const membrete = ['— hoja nueva —', 'AloVida', '— filete —'];
      let hueco = orden.slice(orden.indexOf(`Línea ${relleno - 1}`) + 1, orden.indexOf('Después'));
      // Un corte de hoja antes del hueco o antes del párrafo siguiente trae su
      // membrete (marca y filete): ése no es parte del hueco.
      if (JSON.stringify(hueco.slice(0, 3)) === JSON.stringify(membrete)) hueco = hueco.slice(3);
      if (JSON.stringify(hueco.slice(-3)) === JSON.stringify(membrete)) hueco = hueco.slice(0, -3);
      expect(hueco, `con ${relleno} párrafos antes`).toEqual(Array.from({ length: 6 }, () => '— filete —'));
    }
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

  /** Un corte sobre una hoja recién abierta dejaría una carilla en blanco. */
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

  it('continúa un párrafo largo en páginas nuevas sin perder renglones', () => {
    DocumentoFalso.lineasForzadas = 100;
    buildBlocksPdf([{ kind: 'paragraph', text: 'PÁRRAFO_LARGO' }], { logo: null, firma: null });

    const doc = ultimoDocumento();
    expect(doc.llamadas.addPage).toBeGreaterThan(0);
    const written = doc.llamadas.text.map(([line]) => line);
    expect(written.filter((line) => line.startsWith('Renglón '))).toHaveLength(100);
    expect(written).toContain('Renglón 1');
    expect(written).toContain('Renglón 100');
  });

  it('inserta la ilustración del contenido antes de su atribución', () => {
    buildBlocksPdf(
      [
        {
          kind: 'image',
          text: 'Esquema',
          image: { dataUrl: 'data:image/png;base64,AA==', formato: 'PNG', ancho: 100, alto: 80 },
        },
        { kind: 'paragraph', text: 'Autor · CC BY 4.0' },
      ],
      { logo: null, firma: null },
    );

    expect(ultimoDocumento().llamadas.addImage).toHaveLength(1);
    expect(ultimoDocumento().llamadas.text.map(([line]) => line)).toContain('Autor · CC BY 4.0');
  });

  /**
   * La factura reserva el pie de la última hoja para su QR con párrafos de un
   * espacio duro: `trim()` lo borra, y la reserva medía cero.
   */
  it('un párrafo de un espacio duro ocupa su renglón', () => {
    const duro = String.fromCharCode(0xa0);
    buildBlocksPdf([{ kind: 'paragraph', text: 'Antes' }, { kind: 'paragraph', text: 'Después' }]);
    const sinReserva = ultimoDocumento().llamadas.text.find(([linea]) => linea === 'Después')![2];

    buildBlocksPdf([
      { kind: 'paragraph', text: 'Antes' },
      ...Array.from({ length: 3 }, () => ({ kind: 'paragraph' as const, text: duro })),
      { kind: 'paragraph', text: 'Después' },
    ]);

    const conReserva = ultimoDocumento().llamadas.text.find(([linea]) => linea === 'Después')![2];
    expect(conReserva - sinReserva).toBeGreaterThanOrEqual(3 * 14.5);
  });

  /** Un dato más largo que una hoja seguía de largo por debajo del pie. */
  it('un dato con un valor más largo que una hoja sigue en la siguiente sin salirse', () => {
    DocumentoFalso.lineasForzadas = 120;
    buildBlocksPdf([campoDeBloque('Evolución', 'PÁRRAFO_LARGO')], { logo: null, firma: null });

    const doc = ultimoDocumento();
    expect(doc.llamadas.addPage).toBeGreaterThan(0);
    const renglones = doc.llamadas.text.filter(([linea]) => linea.startsWith('Renglón '));
    expect(renglones).toHaveLength(120);
    // Ningún renglón cae debajo del filete del pie.
    expect(Math.max(...renglones.map(([, , y]) => y))).toBeLessThan(842 - 54);
  });

  it('una rejilla con un dato más largo que una hoja cae a la lista, que sí se parte', async () => {
    const { fieldsBlock } = await import('./pdf-export');
    DocumentoFalso.lineasForzadas = 120;
    buildBlocksPdf([fieldsBlock([{ label: 'Fecha', value: '22/10/2026' }, { label: 'Motivo', value: 'PÁRRAFO_LARGO' }])]);

    const renglones = ultimoDocumento().llamadas.text.filter(([linea]) => linea.startsWith('Renglón '));
    expect(renglones).toHaveLength(120);
    expect(Math.max(...renglones.map(([, , y]) => y))).toBeLessThan(842 - 54);
  });

  it('una rejilla de datos reparte los datos en columnas y omite los vacíos', async () => {
    const { fieldsBlock } = await import('./pdf-export');
    buildBlocksPdf([
      fieldsBlock(
        [
          { label: 'Fecha', value: '22/10/2026' },
          { label: 'Modalidad', value: 'Presencial' },
          { label: 'Sede', value: 'Sopocachi' },
          { label: 'Cobertura', value: '   ' },
          { label: 'Estado', value: 'Atendida' },
        ],
        3,
      ),
    ]);

    const doc = ultimoDocumento();
    const xDe = (texto: string): number => doc.llamadas.text.find(([linea]) => linea === texto)![1];
    const yDe = (texto: string): number => doc.llamadas.text.find(([linea]) => linea === texto)![2];
    // Tres columnas en la primera fila, y la cuarta vuelve a la primera columna.
    expect(new Set([xDe('22/10/2026'), xDe('Presencial'), xDe('Sopocachi')]).size).toBe(3);
    expect(yDe('Presencial')).toBe(yDe('22/10/2026'));
    expect(xDe('Atendida')).toBe(xDe('22/10/2026'));
    expect(yDe('Atendida')).toBeGreaterThan(yDe('22/10/2026'));
    // La etiqueta va encima de su valor.
    expect(yDe('FECHA')).toBeLessThan(yDe('22/10/2026'));
    expect(doc.llamadas.text.map(([linea]) => linea)).not.toContain('COBERTURA');
  });

  it('en la rejilla, un valor que no entra en tres renglones toma la fila entera', async () => {
    const { fieldsBlock } = await import('./pdf-export');
    DocumentoFalso.lineasForzadas = 5;
    buildBlocksPdf([
      fieldsBlock([
        { label: 'Fecha', value: '22/10/2026' },
        { label: 'Motivo', value: 'PÁRRAFO_LARGO' },
        { label: 'Estado', value: 'Atendida' },
      ]),
    ]);

    const doc = ultimoDocumento();
    const xDe = (texto: string): number => doc.llamadas.text.find(([linea]) => linea === texto)![1];
    const yDe = (texto: string): number => doc.llamadas.text.find(([linea]) => linea === texto)![2];
    // El motivo arranca en la primera columna, en una fila propia, y lo que
    // sigue va debajo de sus cinco renglones.
    expect(xDe('MOTIVO')).toBe(xDe('FECHA'));
    expect(yDe('MOTIVO')).toBeGreaterThan(yDe('22/10/2026'));
    expect(yDe('ESTADO')).toBeGreaterThan(yDe('Renglón 5'));
  });

  it('las tarjetas van lado a lado, con su título en versalitas y sus datos', async () => {
    const { panelsBlock } = await import('./pdf-export');
    buildBlocksPdf([
      panelsBlock([
        { title: 'Paciente', fields: [{ label: 'Nombre', value: 'Ana Pérez' }] },
        { title: 'Profesional', fields: [{ label: 'Nombre', value: 'Dra. Rojas' }, { label: 'Sin', value: '' }] },
      ]),
    ]);

    const doc = ultimoDocumento();
    const textos = doc.llamadas.text;
    const paciente = textos.find(([linea]) => linea === 'PACIENTE')!;
    const profesional = textos.find(([linea]) => linea === 'PROFESIONAL')!;
    expect(profesional[1]).toBeGreaterThan(paciente[1]);
    expect(profesional[2]).toBe(paciente[2]);
    expect(textos.map(([linea]) => linea)).toContain('Dra. Rojas');
    expect(textos.map(([linea]) => linea)).not.toContain('SIN');
    // Las dos tarjetas miden lo mismo.
    // (La píldora del número de página también tiene relleno y borde: es chica.)
    const tarjetas = doc.llamadas.roundedRect.filter(([, , ancho, , estilo]) => estilo === 'FD' && ancho > 120);
    expect(tarjetas).toHaveLength(2);
    expect(tarjetas[0][3]).toBe(tarjetas[1][3]);
  });

  it('la caja de totales alinea los importes a la derecha y resalta el total a pagar', async () => {
    const { totalsBlock } = await import('./pdf-export');
    buildBlocksPdf([
      totalsBlock([
        { label: 'Subtotal', value: '100,00 Bs' },
        { label: 'Total a pagar', value: '90,00 Bs', emphasis: true },
      ]),
    ]);

    const textos = ultimoDocumento().llamadas.text;
    const fin = (texto: string): number => {
      const [linea, x] = textos.find(([escrito]) => escrito === texto)!;
      return x + linea.length * 5;
    };
    expect(fin('100,00 Bs')).toBeCloseTo(595 - 48 - 12, 5);
    expect(fin('90,00 Bs')).toBeCloseTo(595 - 48 - 12, 5);
    // El rótulo del total va en versalitas sobre su banda.
    expect(textos.map(([linea]) => linea)).toContain('TOTAL A PAGAR');
  });

  it('un total suelto se parte en rótulo e importe', () => {
    buildBlocksPdf([{ kind: 'total', text: 'Total: 120,00 Bs' }]);

    const textos = ultimoDocumento().llamadas.text.map(([linea]) => linea);
    expect(textos).toContain('TOTAL');
    expect(textos).toContain('120,00 Bs');
  });

  it('un aviso escribe su título y su texto', async () => {
    const { noteBlock } = await import('./pdf-export');
    buildBlocksPdf([noteBlock('Alergia a la penicilina.', 'alert', 'Alergias')]);

    const textos = ultimoDocumento().llamadas.text.map(([linea]) => linea);
    expect(textos.indexOf('Alergias')).toBeLessThan(textos.indexOf('Alergia a la penicilina.'));
  });

  /**
   * En una fotocopia en blanco y negro todos los avisos salen del mismo gris:
   * una alergia no puede depender de que se vea el rojo. Los tonos que avisan
   * algo llevan una marca dibujada; los neutros, sólo la barra.
   */
  it.each([
    ['alert', true],
    ['warning', true],
    ['info', true],
    ['success', true],
    ['brand', false],
    ['neutral', false],
  ] as const)('un aviso %s lleva marca propia: %s', async (tono, conMarca) => {
    const { noteBlock } = await import('./pdf-export');
    buildBlocksPdf([]);
    const base = ultimoDocumento().llamadas.circle.length;
    buildBlocksPdf([noteBlock('Texto del aviso.', tono, 'Título')]);

    expect(ultimoDocumento().llamadas.circle.length > base).toBe(conMarca);
  });

  /** Estirada más allá de sus píxeles, una ilustración se ve escalonada al imprimir. */
  it('una ilustración no se dibuja por debajo de 200 ppp', () => {
    buildBlocksPdf(
      [{ kind: 'image', text: 'Esquema', image: { dataUrl: 'data:image/png;base64,AA==', formato: 'PNG', ancho: 400, alto: 200 } }],
      { logo: null, firma: null },
    );

    const [imagen] = ultimoDocumento().llamadas.addImage;
    // 400 px a 200 ppp son 2 pulgadas: 144 pt.
    expect(imagen!.ancho).toBeCloseTo(144, 5);
    expect(imagen!.alto).toBeCloseTo(72, 5);
  });

  it('una lista pone una viñeta por renglón', async () => {
    const { listBlock } = await import('./pdf-export');
    buildBlocksPdf([]);
    const sinLista = ultimoDocumento().llamadas.circle.length;
    buildBlocksPdf([listBlock(['Uno', 'Dos', 'Tres'])]);

    expect(ultimoDocumento().llamadas.circle).toHaveLength(sinLista + 3);
    expect(textosDelCuerpo()).toEqual(['Uno', 'Dos', 'Tres']);
  });

  it('un QR dibuja sus módulos en vectores, con su título y su leyenda', () => {
    // Un tablero de 3 × 3: cinco módulos oscuros, dos corridas en la fila del medio.
    const modulos = [1, 0, 1, 0, 1, 0, 1, 0, 1];
    buildBlocksPdf([{ kind: 'qr', text: 'Escanee el código', title: 'Verificación', qr: { size: 3, modules: modulos } }]);
    const sinModulos = ultimoDocumento().llamadas.rect.length;

    buildBlocksPdf([{ kind: 'qr', text: 'Escanee el código', title: 'Verificación', qr: { size: 3, modules: [0, 0, 0, 0, 0, 0, 0, 0, 0] } }]);

    expect(sinModulos - ultimoDocumento().llamadas.rect.length).toBe(5);
    const textos = ultimoDocumento().llamadas.text.map(([linea]) => linea);
    expect(textos).toContain('Verificación');
    expect(textos).toContain('Escanee el código');
  });
});

describe('lo que pidió la revisión visual de la fase 2', () => {
  it('las opciones se dibujan con casillas: redondas para una, cuadradas para varias', async () => {
    const { choicesBlock } = await import('./pdf-export');
    buildBlocksPdf([]);
    const base = ultimoDocumento().llamadas;
    const [circulos, redondeados] = [base.circle.length, base.roundedRect.length];

    buildBlocksPdf([choicesBlock(['Sí', 'No'], false)]);
    expect(ultimoDocumento().llamadas.circle.length - circulos).toBe(2);
    buildBlocksPdf([choicesBlock(['Fiebre', 'Tos', 'Dolor'], true)]);
    expect(ultimoDocumento().llamadas.roundedRect.length - redondeados).toBe(3);
    // El texto de la opción va sin «( )» ni «[ ]» escritos.
    expect(textosDelCuerpo()).toEqual(['Fiebre', 'Tos', 'Dolor']);
  });

  it('las opciones cortas van en un mismo renglón', async () => {
    const { choicesBlock } = await import('./pdf-export');
    buildBlocksPdf([choicesBlock(['Sí', 'No'], false)]);

    const textos = ultimoDocumento().llamadas.text;
    const si = textos.find(([linea]) => linea === 'Sí')!;
    const no = textos.find(([linea]) => linea === 'No')!;
    expect(no[2]).toBe(si[2]);
    expect(no[1]).toBeGreaterThan(si[1]);
  });

  it('una etiqueta que sale de los datos con cifras no se pasa a mayúsculas', () => {
    buildBlocksPdf([campoDeBloque('Losartán 50 mg', 'Un comprimido por día'), campoDeBloque('Paciente', 'Ana')]);

    expect(textosDelCuerpo()).toContain('Losartán 50 mg');
    expect(textosDelCuerpo()).toContain('PACIENTE');
  });

  it('«6:30 p. m.» se escribe con espacios duros, para que no se parta', () => {
    buildBlocksPdf([{ kind: 'paragraph', text: 'Pagado a las 6:30 p. m. en caja' }]);

    expect(textosDelCuerpo()).toContain('Pagado a las 6:30\u00A0p.\u00A0m. en caja');
  });

  it('el QR se vuelve a dibujar limpio encima de la marca de agua', () => {
    const qr = { kind: 'qr' as const, text: 'Leyenda', qr: { size: 3, modules: [1, 0, 1, 0, 1, 0, 1, 0, 1] } };
    buildBlocksPdf([qr]);
    const sinMarca = ultimoDocumento().llamadas.rect.length;
    buildBlocksPdf([qr], { watermark: 'Sin validez' });
    const { rect, orden } = ultimoDocumento().llamadas;

    // Las mismas corridas de módulos, otra vez después de la marca, más su blanco.
    expect(orden.indexOf('rotado:SIN VALIDEZ')).toBeGreaterThan(-1);
    expect(rect.length - sinMarca).toBeGreaterThanOrEqual(5 + 1);
  });

  it('un título seguido de un dato largo no queda solo al pie de la hoja', () => {
    DocumentoFalso.lineasForzadas = 4;
    for (let relleno = 30; relleno <= 50; relleno += 1) {
      buildBlocksPdf([
        ...Array.from({ length: relleno }, (_, i) => ({ kind: 'paragraph' as const, text: `Línea ${i}` })),
        { kind: 'heading', level: 3, text: 'Resultados' },
        campoDeBloque('Hemograma', 'PÁRRAFO_LARGO'),
      ]);
      const { orden } = ultimoDocumento().llamadas;
      const titulo = orden.indexOf('Resultados');
      const hoja = orden.indexOf('— hoja nueva —', titulo);
      const despues = orden.slice(titulo, hoja === -1 ? undefined : hoja);
      expect(despues, `con ${relleno} párrafos antes`).toContain('Renglón 1');
    }
  });

  it('el sombreado alterno vuelve a empezar en cada hoja', () => {
    buildBlocksPdf([
      { kind: 'row', text: '', cells: ['Concepto', 'Importe'], header: true },
      ...Array.from({ length: 80 }, (_, i) => ({ kind: 'row' as const, text: '', cells: [`Cuota ${i + 1}`, '1,00'] })),
    ]);
    const { orden, addPage } = ultimoDocumento().llamadas;
    expect(addPage).toBeGreaterThan(0);
    // Imposible de leer desde el doble sin colores: se comprueba que cada hoja
    // nueva arranca con la cabecera seguida de una fila.
    const tras = orden.indexOf('— hoja nueva —');
    expect(orden.slice(tras).find((linea) => linea.startsWith('Cuota '))).toBeDefined();
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
