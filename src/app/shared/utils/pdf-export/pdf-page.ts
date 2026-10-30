import { altoDeMarca, dibujarMarcaAlovida } from './alovida-mark';
import type { PdfComposer } from './pdf-composer';
import type { PdfMetaEntry } from './pdf-document.types';
import { formatDateTime } from './pdf-format';
import { contenerLogo } from '../../../core/pdf-branding/pdf-logo';
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

    - La **primera hoja** abre con la portada (clara con `plainPaper`): una banda a sangre en el
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

/** `24/10/2026, 10:32`: el formato común de `pdf-format.ts`. */
export function formatIssuedAt(date: Date): string {
  return formatDateTime(date);
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

/**
 * Los estilos de la portada. Con `plainPaper` la portada es **clara**: sin el
 * degradado ni las franjas, con la tinta de la marca sobre el blanco del papel.
 * Es la de los artículos largos con ilustraciones clínicas, que no necesitan
 * una banda oscura antes de cada imagen.
 */
function coverStyles(light: boolean) {
  if (!light) {
    return {
      eyebrow: PDF_TYPE.eyebrow,
      title: PDF_TYPE.title,
      subtitle: PDF_TYPE.subtitle,
      reference: PDF_TYPE.coverReference,
      label: PDF_TYPE.coverLabel,
      value: PDF_TYPE.coverValue,
      brand: PDF_COLORS.onBrand,
      secondaryOpacity: COVER_SECONDARY_OPACITY,
    };
  }
  return {
    eyebrow: { ...PDF_TYPE.eyebrow, color: PDF_COLORS.accentInk },
    title: { ...PDF_TYPE.title, color: PDF_COLORS.brandDeep },
    subtitle: { ...PDF_TYPE.subtitle, color: PDF_COLORS.inkMuted },
    reference: { ...PDF_TYPE.coverReference, color: PDF_COLORS.brandDeep },
    label: { ...PDF_TYPE.coverLabel, color: PDF_COLORS.inkSubtle },
    value: { ...PDF_TYPE.coverValue, color: PDF_COLORS.ink },
    brand: PDF_COLORS.brand,
    secondaryOpacity: 1,
  };
}

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
  const styles = coverStyles(composer.options.plainPaper === true);
  const meta = metaEntries(composer);
  const hasMeta = meta.length > 0 || hasText(reference);
  const titleWidth = composer.width - (hasMeta ? PDF_META.width + PDF_META.gap : 0);
  const blockTop = PDF_SPACE.xl + PDF_PRACTICE_LOGO.height + PDF_PRACTICE_LOGO.padding * 2 + PDF_SPACE.xl;

  const eyebrow = hasText(kind) ? composer.wrap(kind, titleWidth, styles.eyebrow) : [];
  const titleLines = hasText(title) ? composer.wrap(title, titleWidth, styles.title) : [];
  const subtitleLines = hasText(subtitle) ? composer.wrap(subtitle, titleWidth, styles.subtitle) : [];
  const referenceLines = hasText(reference)
    ? composer.wrap(reference, PDF_META.width, styles.reference)
    : [];
  const metaLines = meta.map((entry) => ({
    label: composer.wrap(entry.label, PDF_META.width, styles.label),
    value: composer.wrap(entry.value, PDF_META.width, styles.value),
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
  const light = composer.options.plainPaper === true;
  const styles = coverStyles(light);
  const layout = layoutCover(composer);
  const { height } = layout;
  const width = composer.pageWidth;

  if (!light) {
    // El fondo: el degradado a sangre, el isotipo grande y tenue que firma la
    // portada arriba a la derecha, y un halo aguamarina en el mismo rincón.
    // Todo recortado a la banda: nada de la decoración puede asomar sobre el
    // contenido.
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
  }

  // La marca y la ficha del consultorio, en la misma fila.
  const chipHeight = PDF_PRACTICE_LOGO.height + PDF_PRACTICE_LOGO.padding * 2;
  const rowTop = PDF_SPACE.xl;
  const markHeight = altoDeMarca(PDF_MARK.width);
  drawBrand(
    composer,
    rowTop + (chipHeight - markHeight) / 2,
    PDF_MARK.width,
    { ...PDF_TYPE.wordmark, color: light ? PDF_COLORS.brandDeep : PDF_TYPE.wordmark.color },
    styles.brand,
  );
  drawPracticeLogo(composer, rowTop, light);

  // El bloque del título.
  let y = layout.blockTop;
  if (layout.eyebrow.length > 0) {
    y += composer.writeLines(layout.eyebrow, composer.left, y, styles.eyebrow) + PDF_SPACE.xs;
  }
  y += composer.writeLines(layout.title, composer.left, y, styles.title);
  if (layout.subtitle.length > 0) {
    y += PDF_SPACE.xs;
    const top = y;
    composer.withOpacity(styles.secondaryOpacity, () =>
      composer.writeLines(layout.subtitle, composer.left, top, styles.subtitle),
    );
  }

  // Los metadatos, a la derecha: el folio destacado y cada dato con su rótulo.
  let metaY = layout.blockTop;
  if (layout.reference.length > 0) {
    metaY += composer.writeLines(layout.reference, composer.right, metaY, styles.reference, { align: 'right' });
    metaY += PDF_SPACE.sm;
  }
  for (const entry of layout.meta) {
    metaY += composer.writeLines(entry.label, composer.right, metaY, styles.label, { align: 'right' });
    metaY += composer.writeLines(entry.value, composer.right, metaY, styles.value, { align: 'right' });
    metaY += PDF_SPACE.xs;
  }

  if (light) {
    // Sin banda, un filete estructural separa la portada del contenido.
    composer.rule(height - PDF_SPACE.md, PDF_COLORS.rule, 0.8);
    return height + PDF_SPACE.lg;
  }
  return height + PDF_PAGE.coverEdge + PDF_SPACE.xxl;
}

/** Lo que va en la columna de metadatos, además del folio. */
function metaEntries(composer: PdfComposer): readonly PdfMetaEntry[] {
  return [
    {
      label: composer.issuedAtDeclared ? 'Fecha de emisión' : 'Fecha de generación',
      value: formatIssuedAt(composer.issuedAt),
    },
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
function drawPracticeLogo(composer: PdfComposer, top: number, light: boolean): void {
  const { logo } = composer;
  if (logo === null) return;
  const fit = contenerLogo(logo, { ancho: PDF_PRACTICE_LOGO.width, alto: PDF_PRACTICE_LOGO.height });
  // Sin una imagen que se pueda dibujar no hay ficha: una ficha blanca vacía
  // en la portada se lee como un logo roto.
  if (fit === null || !composer.canDraw(logo)) return;
  const pad = PDF_PRACTICE_LOGO.padding;
  const chipWidth = fit.ancho + pad * 2;
  const chipHeight = PDF_PRACTICE_LOGO.height + pad * 2;
  const x = composer.right - chipWidth;
  composer.box(x, top, chipWidth, chipHeight, PDF_SPACE.radius, {
    fill: PDF_COLORS.onBrand,
    ...(light ? { stroke: PDF_COLORS.ruleSoft, weight: 0.7 } : {}),
  });
  composer.image(logo, x + pad, top + pad + fit.arriba, fit.ancho, fit.alto);
}

/* ---- las hojas siguientes ---------------------------------------------- */

/**
 * El membrete de las hojas siguientes: la franja en degradado arriba, la marca
 * chica a la izquierda y, a la derecha, el título y el folio en letra de pie.
 */
function drawContinuationHeader(composer: PdfComposer): number {
  if (composer.options.plainPaper !== true) {
    composer.gradient(0, 0, composer.pageWidth, PDF_PAGE.bandHeight, PDF_GRADIENTS.cover);
  }
  const top = PDF_PAGE.continuationHeaderTop;
  const markWidth = PDF_MARK.continuationWidth;
  const markHeight = altoDeMarca(markWidth);
  drawBrand(composer, top, markWidth, { ...PDF_TYPE.wordmark, size: 10, leading: 12 }, PDF_COLORS.brand);
  const { title, kind, reference } = composer.options;
  const parts = [hasText(title) ? title : kind, reference].filter(hasText);
  if (parts.length > 0) {
    const style = PDF_TYPE.footer;
    // Lo que queda a la derecha de la marca, con aire: un título larguísimo se
    // recorta con puntos suspensivos en vez de pisar el nombre de la marca.
    const room = composer.width - 120;
    composer.write(fitWidth(composer, parts.join('  ·  '), room, style), composer.right, top + markHeight - style.leading + 2, style, {
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
  const dated = `${composer.issuedAtDeclared ? 'Emitido' : 'Generado'} el ${formatIssuedAt(composer.issuedAt)}`;
  const note = [composer.options.footerNote ?? DEFAULT_FOOTER_NOTE, dated]
    .filter(hasText)
    .join('  ·  ');
  const issuerLines = composer.wrap(issuer.join('  ·  '), textWidth, PDF_TYPE.footer).slice(0, 2);
  const noteLines = composer.wrap(note, textWidth, PDF_TYPE.footer).slice(0, 1);

  for (let page = 1; page <= total; page += 1) {
    doc.setPage(page);
    drawWatermark(composer);
    for (const draw of composer.overlays.get(page) ?? []) draw();
    composer.rule(ruleY, PDF_COLORS.rule, 0.6);
    if (composer.options.plainPaper !== true) {
      composer.gradient(0, composer.pageHeight - PDF_PAGE.footerBand, composer.pageWidth, PDF_PAGE.footerBand, PDF_GRADIENTS.cover);
    }

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

/** El texto recortado con «…» hasta que entra en `width`. */
function fitWidth(composer: PdfComposer, text: string, width: number, style: PdfTextStyle): string {
  if (composer.measure(text, style) <= width) return text;
  let cut = text;
  while (cut.length > 1 && composer.measure(`${cut}…`, style) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

function hasText(value: string | undefined | null): value is string {
  return value !== undefined && value !== null && value.trim() !== '';
}
