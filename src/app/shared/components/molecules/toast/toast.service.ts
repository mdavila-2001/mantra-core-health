/* ============================================================================
    Cola de avisos. Única fuente de verdad de lo que hay en pantalla.

    Quien lanza un aviso no conoce al contenedor ni al componente: pide
    `toastService.error('…')` y se olvida. El `ToastContainer` es el único que
    lee la cola, y solo hay uno, montado fuera del `router-outlet`.
    ========================================================================== */

import {
  DestroyRef,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

import type { StatusType } from '@core/tokens/design-tokens.types';
import {
  TOAST_DEFAULT_DURATION_MS,
  TOAST_MAX_VISIBLE,
  type ToastMessage,
  type ToastOptions,
} from './toast.types';

@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly destroyRef = inject(DestroyRef);

  private readonly queue = signal<readonly ToastMessage[]>([]);

  /** Lo que el contenedor pinta. Solo lectura: la cola se toca por métodos. */
  readonly toasts = this.queue.asReadonly();

  /** Temporizador de autocierre por aviso; los fijos no aparecen acá. */
  private readonly timers = new Map<number, ReturnType<typeof setTimeout>>();

  private sequence = 0;

  constructor() {
    // Sin esto, un temporizador vivo mantiene una referencia al servicio (y en
    // pruebas, el runner queda colgado esperando el handle).
    this.destroyRef.onDestroy(() => this.clear());
  }

  /** Forma general. Devuelve el `id`, que permite cerrarlo antes de tiempo. */
  show(type: StatusType, message: string, options: ToastOptions = {}): number {
    this.sequence += 1;
    const id = this.sequence;

    const duration =
      options.duration === undefined ? TOAST_DEFAULT_DURATION_MS : options.duration;

    const toast: ToastMessage = {
      id,
      type,
      message,
      duration,
      ...(options.title ? { title: options.title } : {}),
    };

    this.queue.update((current) => {
      const next = [...current, toast];
      // Se descarta por la cabeza —lo más viejo— hasta entrar en el techo.
      const overflow = next.length - TOAST_MAX_VISIBLE;
      if (overflow <= 0) {
        return next;
      }
      for (const dropped of next.slice(0, overflow)) {
        this.clearTimer(dropped.id);
      }
      return next.slice(overflow);
    });

    this.scheduleDismissal(id, duration);
    return id;
  }

  success(message: string, options?: ToastOptions): number {
    return this.show('success', message, options);
  }

  warning(message: string, options?: ToastOptions): number {
    return this.show('warning', message, options);
  }

  error(message: string, options?: ToastOptions): number {
    return this.show('error', message, options);
  }

  info(message: string, options?: ToastOptions): number {
    return this.show('info', message, options);
  }

  /** Cierra un aviso concreto. Descartar dos veces el mismo id no es un error. */
  dismiss(id: number): void {
    this.clearTimer(id);
    this.queue.update((current) => current.filter((toast) => toast.id !== id));
  }

  /** Vacía la cola — p. ej. al cerrar sesión, donde los avisos ya no aplican. */
  clear(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.queue.set([]);
  }

  /**
   * En el servidor no se programa nada: un `setTimeout` pendiente retrasa el
   * render de SSR, y de todos modos nadie va a ver desaparecer el aviso.
   */
  private scheduleDismissal(id: number, duration: number | null): void {
    if (!this.isBrowser || duration === null || duration <= 0) {
      return;
    }
    this.timers.set(
      id,
      setTimeout(() => this.dismiss(id), duration),
    );
  }

  private clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }
}
