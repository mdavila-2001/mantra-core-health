import type { PdfComposer } from './pdf-composer';
import type { PdfBlock, PdfField, PdfQrMatrix, PdfTotalRow } from './pdf-document.types';
import { contenerLogo, type PdfLogo } from './pdf-logo';
import { drawTable } from './pdf-table';
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

/** Dibuja el contenido entero, en orden. */
export function drawContent(composer: PdfComposer, blocks: readonly PdfBlock[]): void {
  for (const element of groupBlocks(blocks)) {
    if (element.type === 'table') {
      drawTable(composer, element.rows);
    } else if (element.type === 'fieldList') {
      drawFieldList(composer, element.fields);
    } else {
      drawBlock(composer, element.block);
    }
  }
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
    case 'note':
      drawNote(composer, block);
      return;
    case 'total':
      drawTotals(composer, [totalRowOf(block.text)]);
      return;
    case 'totals':
      drawTotals(composer, block.totals ?? []);
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
function drawHeading(composer: PdfComposer, block: PdfBlock): void {
  const level = block.level ?? 6;
  if (level <= 2) {
    const style = level === 1 ? PDF_TYPE.section : PDF_TYPE.subsection;
    const indent = 11;
    const lines = composer.wrap(block.text, composer.width - indent, style);
    const height = lines.length * style.leading + PDF_SPACE.sm + PDF_SPACE.afterSection;
    composer.ensure(PDF_SPACE.beforeSection + height + PDF_TYPE.body.leading * 2);
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
  const style = level === 3 ? PDF_TYPE.heading : PDF_TYPE.minorHeading;
  const lines = composer.wrap(block.text, composer.width, style);
  composer.ensure(PDF_SPACE.md + lines.length * style.leading + PDF_TYPE.body.leading * 2);
  composer.space(PDF_SPACE.md);
  composer.y += composer.writeLines(lines, composer.left, composer.y, style);
  composer.y += PDF_SPACE.xs;
}

/**
 * Un párrafo, partido entre hojas renglón por renglón.
 *
 * Va alineado a la izquierda y no justificado: Inter justificada abre ríos
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
 * Datos seguidos: la etiqueta en versalitas a la izquierda y el valor a la
 * derecha, con un filete de superficie entre renglones. La vista baja por los
 * valores sin tropezar con «Paciente:», «Documento:», «Profesional:» repetidos.
 */
function drawFieldList(composer: PdfComposer, fields: readonly PdfField[]): void {
  const labelWidth = PDF_SPACE.labelColumn;
  const valueX = composer.left + labelWidth;
  const valueWidth = composer.width - labelWidth;
  const padding = 6;
  composer.space(PDF_SPACE.xs);
  for (const field of fields) {
    const labelLines = composer.wrap(field.label, labelWidth - PDF_SPACE.md, PDF_TYPE.label);
    const valueLines = composer.wrap(field.value, valueWidth, PDF_TYPE.value);
    const height =
      Math.max(
        labelLines.length * PDF_TYPE.label.leading + 3,
        valueLines.length * PDF_TYPE.value.leading,
      ) +
      padding * 2;
    composer.ensure(height);
    // La etiqueta, más chica, se baja hasta que su línea base coincide con la
    // del valor: así se leen como un solo renglón.
    const labelOffset = composer.baseline(PDF_TYPE.value) - composer.baseline(PDF_TYPE.label);
    composer.writeLines(labelLines, composer.left, composer.y + padding + labelOffset, PDF_TYPE.label);
    composer.writeLines(valueLines, valueX, composer.y + padding, PDF_TYPE.value);
    composer.y += height;
    composer.rule(composer.y, PDF_COLORS.ruleSoft, 0.6);
  }
  composer.y += PDF_SPACE.md;
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
 * Un aviso: texto sobre una tarjeta del color de su estado, con una barra
 * redondeada de la tinta del estado y un título opcional. Es para lo que hay
 * que leer pero no es el dato —advertencias, alergias, «esto no es una
 * factura»—.
 */
function drawNote(composer: PdfComposer, block: PdfBlock): void {
  const tone = PDF_TONES[block.tone ?? 'brand'];
  const pad = PDF_SPACE.panelPadding;
  const bar = 3;
  const textX = composer.left + pad + bar + 10;
  const textWidth = composer.right - pad - textX;
  const titleStyle = { ...PDF_TYPE.noteTitle, color: tone.ink };
  const title = block.title === undefined ? [] : composer.wrap(block.title, textWidth, titleStyle);
  const lines = composer.wrap(block.text, textWidth, PDF_TYPE.note);
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
    composer.box(composer.left, composer.y, composer.width, height, PDF_SPACE.radius, { fill: tone.fill });
    composer.box(composer.left + pad, composer.y + pad, bar, height - pad * 2, bar / 2, { fill: tone.ink });
    let y = composer.y + pad;
    if (first && title.length > 0) {
      y += composer.writeLines(title, textX, y, titleStyle) + 2;
    }
    composer.writeLines(chunk, textX, y, PDF_TYPE.note);
    composer.y += height;
    pending = pending.slice(chunk.length);
    first = false;
    if (pending.length > 0) composer.newPage();
  }
  composer.y += PDF_SPACE.sm;
}

/** «Total: 120,00 Bs» → la etiqueta y el importe, para la caja de totales. */
function totalRowOf(text: string): PdfTotalRow {
  const at = text.lastIndexOf(':');
  if (at <= 0) return { label: '', value: text.trim(), emphasis: true };
  return { label: text.slice(0, at).trim(), value: text.slice(at + 1).trim(), emphasis: true };
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
  const total = measured.reduce((sum, row) => sum + row.height, 0) + 4;

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
  drawQrModules(composer, qr, composer.left + pad, top + (height - side) / 2, side);
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
  for (let index = 0; index < lines; index += 1) {
    composer.ensure(PDF_SPACE.writingLine);
    composer.y += PDF_SPACE.writingLine;
    composer.rule(composer.y - 4, PDF_COLORS.rule, 0.6);
  }
  composer.y += PDF_SPACE.sm;
}

/** Una ilustración del contenido, centrada, sin separarla de su crédito siguiente. */
function drawContentImage(composer: PdfComposer, image: PdfLogo | undefined): void {
  if (image === undefined) return;
  const box = { ancho: composer.width, alto: Math.min(300, composer.usableHeight - 20) };
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
const SIGNATURE_HEIGHT =
  PDF_SIGNATURE.stampBox.height + 4 + PDF_TYPE.heading.leading + PDF_TYPE.caption.leading + PDF_TYPE.label.leading + 6;

/**
 * El bloque de firma, a la derecha y al final del contenido: la firma y el
 * sello arriba, una línea, y el nombre, la matrícula y el rótulo debajo.
 *
 * Va pegado al contenido y no al pie de la hoja, que dejaba un hueco en medio
 * del papel o mandaba la firma sola a una hoja nueva. Si no entra entero en la
 * hoja en curso, pasa a la siguiente sin dejar nada a medias.
 *
 * Sin imágenes —o con imágenes que `jsPDF` no acepta— el bloque sale igual, con
 * la línea vacía: un documento que se firma a mano después necesita justo eso.
 */
export function drawSignature(composer: PdfComposer): void {
  const signature = composer.signature;
  if (signature === null) return;
  composer.ensure(PDF_SIGNATURE.clearance + SIGNATURE_HEIGHT);
  composer.space(PDF_SIGNATURE.clearance);

  const width = PDF_SIGNATURE.width;
  const x = composer.right - width;
  const center = x + width / 2;
  const top = composer.y;
  const { signatureBox, stampBox, gap } = PDF_SIGNATURE;
  const imagesWidth = signatureBox.width + gap + stampBox.width;
  const imagesX = center - imagesWidth / 2;
  const lineY = top + stampBox.height + 4;

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
  composer.y = top + SIGNATURE_HEIGHT;
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
