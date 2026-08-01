import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

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
    // Un error interrumpe la lectura; una confirmación espera su turno.
    '[attr.role]': 'toast().type === "error" ? "alert" : "status"',
  },
})
export class Toast {
  readonly toast = input.required<ToastMessage>();

  /** Emite el id del aviso que se cerró. */
  readonly dismissed = output<string>();

  readonly hostClasses = computed(() => `toast toast--${this.toast().type}`);

  /** El tono en palabras, para el texto que solo alcanza al lector de pantalla. */
  readonly iconLabel = computed(() => TOAST_TYPE_LABEL[this.toast().type]);

  dismiss(): void {
    this.dismissed.emit(this.toast().id);
  }
}
