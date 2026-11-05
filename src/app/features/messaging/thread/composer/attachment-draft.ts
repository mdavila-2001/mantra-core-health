/**
 * Los adjuntos elegidos que todavía no salieron: lo que la vista previa
 * muestra, deja comentar y editar, y el composer manda.
 *
 * Funciones puras y sin Angular: el composer valida con ellas lo que llega por
 * el selector y por el arrastre, y la vista previa con lo que se suma desde su
 * «+». Las dos puertas tienen que decir que no a lo mismo.
 */

import { UPLOAD_MAX_BYTES } from '../../../../core/data-access/files/upload-policy';

/**
 * Lo más grande que sube, **por archivo**: espejo de `FILE_STORAGE_MAX_SIZE_BYTES`
 * de la API (`src/common/storage/storage.env.ts`, 10 MB por omisión). La
 * autoridad es la API: ofrecer más era prometer una subida que vuelve con 422.
 *
 * Las fotos no se miden contra este tope al elegirlas: se achican antes de
 * subir (`prepare-image.ts`) y recién lo que no entra aun achicado se rechaza.
 */
export const MAX_ATTACHMENT_BYTES = UPLOAD_MAX_BYTES;

/**
 * Los documentos que el chat deja adjuntar: lo que la API acepta en la
 * categoría `DOCUMENT` (`UPLOAD_MIME_ALLOWLIST`, en
 * `src/common/storage/upload-content-type.ts`), que deduce el tipo por los
 * primeros bytes. PDF, Word (`.docx`), Excel (`.xlsx`) y texto plano o CSV.
 *
 * Audio y video **no**: la API no los reconoce por firma y los rechaza, así
 * que el chat no los ofrece. Las notas de voz salen por otra puerta (el
 * grabador) y no pasan por acá.
 */
export const ACCEPTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
] as const;

/** El `accept` del selector cuando se buscan fotos. */
export const PHOTO_ACCEPT = 'image/*';

/** El `accept` del selector de «Documento»: tipos y extensiones, para el diálogo del sistema. */
export const DOCUMENT_ACCEPT = [...ACCEPTED_DOCUMENT_TYPES, '.pdf', '.docx', '.xlsx', '.txt', '.csv'].join(',');

/**
 * Lo que acepta el selector por omisión y, con él, el arrastre sobre la barra
 * (`appFileDropTarget` filtra por este `accept`). `image/*` y no la lista
 * exacta de la API: un HEIC, un BMP o un AVIF se convierten a JPEG antes de subir.
 */
export const ATTACHMENT_ACCEPT = `${PHOTO_ACCEPT},${DOCUMENT_ACCEPT}`;

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
 * Una imagen de cualquier formato y peso pasa: se prepara después (se achica,
 * se convierte a JPEG si hace falta y se le quitan los metadatos) y es esa
 * preparación la que dice que no si no hay forma de hacerla entrar.
 */
export function rejectionReason(file: File): string | null {
  const type = file.type.toLowerCase();
  if (type.startsWith('image/')) {
    return null;
  }
  if (!(ACCEPTED_DOCUMENT_TYPES as readonly string[]).includes(type)) {
    return `«${file.name}» no se puede mandar. Puede mandar fotos, PDF, documentos de Word o Excel y archivos de texto.`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return `«${file.name}» pesa más de 10 MB.`;
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
