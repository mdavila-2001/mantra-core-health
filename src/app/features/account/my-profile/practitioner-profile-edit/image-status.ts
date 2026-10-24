import { signal } from '@angular/core';
import { map, switchMap, type Observable } from 'rxjs';

import { blobToDataUrl } from '../../../../core/data-access/files/blob-to-data-url';
import type { RejectedFile } from '../../../../shared/components/molecules/file-input/file-input';

/** Formatos y peso que admite una imagen de firma o de sello. */
export const SIGNATURE_IMAGE_FORMATS = 'image/png,image/jpeg,image/webp';
export const SIGNATURE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

/**
 * El estado de **una** imagen editable del perfil —la firma o el sello— mientras
 * se edita: lo que hay guardado, lo que se ve ahora y si algo quedó pendiente
 * de «Guardar cambios».
 *
 * Es una clase y no señales sueltas en el componente porque son dos (firma y
 * sello) con exactamente la misma vida, y copiarlas era copiar seis señales y
 * cuatro métodos. No sabe adónde se guarda: recibe cómo subir un archivo y
 * expone el `fileId` pendiente; quien la usa decide cuándo y cómo escribirlo.
 *
 * - `cambio` es `undefined` si nada cambió, el `fileId` del archivo ya subido si
 *   se eligió uno, o `null` si lo que se quiere es **quitarla**.
 * - Sube al elegir, no al guardar: un archivo que el servidor rechaza se dice en
 *   el momento y no después de haber escrito el resto del formulario.
 */
export class ImageStatus {
  private readonly saved = signal<string | null>(null);
  private readonly pending = signal<{ readonly fileId: string | null } | null>(null);

  /** Lo que la caja muestra ahora: puede ser una imagen recién elegida. */
  readonly visible = signal<string | null>(null);
  readonly uploading = signal(false);
  readonly error = signal('');
  /** Vacío siempre: el selector sólo dispara; la imagen vive en `visible`. */
  readonly files = signal<readonly File[]>([]);

  /**
   * @param nombre - Cómo se la nombra en los avisos: «la firma», «el sello».
   */
  constructor(private readonly nombre: string) {}

  /** `undefined` = nada pendiente; `string` = id a guardar; `null` = quitarla. */
  get change(): string | null | undefined {
    const pendiente = this.pending();
    return pendiente === null ? undefined : pendiente.fileId;
  }

  /** Lo que ya hay en el servidor. No pisa lo que la persona ya eligió. */
  load(url: string | null): void {
    this.saved.set(url);
    if (this.pending() === null) {
      this.visible.set(url);
    }
  }

  /** Sube la imagen elegida y la deja pendiente de guardar. */
  choose(archivos: readonly File[], subir: (archivo: File) => Observable<string>): void {
    const archivo = archivos[0];
    if (archivo === undefined || this.uploading()) {
      return;
    }
    this.error.set('');
    this.uploading.set(true);
    subir(archivo)
      .pipe(
        switchMap((fileId) => blobToDataUrl(archivo).pipe(map((vista) => ({ fileId, vista })))),
      )
      .subscribe({
        next: ({ fileId, vista }) => {
          this.uploading.set(false);
          this.pending.set({ fileId });
          this.visible.set(vista);
        },
        error: () => {
          this.uploading.set(false);
          this.error.set(`No se pudo subir ${this.nombre}. Pruebe de nuevo.`);
        },
      });
  }

  /** El selector descartó un archivo: se dice por qué, sin tocar lo que hay. */
  reject(rechazados: readonly RejectedFile[]): void {
    this.error.set(
      rechazados[0]?.reason === 'tamaño'
        ? `La imagen pesa más de 2 MB. Elija una más liviana para ${this.nombre}.`
        : `${this.nombre[0]!.toUpperCase()}${this.nombre.slice(1)} tiene que ser una imagen PNG, JPG o WEBP.`,
    );
  }

  /** Pide quitarla. Si nunca hubo una guardada, no hay nada que escribir. */
  remove(): void {
    this.error.set('');
    this.pending.set(this.saved() === null ? null : { fileId: null });
    this.visible.set(null);
  }

  /** Vuelve a lo guardado. */
  discard(): void {
    this.pending.set(null);
    this.visible.set(this.saved());
    this.error.set('');
  }

  /** Lo pendiente ya se guardó: lo que se ve pasa a ser lo guardado. */
  confirm(): void {
    if (this.pending() !== null) {
      this.saved.set(this.visible());
      this.pending.set(null);
    }
  }
}
