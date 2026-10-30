import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { Router } from '@angular/router';

import { TOAST_TYPE_LABEL, type ToastMessage } from './toast.types';

/**
 * Un aviso suelto. No conoce la cola: recibe el mensaje y avisa cuando lo
 * cierran, para que el contenedor sea el único que decide qué se muestra.
 *
 * ```html
 * <app-toast [toast]="aviso" (dismissed)="cerrar($event)" />
 * ```
 */
@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'hostClasses()',
    /* Sin `role` propio: la región viva es el contenedor, que existe antes que
       el aviso (`app-toast-container`). Un `status`/`alert` que nace junto con
       su texto no siempre se anuncia, y dentro de la región del contenedor
       sería un anuncio doble. */
  },
})
export class Toast {
  private readonly router = inject(Router);

  readonly toast = input.required<ToastMessage>();

  /** Emite el id del aviso que se cerró. */
  readonly dismissed = output<string>();

  readonly hostClasses = computed(() => `toast toast--${this.toast().type}`);

  /** El tono en palabras, para el texto que solo alcanza al lector de pantalla. */
  readonly iconLabel = computed(() => TOAST_TYPE_LABEL[this.toast().type]);

  dismiss(): void {
    this.dismissed.emit(this.toast().id);
  }

  /** Va a donde se resuelve el aviso y lo cierra: ya cumplió. */
  act(): void {
    const action = this.toast().action;
    if (action === undefined) return;
    void this.router.navigateByUrl(action.url);
    this.dismiss();
  }
}
