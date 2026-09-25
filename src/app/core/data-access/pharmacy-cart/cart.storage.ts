import { InjectionToken } from '@angular/core';

import type { CartState } from './pharmacy-cart.types';

/**
 * Dónde vive el carrito, por cuenta.
 *
 * Misma forma que `TutorialStorageAdapter` (`core/tutorials/tutorial-progress.store.ts`):
 * una interfaz sobre la que hoy sólo hay un adaptador de navegador. Acá, en la
 * Ola 0, la implementación registrada es la que no guarda nada — la real
 * (H3.S1) llega después, sobre `localStorage`, con clave por usuario.
 */
export interface CartStorage {
  read(clave: string): CartState | null;
  write(clave: string, cart: CartState): void;
  clear(clave: string): void;
}

/** El que no guarda nada. Placeholder de la Ola 0 hasta H3.S1. */
class NoopCartStorage implements CartStorage {
  read(): CartState | null {
    return null;
  }
  write(): void {
    /* Ola 0: sin persistencia todavía. H3.S1 la reemplaza por `localStorage`. */
  }
  clear(): void {
    /* Ídem. */
  }
}

/** El adaptador en uso. H3.S1 provee la implementación real sobre `localStorage`. */
export const CART_STORAGE = new InjectionToken<CartStorage>('CART_STORAGE', {
  providedIn: 'root',
  factory: () => new NoopCartStorage(),
});
