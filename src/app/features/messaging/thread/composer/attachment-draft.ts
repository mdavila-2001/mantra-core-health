/**
 * Los adjuntos elegidos que todavía no salieron: lo que la vista previa
 * muestra, deja comentar y editar, y el composer manda.
 *
 * Funciones puras y sin Angular: el composer valida con ellas lo que llega por
 * el selector y por el arrastre, y la vista previa con lo que se suma desde su
 * «+». Las dos puertas tienen que decir que no a lo mismo.
 */

/** Lo más grande que se deja adjuntar. Más que esto no sube por el móvil. */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

/** Lo que el chat acepta adjuntar. */
export const ACCEPTED_ATTACHMENT_TYPES = ['image/', 'audio/', 'video/', 'application/pdf'] as const;

/**
 * Cuántos archivos entran en un mismo envío.
 *
 * WhatsApp deja cien; acá cada uno es una subida aparte contra el servidor,
 * y treinta ya es más de lo que alguien elige a propósito.
 */
export const MAX_DRAFTS = 30;

/** Cómo se muestra el adjunto en la vista previa. */
export type AttachmentKind = 'image' | 'video' | 'document';

export interface AttachmentDraft {
  /** Estable mientras dura la vista previa: la miniatura se sigue por esto. */
  readonly id: string;
  readonly file: File;
  /** El pie de foto. Viaja con el adjunto como texto del mismo mensaje. */
  readonly caption: string;
  /**
   * Las versiones anteriores del archivo, de la más vieja a la más nueva.
   * Cada edición aplicada empuja la que había; «Deshacer» la recupera.
   */
  readonly history: readonly File[];
}

let draftSequence = 0;

export function createDraft(file: File, caption = ''): AttachmentDraft {
  draftSequence += 1;
  return { id: `draft-${draftSequence}`, file, caption, history: [] };
}

export function attachmentKind(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
}

/**
 * Si la imagen se puede editar en el lienzo.
 *
 * Fuera quedan el GIF —el lienzo se queda con el primer cuadro y la
 * animación se perdería sin aviso— y el SVG, que es texto y no píxeles.
 */
export function isEditableImage(file: File): boolean {
  return /^image\/(jpeg|png|webp|bmp|avif)$/.test(file.type);
}

/**
 * Por qué no se puede adjuntar, o `null` si se puede.
 *
 * Mismos textos que tenía el composer: son los que la gente ya vio.
 */
export function rejectionReason(file: File): string | null {
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return 'El archivo pesa más de 20 MB.';
  }
  if (!ACCEPTED_ATTACHMENT_TYPES.some((type) => file.type.startsWith(type))) {
    return 'Puede mandar imágenes, videos, audios y PDF.';
  }
  return null;
}

/**
 * Separa lo que se puede adjuntar de lo que no.
 *
 * @param files - Lo que llegó del selector o del arrastre.
 * @param room - Cuántos lugares quedan en el envío.
 * @returns Los archivos aceptados y el primer motivo de rechazo, si hubo.
 */
export function partitionFiles(
  files: Iterable<File>,
  room = MAX_DRAFTS,
): { accepted: File[]; rejection: string | null } {
  const accepted: File[] = [];
  let rejection: string | null = null;
  for (const file of files) {
    const reason = rejectionReason(file);
    if (reason !== null) {
      rejection ??= reason;
      continue;
    }
    if (accepted.length >= room) {
      rejection ??= `Puede mandar hasta ${MAX_DRAFTS} archivos por vez.`;
      continue;
    }
    accepted.push(file);
  }
  return { accepted, rejection };
}

/** La extensión que corresponde a un tipo de imagen exportado por el lienzo. */
export function imageExtension(mimeType: string): string {
  switch (mimeType) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    default:
      return 'png';
  }
}

/**
 * El nombre del archivo editado: legible, sin la marca de tiempo que ponen
 * las cámaras y los portapapeles (`1792710466504_image.png`).
 *
 * @example editedFileName('1792710466504_image.png', 'image/png') // 'imagen-editada.png'
 * @example editedFileName('Lunar brazo.jpeg', 'image/jpeg') // 'Lunar brazo-editada.jpg'
 */
export function editedFileName(originalName: string, mimeType: string): string {
  const stem = originalName
    .replace(/\.[^.]+$/, '')
    .replace(/-editada$/, '')
    .replace(/^\d{8,}[\s_-]*/, '')
    .replace(/^(image|img|imagen|screenshot|captura)$/i, '')
    .trim();
  return `${stem === '' ? 'imagen' : stem}-editada.${imageExtension(mimeType)}`;
}
