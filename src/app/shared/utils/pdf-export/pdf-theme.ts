import type { ColorRgb } from './alovida-mark';

/* ============================================================================
    El sistema de diseño del papel: la identidad AloVida impresa.

    Un solo archivo decide la retícula, la escala tipográfica, la paleta, los
    degradados y el ritmo vertical de **todos** los PDF del portal: receta,
    historia clínica, orden de estudio, comprobante, cotización, factura y
    formulario. Si cada documento eligiera lo suyo, siete papeles de la misma
    clínica saldrían con siete identidades distintas.

    ## Reglas

    - **Sólo tokens de AloVida.** Cada color es una variable de
      `src/styles/alovida.css` (la hoja normativa del sistema AloVida v1.1)
      copiada en RGB porque `jsPDF` no lee CSS. `pdf-theme.spec.ts` compara
      cada entrada de {@link PDF_TOKENS} con su variable: si la hoja cambia, el
      papel se entera por una prueba en rojo. No hay hex inventados.
    - **Las transparencias también son tokens.** `--sombra-azul` y
      `--sombra-azul-suave` son el petróleo con alfa: el papel las reproduce con
      opacidad (`GState`), no con un tinte calculado a ojo.
    - **Todo es vector.** Degradados, isotipo, filetes y QR se dibujan como
      trazos: nítidos a cualquier zoom y en cualquier impresora.
    ========================================================================== */

/** Los tokens de `alovida.css` (tema claro) que usa el papel, por su nombre de variable. */
export const PDF_TOKENS = {
  petroleo: [11, 85, 126],
  'petroleo-h': [11, 71, 104],
  'petroleo-p': [11, 57, 83],
  'tinta-marca': [36, 40, 40],
  'petroleo-x': [7, 47, 69],
  'petroleo-xx': [5, 34, 50],
  aguamarina: [79, 179, 169],
  menta: [159, 216, 208],
  tinta: [36, 40, 40],
  'tinta-2': [78, 81, 81],
  'tinta-3': [101, 103, 104],
  'tinta-nav': [255, 255, 255],
  'sup-inset': [249, 248, 244],
  filete: [205, 217, 213],
  'filete-2': [227, 234, 231],
  'borde-ctrl': [125, 135, 134],
  'anillo-foco': [51, 112, 108],
  'ok-bg': [223, 237, 233],
  'ok-tinta': [39, 114, 92],
  'aviso-bg': [251, 242, 232],
  'aviso-tinta': [94, 75, 53],
  'error-bg': [244, 229, 225],
  'error-tinta': [146, 69, 52],
  'info-bg': [228, 243, 242],
  'info-tinta': [51, 112, 108],
  'neutro-bg': [243, 246, 245],
  'neutro-tinta': [78, 81, 81],
} as const satisfies Record<string, ColorRgb>;

/** Los tokens con alfa de `alovida.css`: el color y su opacidad. */
export const PDF_ALPHA_TOKENS = {
  'sombra-azul': { color: [11, 85, 126], opacity: 0.14 },
  'sombra-azul-suave': { color: [11, 85, 126], opacity: 0.07 },
} as const satisfies Record<string, { color: ColorRgb; opacity: number }>;

export type PdfToken = keyof typeof PDF_TOKENS;

const token = (name: PdfToken): ColorRgb => PDF_TOKENS[name];

/** Los colores del papel por su función. Cada uno es un token de {@link PDF_TOKENS}. */
export const PDF_COLORS = {
  /** El azul de AloVida: isotipo, acentos, folio. */
  brand: token('petroleo'),
  /** Títulos y jerarquía: `--tinta-marca`, que desde el 27/10/2026 es la tinta neutra y ya no un azul (alovida.css). */
  brandDeep: token('tinta-marca'),
  /** La cabecera de tabla. */
  brandDarker: token('petroleo-x'),
  /** El extremo más oscuro del degradado de portada. */
  brandDarkest: token('petroleo-xx'),
  /** La aguamarina: la marca de sección, las viñetas, el filo del degradado. */
  accent: token('aguamarina'),
  /** La menta: rótulos sobre fondo oscuro. */
  accentSoft: token('menta'),
  /** El aguamarina oscuro (`--anillo-foco`): títulos de tarjeta sobre blanco. */
  accentInk: token('anillo-foco'),
  /** La tinta del cuerpo. */
  ink: token('tinta'),
  /** Etiquetas y datos secundarios. */
  inkMuted: token('tinta-2'),
  /** Letra chica: pie, rótulos de dato. */
  inkSubtle: token('tinta-3'),
  /** Tinta sobre fondo oscuro y el blanco del papel (`--tinta-nav`). */
  onBrand: token('tinta-nav'),
  /** El filete estructural: cierra una tabla, separa el pie. */
  rule: token('filete'),
  /** El filete de superficie: entre renglones, el filo de una tarjeta. */
  ruleSoft: token('filete-2'),
  /** Fondo de las filas pares y de las rejillas de datos: el marfil de AloVida. */
  inset: token('sup-inset'),
  /** Los renglones para escribir a mano: el borde de un campo editable (`--borde-ctrl`). */
  writingLine: token('borde-ctrl'),
  /**
   * La marca de agua: la tinta del error, con poca opacidad y **encima** del
   * contenido. Debajo la tapaba cualquier bloque opaco, y en un gris claro la
   * fotocopiadora la borraba; una marca que invalida un papel se tiene que leer
   * entera en cada hoja.
   */
  watermark: token('error-tinta'),
} as const satisfies Record<string, ColorRgb>;

/** Los tonos de un aviso: los pares de estado de AloVida (`--*-bg` / `--*-tinta`). */
export const PDF_TONES = {
  /** Lo que acompaña al documento sin alarmar. */
  neutral: { fill: token('neutro-bg'), ink: token('neutro-tinta') },
  /** Lo propio de la marca: una indicación, «esto no es una factura». */
  brand: { fill: token('sup-inset'), ink: token('tinta-marca') },
  /** Una información útil para el lector. */
  info: { fill: token('info-bg'), ink: token('info-tinta') },
  /** Un resultado favorable, una confirmación. */
  success: { fill: token('ok-bg'), ink: token('ok-tinta') },
  /** Algo que requiere atención sin ser un error. */
  warning: { fill: token('aviso-bg'), ink: token('aviso-tinta') },
  /** Lo que no se puede pasar por alto: alergias, «sin validez fiscal». */
  alert: { fill: token('error-bg'), ink: token('error-tinta') },
} as const satisfies Record<string, { fill: ColorRgb; ink: ColorRgb }>;

export type PdfTone = keyof typeof PDF_TONES;

/** Un degradado lineal: paradas de 0 a 1 con su color. */
export type PdfGradient = readonly { readonly offset: number; readonly color: ColorRgb }[];

/** Los degradados del papel, sobre los azules profundos de AloVida v1.1. */
export const PDF_GRADIENTS = {
  /** La portada: del petróleo más profundo al petróleo de la marca. */
  cover: [
    { offset: 0, color: token('petroleo-xx') },
    { offset: 0.45, color: token('petroleo-x') },
    { offset: 0.8, color: token('tinta-marca') },
    { offset: 1, color: token('petroleo') },
  ],
  /** El filo inferior de la portada y la franja del pie. */
  edge: [
    { offset: 0, color: token('aguamarina') },
    { offset: 1, color: token('menta') },
  ],
  /** La banda del total a pagar. */
  total: [
    { offset: 0, color: token('petroleo-x') },
    { offset: 1, color: token('petroleo') },
  ],
} as const satisfies Record<string, PdfGradient>;

/**
 * Las cuatro piezas tipográficas, con el nombre con que se registran en
 * `jsPDF`. Son las de AloVida (`--f-titulo` y `--f-texto`): Poppins para lo
 * que se destaca y Nunito Sans para lo que se lee. Sin las fuentes cargadas
 * (ver `core/pdf-branding/pdf-fonts.ts`) caen a Helvetica.
 */
export const PDF_FONTS = {
  /** Poppins SemiBold: títulos. */
  display: 'Poppins-SemiBold',
  /** Poppins Medium: rótulos, versalitas, cabeceras de tabla. */
  displayMedium: 'Poppins-Medium',
  /** Nunito Sans Regular: cuerpo, datos, tablas. */
  text: 'NunitoSans-Regular',
  /** Nunito Sans Bold: datos destacados y cifras. */
  textBold: 'NunitoSans-Bold',
  fallback: 'helvetica',
} as const;

export type PdfFontRole = Exclude<keyof typeof PDF_FONTS, 'fallback'>;

/**
 * La hoja A4 en puntos y su retícula.
 *
 * Márgenes de 48 pt (≈ 17 mm): holgados para el agujereado de una carpeta y
 * para que una impresora sin margen no se coma el dato. El ancho útil se
 * reparte en 12 columnas con 12 pt de calle.
 */
export const PDF_PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 48,
  columns: 12,
  gutter: 12,
  /** Alto mínimo de la portada de la primera hoja. */
  coverMinHeight: 156,
  /** Alto del filo aguamarina bajo la portada. */
  coverEdge: 2.5,
  /** Alto de la franja de las hojas de continuación. */
  bandHeight: 5,
  /** Dónde arranca el membrete de las hojas de continuación. */
  continuationHeaderTop: 24,
  /** Dónde va el filete del pie, medido desde el borde inferior. */
  footerRuleFromBottom: 54,
  /** Alto de la franja del pie, al borde inferior. */
  footerBand: 3,
  /** Aire mínimo entre el contenido y el filete del pie. */
  footerClearance: 16,
} as const;

/** Ancho útil de la hoja. */
export const CONTENT_WIDTH = PDF_PAGE.width - PDF_PAGE.marginX * 2;

/** Ancho de `span` columnas de la retícula, con sus calles internas. */
export function gridSpan(span: number): number {
  const column = (CONTENT_WIDTH - PDF_PAGE.gutter * (PDF_PAGE.columns - 1)) / PDF_PAGE.columns;
  return column * span + PDF_PAGE.gutter * (span - 1);
}

/** Un estilo de texto del papel. */
export interface PdfTextStyle {
  readonly font: PdfFontRole;
  /** Cuerpo, en puntos. */
  readonly size: number;
  /** Alto de línea, en puntos. */
  readonly leading: number;
  readonly color: ColorRgb;
  /** Espaciado entre letras, en puntos. Sólo para las versalitas. */
  readonly tracking?: number;
  /** Se escribe en mayúsculas. */
  readonly uppercase?: boolean;
}

/**
 * La escala tipográfica: siete pasos —22, 15, 13, 11, 9,75, 8,5 y 7 pt— y
 * nada fuera de ellos. Lo que distingue un rol de otro dentro de un paso es la
 * pieza (Poppins o Nunito Sans), el color y las versalitas, no medio punto de
 * cuerpo: dos tamaños casi iguales se leen como un descuido.
 */
export const PDF_TYPE = {
  /** El título del documento, sobre la portada. */
  title: { font: 'display', size: 22, leading: 27, color: PDF_COLORS.onBrand },
  /** El nombre de la marca, junto al isotipo. */
  wordmark: { font: 'display', size: 15, leading: 18, color: PDF_COLORS.onBrand },
  /** El folio, destacado sobre la portada. */
  coverReference: { font: 'display', size: 13, leading: 17, color: PDF_COLORS.onBrand },
  /** El total a pagar. */
  grandTotal: { font: 'display', size: 13, leading: 17, color: PDF_COLORS.onBrand },
  /** Título de sección de primer nivel. */
  section: { font: 'display', size: 13, leading: 17, color: PDF_COLORS.brandDeep },
  /** Título de sección de segundo nivel: el que usan casi todos los documentos. */
  subsection: { font: 'display', size: 11, leading: 15, color: PDF_COLORS.brandDeep },
  /** Subtítulo dentro de una sección, el título de un aviso o de un QR. */
  heading: { font: 'display', size: 9.75, leading: 13.5, color: PDF_COLORS.brandDeep },
  /** La bajada bajo el título, sobre la portada. */
  subtitle: { font: 'text', size: 9.75, leading: 14, color: PDF_COLORS.onBrand },
  /** Valor de un dato sobre la portada. */
  coverValue: { font: 'text', size: 9.75, leading: 13.5, color: PDF_COLORS.onBrand },
  /** El cuerpo. */
  body: { font: 'text', size: 9.75, leading: 14.5, color: PDF_COLORS.ink },
  /** El valor de un dato. */
  value: { font: 'text', size: 9.75, leading: 13.5, color: PDF_COLORS.ink },
  /** El valor destacado de un dato o una cifra. */
  valueStrong: { font: 'textBold', size: 9.75, leading: 13.5, color: PDF_COLORS.ink },
  /** Una fila de totales. */
  totalRow: { font: 'text', size: 9.75, leading: 13.5, color: PDF_COLORS.inkMuted },
  /** El importe de una fila de totales. */
  totalValue: { font: 'textBold', size: 9.75, leading: 13.5, color: PDF_COLORS.ink },
  /** Las filas de una tabla. */
  cell: { font: 'text', size: 8.5, leading: 12, color: PDF_COLORS.ink },
  /** Notas y avisos. */
  note: { font: 'text', size: 8.5, leading: 12.5, color: PDF_COLORS.ink },
  /** Letra chica al final de un bloque. */
  caption: { font: 'text', size: 8.5, leading: 12, color: PDF_COLORS.inkSubtle },
  /** La clase de documento sobre el título, en versalitas menta. */
  eyebrow: { font: 'displayMedium', size: 7, leading: 10.5, color: PDF_COLORS.accentSoft, tracking: 1.6, uppercase: true },
  /** Rótulo de un dato sobre la portada. */
  coverLabel: { font: 'displayMedium', size: 7, leading: 10, color: PDF_COLORS.accentSoft, tracking: 0.9, uppercase: true },
  /** La etiqueta de un dato, en versalitas. */
  label: { font: 'displayMedium', size: 7, leading: 10, color: PDF_COLORS.inkSubtle, tracking: 0.8, uppercase: true },
  /** El título de una tarjeta, en versalitas aguamarina. */
  cardTitle: { font: 'display', size: 7, leading: 10, color: PDF_COLORS.accentInk, tracking: 1.1, uppercase: true },
  /** La cabecera de una tabla, en blanco sobre petróleo. */
  cellHead: { font: 'displayMedium', size: 7, leading: 10, color: PDF_COLORS.onBrand, tracking: 0.7, uppercase: true },
  /** El rótulo del total a pagar, sobre la banda. */
  grandTotalLabel: { font: 'displayMedium', size: 7, leading: 10, color: PDF_COLORS.accentSoft, tracking: 1, uppercase: true },
  /** El pie de página. */
  footer: { font: 'text', size: 7, leading: 10.5, color: PDF_COLORS.inkSubtle },
  /** El emisor en el pie. */
  footerStrong: { font: 'display', size: 7, leading: 10.5, color: PDF_COLORS.brandDeep },
  /** La numeración en el pie. */
  pageNumber: { font: 'displayMedium', size: 7, leading: 10, color: PDF_COLORS.brandDeep },
  /** La marca de agua: fuera de la escala a propósito, es una estampa y no texto de lectura. */
  watermark: { font: 'display', size: 64, leading: 72, color: PDF_COLORS.watermark },
} as const satisfies Record<string, PdfTextStyle>;

/** El ritmo vertical, en puntos: la escala de 4 de AloVida (`--e1`…`--e10`). */
export const PDF_SPACE = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  /** Aire antes de un título de sección. */
  beforeSection: 24,
  /** Aire entre el filete de una sección y su contenido. */
  afterSection: 12,
  /** Relleno interno de una tarjeta o un aviso. */
  panelPadding: 12,
  /** Radio de tarjetas, avisos y bandas: el `--r-card` de la pantalla a escala de papel. */
  radius: 7,
  /** Radio de piezas chicas (la píldora del número de página). */
  radiusSmall: 4,
  /** Relleno vertical de una celda. */
  cellPaddingY: 5.5,
  /** Relleno horizontal de una celda. */
  cellPaddingX: 7,
  /** Ancho de la columna de etiquetas en una lista de datos. */
  labelColumn: 150,
  /** Alto de un renglón para escribir a mano (≈ 7,8 mm): se llena con lapicera. */
  writingLine: 22,
} as const;

/** La sombra de una tarjeta: dos capas del petróleo con alfa, como `--sombra-1`. */
export const PDF_SHADOW = [
  { dy: 1, spread: 0.4, opacity: 0.05 },
  { dy: 3, spread: 1.6, opacity: 0.035 },
] as const;

/** El isotipo en el membrete. */
export const PDF_MARK = {
  width: 26,
  continuationWidth: 16,
  /** Aire entre el isotipo y el nombre de la marca. */
  gap: 9,
  /** El isotipo grande y tenue que firma la portada, a la derecha. */
  coverWidth: 230,
  coverOpacity: 0.07,
} as const;

/**
 * La ranura del logo del consultorio: una ficha blanca arriba a la derecha de
 * la portada. Es de tamaño **fijo** y el logo se contiene dentro de ella: la
 * portada mide lo mismo con un logo cuadrado, apaisado, altísimo o sin ninguno.
 */
export const PDF_PRACTICE_LOGO = { width: 120, height: 34, padding: 7 } as const;

/** La columna de metadatos de la portada (folio, fecha de emisión). */
export const PDF_META = { width: 160, gap: 28 } as const;

/**
 * El bloque de firma: la imagen de la firma y el sello lado a lado, una línea,
 * y debajo el nombre, la matrícula y el rótulo. Cajas de tamaño **fijo**: con
 * firma, sin firma o con una imagen rota, mide lo mismo.
 */
export const PDF_SIGNATURE = {
  width: 220,
  signatureBox: { width: 140, height: 52 },
  stampBox: { width: 60, height: 60 },
  /** Sin imágenes: el lugar para firmar a mano sobre la línea (≈ 1,1 cm). */
  handwritingHeight: 30,
  gap: 12,
  /** Aire mínimo entre el contenido y el bloque: lo justo para que se lea aparte. */
  clearance: 16,
} as const;

/**
 * El código QR: el **símbolo** —sin contar la zona de silencio— mide ≥ 3 × 3
 * cm, lo que pide el SIN para una representación gráfica (98 − 2 × 5 = 88 pt
 * ≈ 3,1 cm).
 */
export const PDF_QR = { size: 98, quietZone: 5 } as const;
