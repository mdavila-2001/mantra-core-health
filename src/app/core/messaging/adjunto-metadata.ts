/* ============================================================================
    Qué es un adjunto del hilo y cuánto pesa, leído del contenido que ya se bajó.

    ## Por qué no se pide la metadata a un endpoint

    Porque el hilo **ya tiene el contenido**. `ChatStore` baja cada adjunto por
    la ruta contextual de 5.1 (`GET /community/conversations/:id/attachments/
    :fileId/content`), que responde con el `Content-Type` real del archivo, y lo
    guarda como `data:` URL. Ese URL lleva el tipo en su cabecera y los bytes en
    base64: de ahí sale el tipo exacto y el tamaño exacto. Una petición más para
    volver a preguntarlo sería repetir lo que ya está en la mano — y, peor, un
    camino nuevo al archivo que habría que autorizar.

    ## Por qué el tipo es fiable

    El `data:` URL lo arma `blobToDataUrl` con el `type` del `Blob`, y ese `type`
    es el `Content-Type` que sirvió la API: el tipo que el backend dedujo de los
    primeros bytes al recibir el archivo, no el que declaró quien lo subió.

    ## Lo que nunca sale de acá

    Ni `storageUri`, ni bucket, ni clave de objeto, ni hash. Este archivo no los
    ve: sólo recibe el contenido ya autorizado.
   ========================================================================== */

/** Lo que el hilo puede decir de un adjunto sin preguntarle a nadie. */
export interface MetadatosDeAdjunto {
  /** Tipo MIME real, en minúsculas. Vacío si el contenido no lo declaró. */
  readonly mimeType: string;
  /** Tamaño exacto en bytes, calculado sobre el base64. */
  readonly sizeBytes: number;
}

/** Cómo se llama un tipo en una burbuja. Lo que no está acá se muestra crudo. */
const NOMBRE_DEL_TIPO: Readonly<Record<string, string>> = {
  'application/pdf': 'PDF',
  'image/jpeg': 'Imagen JPEG',
  'image/png': 'Imagen PNG',
  'image/webp': 'Imagen WEBP',
  'image/gif': 'Imagen GIF',
  'text/plain': 'Texto',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Hoja de cálculo Excel',
};

/**
 * El tipo y el tamaño de un adjunto, leídos de su `data:` URL.
 *
 * Sólo acepta la forma que produce `FileReader.readAsDataURL`
 * (`data:<tipo>[;parámetros];base64,<datos>`). Cualquier otra cosa —un URL de
 * vista previa local, un `data:` sin base64, un base64 de longitud imposible—
 * devuelve `null`: quien llama no muestra metadata en vez de mostrar una
 * inventada. No valida carácter por carácter el base64 de un archivo de varios
 * megas; si el contenido estuviera corrupto, lo nota {@link archivoDeDataUrl}.
 *
 * @param url - El `data:` URL que tiene el hilo.
 * @returns Tipo y tamaño, o `null` si no se pueden leer con certeza.
 */
export function metadatosDeDataUrl(url: string | null | undefined): MetadatosDeAdjunto | null {
  if (typeof url !== 'string' || !url.startsWith('data:')) return null;
  const coma = url.indexOf(',');
  if (coma < 0) return null;

  const partes = url.slice('data:'.length, coma).split(';');
  if (partes[partes.length - 1]?.trim().toLowerCase() !== 'base64') return null;

  // Sin `slice` de los datos: el hilo llama esto en cada ciclo de detección, y
  // copiar varios megas de base64 cada vez sólo para medirlos sería absurdo.
  // El relleno se mira en el final del URL, que es el final de los datos.
  const largo = url.length - coma - 1;
  if (largo % 4 !== 0) return null;

  const relleno = largo === 0 ? 0 : url.endsWith('==') ? 2 : url.endsWith('=') ? 1 : 0;
  return {
    mimeType: (partes[0] ?? '').trim().toLowerCase(),
    sizeBytes: (largo / 4) * 3 - relleno,
  };
}

/** `true` si el adjunto es un PDF: el único documento que el hilo previsualiza. */
export function esPdf(metadatos: MetadatosDeAdjunto | null): boolean {
  return metadatos?.mimeType === 'application/pdf';
}

/**
 * El tipo en palabras. Vacío pasa a «Tipo desconocido»; lo que no está en la
 * tabla se muestra por su MIME, que es honesto aunque sea feo.
 */
export function nombreDelTipo(mimeType: string): string {
  if (mimeType === '') return 'Tipo desconocido';
  return NOMBRE_DEL_TIPO[mimeType] ?? mimeType;
}

/**
 * El `File` que entiende `app-file-preview`, armado desde el `data:` URL.
 *
 * Se decodifica acá y no con `fetch(dataUrl)`: la CSP deja `connect-src` en
 * `'self'`, y un `fetch` a un `data:` URL quedaría bloqueado en silencio.
 *
 * @param url - El `data:` URL del adjunto.
 * @param nombre - Con qué nombre presentarlo.
 * @returns El archivo, o `null` si el contenido no se puede decodificar.
 */
export function archivoDeDataUrl(url: string | null | undefined, nombre: string): File | null {
  const metadatos = metadatosDeDataUrl(url);
  if (metadatos === null || typeof atob !== 'function') return null;
  try {
    const binario = atob((url as string).slice((url as string).indexOf(',') + 1));
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i += 1) {
      bytes[i] = binario.charCodeAt(i);
    }
    return new File([bytes], nombre, { type: metadatos.mimeType });
  } catch {
    // Base64 con caracteres inválidos: no hay archivo que mostrar.
    return null;
  }
}
