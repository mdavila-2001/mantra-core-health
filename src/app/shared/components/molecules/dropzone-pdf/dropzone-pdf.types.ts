import type { HttpEvent } from '@angular/common/http';
import type { Observable } from 'rxjs';

/** El archivo tal como queda tras la pre-carga: lo que la subida necesita reenviar. */
export interface UploadedDocument {
  readonly fileId: string;
  readonly originalName: string;
  readonly sizeBytes: number;
  readonly mimeType: string;
}

/**
 * Cómo sube el archivo `app-dropzone-pdf`.
 *
 * Una función y no un cliente inyectado: la molécula no puede depender de un
 * cliente de dominio (`IamClient`) sin dejar de ser reutilizable por
 * cualquier otra alta que necesite el mismo patrón «elegir → subir →
 * recordar el `fileId`».
 */
export type PdfUploader = (file: File) => Observable<HttpEvent<UploadedDocument>>;

/**
 * El estado visible de la zona de carga.
 *
 * Guarda `fileName` (no el `File` en sí): es lo único que el estado `ready`
 * necesita mostrar, y así el mismo estado sirve tanto para un archivo recién
 * subido como para uno restaurado por {@link UploadedDocument} — un `File`
 * del navegador no sobrevive a que el asistente destruya y recree esta
 * página al ir y volver, pero el nombre y el tamaño que la pre-carga ya
 * devolvió sí.
 */
export type DropzonePdfState =
  | { readonly kind: 'empty' }
  | { readonly kind: 'uploading'; readonly fileName: string; readonly progress: number | null }
  | { readonly kind: 'ready'; readonly fileName: string; readonly fileId: string; readonly sizeBytes: number }
  | { readonly kind: 'error'; readonly message: string };
