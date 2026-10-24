import { jsPDF } from 'jspdf';

import { drawContent, drawSignature, signatureHeight } from './pdf-blocks';
import { PdfComposer } from './pdf-composer';
import type {
  PdfBlock,
  PdfExportOptions,
  PdfField,
  PdfPanel,
  PdfTotalRow,
} from './pdf-document.types';
import { drawContinuationPage, drawFirstPage, stampFooters } from './pdf-page';
import type { PdfTone } from './pdf-theme';

export { formatDate, formatDateTime, formatMoney, formatTime, MINUS } from './pdf-format';
export type {
  PdfBlock,
  PdfExportOptions,
  PdfField,
  PdfIssuer,
  PdfMetaEntry,
  PdfPanel,
  PdfQrMatrix,
  PdfTotalRow,
} from './pdf-document.types';

/**
 * El maquetador de PDF de AloVida, sobre `jsPDF` puro.
 *
 * ## Por qué no rasteriza (nada de `html2canvas`)
 *
 * Todos los documentos del sistema —receta, historia clínica, orden de
 * estudio, comprobante, cotización, factura— son **texto estructurado**:
 * títulos, datos, párrafos, tablas y totales. Para eso alcanzan las primitivas
 * de `jsPDF`, que no dependen de canvas: el papel sale con texto real —se
 * busca, se copia, lo lee un lector de pantalla— y corre igual en el navegador
 * y en una prueba.
 *
 * ## Cómo está armado
 *
 * - `pdf-theme.ts` — el sistema de diseño: retícula, escala tipográfica,
 *   paleta de AloVida y ritmo vertical.
 * - `pdf-composer.ts` — la pluma: cuánto lugar queda, cómo se escribe cada
 *   estilo, cuándo se pasa de hoja.
 * - `pdf-page.ts` — el marco de cada hoja: franja, membrete, marca de agua y
 *   pie con el emisor, la fecha y «Página X de Y».
 * - `pdf-blocks.ts` y `pdf-table.ts` — los bloques de contenido.
 * - Este archivo — las dos entradas (bloques o DOM) y los constructores de
 *   bloques que usan las plantillas.
 *
 * ## Qué extrae del DOM
 *
 * Recorre el elemento y arma bloques en el orden en que aparecen: `h1`–`h6`
 * como títulos con su jerarquía, `p`/`li` como párrafos, `dt`/`dd` como pares
 * de dato, y cada `tr` de una `table` como una fila de columnas. Cualquier otro
 * nodo hoja con texto propio se trata como párrafo. Es deliberadamente simple:
 * no replica el CSS, replica el contenido.
 */

/**
 * Arma el documento PDF a partir del elemento, sin guardarlo.
 *
 * Separado de {@link exportElementToPdf} para que se pueda reusar el mismo PDF
 * —adjuntarlo, previsualizarlo— sin repetir la extracción, y para que las
 * pruebas puedan inspeccionar el documento sin disparar una descarga.
 */
export function buildPdfDocument(element: HTMLElement, options: PdfExportOptions = {}): jsPDF {
  return buildBlocksPdf(withoutRepeatedTitle(blocksOf(element), options.title), options);
}

/**
 * Quita el primer encabezado de la pantalla cuando dice lo mismo que el título
 * del documento: una vista empieza casi siempre con su propio `h2` y el botón
 * de exportar manda ese mismo texto como `title`. Sólo el primero y sólo si es
 * un encabezado: un párrafo que casualmente coincide es contenido.
 */
function withoutRepeatedTitle(blocks: readonly PdfBlock[], title: string | undefined): readonly PdfBlock[] {
  const first = blocks[0];
  if (
    title === undefined ||
    first === undefined ||
    first.kind !== 'heading' ||
    first.text.trim().toLocaleLowerCase('es') !== title.trim().toLocaleLowerCase('es')
  ) {
    return blocks;
  }
  return blocks.slice(1);
}

/**
 * Arma el documento a partir de bloques.
 *
 * Es el maquetador de verdad: `buildPdfDocument` es esto mismo con un paso
 * previo que saca los bloques del DOM. Existe separado porque la mayoría de los
 * documentos **no vienen de una pantalla** —la receta, el comprobante, la
 * factura— y renderizarlos en el DOM sólo para volver a leerlos sería dar una
 * vuelta larga y frágil, además de imposible bajo SSR.
 *
 * @param blocks - Contenido en orden de lectura.
 * @param options - Título, clase, emisor y demás datos del membrete y el pie.
 * @returns El documento `jsPDF` maquetado, listo para `.save()` o `.output()`.
 */
export function buildBlocksPdf(blocks: readonly PdfBlock[], options: PdfExportOptions = {}): jsPDF {
  const first = compose(blocks, options);
  // La firma sola en la última hoja se lee como un papel al que le falta algo:
  // si el último bloque del contenido es chico, se arma otra vez el papel con
  // ese bloque en la hoja nueva, junto a la firma.
  if (first.signatureAlone && first.end.lastHeight !== null && first.end.lastStart > 0) {
    const fits = first.end.lastHeight + first.signatureNeeds <= first.usableHeight;
    if (fits) {
      const moved = [
        ...blocks.slice(0, first.end.lastStart),
        { kind: 'pagebreak' as const, text: '' },
        ...blocks.slice(first.end.lastStart),
      ];
      return compose(moved, options).doc;
    }
  }
  return first.doc;
}

/** Una pasada del maquetador, con lo que hace falta para decidir si repetirla. */
function compose(blocks: readonly PdfBlock[], options: PdfExportOptions) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
  // La bajada no va a los metadatos: en los papeles clínicos dice de quién es,
  // y los metadatos viajan con el archivo sin que nadie los mire.
  doc.setProperties({
    ...(options.title === undefined ? {} : { title: options.title }),
    author: options.issuer?.name ?? 'AloVida',
    creator: 'AloVida',
  });

  const composer = new PdfComposer(doc, options, drawContinuationPage);
  composer.pageTop = drawFirstPage(composer);
  composer.y = composer.pageTop;

  const end = drawContent(composer, blocks);
  const signatureAlone = drawSignature(composer);
  stampFooters(composer);
  return {
    doc,
    end,
    signatureAlone,
    signatureNeeds: signatureHeight(composer) + 48,
    usableHeight: composer.usableHeight,
  };
}

/**
 * Exporta un elemento del DOM a un archivo PDF descargable.
 *
 * @param element - Elemento cuyo contenido se exporta.
 * @param filename - Nombre del archivo a descargar; se agrega `.pdf` si falta.
 * @param options - Título, bajada y clase del documento.
 */
export function exportElementToPdf(
  element: HTMLElement,
  filename: string,
  options: PdfExportOptions = {},
): void {
  const doc = buildPdfDocument(element, options);
  doc.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/* ---- constructores de bloques ------------------------------------------ */

/**
 * Datos en rejilla, la etiqueta sobre el valor. Los datos sin valor no se
 * imprimen: una etiqueta con un hueco debajo se lee como un dato perdido.
 */
export function fieldsBlock(fields: readonly PdfField[], columns = 3): PdfBlock {
  const present = fields.filter((field) => field.value.trim() !== '');
  return {
    kind: 'fields',
    text: present.map((field) => `${field.label}: ${field.value}`).join('\n'),
    fields: present,
    columns,
  };
}

/** Paneles de datos lado a lado (hasta tres). */
export function panelsBlock(panels: readonly PdfPanel[]): PdfBlock {
  return {
    kind: 'panels',
    text: panels
      .map((panel) => [panel.title, ...panel.fields.map((field) => `${field.label}: ${field.value}`)].join('\n'))
      .join('\n'),
    panels,
  };
}

/** La caja de totales. La fila con `emphasis` es el total a pagar. */
export function totalsBlock(rows: readonly PdfTotalRow[]): PdfBlock {
  return { kind: 'totals', text: rows.map((row) => `${row.label}: ${row.value}`).join('\n'), totals: rows };
}

/** Un aviso con su tono y, si hace falta, un título. */
export function noteBlock(text: string, tone: PdfTone = 'brand', title?: string): PdfBlock {
  return { kind: 'note', text, tone, ...(title === undefined ? {} : { title }) };
}

/** Una lista con viñetas. */
export function listBlock(items: readonly string[]): PdfBlock {
  return { kind: 'list', text: items.join('\n'), items };
}

/**
 * Opciones para marcar a mano: casillas redondas si se marca una sola,
 * cuadradas si se marcan varias.
 */
export function choicesBlock(items: readonly string[], multiple: boolean): PdfBlock {
  const marker = multiple ? '[ ]' : '( )';
  return { kind: 'choices', text: items.map((item) => `${marker} ${item}`).join('   '), items, multiple };
}

/* ---- la extracción desde el DOM ----------------------------------------- */

/** Los bloques de contenido del elemento, en el orden en que aparecen. */
function blocksOf(element: HTMLElement): readonly PdfBlock[] {
  const blocks: PdfBlock[] = [];
  walk(element, blocks);
  return blocks;
}

const HEADING_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6']);
const PARAGRAPH_TAGS = new Set(['P', 'LI']);

/**
 * Lo que está en la pantalla pero **no es contenido**: texto que sólo existe
 * para el lector de pantalla, lo que se declara oculto, y lo que una vista marca
 * a mano con `data-pdf-ignore`.
 *
 * El defecto que esto cierra: el balance contable salía con una columna
 * «Seleccionar las filas visibles», las flechas «▲ ▼ ↕» pegadas a cada
 * encabezado y el rótulo del propio botón «Exportar a PDF» como primer párrafo.
 * Un documento que copia los controles de la pantalla no es un documento.
 */
const SELECTOR_OCULTO = '[aria-hidden="true"], [data-pdf-ignore], .sr-only';

/**
 * Los controles: un botón suelto en la pantalla es una acción, no una línea
 * del papel. Se saltan como nodo entero al recorrer.
 *
 * **Dentro de una celda no se podan**: el encabezado ordenable de una tabla es
 * un `<button>` y su texto es el nombre de la columna. Ahí lo que sobra es la
 * flecha, y la flecha ya viene con `aria-hidden`.
 */
const SELECTOR_CONTROL = 'button, input, select, textarea, app-pdf-export-button';

/** El texto de un nodo sin lo que {@link SELECTOR_OCULTO} tapa, con los blancos normalizados. */
function textoVisible(node: Element): string {
  const copia = node.cloneNode(true) as Element;
  for (const oculto of Array.from(copia.querySelectorAll(SELECTOR_OCULTO))) {
    oculto.remove();
  }
  return (copia.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function walk(node: Element, blocks: PdfBlock[]): void {
  if (node.matches(SELECTOR_OCULTO) || node.matches(SELECTOR_CONTROL)) {
    return;
  }

  if (node.tagName === 'TABLE') {
    for (const row of Array.from(node.querySelectorAll(':scope tr'))) {
      const celdas = Array.from(row.querySelectorAll('th, td'))
        .filter((cell) => !cell.matches(SELECTOR_OCULTO))
        .map((cell) => textoVisible(cell));
      const texto = celdas.join('   ');
      if (texto.trim() !== '') {
        blocks.push({
          kind: 'row',
          text: texto,
          cells: celdas,
          // Cabecera es la fila de `thead` o la que es toda de `th`: un
          // `<th scope="row">` al principio de una fila de datos es el rótulo
          // de esa fila, no el nombre de las columnas.
          header:
            row.parentElement?.tagName === 'THEAD' ||
            Array.from(row.querySelectorAll('th, td')).every((cell) => cell.tagName === 'TH'),
        });
      }
    }
    return;
  }

  // `dt`/`dd` es un dato con su etiqueta y su valor: el DOM ya lo dice así, y
  // maquetarlo como dos párrafos sueltos perdería esa relación.
  if (node.tagName === 'DL') {
    const hijos = Array.from(node.children);
    for (const [indice, hijo] of hijos.entries()) {
      if (hijo.tagName !== 'DT') {
        continue;
      }
      const etiqueta = textoVisible(hijo);
      const siguiente = hijos[indice + 1];
      const valor =
        siguiente !== undefined && siguiente.tagName === 'DD' ? textoVisible(siguiente) : '';
      if (etiqueta !== '' && valor !== '') {
        blocks.push(campoDeBloque(etiqueta, valor));
      }
    }
    return;
  }

  if (HEADING_TAGS.has(node.tagName)) {
    const texto = textoVisible(node);
    if (texto !== '') {
      blocks.push({ kind: 'heading', text: texto, level: Number(node.tagName[1]) });
    }
    return;
  }

  if (PARAGRAPH_TAGS.has(node.tagName)) {
    const texto = textoVisible(node);
    if (texto !== '') {
      blocks.push({ kind: 'paragraph', text: texto });
    }
    return;
  }

  const hijos = Array.from(node.children);
  if (hijos.length === 0) {
    const texto = textoVisible(node);
    if (texto !== '') {
      blocks.push({ kind: 'paragraph', text: texto });
    }
    return;
  }

  for (const child of hijos) {
    walk(child, blocks);
  }
}

/**
 * Un dato con su etiqueta, para armar bloques desde cualquier documento.
 *
 * Se exporta porque los cuatro constructores de documentos —clínicos,
 * comprobante y los que vengan— arman los mismos pares etiqueta/valor, y cada
 * uno repitiendo el `${etiqueta}: ${valor}` de `text` es la clase de detalle
 * que se desincroniza entre archivos sin que nadie lo note.
 */
export function campoDeBloque(etiqueta: string, valor: string): PdfBlock {
  return { kind: 'field', text: `${etiqueta}: ${valor}`, label: etiqueta, value: valor };
}
