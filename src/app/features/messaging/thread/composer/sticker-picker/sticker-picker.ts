import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import {
  MisStickers,
  TIPOS_DE_STICKER,
  type MiSticker,
} from '../../../../../core/messaging/mis-stickers';
import {
  PACK_DE_STICKERS,
  type Sticker,
} from '../../../../../core/messaging/sticker-pack.generated';

/**
 * El panel de stickers del composer.
 *
 * ## Se manda al tocarlo
 *
 * Sin previsualización ni leyenda, igual que la nota de voz: un sticker **es**
 * el mensaje. Meterlo en la caja de texto para después apretar enviar serían
 * dos gestos para decir «gracias».
 *
 * ## Los propios: subir desde el equipo
 *
 * Además del pack, la persona puede subir su sticker o su GIF (PNG, WEBP, GIF o
 * JPG de hasta 1 MB). Se manda en el acto —un sticker es el mensaje— y, si
 * cabe, queda en «Míos» para reusarlo. Viaja por la subida de archivos de
 * siempre, marcado como sticker para que el otro lado lo vea sin burbuja.
 *
 * ## La atribución va al pie y no en un archivo escondido
 *
 * Las ilustraciones son de OpenMoji bajo CC BY-SA 4.0, que obliga a atribuir.
 * `public/stickers/LICENSE.md` lo declara completo; este pie es la parte
 * visible, que es lo que la licencia pide.
 */
@Component({
  selector: 'app-sticker-picker',
  imports: [],
  templateUrl: './sticker-picker.html',
  styleUrl: './sticker-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StickerPicker {
  private readonly propios = inject(MisStickers);

  /** Un sticker del pack. */
  readonly elegido = output<Sticker>();

  /** Un archivo propio, nuevo o de «Míos», listo para mandar como sticker. */
  readonly propio = output<File>();

  /** Por qué no se aceptó el archivo. */
  readonly rechazado = output<string>();

  protected readonly stickers = PACK_DE_STICKERS;
  protected readonly misStickers = this.propios.lista;
  protected readonly aceptados = TIPOS_DE_STICKER.join(',');

  protected async alElegirArchivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (archivo === undefined) {
      return;
    }
    const motivo = MisStickers.rechazo(archivo);
    if (motivo !== null) {
      this.rechazado.emit(motivo);
      return;
    }
    // Se guarda para la próxima y se manda ya: guardarlo no bloquea el envío.
    void this.propios.guardar(archivo);
    this.propio.emit(archivo);
  }

  protected mandarPropio(sticker: MiSticker): void {
    const archivo = MisStickers.archivoDe(sticker);
    if (archivo === null) {
      this.rechazado.emit('No pudimos leer ese sticker. Volvé a subirlo.');
      return;
    }
    this.propio.emit(archivo);
  }

  protected quitarPropio(sticker: MiSticker): void {
    this.propios.quitar(sticker.id);
  }
}
