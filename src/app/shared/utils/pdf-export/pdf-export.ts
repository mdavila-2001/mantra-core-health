import { jsPDF } from 'jspdf';

/**
 * Exportación genérica de un elemento del DOM a PDF, sobre `jsPDF` puro.
 *
 * ## Por qué no rasteriza (nada de `html2canvas`)
 *
 * El primer caso de uso real —entregarle al paciente su presupuesto— y los que
 * van a venir de los carriles 2 a 5 (recetas, formularios, reportes) son todos
 * **documentos de texto estructurado**: encabezados, párrafos y tablas. Para
 * eso alcanza con las primitivas de texto de `jsPDF`, que no dependen de canvas
 * ni de una librería aparte. `html2canvas` resuelve un problema distinto —una
 * captura visual fiel de CSS arbitrario— que ninguno de estos documentos
 * necesita, y sumarlo habría sido la dependencia de más que el catálogo de
 * `package.json` todavía no tiene.
 *
 * ## Qué extrae del elemento
 *
 * Recorre el DOM y arma bloques en el orden en que aparecen: `h1`–`h6` como
 * encabezados con su jerarquía de tamaño, `p`/`li` como párrafos, y cada `tr`
 * de una `table` como una fila de columnas alineadas por tabulación. Cualquier
 * otro nodo hoja con texto propio (un `div` o `span` sin hijos de elemento) se
 * trata como párrafo. Es deliberadamente simple: no replica el CSS, replica el
 * contenido.
 */

/** Opciones de `exportElementToPdf`. */
export interface PdfExportOptions {
  /** Título del documento, impreso arriba y guardado en los metadatos del PDF. */
  readonly title?: string;
}

/**
 * Un bloque de contenido listo para maquetar.
 *
 * Se exporta porque el maquetador es **uno solo** para todo el repo: un
 * documento puede llegar desde el DOM (`buildPdfDocument`) o desde datos
 * (`buildBlocksPdf`, que usan los documentos clínicos del carril 08), y las dos
 * entradas terminan en la misma lista de bloques. Dos maquetadores producirían
 * dos PDFs con márgenes distintos para el mismo sistema.
 */
export interface PdfBlock {
  readonly kind: 'heading' | 'paragraph' | 'row';
  readonly text: string;
  /** Nivel de encabezado (1–6); sólo presente cuando `kind === 'heading'`. */
  readonly level?: number;
}

const PAGE_MARGIN_PT = 40;
const LINE_HEIGHT_PT = 14;
const BLOCK_SPACING_PT = 8;
const BODY_FONT_SIZE_PT = 11;
const ROW_FONT_SIZE_PT = 10;

/** Tamaño de fuente por nivel de encabezado; h1 el más grande. */
const HEADING_FONT_SIZE_PT: Readonly<Record<number, number>> = {
  1: 20,
  2: 18,
  3: 16,
  4: 14,
  5: 12,
  6: 11,
};

/**
 * Arma el documento PDF a partir del elemento, sin guardarlo.
 *
 * Separado de {@link exportElementToPdf} para que se pueda reusar el mismo PDF
 * —adjuntarlo, previsualizarlo, mandarlo por otro canal— sin repetir la
 * extracción, y para que las pruebas puedan inspeccionar el documento sin
 * disparar una descarga.
 *
 * @param element - Elemento cuyo contenido se exporta.
 * @param options - Título opcional del documento.
 * @returns El documento `jsPDF` ya maquetado, listo para `.save()` o `.output()`.
 */
export function buildPdfDocument(element: HTMLElement, options: PdfExportOptions = {}): jsPDF {
  return buildBlocksPdf(blocksOf(element), options);
}

/**
 * Arma el documento a partir de bloques ya extraídos.
 *
 * Es el maquetador de verdad: `buildPdfDocument` es esto mismo con un paso
 * previo que saca los bloques del DOM. Existe separado porque hay documentos
 * que **no vienen de una pantalla** —la receta y la historia de una atención,
 * del carril 08— y renderizarlos en el DOM sólo para volver a leerlos sería dar
 * una vuelta larga y frágil, además de imposible bajo SSR.
 *
 * @param blocks - Contenido en orden de lectura.
 * @param options - Título opcional del documento.
 * @returns El documento `jsPDF` maquetado, listo para `.save()` o `.output()`.
 */
export function buildBlocksPdf(blocks: readonly PdfBlock[], options: PdfExportOptions = {}): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  if (options.title !== undefined) {
    doc.setProperties({ title: options.title });
  }

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - PAGE_MARGIN_PT * 2;

  let y = PAGE_MARGIN_PT;

  const avanzar = (alto: number): void => {
    if (y + alto > pageHeight - PAGE_MARGIN_PT) {
      doc.addPage();
      y = PAGE_MARGIN_PT;
    }
  };

  if (options.title !== undefined) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(HEADING_FONT_SIZE_PT[1]);
    const lineas = doc.splitTextToSize(options.title, maxWidth) as string[];
    avanzar(lineas.length * LINE_HEIGHT_PT);
    doc.text(lineas, PAGE_MARGIN_PT, y + LINE_HEIGHT_PT * 0.8);
    y += lineas.length * LINE_HEIGHT_PT + BLOCK_SPACING_PT;
  }

  for (const block of blocks) {
    const size =
      block.kind === 'heading'
        ? (HEADING_FONT_SIZE_PT[block.level ?? 6] ?? BODY_FONT_SIZE_PT)
        : block.kind === 'row'
          ? ROW_FONT_SIZE_PT
          : BODY_FONT_SIZE_PT;

    doc.setFont(
      block.kind === 'row' ? 'courier' : 'helvetica',
      block.kind === 'heading' ? 'bold' : 'normal',
    );
    doc.setFontSize(size);

    const lineas = doc.splitTextToSize(block.text, maxWidth) as string[];
    const alto = lineas.length * LINE_HEIGHT_PT;
    avanzar(alto);
    doc.text(lineas, PAGE_MARGIN_PT, y + LINE_HEIGHT_PT * 0.8);
    y += alto + BLOCK_SPACING_PT;
  }

  return doc;
}

/**
 * Exporta un elemento del DOM a un archivo PDF descargable.
 *
 * @param element - Elemento cuyo contenido se exporta (encabezados, párrafos y
 *   tablas, en el orden en que aparecen).
 * @param filename - Nombre del archivo a descargar; se agrega `.pdf` si falta.
 * @param options - Título opcional del documento.
 */
export function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  options: PdfExportOptions = {},
): void {
  const doc = buildPdfDocument(element, options);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/** Los bloques de contenido del elemento, en el orden en que aparecen. */
function blocksOf(element: HTMLElement): readonly PdfBlock[] {
  const blocks: PdfBlock[] = [];
  walk(element, blocks);
  return blocks;
}

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const PARAGRAPH_TAGS = new Set(['P', 'LI']);

function walk(node: Element, blocks: PdfBlock[]): void {
  if (node.tagName === 'TABLE') {
    for (const row of Array.from(node.querySelectorAll(':scope tr'))) {
      const cells = Array.from(row.querySelectorAll('th, td')).map((cell) =>
        (cell.textContent ?? '').trim(),
      );
      const texto = cells.join('   ');
      if (texto.trim() !== '') {
        blocks.push({ kind: 'row', text: texto });
      }
    }
    return;
  }

  if (HEADING_TAGS.has(node.tagName)) {
    const texto = (node.textContent ?? '').trim();
    if (texto !== '') {
      blocks.push({ kind: 'heading', text: texto, level: Number(node.tagName[1]) });
    }
    return;
  }

  if (PARAGRAPH_TAGS.has(node.tagName)) {
    const texto = (node.textContent ?? '').trim();
    if (texto !== '') {
      blocks.push({ kind: 'paragraph', text: texto });
    }
    return;
  }

  const hijos = Array.from(node.children);
  if (hijos.length === 0) {
    const texto = (node.textContent ?? '').trim();
    if (texto !== '') {
      blocks.push({ kind: 'paragraph', text: texto });
    }
    return;
  }

  for (const child of hijos) {
    walk(child, blocks);
  }
}
