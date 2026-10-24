import { ShadingPattern, type jsPDF } from 'jspdf';

import type { ColorRgb } from './alovida-mark';
import type { PdfExportOptions, PdfIssuer } from './pdf-document.types';
import { documentSignature, type PdfSignature } from '../../../core/pdf-branding/pdf-signature';
import { documentFonts, type PdfFonts } from '../../../core/pdf-branding/pdf-fonts';
import { logoDeDocumentos, type PdfLogo } from '../../../core/pdf-branding/pdf-logo';
import {
  PDF_ALPHA_TOKENS,
  PDF_FONTS,
  PDF_PAGE,
  PDF_SHADOW,
  type PdfFontRole,
  type PdfGradient,
  type PdfTextStyle,
} from './pdf-theme';

/**
 * La pluma del maquetador: sabe dónde va el próximo bloque, cuánto lugar queda
 * en la hoja y cómo escribir con los estilos del tema.
 *
 * ## La convención de la pluma
 *
 * `y` es el **borde superior** del próximo bloque, no la línea base de un
 * texto. Cada bloque mide su alto, pide lugar con {@link PdfComposer.ensure} y
 * deja `y` en su borde inferior. Así el aire entre dos bloques es una suma que
 * se lee en el código, no una línea base que cada bloque corrige a ojo.
 *
 * Lo que se dibuja en cada hoja nueva —la franja, el membrete corto, la marca
 * de agua— lo decide quien crea la pluma con `onNewPage`: la pluma sólo sabe
 * que hay que dibujarlo y dónde queda el contenido después.
 */
export class PdfComposer {
  readonly left: number = PDF_PAGE.marginX;
  /** Ancho útil: el de la hoja real menos los márgenes (en A4, `CONTENT_WIDTH` del tema). */
  readonly width: number;
  readonly right: number;
  readonly pageWidth: number;
  readonly pageHeight: number;
  /** La última altura que el contenido puede ocupar antes del pie. */
  readonly bottom: number;

  /** El logo del consultorio ya resuelto, o `null`. Se decide una vez por documento. */
  readonly logo: PdfLogo | null;
  /** La firma del final, ya resuelta, o `null` si el documento no lleva bloque. */
  readonly signature: PdfSignature | null;
  readonly issuer: PdfIssuer;
  readonly issuedAt: Date;
  /**
   * El documento declaró su fecha de emisión. Si no, la fecha es la de
   * **generación** y se rotula así: una factura del 15/09 bajada el 24/10 no
   * puede decir «emitida el 24/10».
   */
  readonly issuedAtDeclared: boolean;

  /** Dónde va el próximo bloque. */
  y = 0;
  /** La hoja en curso, desde 1. */
  page = 1;
  /**
   * Lo que se vuelve a dibujar **encima de la marca de agua**, por hoja: un QR
   * con la marca cruzándole los módulos es el que la impresora láser ensucia y
   * el celular no lee.
   */
  readonly overlays = new Map<number, (() => void)[]>();
  /**
   * Dónde empieza el contenido de la hoja **en curso**, bajo su membrete. Es
   * lo que distingue una hoja recién abierta de una a medio escribir.
   */
  pageTop = 0;

  private readonly fonts: Readonly<Record<PdfFontRole, string>>;
  /** Los degradados ya registrados en el documento, para no repetirlos por hoja. */
  private readonly patterns = new Set<string>();
  private readonly hasBrandFonts: boolean;

  constructor(
    readonly doc: jsPDF,
    readonly options: PdfExportOptions,
    private readonly onNewPage: (composer: PdfComposer) => number,
  ) {
    this.pageWidth = doc.internal.pageSize.getWidth();
    this.pageHeight = doc.internal.pageSize.getHeight();
    this.width = this.pageWidth - PDF_PAGE.marginX * 2;
    this.right = this.left + this.width;
    this.bottom = this.pageHeight - PDF_PAGE.footerRuleFromBottom - PDF_PAGE.footerClearance;
    this.logo = options.logo === undefined ? logoDeDocumentos() : options.logo;
    this.signature = options.firma === undefined ? documentSignature() : options.firma;
    this.issuer = options.issuer ?? { name: 'AloVida' };
    this.issuedAt = options.issuedAt ?? new Date();
    this.issuedAtDeclared = options.issuedAt !== undefined;
    const fuentes = documentFonts();
    this.hasBrandFonts = fuentes !== null;
    this.fonts = registerFonts(doc, fuentes);
  }

  /** Lo que queda libre en la hoja en curso. */
  get remaining(): number {
    return this.bottom - this.y;
  }

  /** La hoja en curso todavía no tiene contenido. */
  get atPageTop(): boolean {
    return this.y <= this.pageTop;
  }

  /** Alto útil de una hoja de continuación vacía: lo más alto que puede ser un bloque. */
  get usableHeight(): number {
    return this.bottom - this.pageTop;
  }

  /** Pasa a una hoja nueva y deja la pluma bajo su membrete. */
  newPage(): void {
    this.doc.addPage();
    this.page += 1;
    this.pageTop = this.onNewPage(this);
    this.y = this.pageTop;
  }

  /**
   * Deja lugar para un bloque de `height` puntos, pasando de hoja si no entra.
   *
   * No pasa de hoja cuando la actual está vacía: un bloque más alto que la caja
   * de texto entraría en un bucle de hojas en blanco, y es preferible que se
   * corte a que el documento no termine de generarse nunca.
   *
   * @returns `true` si pasó de hoja.
   */
  ensure(height: number): boolean {
    if (this.y + height > this.bottom && !this.atPageTop) {
      this.newPage();
      return true;
    }
    return false;
  }

  /** Aire antes de un bloque, salvo al tope de una hoja: ahí el membrete ya lo da. */
  space(amount: number): void {
    if (!this.atPageTop) {
      this.y += amount;
    }
  }

  /* ---- texto ------------------------------------------------------------ */

  /** Pone la fuente, el cuerpo y el color de un estilo. */
  useStyle(style: PdfTextStyle, color: ColorRgb = style.color): void {
    const family = this.fonts[style.font];
    const weight = !this.hasBrandFonts && style.font !== 'text' ? 'bold' : 'normal';
    this.doc.setFont(family, weight);
    this.doc.setFontSize(style.size);
    this.doc.setTextColor(color[0], color[1], color[2]);
  }

  /** El texto como se escribe con el estilo: en mayúsculas si el estilo lo pide. */
  shape(text: string, style: PdfTextStyle): string {
    return style.uppercase === true ? text.toLocaleUpperCase('es') : text;
  }

  /** Cuánto mide un texto ya formado con un estilo, contando el espaciado entre letras. */
  measure(text: string, style: PdfTextStyle): number {
    this.useStyle(style);
    const tracking = style.tracking ?? 0;
    return this.doc.getTextWidth(text) + Math.max(0, text.length - 1) * tracking;
  }

  /**
   * Parte un texto en las líneas que entran en `width`.
   *
   * Con espaciado entre letras no sirve `splitTextToSize`, que mide sin él: en
   * una versalita espaciada ese extra es casi un quinto del ancho y el texto se
   * saldría de su columna. Ahí se parte por palabras midiendo con el espaciado.
   */
  /** Dibuja algo otra vez al final, encima de la marca de agua de esta hoja. */
  overlay(draw: () => void): void {
    const list = this.overlays.get(this.page) ?? [];
    list.push(draw);
    this.overlays.set(this.page, list);
  }

  wrap(text: string, width: number, style: PdfTextStyle): string[] {
    const shaped = keepTimesTogether(this.shape(text, style));
    // Sólo los blancos comunes cuentan como vacío: un espacio duro (U+00A0) es
    // un renglón deliberado —un hueco pedido a propósito—, y `trim()` lo
    // borraría.
    if (/^[ \t\r\n]*$/.test(shaped)) {
      return [];
    }
    if ((style.tracking ?? 0) === 0) {
      this.useStyle(style);
      return this.doc.splitTextToSize(shaped, Math.max(1, width)) as string[];
    }
    const lines: string[] = [];
    let current = '';
    for (const word of shaped.trim().split(/\s+/)) {
      const candidate = current === '' ? word : `${current} ${word}`;
      if (current !== '' && this.measure(candidate, style) > width) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    lines.push(current);
    return lines;
  }

  /** Distancia del borde superior de una línea a su línea base. */
  baseline(style: PdfTextStyle): number {
    return (style.leading - style.size) / 2 + style.size * 0.78;
  }

  /**
   * Escribe líneas ya partidas desde el borde superior `top`.
   *
   * La alineación se calcula acá y no con la de `jsPDF`, que ignora el
   * espaciado entre letras: un texto espaciado alineado a la derecha sobresalía
   * de su ancla lo que suma el espaciado.
   */
  writeLines(
    lines: readonly string[],
    x: number,
    top: number,
    style: PdfTextStyle,
    options: { readonly align?: 'left' | 'right' | 'center'; readonly color?: ColorRgb } = {},
  ): number {
    const align = options.align ?? 'left';
    const tracking = style.tracking ?? 0;
    // Los anchos se miden **antes** de poner el espaciado: `getTextWidth` ya lo
    // suma cuando está puesto, y contarlo dos veces corría el texto.
    const widths = align === 'left' ? [] : lines.map((line) => this.measure(line, style));
    this.useStyle(style, options.color);
    if (tracking !== 0) this.doc.setCharSpace(tracking);
    for (const [index, line] of lines.entries()) {
      const width = widths[index] ?? 0;
      const start = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
      this.doc.text(line, start, top + this.baseline(style) + index * style.leading);
    }
    if (tracking !== 0) this.doc.setCharSpace(0);
    return lines.length * style.leading;
  }

  /** Escribe un texto de una línea. Devuelve su alto. */
  write(
    text: string,
    x: number,
    top: number,
    style: PdfTextStyle,
    options: { readonly align?: 'left' | 'right' | 'center'; readonly color?: ColorRgb } = {},
  ): number {
    return this.writeLines([this.shape(text, style)], x, top, style, options);
  }

  /* ---- trazos ----------------------------------------------------------- */

  /** Un filete horizontal; por omisión, a todo el ancho útil. */
  rule(y: number, color: ColorRgb, weight: number, from = this.left, to = this.right): void {
    this.doc.setDrawColor(color[0], color[1], color[2]);
    this.doc.setLineWidth(weight);
    this.doc.line(from, y, to, y);
  }

  /** Un rectángulo relleno. */
  fill(x: number, y: number, width: number, height: number, color: ColorRgb): void {
    this.doc.setFillColor(color[0], color[1], color[2]);
    this.doc.rect(x, y, width, height, 'F');
  }

  /** Un rectángulo de esquinas redondeadas, con relleno, borde o los dos. */
  box(
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
    paint: { readonly fill?: ColorRgb; readonly stroke?: ColorRgb; readonly weight?: number },
  ): void {
    const { fill, stroke } = paint;
    if (fill !== undefined) this.doc.setFillColor(fill[0], fill[1], fill[2]);
    if (stroke !== undefined) {
      this.doc.setDrawColor(stroke[0], stroke[1], stroke[2]);
      this.doc.setLineWidth(paint.weight ?? 0.6);
    }
    const mode = fill !== undefined && stroke !== undefined ? 'FD' : fill !== undefined ? 'F' : 'S';
    this.doc.roundedRect(x, y, width, height, radius, radius, mode);
  }

  /**
   * Un degradado lineal **vectorial** (un `ShadingPattern` del PDF, no franjas
   * pintadas): se ve liso a cualquier zoom y en cualquier impresora.
   *
   * @param direction - `horizontal` va de izquierda a derecha; `vertical`, de arriba abajo.
   */
  gradient(
    x: number,
    y: number,
    width: number,
    height: number,
    stops: PdfGradient,
    options: { readonly radius?: number; readonly direction?: 'horizontal' | 'vertical' } = {},
  ): void {
    const radius = options.radius ?? 0;
    const { doc } = this;
    if (typeof doc.advancedAPI !== 'function' || typeof ShadingPattern !== 'function') {
      // Sin la API avanzada (un doble de prueba), el color del medio del degradado.
      const middle = stops[Math.floor(stops.length / 2)]?.color ?? [0, 0, 0];
      if (radius > 0) this.box(x, y, width, height, radius, { fill: middle });
      else this.fill(x, y, width, height, middle);
      return;
    }
    const coords =
      options.direction === 'vertical' ? [x, y, x, y + height] : [x, y, x + width, y];
    const key = `alovida-${coords.map((value) => value.toFixed(2)).join('-')}-${stops.map((stop) => stop.color.join('.')).join('_')}`;
    doc.advancedAPI((advanced) => {
      if (!this.patterns.has(key)) {
        advanced.addShadingPattern(
          key,
          new ShadingPattern(
            'axial',
            coords,
            stops.map((stop) => ({ offset: stop.offset, color: [...stop.color] })),
          ),
        );
        this.patterns.add(key);
      }
      if (radius > 0) advanced.roundedRect(x, y, width, height, radius, radius, null);
      else advanced.rect(x, y, width, height, null);
      advanced.fill({ key, matrix: advanced.Matrix(1, 0, 0, 1, 0, 0) });
    });
  }

  /** Dibuja con una opacidad y la devuelve a 1: en un PDF es un estado global. */
  withOpacity(opacity: number, draw: () => void): void {
    this.doc.saveGraphicsState();
    this.doc.setGState(this.doc.GState({ opacity }));
    draw();
    this.doc.restoreGraphicsState();
  }

  /** Dibuja recortado a un rectángulo, redondeado si se pide: lo que se sale no se ve. */
  clipped(x: number, y: number, width: number, height: number, draw: () => void, radius = 0): void {
    this.doc.saveGraphicsState();
    if (radius > 0) this.doc.roundedRect(x, y, width, height, radius, radius, null);
    else this.doc.rect(x, y, width, height, null);
    this.doc.clip();
    this.doc.discardPath();
    draw();
    this.doc.restoreGraphicsState();
  }

  /**
   * La sombra de una tarjeta: dos capas del petróleo con alfa —un contacto y
   * una difusión—, como `--sombra-1` en la pantalla.
   */
  shadow(x: number, y: number, width: number, height: number, radius: number): void {
    const { color } = PDF_ALPHA_TOKENS['sombra-azul'];
    for (const layer of PDF_SHADOW) {
      this.withOpacity(layer.opacity, () =>
        this.box(
          x - layer.spread,
          y + layer.dy - layer.spread / 2,
          width + layer.spread * 2,
          height + layer.spread,
          radius + layer.spread,
          { fill: color },
        ),
      );
    }
  }

  /**
   * Una imagen contenida en su caja. Si no se puede dibujar —formato que
   * `jsPDF` no acepta, datos rotos— se omite sin más: es un hueco, no un error.
   *
   * @returns `true` si quedó dibujada.
   */
  /** La imagen se puede dibujar: `jsPDF` entiende sus datos. */
  canDraw(image: PdfLogo): boolean {
    if (typeof this.doc.getImageProperties !== 'function') return true;
    try {
      this.doc.getImageProperties(image.dataUrl);
      return true;
    } catch {
      return false;
    }
  }

  image(image: PdfLogo, x: number, y: number, width: number, height: number): boolean {
    try {
      this.doc.addImage(image.dataUrl, image.formato, x, y, width, height);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * «6:30 p. m.» no se parte entre renglones: los espacios de la hora y de
 * «a. m.» / «p. m.» pasan a ser duros. También el espacio fino (U+202F) que usa
 * `Intl` en algunos entornos, que las fuentes del papel no siempre traen.
 */
function keepTimesTogether(text: string): string {
  return text.replace(/(\d)[ \u00A0\u202F]+([ap])\.[ \u00A0\u202F]*m\./g, '$1\u00A0$2.\u00A0m.');
}

/** Qué archivo de `PdfFonts` cubre cada pieza tipográfica del tema. */
const FONT_FILES: Readonly<Record<PdfFontRole, keyof PdfFonts>> = {
  display: 'titulos',
  displayMedium: 'rotulos',
  text: 'cuerpo',
  textBold: 'cuerpoDestacado',
};

/**
 * Registra las fuentes de marca en el documento y dice qué familia va con cada
 * pieza del tema.
 *
 * Se registran por documento porque `jsPDF` las guarda por instancia; cada
 * archivo es un solo peso y va bajo el estilo `normal` de su propia familia.
 * Sin fuentes cargadas, todo va en Helvetica (la negrita para lo destacado).
 */
function registerFonts(doc: jsPDF, fuentes: PdfFonts | null): Readonly<Record<PdfFontRole, string>> {
  const roles = Object.keys(FONT_FILES) as PdfFontRole[];
  if (fuentes === null) {
    return {
      display: PDF_FONTS.fallback,
      displayMedium: PDF_FONTS.fallback,
      text: PDF_FONTS.fallback,
      textBold: PDF_FONTS.fallback,
    };
  }
  for (const role of roles) {
    const fuente = fuentes[FONT_FILES[role]];
    doc.addFileToVFS(fuente.archivo, fuente.base64);
    doc.addFont(fuente.archivo, PDF_FONTS[role], 'normal');
  }
  return {
    display: PDF_FONTS.display,
    displayMedium: PDF_FONTS.displayMedium,
    text: PDF_FONTS.text,
    textBold: PDF_FONTS.textBold,
  };
}
