import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';

import {
  MyStickers,
  STICKER_TYPES,
  type MySticker,
} from '../../../../../core/messaging/my-stickers';
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
  private readonly propios = inject(MyStickers);

  /** Un sticker del pack. */
  readonly elegido = output<Sticker>();

  /** Un archivo propio, nuevo o de «Míos», listo para mandar como sticker. */
  readonly propio = output<File>();

  /** Por qué no se aceptó el archivo. */
  readonly rechazado = output<string>();

  protected readonly stickers = PACK_DE_STICKERS;
  protected readonly misStickers = this.propios.list;
  protected readonly aceptados = STICKER_TYPES.join(',');

  protected async alElegirArchivo(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (archivo === undefined) {
      return;
    }
    const motivo = MyStickers.rejection(archivo);
    if (motivo !== null) {
      this.rechazado.emit(motivo);
      return;
    }
    // Se guarda para la próxima y se manda ya: guardarlo no bloquea el envío.
    void this.propios.save(archivo);
    this.propio.emit(archivo);
  }

  protected mandarPropio(sticker: MySticker): void {
    const archivo = MyStickers.fileOf(sticker);
    if (archivo === null) {
      this.rechazado.emit('No pudimos leer ese sticker. Vuelva a subirlo.');
      return;
    }
    this.propio.emit(archivo);
  }

  protected quitarPropio(sticker: MySticker): void {
    this.propios.remove(sticker.id);
  }
}
