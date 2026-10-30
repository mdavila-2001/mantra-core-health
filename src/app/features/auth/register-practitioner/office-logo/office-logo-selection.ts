import { DestroyRef, inject, Injectable, signal } from '@angular/core';
import { map, of, tap, type Observable, type Subscription } from 'rxjs';

import { blobToDataUrl } from '../../../../core/data-access/files/blob-to-data-url';
import {
  PRACTICE_LOGO_ACCEPT,
  PRACTICE_LOGO_MAX_BYTES,
  PracticeLogoClient,
} from '../../../../core/data-access/practice-sites/practice-logo.client';
import { matchesFileAccept } from '../../../../shared/forms/file-accept';

/** Por qué un archivo no sirve como logo: el formato o el peso. */
export type OfficeLogoRejection = 'type' | 'size';

/** Lo que se le dice a la persona, en el campo y con usted. */
const MESSAGES: Readonly<Record<OfficeLogoRejection | 'unreadable', string>> = {
  type: 'El logo tiene que ser una imagen PNG, JPG o WebP.',
  size: 'El logo pesa más de 2 MB. Elija una imagen más liviana.',
  unreadable: 'No se pudo leer la imagen seleccionada.',
};

/** Un archivo ya pre-cargado, para no volver a subirlo en un reintento del alta. */
interface UploadedLogo {
  readonly file: File;
  readonly fileId: string;
}

/**
 * El logo del consultorio que se elige en el alta del médico, desde que se
 * elige hasta que el alta lo manda en `ownSite.logoFileId`.
 *
 * ## Por qué vive fuera del campo
 *
 * El motor de páginas destruye el campo al pasar de página, y lo elegido tiene
 * que llegar hasta «Crear cuenta». Se provee en el alta y no en la raíz: cada
 * alta empieza sin logo.
 *
 * ## Se sube al enviar, no al elegir
 *
 * Como la firma y el sello del mismo alta. La pre-carga es anónima y nada purga
 * las que nadie reclama: subir al elegir dejaría una por cada cambio de idea.
 * Lo elegido se recuerda junto con su id, así que un reintento del alta no
 * vuelve a subir el mismo archivo, y cambiarlo sí lo sube de nuevo.
 *
 * Un archivo que no es png, jpeg ni webp, o que pesa más de 2 MB, no se acepta:
 * el motivo queda en {@link OfficeLogoSelection.error} y lo que ya estaba
 * elegido sigue igual.
 */
@Injectable()
export class OfficeLogoSelection {
  private readonly logos = inject(PracticeLogoClient);

  private readonly chosen = signal<File | null>(null);
  private readonly previewUrl = signal<string | null>(null);
  private readonly rejection = signal<string | null>(null);
  private uploaded: UploadedLogo | null = null;
  private previewRead: Subscription | null = null;

  /** El archivo elegido, o `null` si no hay logo. */
  readonly file = this.chosen.asReadonly();
  /** La imagen elegida como `data:` URL, para la vista previa. */
  readonly preview = this.previewUrl.asReadonly();
  /** Por qué no se aceptó el último archivo, o `null`. */
  readonly error = this.rejection.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => this.previewRead?.unsubscribe());
  }

  /** Elige un archivo si sirve como logo y prepara su vista previa. */
  choose(file: File): void {
    const reason = rejectionOf(file);
    if (reason !== null) {
      this.reject(reason);
      return;
    }
    this.clear();
    this.chosen.set(file);
    this.previewRead = blobToDataUrl(file).subscribe({
      next: (url) => this.previewUrl.set(url),
      error: () => {
        this.clear();
        this.rejection.set(MESSAGES.unreadable);
      },
    });
  }

  /** Dice por qué no se aceptó un archivo, sin tocar el logo ya elegido. */
  reject(reason: OfficeLogoRejection): void {
    this.rejection.set(MESSAGES[reason]);
  }

  /** Deja el alta sin logo. */
  remove(): void {
    this.clear();
  }

  /**
   * Sube lo elegido si todavía no se subió. Sin logo, o con el mismo archivo ya
   * subido, termina sin pedir nada.
   */
  upload(): Observable<void> {
    const file = this.chosen();
    if (file === null || this.uploaded?.file === file) {
      return of(undefined);
    }
    return this.logos.uploadForRegistration(file).pipe(
      tap((fileId) => (this.uploaded = { file, fileId })),
      map(() => undefined),
    );
  }

  /** El id pre-cargado de lo que está elegido ahora, o `null` si no hay ninguno. */
  fileId(): string | null {
    const file = this.chosen();
    return file !== null && this.uploaded?.file === file ? this.uploaded.fileId : null;
  }

  private clear(): void {
    this.previewRead?.unsubscribe();
    this.previewRead = null;
    this.chosen.set(null);
    this.previewUrl.set(null);
    this.rejection.set(null);
  }
}

function rejectionOf(file: File): OfficeLogoRejection | null {
  if (!matchesFileAccept(file, PRACTICE_LOGO_ACCEPT)) {
    return 'type';
  }
  return file.size > PRACTICE_LOGO_MAX_BYTES ? 'size' : null;
}
