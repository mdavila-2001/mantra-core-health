import type { PdfComposer } from './pdf-composer';
import type { PdfBlock } from './pdf-document.types';
import { PDF_COLORS, PDF_SPACE, PDF_TYPE, type PdfTextStyle } from './pdf-theme';

/* ============================================================================
    Las tablas.

    Columnas alineadas, cabecera en versalitas blancas sobre el petróleo
    profundo de AloVida con las esquinas de arriba redondeadas, filas pares en
    el marfil de la marca y un filete de superficie entre renglones. El sombreado
    alterno deja seguir una fila larga con la vista; el filete es lo que
    sobrevive a la fotocopia cuando el sombreado se pierde. Las columnas de
    números van a la derecha, que es lo que permite comparar cifras sin leerlas
    una por una.

    Cuando la tabla sigue en otra hoja se avisa al pie de la que se corta y se
    repite la cabecera arriba de la siguiente: una columna de importes sin su
    nombre, en la página 3, obliga a volver a la 2 — y en un papel impreso, a
    veces esa página ya no está.
    ========================================================================== */

/** Cómo se parten las columnas cuando la fila no las trae ya separadas. */
const COLUMN_SEPARATOR = /\t|\s{3,}/;

/**
 * Lo que una celda de números puede traer además de las cifras: signo, moneda,
 * separadores, porcentaje. Una fecha («8 de septiembre») o un documento
 * («6543210 SC») tienen cifras y **no** son números.
 */
const NUMERIC = /^[-+]?(?:Bs\.?\s*|\$\s*)?[\d.,\s]+(?:\s*(?:%|Bs\.?))?$/;

/** La raya con que un dato ausente ocupa su columna. No decide la alineación. */
const EMPTY_CELL = /^[—–-]?$/;

/** El aviso al pie de una tabla cortada. */
export const TABLE_CONTINUES = 'Continúa en la página siguiente';

/** Dibuja las filas seguidas como una tabla. */
/**
 * @param trailing - El alto de lo que tiene que ir pegado a la última fila
 *   (la caja de totales que cierra la tabla): se reserva junto con ella.
 */
export function drawTable(composer: PdfComposer, rows: readonly PdfBlock[], trailing = 0): void {
  const cells = rows.map(cellsOf);
  const columns = Math.max(...cells.map((row) => row.length));
  if (columns === 0) return;

  const widths = columnWidths(composer, rows, cells, columns);
  const numeric = numericColumns(rows, cells, columns);
  // La cabecera que se repite al cortar es la **última** vista: dos tablas
  // seguidas, o una con varias cabeceras, repiten cada una la suya.
  let header: RowLayout | null = null;

  composer.space(PDF_SPACE.sm);
  let bodyIndex = 0;

  for (const [index, row] of rows.entries()) {
    const isHeader = row.header === true;
    const layout = layoutRow(composer, cells[index], widths, isHeader);

    // Ni la cabecera ni la última fila quedan solas en una hoja: la cabecera
    // se reserva con la fila que la sigue, y la penúltima con la última.
    const next = rows[index + 1];
    const keepsNext =
      next !== undefined && next.header !== true && (isHeader || index === rows.length - 2);
    const last = index === rows.length - 1;
    const needed =
      (keepsNext ? layout.height + layoutRow(composer, cells[index + 1], widths, false).height : layout.height) +
      (last || index === rows.length - 2 ? trailing : 0);

    if (composer.y + needed > composer.bottom && !composer.atPageTop) {
      if (!isHeader && index > 0) {
        composer.write(TABLE_CONTINUES, composer.right, composer.y + PDF_SPACE.xs, PDF_TYPE.caption, {
          align: 'right',
        });
      }
      composer.newPage();
      if (!isHeader && header !== null) {
        drawRow(composer, header, widths, numeric, 'header');
      }
    }

    if (isHeader) {
      header = layout;
      drawRow(composer, layout, widths, numeric, 'header');
      continue;
    }
    drawRow(composer, layout, widths, numeric, bodyIndex % 2 === 1 ? 'zebra' : 'plain');
    bodyIndex += 1;
    composer.rule(
      composer.y,
      last ? PDF_COLORS.rule : PDF_COLORS.ruleSoft,
      last ? 0.9 : 0.5,
    );
  }
  composer.y += PDF_SPACE.md;
}

/** Una fila ya partida en las líneas que entran en su columna. */
interface RowLayout {
  readonly lines: readonly (readonly string[])[];
  readonly height: number;
  readonly style: PdfTextStyle;
}

function layoutRow(
  composer: PdfComposer,
  cells: readonly string[],
  widths: readonly number[],
  isHeader: boolean,
): RowLayout {
  const style = isHeader ? PDF_TYPE.cellHead : PDF_TYPE.cell;
  const lines = widths.map((width, column) =>
    composer.wrap(cells[column] ?? '', width - PDF_SPACE.cellPaddingX * 2, style),
  );
  const count = Math.max(1, ...lines.map((cell) => cell.length));
  return { lines, height: count * style.leading + PDF_SPACE.cellPaddingY * 2, style };
}

function drawRow(
  composer: PdfComposer,
  row: RowLayout,
  widths: readonly number[],
  numeric: readonly boolean[],
  paint: 'header' | 'zebra' | 'plain',
): void {
  if (paint === 'header') {
    // Esquinas de arriba redondeadas y las de abajo rectas: la cabecera se
    // apoya sobre la primera fila.
    composer.box(composer.left, composer.y, composer.width, row.height, PDF_SPACE.radiusSmall, {
      fill: PDF_COLORS.brandDarker,
    });
    composer.fill(composer.left, composer.y + row.height / 2, composer.width, row.height / 2, PDF_COLORS.brandDarker);
  } else if (paint === 'zebra') {
    composer.fill(composer.left, composer.y, composer.width, row.height, PDF_COLORS.inset);
  }
  let x = composer.left;
  for (const [column, width] of widths.entries()) {
    const right = numeric[column] ?? false;
    composer.writeLines(
      row.lines[column] ?? [],
      right ? x + width - PDF_SPACE.cellPaddingX : x + PDF_SPACE.cellPaddingX,
      composer.y + PDF_SPACE.cellPaddingY,
      row.style,
      { align: right ? 'right' : 'left' },
    );
    x += width;
  }
  composer.y += row.height;
}

/** Las columnas de una fila: las que trae, o las que salen de partir su texto. */
function cellsOf(row: PdfBlock): readonly string[] {
  if (row.cells !== undefined && row.cells.length > 0) {
    return row.cells.map((cell) => cell.trim());
  }
  return row.text.split(COLUMN_SEPARATOR).map((cell) => cell.trim());
}

/**
 * Reparte el ancho entre las columnas.
 *
 * Cada una pide lo que mide su contenido más largo (**preferido**) y no puede
 * bajar de lo que mide su palabra más larga (**mínimo**): una columna más
 * angosta que su palabra más larga parte palabras por la mitad. Si entre todas
 * entran, el sobrante se lo queda la más ancha, que es la de la descripción.
 * Si no, cada una recibe su mínimo y el resto se reparte en proporción a la
 * **holgura** (preferido − mínimo): las columnas de una sola palabra —una
 * numeración, una fecha corta— conservan su ancho y las de texto largo ceden.
 *
 * La cabecera se mide **como se escribe** —en versalitas espaciadas—: medida
 * en minúsculas, «N.º» o «Cantidad» se partían en dos renglones.
 */
function columnWidths(
  composer: PdfComposer,
  rows: readonly PdfBlock[],
  cells: readonly (readonly string[])[],
  columns: number,
): readonly number[] {
  const padding = PDF_SPACE.cellPaddingX * 2;
  const preferred: number[] = [];
  const minimum: number[] = [];

  for (let column = 0; column < columns; column += 1) {
    let wide = 0;
    let narrow = 0;
    for (const [index, row] of rows.entries()) {
      const style = row.header === true ? PDF_TYPE.cellHead : PDF_TYPE.cell;
      const text = composer.shape(cells[index][column] ?? '', style);
      wide = Math.max(wide, composer.measure(text, style));
      for (const word of text.split(/\s+/)) {
        narrow = Math.max(narrow, composer.measure(word, style));
      }
    }
    preferred.push(wide + padding);
    // Una palabra interminable no puede quedarse con la hoja entera.
    minimum.push(Math.min(narrow + padding, composer.width / 2));
  }

  const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
  const total = sum(preferred);
  if (total <= 0) return preferred.map(() => composer.width / columns);
  if (total <= composer.width) {
    const widths = [...preferred];
    const widest = preferred.indexOf(Math.max(...preferred));
    widths[widest] += composer.width - total;
    return widths;
  }

  const base = sum(minimum);
  const spare = composer.width - base;
  if (spare <= 0) {
    // Ni los mínimos entran: se achica todo en proporción antes que salirse del margen.
    return minimum.map((value) => (value / base) * composer.width);
  }
  const slack = preferred.map((value, column) => Math.max(0, value - minimum[column]));
  const totalSlack = sum(slack);
  return minimum.map((value, column) =>
    totalSlack > 0 ? value + (slack[column] / totalSlack) * spare : value + spare / columns,
  );
}

/** Qué columnas son de números —importes, cantidades, numeración— y van a la derecha. */
function numericColumns(
  rows: readonly PdfBlock[],
  cells: readonly (readonly string[])[],
  columns: number,
): readonly boolean[] {
  return Array.from({ length: columns }, (_, column) => {
    const body = rows
      .map((row, index) => ({ row, text: cells[index][column] ?? '' }))
      .filter((entry) => entry.row.header !== true && !EMPTY_CELL.test(entry.text));
    return body.length > 0 && body.every((entry) => NUMERIC.test(entry.text));
  });
}
