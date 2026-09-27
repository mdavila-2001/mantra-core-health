import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { Toast } from '../../molecules/toast/toast';
import { ToastService } from '../../molecules/toast/toast.service';

/**
 * Ancla de los avisos. Va una sola vez en la aplicación, fuera del
 * `router-outlet`, para que sobreviva a los cambios de ruta.
 *
 * Solo lee la cola de {@link ToastService}: quién avisa y por qué es asunto de
 * quien llama al servicio, no de este componente.
 *
 * Es además la región viva de los avisos: dos regiones fijas —cortés y
 * urgente— que existen antes de que llegue el primero (ver la plantilla).
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

  /** Lo que se anuncia sin interrumpir: éxito, información y advertencia. */
  readonly notices = computed(() => this.toasts().filter((toast) => toast.type !== 'error'));

  /** Lo que interrumpe la lectura: sólo los errores. */
  readonly errors = computed(() => this.toasts().filter((toast) => toast.type === 'error'));

  dismiss(id: string): void {
    this.toastService.dismiss(id);
  }
}
