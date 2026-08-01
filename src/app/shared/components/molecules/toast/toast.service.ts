import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import {
  TOAST_DEFAULT_DURATION_MS,
  type ToastInput,
  type ToastMessage,
  type ToastType,
} from './toast.types';

/**
 * Cola de avisos de la aplicación.
 *
 * Es la única fuente: los componentes (`app-toast-container`) solo la leen. El
 * cierre automático se programa **solo en el navegador** — en el render del
 * servidor un temporizador pendiente retrasa la respuesta y además nadie está
 * mirando la pantalla todavía.
 */
@Injectable({
  providedIn: 'root',
})
export class ToastService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly items = signal<readonly ToastMessage[]>([]);

  /** Avisos visibles, del más viejo al más nuevo. */
  readonly toasts = this.items.asReadonly();

  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Contador propio en vez de `crypto.randomUUID()`: el id no es un secreto, no
   * sale de la aplicación, y así es reproducible en las pruebas.
   */
  private sequence = 0;

  /** Encola un aviso y devuelve su id, por si hay que cerrarlo antes de tiempo. */
  show(input: ToastInput): string {
    const type: ToastType = input.type ?? 'info';
    const id = `toast-${++this.sequence}`;
    const durationMs =
      input.durationMs === undefined ? TOAST_DEFAULT_DURATION_MS[type] : input.durationMs;

    const toast: ToastMessage = {
      id,
      type,
      message: input.message,
      durationMs,
      ...(input.title === undefined ? {} : { title: input.title }),
    };

    this.items.update((current) => [...current, toast]);
    this.scheduleDismissal(toast);

    return id;
  }

  success(message: string, title?: string): string {
    return this.show({ type: 'success', message, ...(title === undefined ? {} : { title }) });
  }

  info(message: string, title?: string): string {
    return this.show({ type: 'info', message, ...(title === undefined ? {} : { title }) });
  }

  warning(message: string, title?: string): string {
    return this.show({ type: 'warning', message, ...(title === undefined ? {} : { title }) });
  }

  error(message: string, title?: string): string {
    return this.show({ type: 'error', message, ...(title === undefined ? {} : { title }) });
  }

  /** Cierra un aviso. Es idempotente: cerrar dos veces el mismo id no rompe. */
  dismiss(id: string): void {
    this.clearTimer(id);
    this.items.update((current) => current.filter((toast) => toast.id !== id));
  }

  /** Vacía la cola, por ejemplo al cerrar sesión. */
  clear(): void {
    for (const id of [...this.timers.keys()]) {
      this.clearTimer(id);
    }
    this.items.set([]);
  }

  private scheduleDismissal(toast: ToastMessage): void {
    if (!this.isBrowser || toast.durationMs === null) {
      return;
    }

    this.timers.set(
      toast.id,
      setTimeout(() => this.dismiss(toast.id), toast.durationMs),
    );
  }

  private clearTimer(id: string): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
