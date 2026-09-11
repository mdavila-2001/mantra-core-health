import { FileDropTarget } from '../../../forms/file-drop-target';
/* ============================================================================
    El selector de adjuntos de un comentario (REQ-01-011).

    ## Por qué no reusa el dropzone de `app-file-input`

    `app-file-input` (shared/components/molecules/file-input) existe y se buscó
    primero, pero es una zona de arrastre completa pensada para formularios que
    suben un documento: demasiado grande para el pie de un comentario, que hoy
    es una sola línea con un textarea y un botón. Lo que **sí** se reusa es el
    pipeline real de subida — `FilesClient.upload()`, el mismo que usa el resto
    del sistema — y `AppButton`/`Alert` del banco de átomos. No se agrega
    proveedor nuevo (60-backend.md #12): un "sticker" es una imagen chica
    subida con ese rol, y un GIF es un `image/gif` normal.

    ## Por qué sube al elegir el archivo, no al enviar el comentario

    Si la subida esperara al `submit`, un comentario con foto tardaría el doble
    en sentirse enviado y un error de red durante la subida se confundiría con
    un error al comentar. Subir al elegir dice de inmediato si el archivo entra
    o no, y lo que se manda con el comentario es sólo un `fileId` ya confirmado.

    ## Vista previa en `data:`, nunca `blob:`

    La CSP del proyecto declara `img-src 'self' data:` (ver el porqué en
    `FilesClient.imageDataUrl`) — un `blob:` quedaría bloqueado en silencio. Acá
    la miniatura sale del propio `File` elegido, con `FileReader`, sin ida y
    vuelta al servidor.
    ========================================================================== */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';

import { FilesClient } from '@core/data-access/files/files.client';
import type { NewCommentMedia } from '@core/data-access/community/community.types';
import { AppButton } from '../../atoms/button/button';
import { Alert } from '../alert/alert';
import {
  COMMENT_MEDIA_MAX,
  COMMENT_MEDIA_MAX_BYTES,
  COMMENT_MEDIA_OPTIONS,
  type CommentMediaAttachment,
  type CommentMediaKind,
} from './comment-media-picker.types';

@Component({
  selector: 'app-comment-media-picker',
  imports: [FileDropTarget, AppButton, Alert],
  templateUrl: './comment-media-picker.html',
  styleUrl: './comment-media-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentMediaPicker {
  private readonly files = inject(FilesClient);

  /** Se deshabilita entera mientras el comentario se está enviando. */
  readonly disabled = input(false);

  /** Emite la lista completa de adjuntos confirmados en cada cambio. */
  readonly cambio = output<readonly NewCommentMedia[]>();

  protected readonly opciones = COMMENT_MEDIA_OPTIONS;
  protected readonly tope = COMMENT_MEDIA_MAX;

  protected readonly adjuntos = signal<readonly CommentMediaAttachment[]>([]);
  protected readonly subiendo = signal(false);
  protected readonly error = signal('');

  protected readonly puedeAgregar = computed(
    () => !this.disabled() && !this.subiendo() && this.adjuntos().length < this.tope,
  );

  /**
   * Limpia el estado. La llama quien contiene el picker después de que el
   * comentario se envió: los adjuntos ya quedaron colgados de ESE comentario,
   * y el picker vuelve a estar vacío para el próximo.
   */
  limpiar(): void {
    this.adjuntos.set([]);
    this.error.set('');
  }

  protected async archivoElegido(kind: CommentMediaKind, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Se limpia ya: sin esto, elegir el mismo archivo dos veces seguidas no
    // dispara un segundo `change`.
    input.value = '';
    if (!file || !this.puedeAgregar()) {
      return;
    }

    if (file.size > COMMENT_MEDIA_MAX_BYTES) {
      this.error.set(`"${file.name}" pesa más de 5 MB.`);
      return;
    }

    this.subiendo.set(true);
    this.error.set('');

    try {
      const [subido, previewUrl] = await Promise.all([
        firstValueFromUpload(this.files, file),
        aDataUrl(file),
      ]);
      const adjunto: CommentMediaAttachment = {
        fileId: subido.id,
        mediaRole: kind,
        previewUrl,
        nombre: file.name,
      };
      this.adjuntos.update((previos) => [...previos, adjunto]);
      this.emitirCambio();
    } catch {
      this.error.set(`No pudimos subir "${file.name}". Reintentá.`);
    } finally {
      this.subiendo.set(false);
    }
  }

  protected quitar(fileId: string): void {
    this.adjuntos.update((previos) => previos.filter((a) => a.fileId !== fileId));
    this.emitirCambio();
    // Best-effort: el archivo ya no cuelga de nada. Si el borrado falla —red,
    // ya borrado— no hay nada que mostrarle a quien está escribiendo un
    // comentario: el adjunto ya desapareció de SU lista, que es lo que le
    // importa.
    this.files.softDelete(fileId).subscribe({ error: () => undefined });
  }

  private emitirCambio(): void {
    this.cambio.emit(
      this.adjuntos().map((a) => ({
        fileId: a.fileId,
        mediaRole: a.mediaRole,
      })),
    );
  }
}

/** `FilesClient.upload()` es un `Observable` de un solo valor: se espera como promesa. */
function firstValueFromUpload(
  files: FilesClient,
  file: File,
): Promise<{ readonly id: string }> {
  return new Promise((resolve, reject) => {
    files.upload(file, 'IMAGE', 'NORMAL').subscribe({
      next: resolve,
      error: reject,
    });
  });
}

/** El `File` elegido, como `data:` URL — nunca `blob:` (ver encabezado del archivo). */
function aDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(lector.error);
    lector.readAsDataURL(file);
  });
}
