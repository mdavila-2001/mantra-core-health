import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { Toast } from '../toast/toast';
import { ToastService } from '../toast/toast.service';

/**
 * Ancla de los avisos. Va una sola vez en la aplicación, fuera del
 * `router-outlet`, para que sobreviva a los cambios de ruta.
 *
 * Solo lee la cola de {@link ToastService}: quién avisa y por qué es asunto de
 * quien llama al servicio, no de este componente.
 */
@Component({
  selector: 'app-toast-container',
  imports: [Toast],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ToastContainer {
  private readonly toastService = inject(ToastService);

  readonly toasts = this.toastService.toasts;

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}
