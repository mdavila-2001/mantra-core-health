import type { PdfComposer } from './pdf-composer';
import type { PdfBlock, PdfField, PdfQrMatrix, PdfTotalRow } from './pdf-document.types';
import { contenerLogo, type PdfLogo } from '../../../core/pdf-branding/pdf-logo';
import { drawTable, tableStartHeight } from './pdf-table';
import {
  gridSpan,
  PDF_COLORS,
  PDF_GRADIENTS,
  PDF_QR,
  PDF_SIGNATURE,
  PDF_SPACE,
  PDF_TONES,
  PDF_TYPE,
  type PdfTextStyle,
  type PdfTone,
} from './pdf-theme';

/* ============================================================================
    Los bloques de contenido.

    Cada bloque mide su alto **antes** de dibujar, pide lugar a la pluma y deja
    la pluma en su borde inferior. Lo que no se puede partir —un panel, la caja
    de totales, el QR, la firma— pasa entero a la hoja siguiente; lo que sí
    —un párrafo, una tabla, una lista— se parte entre renglones, nunca encima
    de uno.
    ========================================================================== */

/** Un bloque suelto, o un grupo de bloques seguidos que se maquetan juntos. */
type Element =
  | { readonly type: 'block'; readonly block: PdfBlock }
  | { readonly type: 'table'; readonly rows: readonly PdfBlock[] }
  | { readonly type: 'fieldList'; readonly fields: readonly PdfField[] };

/**
 * Junta las filas seguidas en una tabla y los datos seguidos en una lista.
 *
 * Las columnas se alinean entre sí, y para eso hay que medirlas todas juntas
 * antes de dibujar la primera: una fila que decide su ancho sola no es una
 * tabla, es una lista de textos que casualmente van uno debajo del otro.
 */
export function groupBlocks(blocks: readonly PdfBlock[]): readonly Element[] {
  const elements: Element[] = [];
  let rows: PdfBlock[] = [];
  let fields: PdfField[] = [];
  const flush = (): void => {
    if (rows.length > 0) elements.push({ type: 'table', rows });
    if (fields.length > 0) elements.push({ type: 'fieldList', fields });
    rows = [];
    fields = [];
  };
  for (const block of blocks) {
    if (block.kind === 'row') {
      if (fields.length > 0) flush();
      rows.push(block);
      continue;
    }
    if (block.kind === 'field') {
      if (rows.length > 0) flush();
      fields.push({ label: block.label ?? '', value: block.value ?? block.text });
      continue;
    }
    flush();
    elements.push({ type: 'block', block });
  }
  flush();
  return elements;
}

/** Dónde quedó el último elemento del contenido: lo que la firma puede arrastrar. */
export interface ContentEnd {
  /** El índice, en la lista de bloques, del primer bloque del último elemento. */
  readonly lastStart: number;
  /** Cuánto ocupó el último elemento, si cupo entero en una sola hoja; si no, `null`. */
  readonly lastHeight: number | null;
}

/** Cuántos bloques de la lista ocupa un elemento. */
function blockCount(element: Element): number {
  if (element.type === 'table') return element.rows.length;
  if (element.type === 'fieldList') return element.fields.length;
  return 1;
}

/** Dibuja el contenido entero, en orden. */
export function drawContent(composer: PdfComposer, blocks: readonly PdfBlock[]): ContentEnd {
  const elements = groupBlocks(blocks);
  let start = 0;
  let end: ContentEnd = { lastStart: 0, lastHeight: null };
  // El título que anuncia un elemento viaja con él: si la firma arrastra el
  // último elemento a otra hoja, su título no puede quedar solo al pie.
  let headingStart: { readonly start: number; readonly page: number; readonly top: number } | null = null;
  for (const [index, element] of elements.entries()) {
    const isHeading = element.type === 'block' && element.block.kind === 'heading';
    const anchor = !isHeading && headingStart !== null ? headingStart : { start, page: composer.page, top: composer.y };
    const page = anchor.page;
    const top = anchor.top;
    end = { lastStart: anchor.start, lastHeight: null };
    headingStart = isHeading ? (headingStart ?? { start, page: composer.page, top: composer.y }) : null;
    start += blockCount(element);
    if (element.type === 'table') {
      // Los totales que cierran una tabla no quedan solos en una hoja nueva:
      // la última fila se reserva junto con ellos (y con el aire que los separa:
      // el de fin de tabla más el de antes de la caja).
      const next = elements[index + 1];
      const trailing = next?.type === 'block' ? PDF_SPACE.md + trailingHeightOf(composer, next.block) : 0;
      drawTable(composer, element.rows, trailing);
    } else if (element.type === 'fieldList') {
      const last = drawFieldList(composer, element.fields);
      // En una lista de varios datos, la firma arrastra sólo el último dato, no
      // la lista entera: si no, la hoja anterior quedaba casi vacía.
      if (element.fields.length > 1) {
        headingStart = null;
        end = { lastStart: start - 1, lastHeight: composer.page === last.page ? composer.y - last.top : null };
        continue;
      }
    } else if (element.block.kind === 'heading') {
      // Un título reserva el arranque de lo que lo sigue —la cabecera y una
      // fila de una tabla, el primer dato de una lista, la primera fila de una
      // rejilla—: si no, quedaba solo al pie de la hoja.
      drawHeading(composer, element.block, startHeightOf(composer, elements[index + 1]));
    } else {
      drawBlock(composer, element.block);
    }
    if (composer.page === page) end = { lastStart: end.lastStart, lastHeight: composer.y - top };
  }
  return end;
}

function drawBlock(composer: PdfComposer, block: PdfBlock): void {
  switch (block.kind) {
    case 'heading':
      drawHeading(composer, block);
      return;
    case 'fields':
      drawFieldGrid(composer, block.fields ?? [], block.columns);
      return;
    case 'panels':
      drawPanels(composer, block);
      return;
    case 'list':
      drawList(composer, block.items ?? [block.text]);
      return;
    case 'choices':
      drawChoices(composer, block.items ?? [], block.multiple === true);
      return;
    case 'note':
      drawNote(composer, block);
      return;
    case 'total':
    case 'totals':
      drawTotals(composer, totalsOf(block));
      return;
    case 'qr':
      drawQr(composer, block);
      return;
    case 'divider':
      composer.ensure(PDF_SPACE.xl);
      composer.space(PDF_SPACE.md);
      composer.rule(composer.y, PDF_COLORS.ruleSoft, 0.8);
      composer.y += PDF_SPACE.md;
      return;
    case 'blank':
      drawWritingLines(composer, block.lines);
      return;
    case 'pagebreak':
      // Sobre una hoja recién abierta no hace nada: dejaría una carilla en
      // blanco, que en un documento impreso se lee como una falla de la impresora.
      if (!composer.atPageTop) composer.newPage();
      return;
    case 'caption':
      drawCaption(composer, block.text);
      return;
    case 'image':
      drawContentImage(composer, block.image);
      return;
    default:
      drawParagraph(composer, block.text, PDF_TYPE.body);
  }
}

/* ---- títulos y texto corrido ------------------------------------------ */

/**
 * Un título.
 *
 * Los niveles 1 y 2 abren una sección: una barra aguamarina redondeada a la
 * izquierda, el título en Poppins y un filete de superficie a todo el ancho.
 * Se reserva el título **y dos líneas de lo que venga**: un título solo al pie
 * de una hoja, con su contenido en la siguiente, se lee como si la sección
 * estuviera vacía.
 */
/**
 * Lo que mide el arranque de un elemento: lo mínimo que tiene que entrar en la
 * hoja junto con el título que lo anuncia.
 */
function startHeightOf(composer: PdfComposer, element: Element | undefined): number {
  const twoLines = PDF_TYPE.body.leading * 2;
  if (element === undefined) return twoLines;
  if (element.type === 'table') return tableStartHeight(composer, element.rows);
  if (element.type === 'fieldList') {
    const [first] = element.fields;
    if (first === undefined) return twoLines;
    const lines = composer.wrap(first.value, composer.width - PDF_SPACE.labelColumn, PDF_TYPE.value).length;
    return PDF_SPACE.xs + Math.min(3, Math.max(1, lines)) * PDF_TYPE.value.leading + 12;
  }
  switch (element.block.kind) {
    case 'fields':
      return PDF_SPACE.sm + (PDF_SPACE.panelPadding + 2) * 2 + PDF_TYPE.label.leading + 2 + PDF_TYPE.value.leading * 2;
    case 'heading':
      // Un título seguido de otro: el segundo ya reserva lo suyo al dibujarse.
      return PDF_TYPE.heading.leading + twoLines;
    case 'choices':
      return PDF_SPACE.xs + CHOICE_LINE;
    default:
      return twoLines;
  }
}

/** @param keep - Lo que se reserva de lo que viene después, para no dejar el título solo. */
function drawHeading(composer: PdfComposer, block: PdfBlock, keep: number = PDF_TYPE.body.leading * 2): void {
  const level = block.level ?? 6;
  if (level <= 2) {
    const style = level === 1 ? PDF_TYPE.section : PDF_TYPE.subsection;
    const indent = 11;
    const lines = composer.wrap(block.text, composer.width - indent, style);
    const height = lines.length * style.leading + PDF_SPACE.sm + PDF_SPACE.afterSection;
    composer.ensure(PDF_SPACE.beforeSection + height + keep);
    composer.space(PDF_SPACE.beforeSection);
    const barHeight = style.size * 0.95;
    composer.box(
      composer.left,
      composer.y + composer.baseline(style) - barHeight + style.size * 0.08,
      3.2,
      barHeight,
      1.6,
      { fill: PDF_COLORS.accent },
    );
    composer.y += composer.writeLines(lines, composer.left + indent, composer.y, style);
    composer.y += PDF_SPACE.xs + 1;
    composer.rule(composer.y, PDF_COLORS.ruleSoft, 0.8);
    composer.y += PDF_SPACE.afterSection;
    return;
  }
  // Un solo estilo para todos los subtítulos: tres estilos para el mismo rango
  // se leían como tres jerarquías distintas.
  const style = PDF_TYPE.heading;
  const lines = composer.wrap(block.text, composer.width, style);
  composer.ensure(PDF_SPACE.md + lines.length * style.leading + keep);
  composer.space(PDF_SPACE.md);
  composer.y += composer.writeLines(lines, composer.left, composer.y, style);
  composer.y += PDF_SPACE.xs;
}

/**
 * Un párrafo, partido entre hojas renglón por renglón.
 *
 * Va alineado a la izquierda y no justificado: una columna justificada abre ríos
 * blancos en una columna de este ancho. Nunca deja un renglón suelto al pie de
 * una hoja si el párrafo sigue: pasa los dos juntos.
 */
function drawParagraph(composer: PdfComposer, text: string, style: PdfTextStyle, x = composer.left, width = composer.width): void {
  const lines = composer.wrap(text, width - (x - composer.left), style);
  if (lines.length === 0) return;
  composer.space(PDF_SPACE.xs);
  drawFlowingLines(composer, lines, x, style);
  composer.y += PDF_SPACE.sm;
}

/** Líneas que pueden partirse entre hojas, con control de renglón huérfano. */
function drawFlowingLines(composer: PdfComposer, lines: readonly string[], x: number, style: PdfTextStyle): void {
  let next = 0;
  while (next < lines.length) {
    let fit = Math.floor(composer.remaining / style.leading);
    const left = lines.length - next;
    if (fit < Math.min(2, left)) {
      if (!composer.atPageTop) {
        composer.newPage();
        fit = Math.floor(composer.remaining / style.leading);
      }
      fit = Math.max(1, fit);
    }
    // Si sólo quedaría un renglón para la hoja siguiente, se lleva uno más.
    if (fit < left && left - fit === 1 && fit > 2) fit -= 1;
    const chunk = lines.slice(next, next + fit);
    composer.y += composer.writeLines(chunk, x, composer.y, style);
    next += chunk.length;
    if (next < lines.length) composer.newPage();
  }
}

/** Una lista con viñetas: un punto de acento y sangría francesa. */
function drawList(composer: PdfComposer, items: readonly string[]): void {
  const style = PDF_TYPE.body;
  const indent = 14;
  composer.space(PDF_SPACE.xs);
  for (const item of items) {
    const lines = composer.wrap(item, composer.width - indent, style);
    if (lines.length === 0) continue;
    composer.ensure(style.leading * Math.min(2, lines.length));
    const dotY = composer.y + composer.baseline(style) - style.size * 0.32;
    composer.doc.setFillColor(PDF_COLORS.accent[0], PDF_COLORS.accent[1], PDF_COLORS.accent[2]);
    composer.doc.circle(composer.left + 4, dotY, 1.6, 'F');
    drawFlowingLines(composer, lines, composer.left + indent, style);
    composer.y += PDF_SPACE.xs;
  }
  composer.y += PDF_SPACE.xs;
}

/** El lado de una casilla de opción: 11,5 pt ≈ 4 mm, lo que se marca cómodo con una lapicera. */
const CHOICE_BOX = 11.5;

/** El alto de un renglón de opciones. */
const CHOICE_LINE = 20;

/**
 * Opciones para marcar a mano, con la casilla **dibujada**: redonda si se marca
 * una sola, cuadrada si se marcan varias. Las cortas van una al lado de la otra
 * mientras entren; una opción larga ocupa su renglón y se parte debajo de su
 * texto, nunca debajo de la casilla.
 */
function drawChoices(composer: PdfComposer, items: readonly string[], multiple: boolean): void {
  const style = PDF_TYPE.body;
  const gap = 7;
  const between = 22;
  const textWidth = composer.width - CHOICE_BOX - gap;
  composer.space(PDF_SPACE.xs);
  let x = composer.left;
  let rowOpen = false;
  for (const item of items) {
    const width = CHOICE_BOX + gap + composer.measure(item, style);
    const fitsInline = x + width <= composer.right;
    if (rowOpen && !fitsInline) {
      composer.y += CHOICE_LINE;
      x = composer.left;
      rowOpen = false;
    }
    const lines = rowOpen || x + width <= composer.right ? [item] : composer.wrap(item, textWidth, style);
    const height = Math.max(CHOICE_LINE, lines.length * style.leading + (CHOICE_LINE - style.leading));
    if (!rowOpen) composer.ensure(height);
    const boxTop = composer.y + (style.leading - CHOICE_BOX) / 2 + 1;
    composer.doc.setDrawColor(PDF_COLORS.inkMuted[0], PDF_COLORS.inkMuted[1], PDF_COLORS.inkMuted[2]);
    composer.doc.setLineWidth(0.8);
    if (multiple) {
      composer.doc.roundedRect(x, boxTop, CHOICE_BOX, CHOICE_BOX, 1.5, 1.5, 'S');
    } else {
      composer.doc.circle(x + CHOICE_BOX / 2, boxTop + CHOICE_BOX / 2, CHOICE_BOX / 2, 'S');
    }
    composer.writeLines(lines, x + CHOICE_BOX + gap, composer.y, style);
    if (lines.length > 1) {
      composer.y += height;
      x = composer.left;
      rowOpen = false;
      continue;
    }
    x += width + between;
    rowOpen = true;
  }
  if (rowOpen) composer.y += CHOICE_LINE;
  composer.y += PDF_SPACE.xs;
}

/** La letra chica del final: quién emitió el papel y cuándo, una aclaración. */
function drawCaption(composer: PdfComposer, text: string): void {
  const style = PDF_TYPE.caption;
  const lines = composer.wrap(text, composer.width, style);
  if (lines.length === 0) return;
  composer.ensure(PDF_SPACE.sm + lines.length * style.leading);
  composer.space(PDF_SPACE.sm);
  composer.y += composer.writeLines(lines, composer.left, composer.y, style);
  composer.y += PDF_SPACE.xs;
}

/* ---- datos ------------------------------------------------------------ */

/**
 * El estilo de la etiqueta de un dato. Las etiquetas van en versalitas, salvo
 * las que salen de los datos con cifras —«Losartán 50 mg», «Dosis 2»—: en
 * mayúsculas, «50 MG» deja de leerse como una unidad.
 */
function labelStyleFor(label: string): PdfTextStyle {
  return /\d/.test(label) ? { ...PDF_TYPE.label, uppercase: false, tracking: 0, size: 7.5 } : PDF_TYPE.label;
}

/**
 * Datos seguidos: la etiqueta en versalitas a la izquierda y el valor a la
 * derecha, con un filete de superficie entre renglones. La vista baja por los
 * valores sin tropezar con «Paciente:», «Documento:», «Profesional:» repetidos.
 */
function drawFieldList(composer: PdfComposer, fields: readonly PdfField[]): { readonly page: number; readonly top: number } {
  let last = { page: composer.page, top: composer.y };
  const labelWidth = PDF_SPACE.labelColumn;
  const valueX = composer.left + labelWidth;
  const valueWidth = composer.width - labelWidth;
  const padding = 6;
  // La etiqueta, más chica, se baja hasta que su línea base coincide con la
  // del valor: así se leen como un solo renglón.
  composer.space(PDF_SPACE.xs);
  for (const field of fields) {
    last = { page: composer.page, top: composer.y };
    const labelStyle = labelStyleFor(field.label);
    const labelLines = composer.wrap(field.label, labelWidth - PDF_SPACE.md, labelStyle);
    let valueLines = composer.wrap(field.value, valueWidth, PDF_TYPE.value);
    const labelHeight = labelLines.length * labelStyle.leading + 3;
    const labelOffset = composer.baseline(PDF_TYPE.value) - composer.baseline(labelStyle);
    // Un valor más largo que lo que queda de hoja —una evolución, unas
    // indicaciones— sigue en la siguiente, renglón por renglón; nunca se sale
    // de la hoja ni pisa el pie.
    composer.ensure(Math.min(Math.max(labelHeight, valueLines.length * PDF_TYPE.value.leading), PDF_TYPE.value.leading * 3) + padding * 2);
    let first = true;
    while (first || valueLines.length > 0) {
      const room = Math.max(1, Math.floor((composer.remaining - padding * 2) / PDF_TYPE.value.leading));
      const chunk = valueLines.slice(0, room);
      const height =
        Math.max(first ? labelHeight : 0, chunk.length * PDF_TYPE.value.leading) + padding * 2;
      if (first) composer.writeLines(labelLines, composer.left, composer.y + padding + labelOffset, labelStyle);
      composer.writeLines(chunk, valueX, composer.y + padding, PDF_TYPE.value);
      composer.y += height;
      valueLines = valueLines.slice(chunk.length);
      first = false;
      if (valueLines.length > 0) {
        composer.newPage();
      } else {
        composer.rule(composer.y, PDF_COLORS.ruleSoft, 0.6);
      }
    }
  }
  composer.y += PDF_SPACE.md;
  return last;
}

/** Una celda de la rejilla, ya medida. */
interface GridCell {
  readonly span: number;
  readonly label: readonly string[];
  readonly value: readonly string[];
}

/**
 * Datos en rejilla sobre una tarjeta marfil: la etiqueta encima del valor, en
 * dos a cuatro columnas. Es la ficha de un paciente o de una atención.
 *
 * Un valor que no entra en tres renglones de su columna —una dirección, un
 * motivo— toma la fila entera, en vez de estirar la fila con una columna
 * kilométrica. Si la rejilla no entra en la hoja, sigue en la siguiente sobre
 * su propia tarjeta, cortada entre filas.
 */
function drawFieldGrid(composer: PdfComposer, fields: readonly PdfField[], requested = 3): void {
  const columns = Math.min(4, Math.max(2, Math.trunc(requested)));
  const gap = 18;
  const pad = PDF_SPACE.panelPadding + 2;
  const inner = composer.width - pad * 2;
  const columnWidth = (inner - gap * (columns - 1)) / columns;
  const cells: GridCell[] = fields
    .filter((field) => field.value.trim() !== '' || field.label.trim() !== '')
    .map((field) => {
      const narrow = composer.wrap(field.value, columnWidth, PDF_TYPE.value);
      const span = narrow.length > 3 ? columns : 1;
      const width = span === 1 ? columnWidth : inner;
      return {
        span,
        label: composer.wrap(field.label, width, PDF_TYPE.label),
        value: span === 1 ? narrow : composer.wrap(field.value, width, PDF_TYPE.value),
      };
    });
  if (cells.length === 0) return;

  // Filas: se llena de izquierda a derecha y una celda ancha cierra la fila.
  const rows: { readonly cells: readonly GridCell[]; readonly height: number }[] = [];
  let row: GridCell[] = [];
  const close = (): void => {
    if (row.length === 0) return;
    const height = Math.max(
      ...row.map((cell) => cell.label.length * PDF_TYPE.label.leading + 2 + cell.value.length * PDF_TYPE.value.leading),
    );
    rows.push({ cells: row, height });
    row = [];
  };
  for (const cell of cells) {
    const used = row.reduce((sum, item) => sum + item.span, 0);
    if (used + cell.span > columns) close();
    row.push(cell);
  }
  close();

  // Un dato que ni solo entra en una hoja no puede ir en una tarjeta: va como
  // dato de lista, que sí se parte entre hojas.
  const tooTall = (row: { readonly height: number }): boolean =>
    row.height + pad * 2 > composer.usableHeight;
  if (rows.some(tooTall)) {
    drawFieldList(composer, fields.filter((field) => field.value.trim() !== ''));
    return;
  }

  const rowGap = PDF_SPACE.md;
  composer.space(PDF_SPACE.sm);
  let index = 0;
  while (index < rows.length) {
    // Cuántas filas entran en esta hoja, con el relleno de la tarjeta.
    let height = pad * 2 - rowGap;
    let count = 0;
    while (index + count < rows.length) {
      const next = height + rows[index + count].height + rowGap;
      if (next > composer.remaining && count > 0) break;
      height = next;
      count += 1;
    }
    if (height > composer.remaining && !composer.atPageTop) {
      composer.newPage();
      continue;
    }
    const top = composer.y;
    composer.box(composer.left, top, composer.width, height, PDF_SPACE.radius, { fill: PDF_COLORS.inset });
    let y = top + pad;
    for (const current of rows.slice(index, index + count)) {
      let x = composer.left + pad;
      for (const cell of current.cells) {
        const labelHeight = composer.writeLines(cell.label, x, y, PDF_TYPE.label);
        composer.writeLines(cell.value, x, y + labelHeight + 2, PDF_TYPE.value);
        x += cell.span === 1 ? columnWidth + gap : inner;
      }
      y += current.height + rowGap;
    }
    composer.y = top + height;
    index += count;
    if (index < rows.length) composer.newPage();
  }
  composer.y += PDF_SPACE.md;
}

/**
 * Tarjetas lado a lado —emisor y cliente, paciente y profesional—: blancas,
 * con el filo de superficie y la sombra azulada de AloVida, un título en
 * versalitas aguamarina y sus datos. Miden todas lo mismo y pasan juntas de
 * hoja.
 */
function drawPanels(composer: PdfComposer, block: PdfBlock): void {
  const panels = (block.panels ?? []).slice(0, 3);
  if (panels.length === 0) return;
  const gap = 14;
  const pad = PDF_SPACE.panelPadding + 2;
  const width = (composer.width - gap * (panels.length - 1)) / panels.length;
  const inner = width - pad * 2;
  const titleStyle = PDF_TYPE.cardTitle;
  const dot = 8;

  const laidOut = panels.map((panel) => {
    const title = composer.wrap(panel.title, inner - dot, titleStyle);
    const fields = panel.fields
      .filter((field) => field.value.trim() !== '')
      .map((field) => ({
        label: composer.wrap(field.label, inner, PDF_TYPE.label),
        value: composer.wrap(field.value, inner, PDF_TYPE.value),
      }));
    const height =
      title.length * titleStyle.leading +
      PDF_SPACE.md +
      fields.reduce(
        (sum, field) =>
          sum + field.label.length * PDF_TYPE.label.leading + 1 + field.value.length * PDF_TYPE.value.leading + 7,
        0,
      ) -
      7;
    return { title, fields, height };
  });
  const height = Math.max(...laidOut.map((panel) => panel.height)) + pad * 2;

  composer.space(PDF_SPACE.sm);
  composer.ensure(height + 4);
  const top = composer.y;
  for (const [index, panel] of laidOut.entries()) {
    const x = composer.left + index * (width + gap);
    composer.shadow(x, top, width, height, PDF_SPACE.radius);
    composer.box(x, top, width, height, PDF_SPACE.radius, {
      fill: PDF_COLORS.onBrand,
      stroke: PDF_COLORS.ruleSoft,
      weight: 0.7,
    });
    let y = top + pad;
    composer.doc.setFillColor(PDF_COLORS.accent[0], PDF_COLORS.accent[1], PDF_COLORS.accent[2]);
    composer.doc.circle(x + pad + 2.2, y + composer.baseline(titleStyle) - titleStyle.size * 0.36, 2.2, 'F');
    y += composer.writeLines(panel.title, x + pad + dot, y, titleStyle);
    y += PDF_SPACE.md;
    for (const field of panel.fields) {
      y += composer.writeLines(field.label, x + pad, y, PDF_TYPE.label) + 1;
      y += composer.writeLines(field.value, x + pad, y, PDF_TYPE.value) + 7;
    }
  }
  composer.y = top + height + PDF_SPACE.md + 4;
}

/* ---- avisos, totales y QR --------------------------------------------- */

/**
 * Qué marca lleva cada tono, además de su color: una fotocopia en blanco y
 * negro deja todos los avisos del mismo gris, y una alergia no puede depender
 * de que se vea el rojo. `null` = sólo la barra.
 */
const TONE_GLYPH: Readonly<Record<PdfTone, '!' | 'i' | 'check' | null>> = {
  neutral: null,
  brand: null,
  info: 'i',
  success: 'check',
  warning: '!',
  alert: '!',
};

/** El diámetro de la marca de un aviso. */
const GLYPH_SIZE = 11;

/**
 * Un aviso: texto sobre una tarjeta del color de su estado, con una barra de
 * la tinta del estado a ras del borde izquierdo, una marca que se distingue
 * sin color —«!», «i», ✓— y un título opcional. Es para lo que hay que leer
 * pero no es el dato —advertencias, alergias, «esto no es una factura»—.
 *
 * El texto arranca a 14 pt del borde, como el de las tarjetas y la rejilla: un
 * aviso debajo de una lista se alinea con ella.
 */
function drawNote(composer: PdfComposer, block: PdfBlock): void {
  const toneName = block.tone ?? 'brand';
  const tone = PDF_TONES[toneName];
  const glyph = TONE_GLYPH[toneName];
  const pad = PDF_SPACE.panelPadding;
  const inset = 14;
  const textX = composer.left + inset;
  const textWidth = composer.right - pad - textX;
  const titleStyle = { ...PDF_TYPE.heading, color: tone.ink };
  const glyphRoom = glyph === null ? 0 : GLYPH_SIZE + 6;
  const title = block.title === undefined ? [] : composer.wrap(block.title, textWidth - glyphRoom, titleStyle);
  // Sin título, la marca va en el primer renglón del texto y lo corre a la derecha.
  const lines = composer.wrap(block.text, textWidth - (title.length === 0 ? glyphRoom : 0), PDF_TYPE.note);
  if (lines.length === 0 && title.length === 0) return;

  composer.space(PDF_SPACE.sm);
  let pending = lines;
  let first = true;
  while (first || pending.length > 0) {
    const titleHeight = first ? title.length * titleStyle.leading + (title.length > 0 ? 2 : 0) : 0;
    let fit = Math.floor((composer.remaining - pad * 2 - titleHeight) / PDF_TYPE.note.leading);
    if (fit < Math.min(2, pending.length) && !composer.atPageTop) {
      composer.newPage();
      continue;
    }
    fit = Math.max(1, fit);
    const chunk = pending.slice(0, fit);
    const height = pad * 2 + titleHeight + chunk.length * PDF_TYPE.note.leading;
    const top = composer.y;
    composer.box(composer.left, top, composer.width, height, PDF_SPACE.radius, { fill: tone.fill });
    composer.clipped(
      composer.left,
      top,
      composer.width,
      height,
      () => composer.fill(composer.left, top, 3.5, height, tone.ink),
      PDF_SPACE.radius,
    );
    let y = top + pad;
    if (first && glyph !== null) {
      const lineStyle = title.length > 0 ? titleStyle : PDF_TYPE.note;
      drawToneGlyph(composer, glyph, textX, y + (lineStyle.leading - GLYPH_SIZE) / 2, tone.ink, tone.fill);
    }
    if (first && title.length > 0) {
      y += composer.writeLines(title, textX + glyphRoom, y, titleStyle) + 2;
    }
    const bodyX = first && title.length === 0 ? textX + glyphRoom : textX;
    composer.writeLines(chunk.slice(0, 1), bodyX, y, PDF_TYPE.note);
    composer.writeLines(chunk.slice(1), textX, y + PDF_TYPE.note.leading, PDF_TYPE.note);
    composer.y = top + height;
    pending = pending.slice(chunk.length);
    first = false;
    if (pending.length > 0) composer.newPage();
  }
  composer.y += PDF_SPACE.sm;
}

/** La marca de un tono: un disco de su tinta con «!», «i» o ✓ calado en el color del aviso. */
function drawToneGlyph(
  composer: PdfComposer,
  glyph: '!' | 'i' | 'check',
  x: number,
  y: number,
  ink: readonly [number, number, number],
  paper: readonly [number, number, number],
): void {
  const r = GLYPH_SIZE / 2;
  const cx = x + r;
  const cy = y + r;
  composer.doc.setFillColor(ink[0], ink[1], ink[2]);
  composer.doc.circle(cx, cy, r, 'F');
  composer.doc.setFillColor(paper[0], paper[1], paper[2]);
  composer.doc.setDrawColor(paper[0], paper[1], paper[2]);
  if (glyph === 'check') {
    composer.doc.setLineWidth(1.3);
    composer.doc.line(cx - 2.4, cy + 0.1, cx - 0.6, cy + 1.9);
    composer.doc.line(cx - 0.6, cy + 1.9, cx + 2.6, cy - 1.8);
    return;
  }
  // Trazos en vez de un carácter: no dependen de la fuente ni se cuelan en el texto.
  const stem = glyph === '!' ? { top: cy - 3, bottom: cy + 1, dot: cy + 2.9 } : { top: cy - 0.8, bottom: cy + 3, dot: cy - 2.7 };
  composer.doc.rect(cx - 0.75, stem.top, 1.5, stem.bottom - stem.top, 'F');
  composer.doc.circle(cx, stem.dot, 0.85, 'F');
}

/** «Total: 120,00 Bs» → la etiqueta y el importe, para la caja de totales. */
function totalRowOf(text: string): PdfTotalRow {
  const at = text.lastIndexOf(':');
  if (at <= 0) return { label: '', value: text.trim(), emphasis: true };
  return { label: text.slice(0, at).trim(), value: text.slice(at + 1).trim(), emphasis: true };
}

/**
 * Lo que tiene que ir pegado a la última fila de la tabla que lo precede: la
 * caja de totales, o el aviso que la cierra («falta algún precio»). Un aviso
 * más alto que media hoja no se reserva entero: se parte como siempre.
 */
function trailingHeightOf(composer: PdfComposer, block: PdfBlock): number {
  if (block.kind === 'totals' || block.kind === 'total') {
    return PDF_SPACE.sm + measureTotals(composer, totalsOf(block)).total;
  }
  if (block.kind === 'note') {
    const height = PDF_SPACE.sm + noteHeight(composer, block);
    return height <= composer.usableHeight / 2 ? height : 0;
  }
  return 0;
}

/** El alto de un aviso entero, sin partir. */
function noteHeight(composer: PdfComposer, block: PdfBlock): number {
  const toneName = block.tone ?? 'brand';
  const glyphRoom = TONE_GLYPH[toneName] === null ? 0 : GLYPH_SIZE + 6;
  const textWidth = composer.right - PDF_SPACE.panelPadding - (composer.left + 14);
  const titleStyle = PDF_TYPE.heading;
  const title = block.title === undefined ? [] : composer.wrap(block.title, textWidth - glyphRoom, titleStyle);
  const lines = composer.wrap(block.text, textWidth - (title.length === 0 ? glyphRoom : 0), PDF_TYPE.note);
  return (
    PDF_SPACE.panelPadding * 2 +
    title.length * titleStyle.leading +
    (title.length > 0 ? 2 : 0) +
    lines.length * PDF_TYPE.note.leading
  );
}

/** Las filas de un bloque `totals`, o la de un `total` suelto. */
function totalsOf(block: PdfBlock): readonly PdfTotalRow[] {
  return block.kind === 'total' ? [totalRowOf(block.text)] : (block.totals ?? []);
}

/** La caja de totales medida antes de dibujarla: cada fila y el alto total. */
function measureTotals(composer: PdfComposer, rows: readonly PdfTotalRow[]) {
  const width = gridSpan(5);
  const pad = 12;
  const measured = rows.map((row) => {
    const emphasis = row.emphasis === true;
    const labelStyle = emphasis ? PDF_TYPE.grandTotalLabel : PDF_TYPE.totalRow;
    const valueStyle = emphasis ? PDF_TYPE.grandTotal : PDF_TYPE.totalValue;
    // El importe manda: toma lo que mide (hasta dos tercios de la caja) y el
    // rótulo se queda con el resto.
    const valueWidth = Math.min(width * 0.66, composer.measure(row.value, valueStyle));
    const labelWidth = width - valueWidth - pad * 3;
    const label = composer.wrap(row.label, labelWidth, labelStyle);
    const value = composer.wrap(row.value, Math.max(valueWidth, 1) + 0.5, valueStyle);
    const lines = Math.max(label.length * labelStyle.leading, value.length * valueStyle.leading, valueStyle.leading);
    const height = lines + (emphasis ? 22 : 11);
    return { emphasis, labelStyle, valueStyle, label, value, height };
  });
  return { measured, total: rows.length === 0 ? 0 : measured.reduce((sum, row) => sum + row.height, 0) + 4 };
}

/**
 * La caja de totales, a la derecha: subtotal y descuentos con su importe en
 * negrita y, al final, el total a pagar sobre una banda en el degradado del
 * petróleo, con el rótulo en versalitas menta. Es lo único del papel con un
 * relleno oscuro fuera de la portada, y por eso es lo primero que se encuentra
 * al buscar cuánto se paga.
 */
function drawTotals(composer: PdfComposer, rows: readonly PdfTotalRow[]): void {
  if (rows.length === 0) return;
  const width = gridSpan(5);
  const x = composer.right - width;
  const pad = 12;
  const { measured, total } = measureTotals(composer, rows);

  composer.space(PDF_SPACE.sm);
  composer.ensure(total);
  for (const item of measured) {
    const top = composer.y;
    if (item.emphasis) {
      const bandTop = top + 4;
      const bandHeight = item.height - 4;
      composer.shadow(x, bandTop, width, bandHeight, PDF_SPACE.radius);
      composer.gradient(x, bandTop, width, bandHeight, PDF_GRADIENTS.total, { radius: PDF_SPACE.radius });
      const labelTop = bandTop + (bandHeight - item.label.length * item.labelStyle.leading) / 2;
      const valueTop = bandTop + (bandHeight - item.value.length * item.valueStyle.leading) / 2;
      composer.writeLines(item.label, x + pad, labelTop, item.labelStyle);
      composer.writeLines(item.value, x + width - pad, valueTop, item.valueStyle, { align: 'right' });
    } else {
      composer.writeLines(item.label, x + pad, top + 5.5, item.labelStyle);
      composer.writeLines(item.value, x + width - pad, top + 5.5, item.valueStyle, { align: 'right' });
    }
    composer.y += item.height;
    if (!item.emphasis) composer.rule(composer.y, PDF_COLORS.ruleSoft, 0.6, x, x + width);
  }
  composer.y += PDF_SPACE.md + 4;
}

/**
 * Un código QR en su tarjeta, con su título y su leyenda al lado.
 *
 * Se dibuja en vectores módulo por módulo (las corridas de una fila en un solo
 * rectángulo), en el petróleo más profundo sobre blanco y con su zona de
 * silencio: un QR sin margen es el que el lector del celular no encuentra.
 */
function drawQr(composer: PdfComposer, block: PdfBlock): void {
  const qr = block.qr;
  if (qr === undefined || qr.size <= 0) return;
  const pad = PDF_SPACE.panelPadding;
  const side = PDF_QR.size;
  const textX = composer.left + pad + side + PDF_SPACE.xl;
  const textWidth = composer.right - pad - PDF_SPACE.sm - textX;
  const titleStyle = { ...PDF_TYPE.heading, color: PDF_COLORS.brandDeep };
  const title = block.title === undefined ? [] : composer.wrap(block.title, textWidth, titleStyle);
  const lines = composer.wrap(block.text, textWidth, PDF_TYPE.caption);
  const textHeight =
    title.length * titleStyle.leading + (title.length > 0 ? 4 : 0) + lines.length * PDF_TYPE.caption.leading;
  const height = Math.max(side, textHeight) + pad * 2;

  composer.space(PDF_SPACE.sm);
  composer.ensure(height + 4);
  const top = composer.y;
  composer.shadow(composer.left, top, composer.width, height, PDF_SPACE.radius);
  composer.box(composer.left, top, composer.width, height, PDF_SPACE.radius, {
    fill: PDF_COLORS.onBrand,
    stroke: PDF_COLORS.ruleSoft,
    weight: 0.7,
  });
  const qrX = composer.left + pad;
  const qrY = top + (height - side) / 2;
  drawQrModules(composer, qr, qrX, qrY, side);
  // Encima de la marca de agua, el código vuelve a dibujarse limpio sobre su
  // blanco: la marca no le cruza los módulos.
  if ((composer.options.watermark ?? '').trim() !== '') {
    composer.overlay(() => {
      composer.fill(qrX, qrY, side, side, PDF_COLORS.onBrand);
      drawQrModules(composer, qr, qrX, qrY, side);
    });
  }
  // Un filete vertical separa el código de su leyenda.
  composer.doc.setDrawColor(PDF_COLORS.ruleSoft[0], PDF_COLORS.ruleSoft[1], PDF_COLORS.ruleSoft[2]);
  composer.doc.setLineWidth(0.7);
  composer.doc.line(textX - PDF_SPACE.md, top + pad, textX - PDF_SPACE.md, top + height - pad);
  let y = top + (height - textHeight) / 2;
  if (title.length > 0) y += composer.writeLines(title, textX, y, titleStyle) + 4;
  composer.writeLines(lines, textX, y, PDF_TYPE.caption);
  composer.y = top + height + PDF_SPACE.md + 4;
}

function drawQrModules(composer: PdfComposer, qr: PdfQrMatrix, x: number, y: number, side: number): void {
  const quiet = PDF_QR.quietZone;
  const module = (side - quiet * 2) / qr.size;
  const ink = PDF_COLORS.brandDarkest;
  composer.doc.setFillColor(ink[0], ink[1], ink[2]);
  for (let row = 0; row < qr.size; row += 1) {
    let column = 0;
    while (column < qr.size) {
      if (!qr.modules[row * qr.size + column]) {
        column += 1;
        continue;
      }
      const start = column;
      while (column < qr.size && qr.modules[row * qr.size + column]) column += 1;
      // Un cabello de solapamiento: sin él, el antialiasing del visor deja
      // líneas blancas entre módulos vecinos.
      composer.doc.rect(
        x + quiet + start * module,
        y + quiet + row * module,
        (column - start) * module + 0.05,
        module + 0.05,
        'F',
      );
    }
  }
}

/* ---- huecos, imágenes y firma ----------------------------------------- */

/**
 * Los renglones en blanco de un documento que se completa a mano. Cada uno
 * pide su propio lugar, así que un corte de hoja cae **entre** dos renglones y
 * no encima de uno.
 */
function drawWritingLines(composer: PdfComposer, count = 1): void {
  const lines = Math.max(1, Math.trunc(count));
  // Un hueco de hasta seis renglones —una respuesta— va entero en una hoja:
  // dos renglones en una y dos en la otra obligan a escribir la respuesta en
  // dos papeles.
  if (lines <= 6) composer.ensure(lines * PDF_SPACE.writingLine);
  for (let index = 0; index < lines; index += 1) {
    composer.ensure(PDF_SPACE.writingLine);
    composer.y += PDF_SPACE.writingLine;
    // El borde de un campo editable (`--borde-ctrl`): el filete de superficie
    // se perdía al imprimir y desaparecía en una fotocopia.
    composer.rule(composer.y - 4, PDF_COLORS.writingLine, 0.5);
  }
  composer.y += PDF_SPACE.sm;
}

/** La resolución mínima de una ilustración impresa, en píxeles por pulgada. */
const MIN_IMAGE_PPI = 200;

/** Una ilustración del contenido, centrada, sin separarla de su crédito siguiente. */
function drawContentImage(composer: PdfComposer, image: PdfLogo | undefined): void {
  if (image === undefined) return;
  // Nunca por debajo de 200 ppp: una ilustración estirada más allá de sus
  // píxeles se ve escalonada al imprimir. 1 pt = 1/72", así que el ancho
  // máximo es `píxeles × 72 / 200`.
  const box = {
    ancho: Math.min(composer.width, (image.ancho * 72) / MIN_IMAGE_PPI),
    alto: Math.min(300, composer.usableHeight - 20, (image.alto * 72) / MIN_IMAGE_PPI),
  };
  const fit = contenerLogo(image, box);
  if (fit === null) return;
  composer.space(PDF_SPACE.sm);
  composer.ensure(fit.alto + 2 * PDF_TYPE.caption.leading);
  const x = composer.left + (composer.width - fit.ancho) / 2;
  if (!composer.image(image, x, composer.y, fit.ancho, fit.alto)) {
    throw new Error('No se pudo insertar una imagen del glosario en el PDF.');
  }
  composer.y += fit.alto + PDF_SPACE.xs;
}

/** El alto del bloque de firma. */
/** Lo que mide el bloque de firma debajo de la línea: nombre, matrícula y rótulo. */
const SIGNATURE_TEXT_HEIGHT = 4 + PDF_TYPE.heading.leading + PDF_TYPE.caption.leading + PDF_TYPE.label.leading + 2;

/**
 * El espacio sobre la línea: el de las imágenes si hay alguna, o el justo para
 * firmar a mano (≈ 1,1 cm) si no. Sin imágenes, reservar el alto del sello
 * mandaba el bloque solo a una hoja nueva por un hueco que nadie iba a llenar.
 */
function signatureImageArea(signature: { readonly firma: unknown; readonly sello: unknown }): number {
  return signature.firma === null && signature.sello === null
    ? PDF_SIGNATURE.handwritingHeight
    : PDF_SIGNATURE.stampBox.height;
}

/**
 * El bloque de firma, a la derecha y al final del contenido: la firma y el
 * sello arriba, una línea, y el nombre, la matrícula y el rótulo debajo.
 *
 * Va pegado al contenido y no clavado al pie de la hoja, que dejaba un hueco
 * en medio del papel con poco contenido. Si no entra entero en la hoja en
 * curso, pasa a la siguiente sin dejar nada a medias; y si así quedaría sola
 * en esa hoja, el maquetador vuelve a armar el papel llevándose con ella el
 * último bloque del contenido (ver `buildBlocksPdf`).
 *
 * @returns `true` si tuvo que abrir una hoja nueva.
 *
 * Sin imágenes —o con imágenes que `jsPDF` no acepta— el bloque sale igual, con
 * la línea vacía: un documento que se firma a mano después necesita justo eso.
 */
export function drawSignature(composer: PdfComposer): boolean {
  const signature = composer.signature;
  if (signature === null) return false;
  const height = signatureHeight(composer);
  const openedPage = composer.ensure(PDF_SIGNATURE.clearance + height);
  composer.space(PDF_SIGNATURE.clearance);

  const width = PDF_SIGNATURE.width;
  const x = composer.right - width;
  const center = x + width / 2;
  const top = composer.y;
  const { signatureBox, stampBox, gap } = PDF_SIGNATURE;
  const imagesWidth = signatureBox.width + gap + stampBox.width;
  const imagesX = center - imagesWidth / 2;
  const lineY = top + signatureImageArea(signature) + 4;

  placeInBox(composer, signature.firma, imagesX, lineY - signatureBox.height - 2, signatureBox);
  placeInBox(composer, signature.sello, imagesX + signatureBox.width + gap, top, stampBox);

  composer.rule(lineY, PDF_COLORS.inkMuted, 0.6, x, x + width);
  let y = lineY + 4;
  if (signature.nombre.trim() !== '') {
    y += composer.write(signature.nombre, center, y, { ...PDF_TYPE.heading, color: PDF_COLORS.brandDeep }, { align: 'center' });
  }
  if (signature.matricula !== null && signature.matricula.trim() !== '') {
    y += composer.write(`Matrícula ${signature.matricula}`, center, y, PDF_TYPE.caption, { align: 'center' });
  }
  composer.write('Firma y sello', center, y + 2, PDF_TYPE.label, { align: 'center' });
  composer.y = top + height;
  return openedPage;
}

/** El alto del bloque de firma con su aire, o 0 si el documento no lleva firma. */
export function signatureHeight(composer: PdfComposer): number {
  const signature = composer.signature;
  if (signature === null) return 0;
  return signatureImageArea(signature) + 4 + SIGNATURE_TEXT_HEIGHT;
}

/** Una imagen contenida en su caja y apoyada en su borde inferior. */
function placeInBox(
  composer: PdfComposer,
  image: PdfLogo | null,
  x: number,
  y: number,
  box: { readonly width: number; readonly height: number },
): void {
  if (image === null) return;
  const fit = contenerLogo(image, { ancho: box.width, alto: box.height });
  if (fit === null) return;
  composer.image(image, x + (box.width - fit.ancho) / 2, y + box.height - fit.alto, fit.ancho, fit.alto);
}
