import { InjectionToken } from '@angular/core';

import type { CartState } from './pharmacy-cart.types';

/**
 * Privacidad del carrito (H3.S1.M4, Q-P2): qué se guarda, dónde y cuándo se
 * borra.
 *
 * **Qué se guarda:** nombres de medicamentos y cantidades — dato de salud de
 * la persona. **Dónde:** `localStorage` del propio navegador de la persona,
 * bajo la clave `mantra.pharmacy.cart.<userId>` — nunca en un log, una traza
 * ni una captura. **Cuándo se borra:** al vaciar el carrito, al confirmar el
 * pedido (`CartStore.clear()`, H5.S2) y — como cualquier dato de
 * `localStorage` — al borrar los datos del sitio desde el navegador.
 *
 * Misma forma que `TutorialStorageAdapter` (`core/tutorials/tutorial-progress.store.ts`):
 * una interfaz sobre la que hay un adaptador de navegador con `try`/`catch` y
 * uno no-op para el servidor, elegido en la propia factory del token — igual
 * que `TUTORIAL_STORAGE`, sin necesidad de proveerlo aparte en `app.config`.
 */
export interface CartStorage {
  read(clave: string): CartState | null;
  write(clave: string, cart: CartState): void;
  clear(clave: string): void;
}

/**
 * El adaptador del navegador.
 *
 * `try`/`catch` en las tres operaciones: modo privado, cuota llena o una
 * política que bloquea `localStorage` no pueden tumbar el carrito — se
 * degrada a "sin persistencia" para esa operación, con un aviso por consola.
 */
class BrowserCartStorage implements CartStorage {
  private avisado = false;

  read(clave: string): CartState | null {
    try {
      const crudo = localStorage.getItem(clave);
      return crudo === null ? null : (JSON.parse(crudo) as CartState);
    } catch (error) {
      this.avisar(error);
      return null;
    }
  }

  write(clave: string, cart: CartState): void {
    try {
      localStorage.setItem(clave, JSON.stringify(cart));
    } catch (error) {
      this.avisar(error);
    }
  }

  clear(clave: string): void {
    try {
      localStorage.removeItem(clave);
    } catch (error) {
      this.avisar(error);
    }
  }

  private avisar(error: unknown): void {
    if (this.avisado) {
      return;
    }
    this.avisado = true;
    console.warn(
      'No se pudo usar el almacenamiento local para el carrito de farmacia; ' +
        'no se guardará entre recargas durante esta sesión.',
      error,
    );
  }
}

/** El que no guarda nada. Para el servidor: bajo SSR no hay `localStorage`. */
class NoopCartStorage implements CartStorage {
  read(): CartState | null {
    return null;
  }
  write(): void {
    /* Sin `window` no hay dónde, y no es un error: el servidor no persiste el carrito. */
  }
  clear(): void {
    /* Ídem. */
  }
}

/** El adaptador en uso, elegido igual que `TUTORIAL_STORAGE`. */
export const CART_STORAGE = new InjectionToken<CartStorage>('CART_STORAGE', {
  providedIn: 'root',
  factory: () =>
    typeof localStorage === 'undefined' ? new NoopCartStorage() : new BrowserCartStorage(),
});
