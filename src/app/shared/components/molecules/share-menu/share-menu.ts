import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';

import { ShareService } from '../../../utils/share/share.service';
import { AppButton } from '../../atoms/button/button';
import { NavIcon } from '../../atoms/nav-icon/nav-icon';
import { MenuItem } from '../menu/menu-item/menu-item';
import { Menu } from '../menu/menu';
import { MenuTrigger } from '../menu/menu-trigger/menu-trigger';
import { ToastService } from '../toast/toast.service';

/** Los archivos que una vista puede entregar para compartir o imprimir. */
export type ShareFormat = 'png' | 'svg' | 'pdf';

const FORMAT_LABEL: Readonly<Record<ShareFormat, { readonly title: string; readonly hint: string }>> = {
  png: { title: 'Imagen (PNG)', hint: 'Alta resolución, para mandar por mensaje' },
  svg: { title: 'Vector (SVG)', hint: 'Se agranda sin perder nitidez' },
  pdf: { title: 'Documento (PDF)', hint: 'Para imprimir o guardar en la historia' },
};

/**
 * El botón «Compartir» de una vista: enlace que reabre lo mismo y archivos para
 * llevarse (PNG, SVG, PDF).
 *
 * No sabe dibujar nada. El **enlace** lo resuelve acá (`ShareService`) porque es
 * igual en todas las vistas; los **archivos** los pide a quien lo monta con
 * {@link exported}, que es quien tiene el dibujo.
 */
@Component({
  selector: 'app-share-menu',
  imports: [AppButton, Menu, MenuItem, MenuTrigger, NavIcon],
  templateUrl: './share-menu.html',
  styleUrl: './share-menu.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShareMenu {
  private readonly share = inject(ShareService);
  private readonly toast = inject(ToastService);

  /** La dirección que reabre lo mismo; `null` esconde la opción del enlace. */
  readonly url = input<string | null>(null);

  /** Cómo se llama lo compartido: título de la hoja del sistema y de los avisos. */
  readonly title = input.required<string>();

  /** Los archivos que esta vista sabe entregar. */
  readonly formats = input<readonly ShareFormat[]>(['png', 'svg', 'pdf']);

  /** Nombre accesible del botón. */
  readonly label = input('Compartir');

  readonly testId = input('share');

  /** Se pidió un archivo: quien monta la vista lo genera y lo entrega. */
  readonly exported = output<ShareFormat>();

  protected readonly options = computed(() =>
    this.formats().map((format) => ({ format, ...FORMAT_LABEL[format] })),
  );

  protected async shareLink(): Promise<void> {
    const url = this.url();
    if (url === null) return;
    const outcome = await this.share.shareLink(url, this.title());
    switch (outcome) {
      case 'copied':
        this.toast.show({ type: 'success', message: 'Enlace copiado. Pegue donde quiera compartirlo.' });
        break;
      case 'failed':
        this.toast.show({
          type: 'warning',
          message: 'No pudimos copiar el enlace. Copie la dirección de la barra del navegador.',
        });
        break;
      default:
        break;
    }
  }
}
