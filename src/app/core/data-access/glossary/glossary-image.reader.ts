/** Una ilustración propia de AloVida: archivo de `public/glossary-images/`, del mismo origen. */
const OWN_IMAGE = /^\/glossary-images\/[a-z0-9-]+\.(?:svg|webp|png)$/u;

/** Tope de espera de una imagen: pasado esto se sigue sin ella. */
const READ_TIMEOUT_MS = 15_000;

/** Tamaño máximo admitido de una imagen para el PDF. */
const MAX_IMAGE_BYTES = 20_000_000;

/** La URL de una imagen que se puede pedir (propia o `https://`), o `null`. */
export function safeImageUrl(value: string): string | null {
  if (OWN_IMAGE.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * Descarga una imagen del glosario y la devuelve como `data:` URL, sin
 * credenciales. Rechaza una URL insegura, una respuesta que no es imagen, una
 * demasiado grande o una que no llega a tiempo.
 *
 * Las imágenes de otro origen las puede bloquear la política de seguridad de
 * la página (`connect-src`): quien llama decide qué hacer con el rechazo.
 */
export async function readImageAsDataUrl(url: string): Promise<string> {
  const safeUrl = safeImageUrl(url);
  if (safeUrl === null) throw new Error('La imagen no tiene una URL segura.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const response = await fetch(safeUrl, { credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error('La imagen no respondió.');
    const blob = await response.blob();
    if (!blob.type.startsWith('image/') || blob.size > MAX_IMAGE_BYTES) {
      throw new Error('La imagen no tiene un formato o tamaño admitido.');
    }
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(blob);
    });
  } finally {
    clearTimeout(timeout);
  }
}
