/* ============================================================================
    Resuelve un `fileId` de `common.files` a una imagen — con sesión.

    Mismo patrón que ya repetían `my-profile`, `practitioner-profile` y
    `practitioner-detail` cada uno por su cuenta: `FilesClient.imageDataUrl()`
    baja los bytes autenticados y los vuelve `data:` URL (la CSP no declara
    `img-src blob:`, así que un `<img [src]>` directo al endpoint no sirve, y
    de todos modos la descarga exige `Authorization`, que un atributo `src` no
    manda). Se factoriza acá para que el cuarto lugar que lo necesite —los
    adjuntos de comentario de REQ-01-011— no lo copie una vez más.

    Si el archivo no es propio ni la publicación es de quien mira, el backend
    responde 403 (ver el comentario de `FilesClient.imageDataUrl`): se degrada
    al estado de error en vez de romper la tarjeta que lo contiene.
    ========================================================================== */

import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { catchError, of } from 'rxjs';

import { FilesClient } from '@core/data-access/files/files.client';

type Estado = 'carga' | 'listo' | 'error';

@Component({
  selector: 'app-file-preview-image',
  templateUrl: './file-preview-image.html',
  styleUrl: './file-preview-image.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilePreviewImage {
  private readonly files = inject(FilesClient);

  readonly fileId = input.required<string>();
  readonly altText = input<string>('');

  protected readonly estado = signal<Estado>('carga');
  protected readonly url = signal<string | null>(null);

  constructor() {
    // `effect()` y no `ngOnChanges`: `fileId` es un `input.required`, y un
    // `@for` que reordena adjuntos puede reusar la instancia con otro id.
    effect(() => {
      const id = this.fileId();
      this.estado.set('carga');
      this.url.set(null);
      this.files
        .imageDataUrl(id)
        .pipe(catchError(() => of(null)))
        .subscribe((resuelto) => {
          this.url.set(resuelto);
          this.estado.set(resuelto ? 'listo' : 'error');
        });
    });
  }
}
