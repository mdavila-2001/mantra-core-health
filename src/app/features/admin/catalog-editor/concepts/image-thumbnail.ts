/** Ancho y alto de la miniatura guardada (16:9, lo que dibuja la tarjeta). */
const WIDTH = 480;
const HEIGHT = 270;
/** Tope del texto guardado en el catálogo: viaja en cada lectura con propiedades. */
export const MAX_THUMBNAIL_CHARS = 60_000;
export const MAX_SOURCE_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export type ThumbnailResult =
  | { readonly ok: true; readonly dataUrl: string }
  | { readonly ok: false; readonly reason: string };

/** Recorta al centro en 16:9 y comprime a WebP hasta que quepa en el tope. */
export async function toThumbnail(file: File): Promise<ThumbnailResult> {
  if (!TYPES.includes(file.type)) return { ok: false, reason: 'Use una imagen PNG, JPEG o WebP.' };
  if (file.size > MAX_SOURCE_BYTES) return { ok: false, reason: 'La imagen pesa más de 5 MB.' };
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { ok: false, reason: 'No se pudo leer la imagen.' };
  }
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return { ok: false, reason: 'El navegador no puede procesar la imagen.' };
  const escala = Math.max(WIDTH / bitmap.width, HEIGHT / bitmap.height);
  const w = bitmap.width * escala;
  const h = bitmap.height * escala;
  ctx.drawImage(bitmap, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
  bitmap.close();
  for (const calidad of [0.85, 0.7, 0.55, 0.4]) {
    const dataUrl = canvas.toDataURL('image/webp', calidad);
    if (dataUrl.startsWith('data:image/webp') && dataUrl.length <= MAX_THUMBNAIL_CHARS) return { ok: true, dataUrl };
  }
  return { ok: false, reason: 'La imagen es demasiado detallada: pruebe con una más simple.' };
}
