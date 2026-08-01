import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Toast } from '../toast/toast';
import type { ToastMessage } from '../toast/toast.types';

/**
 * Ancla fija de la pila de avisos. También es presentacional: recibe la lista
 * ya armada y reenvía hacia arriba el `id` del aviso que se cerró. Quien lo
 * monta es dueño de la cola (agregar, ordenar, vencer por tiempo).
 *
 * ```html
 * <app-toast-container [toasts]="avisos()" (dismissed)="quitar($event)" />
 * ```
 */
@Component({
  selector: 'app-toast-container',
  imports: [Toast],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    // Región nombrada: quien navega por landmarks encuentra la pila de avisos.
    role: 'region',
    'aria-label': 'Avisos del sistema',
  },
})
export class ToastContainer {
  readonly toasts = input<readonly ToastMessage[]>([]);

  readonly dismissed = output<string>();

  protected dismiss(id: string): void {
    this.dismissed.emit(id);
  }
}
