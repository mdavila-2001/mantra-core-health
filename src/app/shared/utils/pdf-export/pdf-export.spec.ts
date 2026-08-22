/**
 * `jspdf` resuelve a un build distinto bajo Vitest (condición `node`) que bajo
 * el build real de la aplicación (condición `browser`) — el propio
 * `package.json` de la librería lo declara así. Comparar contra la clase real
 * o espiar su prototipo queda atado a cuál de los dos builds resolvió el
 * entorno de pruebas en cada corrida. Se mockea el módulo entero: además de
 * esquivar ese acoplamiento, aísla mejor lo que este archivo tiene que
 * probar de verdad — la extracción de bloques y la paginación — de un motor de
 * render que no es código propio.
 *
 * `DocumentoFalso` se declara dentro de `vi.hoisted`: el factory de `vi.mock`
 * se iza por encima de todo el archivo, así que referenciar la clase desde
 * afuera de `vi.hoisted` fallaría con «Cannot access before initialization».
 */
const { DocumentoFalso } = vi.hoisted(() => {
  class DocumentoFalso {
    static instancias: DocumentoFalso[] = [];

    readonly llamadas: {
      setFont: [string, string][];
      setFontSize: number[];
      text: [string[], number, number][];
      addPage: number;
      setProperties: [{ title?: string }][];
      save: string[];
    } = { setFont: [], setFontSize: [], text: [], addPage: 0, setProperties: [], save: [] };

    readonly internal = {
      pageSize: { getWidth: () => 500, getHeight: () => 200 },
    };

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

    /** Una línea por llamada: mantiene la altura de cada bloque predecible en la prueba. */
    splitTextToSize(text: string): string[] {
      return [text];
    }

    text(lines: string[], x: number, y: number): this {
      this.llamadas.text.push([lines, x, y]);
      return this;
    }

    addPage(): this {
      this.llamadas.addPage += 1;
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
 * caché con el jsPDF real y `vi.mock` llega tarde: las siete pruebas de este
 * archivo fallan con «Ningún documento se construyó».
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

beforeEach(async () => {
  DocumentoFalso.instancias = [];

  // `resetModules` vacía el registro y el `import()` de abajo vuelve a evaluar
  // `pdf-export.ts` — esta vez con el `vi.mock` de arriba ya registrado, corra
  // lo que corra antes en este trabajador.
  vi.resetModules();
  ({ buildPdfDocument, exportElementToPdf } = await import('./pdf-export'));
});

describe('buildPdfDocument', () => {
  it('extrae encabezado, párrafo y filas de tabla, en orden', () => {
    buildPdfDocument(elementoDeEjemplo());

    const textos = ultimoDocumento().llamadas.text.map(([lines]) => lines[0]);
    expect(textos).toEqual([
      'Presupuesto',
      'Paciente: Ana Pérez',
      'Servicio   Precio',
      'Consulta general   100.00',
      'Limpieza dental   80.00',
    ]);
  });

  it('ignora los bloques sin texto', () => {
    const el = document.createElement('div');
    el.innerHTML = '<h2></h2><p>   </p><p>Contenido real</p>';

    buildPdfDocument(el);

    const textos = ultimoDocumento().llamadas.text.map(([lines]) => lines[0]);
    expect(textos).toEqual(['Contenido real']);
  });

  it('imprime el título arriba y lo guarda en las propiedades del documento', () => {
    buildPdfDocument(elementoDeEjemplo(), { title: 'Presupuesto de Ana Pérez' });

    const doc = ultimoDocumento();
    expect(doc.llamadas.setProperties).toEqual([[{ title: 'Presupuesto de Ana Pérez' }]]);
    expect(doc.llamadas.text[0][0][0]).toBe('Presupuesto de Ana Pérez');
  });

  it('agrega una página nueva cuando el contenido no entra en la primera', () => {
    const el = document.createElement('div');
    // Página falsa de 200pt de alto, con 40pt de margen a cada lado: unas 8
    // líneas de 22pt (14 de línea + 8 de espaciado) entran antes de desbordar.
    el.innerHTML = Array.from({ length: 20 }, (_, i) => `<p>Línea ${i}</p>`).join('');

    buildPdfDocument(el);

    expect(ultimoDocumento().llamadas.addPage).toBeGreaterThan(0);
  });

  it('no agrega páginas de más cuando el contenido entra en una sola', () => {
    buildPdfDocument(elementoDeEjemplo());

    expect(ultimoDocumento().llamadas.addPage).toBe(0);
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
