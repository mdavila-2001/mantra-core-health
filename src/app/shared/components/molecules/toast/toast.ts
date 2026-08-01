import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { ToastMessage, ToastType } from './toast.types';

/**
 * El tipo dicho con palabras. El color y el ícono no comunican solos: quien usa
 * lector de pantalla —o no distingue el verde del ámbar— necesita el sustantivo.
 */
const TOAST_TYPE_LABELS: Readonly<Record<ToastType, string>> = {
  success: 'Éxito',
  warning: 'Advertencia',
  error: 'Error',
  info: 'Información',
};

/**
 * Aviso flotante, puramente presentacional: recibe un {@link ToastMessage} y
 * emite su `id` cuando se lo cierra. No conoce la cola, no mide tiempo y no
 * inyecta nada — quien lo monta decide cuándo aparece y cuándo se va.
 *
 * ```html
 * <app-toast [toast]="aviso" (dismissed)="quitar($event)" />
 * ```
 */
@Component({
  selector: 'app-toast',
  imports: [],
  templateUrl: './toast.html',
  styleUrl: './toast.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'toastClasses()',
    // `role="alert"` ya implica live assertive; `aria-live` va explícito porque
    // el spec lo pide y algunos lectores viejos no derivan uno del otro.
    // `aria-atomic` evita que se anuncie solo el trozo que cambió.
    role: 'alert',
    'aria-live': 'assertive',
    'aria-atomic': 'true',
  },
})
export class Toast {
  readonly toast = input.required<ToastMessage>();

  /** Emite el `id`: la cola vive afuera y necesita saber cuál sacar. */
  readonly dismissed = output<string>();

  readonly toastClasses = computed(() => `toast toast--${this.toast().type}`);

  readonly iconLabel = computed(() => TOAST_TYPE_LABELS[this.toast().type]);

  protected dismiss(): void {
    this.dismissed.emit(this.toast().id);
  }
}
