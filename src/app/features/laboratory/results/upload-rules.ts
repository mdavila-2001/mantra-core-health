import { HttpErrorResponse } from '@angular/common/http';

import { formatBytes } from '../file-size';

/** The API accepts at most 10 MB per result file (422 otherwise). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** The only formats the API accepts, by extension and the content type sent for each. */
const ALLOWED_TYPES: Readonly<Record<string, readonly string[]>> = {
  pdf: ['application/pdf'],
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  gif: ['image/gif'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  txt: ['text/plain'],
};

/** For `<input type="file" accept>`: the picker only offers what the API takes. */
export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_TYPES)
  .map((extension) => `.${extension}`)
  .join(',');

/** Shown next to every refused file, so the person knows what to pick instead. */
export const ALLOWED_FORMATS_LABEL = 'PDF, JPG, PNG, WEBP, GIF, DOCX, XLSX y TXT';

/** A file refused before sending, with the reason in plain words. */
export interface UploadRejection {
  readonly name: string;
  readonly message: string;
}

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
}

/** The content type to declare: the browser's, or the one the extension implies when it gives none. */
export function contentTypeOf(file: File): string {
  return file.type !== '' ? file.type : (ALLOWED_TYPES[extensionOf(file.name)]?.[0] ?? '');
}

/** Why the API would refuse this file, or `null` when it would take it. */
export function rejectionOf(file: File, displayName = file.name): UploadRejection | null {
  const allowed = ALLOWED_TYPES[extensionOf(file.name)];
  if (allowed === undefined || !allowed.includes(contentTypeOf(file))) {
    return { name: displayName, message: `${displayName}: formato no admitido. Se aceptan ${ALLOWED_FORMATS_LABEL}.` };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return {
      name: displayName,
      message: `${displayName}: pesa ${formatBytes(file.size)} y supera el máximo de 10 MB.`,
    };
  }
  return null;
}

/** The readable message of a failed request: the API's own, or the fallback. */
export function messageOf(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return 'Se cortó la conexión. Reintente: sigue desde donde quedó.';
    }
    const body = error.error as { message?: unknown } | null;
    if (body !== null && typeof body === 'object' && typeof body.message === 'string') {
      return body.message;
    }
    return `El servidor respondió ${error.status}.`;
  }
  return 'No se pudo subir el archivo.';
}
