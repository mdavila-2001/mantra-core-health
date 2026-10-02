/**
 * Las fuentes de marca del papel: Poppins para lo que se destaca e Inter para
 * lo que se lee.
 *
 * ## Por qué se cargan aparte
 *
 * `jsPDF` sólo embebe **TTF**, y las fuentes de pantalla son WOFF2. Los dos
 * archivos viven en `public/alovida/tipografias/` (licencias en su
 * `LICENCIAS.md`) y pesan ~570 KB entre los dos, así que **no van en el
 * paquete**: se bajan una vez por sesión, en segundo plano, y quedan listos en
 * este módulo con el mismo patrón que el logo (`pdf-logo.ts`): el maquetador es
 * síncrono y lo llaman doce documentos; ninguno puede esperar una descarga.
 *
 * ## Qué garantiza
 *
 * - **Nunca impide un documento.** Si una fuente no se pudo bajar —sin red,
 *   bajo SSR, en una prueba—, el holder queda en `null` y el papel sale en
 *   Helvetica, que es un resultado válido y no un error.
 * - **Las dos o ninguna.** Un documento con los títulos en Poppins y el cuerpo
 *   en Helvetica se vería como un error de maquetado; si falta una, se descartan
 *   las dos.
 */

/** Dónde se sirven los TTF. La misma carpeta que las fuentes de pantalla. */
export const RUTA_DE_TIPOGRAFIAS = '/alovida/tipografias/';

/** Qué archivo cubre cada papel tipográfico. */
export const ARCHIVOS_DE_FUENTES = {
  /** Títulos, rótulos, cabeceras y versalitas: lo que se destaca. */
  titulos: 'poppins-600.ttf',
  /** Cuerpo, datos, tablas y pie: lo que se lee. */
  cuerpo: 'inter-400.ttf',
} as const;

/** Una fuente lista para `jsPDF`: su archivo y sus bytes en base64. */
export interface PdfFuente {
  readonly archivo: string;
  readonly base64: string;
}

/** Las dos fuentes del papel, siempre juntas. */
export interface PdfFuentes {
  readonly titulos: PdfFuente;
  readonly cuerpo: PdfFuente;
}

/** Cómo se bajan los bytes de un archivo. Sustituible en pruebas. */
export type BajarArchivo = (url: string) => Promise<ArrayBuffer | null>;

let fuentesVigentes: PdfFuentes | null = null;

/** Deja las fuentes listas para todos los documentos, o las quita con `null`. */
export function establecerFuentesDeDocumentos(fuentes: PdfFuentes | null): void {
  fuentesVigentes = fuentes;
}

/** Las fuentes con que salen los documentos, o `null` si el papel va en Helvetica. */
export function fuentesDeDocumentos(): PdfFuentes | null {
  return fuentesVigentes;
}

/**
 * Baja las dos fuentes y las deja en base64, que es como `jsPDF` las recibe.
 *
 * **Nunca rechaza.** Devuelve `null` fuera del navegador o si cualquiera de las
 * dos falla: la tipografía no puede impedir que se emita una receta.
 *
 * @param bajar - Cómo obtener los bytes de un archivo; por omisión, `fetch`.
 * @returns Las dos fuentes listas, o `null`.
 */
export async function prepararFuentes(bajar: BajarArchivo = bajarConFetch): Promise<PdfFuentes | null> {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const [titulos, cuerpo] = await Promise.all([
      fuenteDesde(ARCHIVOS_DE_FUENTES.titulos, bajar),
      fuenteDesde(ARCHIVOS_DE_FUENTES.cuerpo, bajar),
    ]);
    if (titulos === null || cuerpo === null) {
      return null;
    }
    return { titulos, cuerpo };
  } catch {
    return null;
  }
}

async function fuenteDesde(archivo: string, bajar: BajarArchivo): Promise<PdfFuente | null> {
  const bytes = await bajar(`${RUTA_DE_TIPOGRAFIAS}${archivo}`);
  if (bytes === null || bytes.byteLength === 0) {
    return null;
  }
  return { archivo, base64: aBase64(bytes) };
}

async function bajarConFetch(url: string): Promise<ArrayBuffer | null> {
  if (typeof fetch === 'undefined') {
    return null;
  }
  const respuesta = await fetch(url);
  return respuesta.ok ? respuesta.arrayBuffer() : null;
}

/** Tramos de 32 KB: `String.fromCharCode(...bytes)` con 400 KB desborda la pila. */
const TRAMO = 0x8000;

/** Los bytes en base64, que es el único formato en que `jsPDF` acepta una fuente. */
export function aBase64(bytes: ArrayBuffer): string {
  const vista = new Uint8Array(bytes);
  let binario = '';
  for (let desde = 0; desde < vista.length; desde += TRAMO) {
    binario += String.fromCharCode(...vista.subarray(desde, desde + TRAMO));
  }
  return btoa(binario);
}
