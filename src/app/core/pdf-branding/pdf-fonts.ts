import { downloadWithFetch, type DownloadFile } from '../data-access/pdf-branding/typeface-download';

/**
 * Las fuentes de marca del papel, las de AloVida: Poppins para lo que se
 * destaca y Nunito Sans para lo que se lee.
 *
 * ## Por qué se cargan aparte
 *
 * `jsPDF` sólo embebe **TTF** estáticos, y las fuentes de pantalla son WOFF2
 * variables. Los cuatro archivos viven en `public/alovida/tipografias/`
 * (licencias y origen en su `LICENCIAS.md`), así que **no van en el
 * paquete**: se bajan una vez por sesión, en segundo plano, y quedan listos en
 * este módulo con el mismo patrón que el logo (`pdf-logo.ts`): el maquetador es
 * síncrono y lo llaman doce documentos; ninguno puede esperar una descarga.
 *
 * ## Qué garantiza
 *
 * - **Nunca impide un documento.** Si una fuente no se pudo bajar —sin red,
 *   bajo SSR, en una prueba—, el holder queda en `null` y el papel sale en
 *   Helvetica, que es un resultado válido y no un error.
 * - **Todas o ninguna.** Un documento con los títulos en Poppins y el cuerpo
 *   en Helvetica se vería como un error de maquetado; si falta una, se descartan
 *   todas.
 */

/** Dónde se sirven los TTF. La misma carpeta que las fuentes de pantalla. */
export const TYPEFACES_PATH = '/alovida/tipografias/';

/** Qué archivo cubre cada papel tipográfico. */
export const FONT_FILES = {
  /** Títulos: Poppins SemiBold. */
  titulos: 'poppins-600.ttf',
  /** Rótulos, versalitas y cabeceras de tabla: Poppins Medium. */
  rotulos: 'poppins-500.ttf',
  /** Cuerpo, datos, tablas y pie: Nunito Sans Regular. */
  cuerpo: 'nunito-sans-400.ttf',
  /** Datos destacados y cifras: Nunito Sans Bold. */
  cuerpoDestacado: 'nunito-sans-700.ttf',
} as const;

export type FontRole = keyof typeof FONT_FILES;

/** Una fuente lista para `jsPDF`: su archivo y sus bytes en base64. */
export interface PdfFont {
  readonly archivo: string;
  readonly base64: string;
}

/** Las cuatro fuentes del papel, siempre juntas. */
export type PdfFonts = Readonly<Record<FontRole, PdfFont>>;

let currentFonts: PdfFonts | null = null;

/** Deja las fuentes listas para todos los documentos, o las quita con `null`. */
export function setDocumentFonts(fuentes: PdfFonts | null): void {
  currentFonts = fuentes;
}

/** Las fuentes con que salen los documentos, o `null` si el papel va en Helvetica. */
export function documentFonts(): PdfFonts | null {
  return currentFonts;
}

/**
 * Baja las cuatro fuentes y las deja en base64, que es como `jsPDF` las recibe.
 *
 * **Nunca rechaza.** Devuelve `null` fuera del navegador o si cualquiera de
 * ellas falla: la tipografía no puede impedir que se emita una receta.
 *
 * @param bajar - Cómo obtener los bytes de un archivo; por omisión, `fetch`.
 * @returns Las cuatro fuentes listas, o `null`.
 */
export async function prepareFonts(bajar: DownloadFile = downloadWithFetch): Promise<PdfFonts | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const roles = Object.keys(FONT_FILES) as FontRole[];
    const fonts = await Promise.all(roles.map((role) => fontFrom(FONT_FILES[role], bajar)));
    if (fonts.some((font) => font === null)) {
      return null;
    }
    return Object.fromEntries(roles.map((role, i) => [role, fonts[i]])) as PdfFonts;
  } catch {
    return null;
  }
}

async function fontFrom(archivo: string, bajar: DownloadFile): Promise<PdfFont | null> {
  const bytes = await bajar(`${TYPEFACES_PATH}${archivo}`);
  if (bytes === null || bytes.byteLength === 0) {
    return null;
  }
  return { archivo, base64: aBase64(bytes) };
}

/** Tramos de 32 KB: `String.fromCharCode(...bytes)` con 400 KB desborda la pila. */
const BRACKET = 0x8000;

/** Los bytes en base64, que es el único formato en que `jsPDF` acepta una fuente. */
export function aBase64(bytes: ArrayBuffer): string {
  const vista = new Uint8Array(bytes);
  let binario = '';
  for (let desde = 0; desde < vista.length; desde += BRACKET) {
    binario += String.fromCharCode(...vista.subarray(desde, desde + BRACKET));
  }
  return btoa(binario);
}
