import { ChangeDetectionStrategy, Component, isDevMode, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ToastDevPanel } from './core/dev/toast-dev-panel/toast-dev-panel';
import { DEMO_TOASTS, PERSISTENT_DEMO_TOAST } from './core/dev/toast-samples';
import { ToastContainer } from './shared/components/molecules/toast-container/toast-container';
import {
  TOAST_TYPES,
  type ToastMessage,
  type ToastType,
} from './shared/components/molecules/toast/toast.types';

/** Avisos que dispara la ráfaga: suficientes para ver la pila desbordar. */
const BURST_SIZE = 5;

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer, ToastDevPanel],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly isDev = isDevMode();

  /* La cola vive acá porque no hay servicio: el contenedor y el aviso son
     presentacionales y el raíz es quien los monta. Cuando exista un
     `ToastService`, esto se reemplaza por su señal sin tocar los componentes. */
  protected readonly toasts = signal<readonly ToastMessage[]>([]);

  /** Contador en vez de `randomUUID()`/`Date.now()`: el raíz renderiza con SSR. */
  private readonly lastToastId = signal(0);

  protected showToast(type: ToastType): void {
    this.enqueue(DEMO_TOASTS[type]);
  }

  protected showPersistentToast(): void {
    this.enqueue(PERSISTENT_DEMO_TOAST);
  }

  protected showToastBurst(): void {
    for (let index = 0; index < BURST_SIZE; index++) {
      this.enqueue(DEMO_TOASTS[TOAST_TYPES[index % TOAST_TYPES.length]]);
    }
  }

  protected removeToast(id: string): void {
    this.toasts.update((queue) => queue.filter((toast) => toast.id !== id));
  }

  protected clearToasts(): void {
    this.toasts.set([]);
  }

  private enqueue(sample: Omit<ToastMessage, 'id'>): void {
    const id = `aviso-${this.lastToastId() + 1}`;
    this.lastToastId.update((last) => last + 1);

    const toast: ToastMessage = { id, ...sample };
    this.toasts.update((queue) => [...queue, toast]);

    // Sin `duration` el aviso se queda: lo cierra quien lo lee.
    if (toast.duration) {
      setTimeout(() => this.removeToast(id), toast.duration);
    }
  }
}
