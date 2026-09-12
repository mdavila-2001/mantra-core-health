import { ChangeDetectionStrategy, Component, output } from '@angular/core';

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
  readonly elegido = output<Sticker>();

  protected readonly stickers = PACK_DE_STICKERS;
}
