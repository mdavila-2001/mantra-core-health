import { altoDeMarca, dibujarMarcaAlovida } from './alovida-mark';
import type { PdfComposer } from './pdf-composer';
import type { PdfMetaEntry } from './pdf-document.types';
import { contenerLogo } from './pdf-logo';
import {
  PDF_COLORS,
  PDF_GRADIENTS,
  PDF_MARK,
  PDF_META,
  PDF_PAGE,
  PDF_PRACTICE_LOGO,
  PDF_SPACE,
  PDF_TYPE,
  type PdfTextStyle,
} from './pdf-theme';

/* ============================================================================
    El marco de la hoja: portada, membrete de continuación, marca de agua y pie.

    Lo dibuja **el motor**, no cada documento: un membrete que cada pantalla
    arme por su cuenta deja de ser un membrete.

    - La **primera hoja** abre con la portada: una banda a sangre en el
      degradado de los azules profundos de AloVida, con el isotipo y la marca
      en blanco, el logo del consultorio en su ficha, la clase de documento, el
      título y, a la derecha, el folio y la fecha de emisión. Un filo
      aguamarina la cierra.
    - Las **siguientes** llevan una franja fina y un membrete corto con el
      título y el folio: repetir la portada en cada hoja convierte un documento
      de cinco carillas en cinco portadas.
    - **Todas** cierran con el pie: emisor, nota legal, fecha de emisión y
      «Página X de Y».
    ========================================================================== */

/** La línea del pie cuando el documento no pide otra. */
export const DEFAULT_FOOTER_NOTE = 'Documento confidencial';

/** El nombre de la marca junto al isotipo. */
export const WORDMARK = 'AloVida';

/** Cuánto se nota la marca de agua: lo justo para leerse sin tapar lo de debajo. */
const WATERMARK_OPACITY = 0.14;

/** Cuánto se nota lo secundario sobre la portada: el blanco de la marca, más tenue. */
const COVER_SECONDARY_OPACITY = 0.78;

/** `24/10/2026, 10:32`: día, mes y año a la boliviana, sin depender del ICU del entorno. */
export function formatIssuedAt(date: Date): string {
  const two = (value: number): string => String(value).padStart(2, '0');
  return `${two(date.getDate())}/${two(date.getMonth() + 1)}/${date.getFullYear()}, ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** Abre la primera hoja. Devuelve dónde empieza el contenido. */
export function drawFirstPage(composer: PdfComposer): number {
  return drawCover(composer);
}

/** Abre una hoja de continuación. Devuelve dónde empieza el contenido. */
export function drawContinuationPage(composer: PdfComposer): number {
  return drawContinuationHeader(composer);
}

/* ---- la portada -------------------------------------------------------- */

/** Las líneas de la portada ya partidas: se mide todo antes de pintar el fondo. */
interface CoverLayout {
  readonly eyebrow: readonly string[];
  readonly title: readonly string[];
  readonly subtitle: readonly string[];
  readonly reference: readonly string[];
  readonly meta: readonly { readonly label: readonly string[]; readonly value: readonly string[] }[];
  readonly blockTop: number;
  readonly height: number;
}

function layoutCover(composer: PdfComposer): CoverLayout {
  const { kind, title, subtitle, reference } = composer.options;
  const meta = metaEntries(composer);
  const hasMeta = meta.length > 0 || hasText(reference);
  const titleWidth = composer.width - (hasMeta ? PDF_META.width + PDF_META.gap : 0);
  const blockTop = PDF_SPACE.xl + PDF_PRACTICE_LOGO.height + PDF_PRACTICE_LOGO.padding * 2 + PDF_SPACE.xl;

  const eyebrow = hasText(kind) ? composer.wrap(kind, titleWidth, PDF_TYPE.eyebrow) : [];
  const titleLines = hasText(title) ? composer.wrap(title, titleWidth, PDF_TYPE.title) : [];
  const subtitleLines = hasText(subtitle) ? composer.wrap(subtitle, titleWidth, PDF_TYPE.subtitle) : [];
  const referenceLines = hasText(reference)
    ? composer.wrap(reference, PDF_META.width, PDF_TYPE.coverReference)
    : [];
  const metaLines = meta.map((entry) => ({
    label: composer.wrap(entry.label, PDF_META.width, PDF_TYPE.coverLabel),
    value: composer.wrap(entry.value, PDF_META.width, PDF_TYPE.coverValue),
  }));

  const left =
    eyebrow.length * PDF_TYPE.eyebrow.leading +
    (eyebrow.length > 0 ? PDF_SPACE.xs : 0) +
    titleLines.length * PDF_TYPE.title.leading +
    (subtitleLines.length > 0 ? PDF_SPACE.xs + subtitleLines.length * PDF_TYPE.subtitle.leading : 0);
  const right =
    referenceLines.length * PDF_TYPE.coverReference.leading +
    (referenceLines.length > 0 ? PDF_SPACE.sm : 0) +
    metaLines.reduce(
      (sum, entry) =>
        sum + entry.label.length * PDF_TYPE.coverLabel.leading + entry.value.length * PDF_TYPE.coverValue.leading + PDF_SPACE.xs,
      0,
    );
  const height = Math.max(PDF_PAGE.coverMinHeight, blockTop + Math.max(left, right) + PDF_SPACE.xl + PDF_SPACE.xs);
  return {
    eyebrow,
    title: titleLines,
    subtitle: subtitleLines,
    reference: referenceLines,
    meta: metaLines,
    blockTop,
    height,
  };
}

/** La portada de la primera hoja. Devuelve dónde empieza el contenido. */
function drawCover(composer: PdfComposer): number {
  const layout = layoutCover(composer);
  const { height } = layout;
  const width = composer.pageWidth;

  // El fondo: el degradado a sangre, el isotipo grande y tenue que firma la
  // portada arriba a la derecha, y un halo aguamarina en el mismo rincón. Todo recortado a
  // la banda: nada de la decoración puede asomar sobre el contenido.
  composer.gradient(0, 0, width, height, PDF_GRADIENTS.cover);
  composer.clipped(0, 0, width, height, () => {
    composer.withOpacity(0.07, () => {
      composer.doc.setFillColor(PDF_COLORS.accent[0], PDF_COLORS.accent[1], PDF_COLORS.accent[2]);
      composer.doc.circle(width - 40, -10, 190, 'F');
      composer.doc.circle(width - 40, -10, 120, 'F');
    });
    const markWidth = PDF_MARK.coverWidth;
    dibujarMarcaAlovida(composer.doc, {
      // Asoma desde el borde superior, detrás de la ficha del logo: nunca
      // debajo del folio ni del título.
      x: width - markWidth * 0.62,
      y: -altoDeMarca(markWidth) * 0.42,
      ancho: markWidth,
      color: PDF_COLORS.onBrand,
      opacidad: PDF_MARK.coverOpacity,
    });
  });
  composer.gradient(0, height, width, PDF_PAGE.coverEdge, PDF_GRADIENTS.edge);

  // La marca y la ficha del consultorio, en la misma fila.
  const chipHeight = PDF_PRACTICE_LOGO.height + PDF_PRACTICE_LOGO.padding * 2;
  const rowTop = PDF_SPACE.xl;
  const markHeight = altoDeMarca(PDF_MARK.width);
  drawBrand(composer, rowTop + (chipHeight - markHeight) / 2, PDF_MARK.width, PDF_TYPE.wordmark, PDF_COLORS.onBrand);
  drawPracticeLogo(composer, rowTop);

  // El bloque del título.
  let y = layout.blockTop;
  if (layout.eyebrow.length > 0) {
    y += composer.writeLines(layout.eyebrow, composer.left, y, PDF_TYPE.eyebrow) + PDF_SPACE.xs;
  }
  y += composer.writeLines(layout.title, composer.left, y, PDF_TYPE.title);
  if (layout.subtitle.length > 0) {
    y += PDF_SPACE.xs;
    const top = y;
    composer.withOpacity(COVER_SECONDARY_OPACITY, () =>
      composer.writeLines(layout.subtitle, composer.left, top, PDF_TYPE.subtitle),
    );
  }

  // Los metadatos, a la derecha: el folio destacado y cada dato con su rótulo.
  let metaY = layout.blockTop;
  if (layout.reference.length > 0) {
    metaY += composer.writeLines(layout.reference, composer.right, metaY, PDF_TYPE.coverReference, {
      align: 'right',
    });
    metaY += PDF_SPACE.sm;
  }
  for (const entry of layout.meta) {
    metaY += composer.writeLines(entry.label, composer.right, metaY, PDF_TYPE.coverLabel, { align: 'right' });
    metaY += composer.writeLines(entry.value, composer.right, metaY, PDF_TYPE.coverValue, { align: 'right' });
    metaY += PDF_SPACE.xs;
  }

  return height + PDF_PAGE.coverEdge + PDF_SPACE.xxl;
}

/** Lo que va en la columna de metadatos, además del folio. */
function metaEntries(composer: PdfComposer): readonly PdfMetaEntry[] {
  return [
    { label: 'Fecha de emisión', value: formatIssuedAt(composer.issuedAt) },
    ...(composer.options.meta ?? []).filter((entry) => hasText(entry.value)),
  ];
}

/** El isotipo y el nombre de la marca, alineados por la base. */
function drawBrand(
  composer: PdfComposer,
  top: number,
  markWidth: number,
  style: PdfTextStyle,
  color: readonly [number, number, number],
): void {
  dibujarMarcaAlovida(composer.doc, { x: composer.left, y: top, ancho: markWidth, color });
  const markHeight = altoDeMarca(markWidth);
  composer.useStyle(style, color);
  // La base del nombre cae sobre la base del isotipo: se leen como una pieza.
  composer.doc.text(
    WORDMARK,
    composer.left + markWidth + PDF_MARK.gap * (markWidth / PDF_MARK.width),
    top + markHeight - style.size * 0.06,
  );
}

/**
 * El logo del consultorio en su ficha blanca, arriba a la derecha. Sin logo no
 * hay ficha. Un logo defectuoso se omite: nunca puede impedir una receta.
 */
function drawPracticeLogo(composer: PdfComposer, top: number): void {
  const { logo } = composer;
  if (logo === null) return;
  const fit = contenerLogo(logo, { ancho: PDF_PRACTICE_LOGO.width, alto: PDF_PRACTICE_LOGO.height });
  if (fit === null) return;
  const pad = PDF_PRACTICE_LOGO.padding;
  const chipWidth = fit.ancho + pad * 2;
  const chipHeight = PDF_PRACTICE_LOGO.height + pad * 2;
  const x = composer.right - chipWidth;
  composer.box(x, top, chipWidth, chipHeight, PDF_SPACE.radius, { fill: PDF_COLORS.onBrand });
  composer.image(logo, x + pad, top + pad + fit.arriba, fit.ancho, fit.alto);
}

/* ---- las hojas siguientes ---------------------------------------------- */

/**
 * El membrete de las hojas siguientes: la franja en degradado arriba, la marca
 * chica a la izquierda y, a la derecha, el título y el folio en letra de pie.
 */
function drawContinuationHeader(composer: PdfComposer): number {
  composer.gradient(0, 0, composer.pageWidth, PDF_PAGE.bandHeight, PDF_GRADIENTS.cover);
  const top = PDF_PAGE.continuationHeaderTop;
  const markWidth = PDF_MARK.continuationWidth;
  const markHeight = altoDeMarca(markWidth);
  drawBrand(composer, top, markWidth, { ...PDF_TYPE.wordmark, size: 10, leading: 12 }, PDF_COLORS.brand);
  const { title, kind, reference } = composer.options;
  const parts = [hasText(title) ? title : kind, reference].filter(hasText);
  if (parts.length > 0) {
    const style = PDF_TYPE.footer;
    composer.write(parts.join('  ·  '), composer.right, top + markHeight - style.leading + 2, style, {
      align: 'right',
    });
  }
  const ruleY = top + markHeight + PDF_SPACE.sm + 2;
  composer.rule(ruleY, PDF_COLORS.ruleSoft, 0.7);
  return ruleY + PDF_SPACE.xl;
}

/* ---- la marca de agua -------------------------------------------------- */

/**
 * Marca de agua en diagonal, centrada en la hoja y **encima** de todo, con poca
 * opacidad: el texto de debajo se sigue leyendo, y ningún bloque opaco —una
 * tarjeta, la cabecera de una tabla, la banda del total— la tapa. Debajo del
 * contenido, «SIN VALIDEZ» salía como «SIN V… DEZ», y una marca que invalida un
 * papel se tiene que leer entera en cada hoja.
 *
 * `jsPDF` alinea el texto **antes** de rotarlo, así que el punto de partida se
 * calcula a mano para que el centro del texto rotado caiga en el centro de la
 * hoja, y el cuerpo se achica para que el largo quepa en el 75 % del ancho.
 */
function drawWatermark(composer: PdfComposer): void {
  const text = composer.options.watermark?.trim();
  if (text === undefined || text === '') return;
  const angle = 35;
  const radians = (angle * Math.PI) / 180;
  const style = PDF_TYPE.watermark;
  const shaped = text.toLocaleUpperCase('es');
  composer.useStyle(style);
  const natural = composer.doc.getTextWidth(shaped);
  const size = Math.min(style.size, (style.size * composer.pageWidth * 0.75) / (natural * Math.cos(radians)));
  composer.doc.setFontSize(size);
  const length = composer.doc.getTextWidth(shaped);
  const x = composer.pageWidth / 2 - (length / 2) * Math.cos(radians);
  const y = composer.pageHeight / 2 + (length / 2) * Math.sin(radians);
  composer.withOpacity(WATERMARK_OPACITY, () => composer.doc.text(shaped, x, y, { angle }));
}

/* ---- el pie ------------------------------------------------------------ */

/**
 * El pie de todas las hojas —y, con él, la marca de agua, que va encima del
 * contenido—: emisor, nota legal, fecha de emisión y «Página X
 * de Y» en su píldora, sobre una franja fina en degradado al borde.
 *
 * Se estampa **al final**, cuando ya se sabe cuántas hojas hay: un documento
 * clínico sin ese «de 7» no deja notar que falta una carilla.
 */
export function stampFooters(composer: PdfComposer): void {
  const { doc } = composer;
  const total = doc.getNumberOfPages();
  const ruleY = composer.pageHeight - PDF_PAGE.footerRuleFromBottom;
  const pillColumn = 96;
  const textWidth = composer.width - pillColumn - PDF_SPACE.md;

  const issuer = [composer.issuer.name, ...(composer.issuer.details ?? [])].filter(hasText);
  const note = [composer.options.footerNote ?? DEFAULT_FOOTER_NOTE, `Emitido el ${formatIssuedAt(composer.issuedAt)}`]
    .filter(hasText)
    .join('  ·  ');
  const issuerLines = composer.wrap(issuer.join('  ·  '), textWidth, PDF_TYPE.footer).slice(0, 2);
  const noteLines = composer.wrap(note, textWidth, PDF_TYPE.footer).slice(0, 1);

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    drawWatermark(composer);
    composer.rule(ruleY, PDF_COLORS.rule, 0.6);
    composer.gradient(0, composer.pageHeight - PDF_PAGE.footerBand, composer.pageWidth, PDF_PAGE.footerBand, PDF_GRADIENTS.cover);

    let y = ruleY + PDF_SPACE.sm + 1;
    // El nombre del emisor en Poppins y sus datos en Nunito Sans, en la misma línea.
    const [first, ...rest] = issuerLines;
    if (first !== undefined) {
      const name = composer.issuer.name;
      if (first.startsWith(name)) {
        composer.write(name, composer.left, y, PDF_TYPE.footerStrong);
        const tail = first.slice(name.length);
        if (tail !== '') {
          composer.write(tail, composer.left + composer.measure(name, PDF_TYPE.footerStrong), y, PDF_TYPE.footer);
        }
      } else {
        composer.write(first, composer.left, y, PDF_TYPE.footer);
      }
      y += PDF_TYPE.footer.leading;
    }
    for (const line of [...rest, ...noteLines]) {
      composer.write(line, composer.left, y, PDF_TYPE.footer);
      y += PDF_TYPE.footer.leading;
    }

    const label = `Página ${page} de ${total}`;
    const style = PDF_TYPE.pageNumber;
    const pillWidth = composer.measure(label, style) + PDF_SPACE.md * 2;
    const pillHeight = style.leading + 7;
    const pillTop = ruleY + PDF_SPACE.sm;
    composer.box(composer.right - pillWidth, pillTop, pillWidth, pillHeight, pillHeight / 2, {
      fill: PDF_COLORS.inset,
      stroke: PDF_COLORS.ruleSoft,
      weight: 0.6,
    });
    composer.write(label, composer.right - pillWidth / 2, pillTop + 3.5, style, { align: 'center' });
  }
  doc.setPage(total);
}

function hasText(value: string | undefined | null): value is string {
  return value !== undefined && value !== null && value.trim() !== '';
}
