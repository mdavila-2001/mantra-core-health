/* ============================================================================
    Resuelve el `fileId` de un adjunto de comentario a una imagen — con sesión.

    Es el único consumidor de `CommunityClient.commentMediaDataUrl()`, y a
    propósito: un adjunto de comentario lo tiene que poder ver cualquiera que
    pueda ver el post, no sólo quien lo subió, y ésa es la regla que autoriza
    ese endpoint (FND-01). `FilesClient.imageDataUrl()` —lo que usaban
    `my-profile`, `practitioner-profile` y `practitioner-detail` cada uno por
    su cuenta— sólo entrega el contenido a quien subió el archivo: correcto
    para una foto de perfil propia, un 403 permanente para el adjunto de
    OTRA persona en un hilo que sí se puede leer.

    Mismo patrón de conversión que aquellos tres (`GET` autenticado → `data:`
    URL vía `blobToDataUrl`, ver su porqué ahí): la CSP no declara `img-src
    blob:` y de todos modos la descarga exige `Authorization`, que un
    atributo `src` no manda.
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

import { CommunityClient } from '@core/data-access/community/community.client';

type Estado = 'carga' | 'listo' | 'error';

@Component({
  selector: 'app-file-preview-image',
  templateUrl: './file-preview-image.html',
  styleUrl: './file-preview-image.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilePreviewImage {
  private readonly community = inject(CommunityClient);

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
      this.community
        .commentMediaDataUrl(id)
        .pipe(catchError(() => of(null)))
        .subscribe((resuelto) => {
          this.url.set(resuelto);
          this.estado.set(resuelto ? 'listo' : 'error');
        });
    });
  }
}
