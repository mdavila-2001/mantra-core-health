import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import { MAX_ATTACHMENT_BYTES, MAX_DRAFTS, partitionFiles } from './attachment-draft';
import { ImagenRechazada, LIENZO, prepararImagen } from './prepare-image';

/** Lo que quedó listo para entrar a la vista previa, y el primer motivo de lo que no. */
export interface PreparedFiles {
  readonly accepted: readonly File[];
  readonly rejection: string | null;
}

/**
 * La única puerta por la que un archivo pasa a ser un borrador.
 *
 * Todo lo que entra al envío —el selector, la cámara, el arrastre sobre la
 * barra o sobre la vista previa, Ctrl+V, el «+» de la vista previa, el archivo
 * que devuelve el editor y el sticker propio— pasa por acá antes de subir:
 *
 * - se valida contra lo que la API acepta (`partitionFiles`);
 * - cada imagen se **achica** a 2048 px y al tope de bytes, y se le **quitan
 *   EXIF y XMP** (JPEG, PNG, WebP y GIF): {@link prepararImagen}. La foto de
 *   la receta no puede salir con las coordenadas de la casa de quien la saca.
 *
 * Un servicio y no una función suelta porque necesita el lienzo inyectable
 * (`LIENZO`, que las pruebas cambian) y saber si corre en el navegador.
 */
@Injectable({ providedIn: 'root' })
export class AttachmentPreparer {
  private readonly lienzo = inject(LIENZO);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /**
   * Deja un archivo listo para subir.
   *
   * @throws ImagenRechazada con el motivo en palabras de quien lo eligió.
   */
  async prepare(file: File): Promise<File> {
    if (!file.type.toLowerCase().startsWith('image/')) {
      return file;
    }
    const ready = await prepararImagen(file, this.isBrowser, this.lienzo);
    // `prepararImagen` ya lo garantiza; se revisa igual porque es lo último
    // antes de una subida que la API rechazaría.
    if (ready.size > MAX_ATTACHMENT_BYTES) {
      throw new ImagenRechazada(`«${file.name}» es demasiado grande, aun achicándola.`);
    }
    return ready;
  }

  /**
   * Valida y prepara varios a la vez, en paralelo y conservando el orden.
   *
   * @param files - Lo que llegó por cualquiera de las puertas.
   * @param room - Cuántos lugares quedan en el envío.
   */
  async prepareAll(files: Iterable<File>, room = MAX_DRAFTS): Promise<PreparedFiles> {
    const { accepted, rejection } = partitionFiles(files, room);
    const results = await Promise.all(
      accepted.map((file) =>
        this.prepare(file).then(
          (ready) => ({ ready, reason: null }),
          (error: unknown) => ({
            ready: null,
            reason: error instanceof ImagenRechazada ? error.message : `No pudimos preparar «${file.name}».`,
          }),
        ),
      ),
    );
    return {
      accepted: results.flatMap((result) => (result.ready === null ? [] : [result.ready])),
      rejection: rejection ?? results.find((result) => result.reason !== null)?.reason ?? null,
    };
  }
}
