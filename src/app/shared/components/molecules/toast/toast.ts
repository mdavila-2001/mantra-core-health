import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { TOAST_TYPE_LABELS, type ToastMessage } from './toast.types';

/**
 * Un aviso de la pila. **No decide su propia vida**: no conoce duraciones ni
 * temporizadores — solo pinta lo que se le pasa y avisa cuando lo cierran.
 * Quien gobierna la cola es `ToastService`.
 *
 * El host ES el aviso (sin envoltorio extra), así el `gap` de la columna del
 * contenedor separa avisos de verdad y no cajas vacías.
 */
@Component({
  selector: 'app-toast',
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'toastClasses()',
  },
})
export class Toast {
  readonly toast = input.required<ToastMessage>();

  /** Emite el `id`: el contenedor no tiene que adivinar cuál se cerró. */
  readonly dismissed = output<number>();

  protected readonly toastClasses = computed(() => `toast toast--${this.toast().type}`);

  /** Palabra que nombra el tipo; la lee el `sr-only` de la plantilla. */
  protected readonly iconLabel = computed(() => TOAST_TYPE_LABELS[this.toast().type]);

  protected dismiss(): void {
    this.dismissed.emit(this.toast().id);
  }
}
