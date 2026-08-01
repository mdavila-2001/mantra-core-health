import { isPlatformBrowser } from '@angular/common';
import {
  ApplicationRef,
  createComponent,
  DOCUMENT,
  EnvironmentInjector,
  inject,
  Injectable,
  isDevMode,
  PLATFORM_ID,
} from '@angular/core';

import { Dialog } from './dialog';
import type { DialogConfig } from './dialog.types';

/**
 * Abre confirmaciones sin que la pantalla tenga que declarar el diálogo.
 *
 * ```ts
 * const confirmado = await this.dialogs.confirm({
 *   title: 'Anular la orden',
 *   message: 'La orden queda anulada y el laboratorio deja de verla.',
 *   confirmLabel: 'Anular',
 *   destructive: true,
 * });
 * ```
 *
 * Devuelve una promesa y no un observable: una confirmación se responde **una
 * vez**, y el repo no usa RxJS fuera de lo que trae Angular.
 *
 * Al cerrar, el foco vuelve al elemento que lo abrió: sin eso, quien navega
 * con teclado queda parado en el `<body>` después de confirmar.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly environmentInjector = inject(EnvironmentInjector);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  confirm(config: DialogConfig): Promise<boolean> {
    if (!this.isBrowser) {
      // En el servidor no hay quién confirme: se resuelve que no y se avisa.
      if (isDevMode()) {
        console.warn(
          '[DialogService] `confirm()` en el servidor: no hay diálogo posible, devuelve false.',
        );
      }
      return Promise.resolve(false);
    }

    const origen = this.document.activeElement;

    return new Promise<boolean>((resolve) => {
      const dialog = createComponent(Dialog, {
        environmentInjector: this.environmentInjector,
      });
      dialog.setInput('config', config);

      const subscripcion = dialog.instance.resolved.subscribe((confirmado: boolean) => {
        subscripcion.unsubscribe();
        this.applicationRef.detachView(dialog.hostView);
        dialog.destroy();
        dialog.location.nativeElement.remove();
        this.returnFocus(origen);
        resolve(confirmado);
      });

      this.applicationRef.attachView(dialog.hostView);
      this.document.body.appendChild(dialog.location.nativeElement);
    });
  }

  private returnFocus(origen: Element | null): void {
    if (origen instanceof HTMLElement && origen.isConnected) {
      origen.focus();
    }
  }
}
