import { Injectable, computed, signal } from '@angular/core';

import { aCentavos, aTexto } from '../pharmacy-campaigns/pharmacy-campaigns.money';
import type { AddOutcome, CartLine, CartSite, CartState } from './pharmacy-cart.types';

/** Lo que hace falta para agregar una línea: todo `CartLine` menos la cantidad. */
export type NuevaLineaDeCarrito = Omit<CartLine, 'quantity'>;

/**
 * El carrito de farmacia (Ola 0, `core/data-access/pharmacy-cart`).
 *
 * En memoria por ahora: la persistencia por usuario sobre `localStorage`
 * llega en H3.S1, calcada de `TutorialProgressStore`
 * (`core/tutorials/tutorial-progress.store.ts`). Un carrito es de **una sola
 * sede**: agregar algo de otra sede no se resuelve solo — se dice
 * (`conflict`) y decide la persona, nunca el store.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly estado = signal<CartState | null>(null);

  /** El carrito activo, o `null` si no hay ninguno. */
  readonly cart = this.estado.asReadonly();

  /** Suma de `quantity` de todas las líneas. Es lo que muestra el badge. */
  readonly unitCount = computed(() => {
    const carrito = this.estado();
    if (carrito === null) {
      return 0;
    }
    return carrito.lines.reduce((total, linea) => total + linea.quantity, 0);
  });

  /**
   * El total estimado, o `null` si alguna línea no tiene precio o las
   * líneas mezclan moneda.
   *
   * Igual que `totalDeRenglones` de `pharmacy-campaigns.money.ts`, pero sobre
   * `CartLine` (que trae `unitAmount`, no `precio`) y validando moneda única.
   */
  readonly estimatedTotal = computed<{ amount: string; currency: string } | null>(() => {
    const carrito = this.estado();
    if (carrito === null || carrito.lines.length === 0) {
      return null;
    }
    let total = 0;
    let moneda: string | null = null;
    for (const linea of carrito.lines) {
      if (linea.unitAmount === null || linea.currency === null) {
        return null;
      }
      if (moneda === null) {
        moneda = linea.currency;
      } else if (moneda !== linea.currency) {
        return null;
      }
      const centavos = aCentavos(linea.unitAmount);
      if (centavos === null) {
        return null;
      }
      total += centavos * linea.quantity;
    }
    return moneda === null ? null : { amount: aTexto(total), currency: moneda };
  });

  /**
   * Agrega una línea, o suma cantidad si el producto ya está en el carrito.
   *
   * `conflict`: el carrito tiene otra sede — no se pisa sin preguntar, y no
   * cambia nada. `requires-prescription`: la línea exige receta y el carrito
   * (nuevo o existente) no tiene `requestId`. En cualquier otro caso, agrega o
   * suma y devuelve `added`.
   */
  add(site: CartSite, line: NuevaLineaDeCarrito, quantity = 1): AddOutcome {
    const actual = this.estado();
    if (actual !== null && actual.site.siteId !== site.siteId) {
      return 'conflict';
    }
    const requestId = actual?.requestId ?? null;
    if (line.requiresPrescription && requestId === null) {
      return 'requires-prescription';
    }

    const lineasPrevias = actual?.lines ?? [];
    const existente = lineasPrevias.find((l) => l.productId === line.productId);
    const lineas = existente
      ? lineasPrevias.map((l) =>
          l.productId === line.productId ? { ...l, quantity: l.quantity + quantity } : l,
        )
      : [...lineasPrevias, { ...line, quantity }];

    this.estado.set({ site, requestId, lines: lineas, updatedAt: ahora() });
    return 'added';
  }

  /** Vacía el carrito y lo arma de nuevo con estas líneas, de esta sede. */
  replaceWith(site: CartSite, lines: readonly CartLine[], requestId: string | null): void {
    this.estado.set({ site, requestId, lines, updatedAt: ahora() });
  }

  /** `0` quita la línea. Si no queda ninguna, el carrito vuelve a `null`. */
  setQuantity(productId: string, quantity: number): void {
    const actual = this.estado();
    if (actual === null) {
      return;
    }
    const lineas =
      quantity <= 0
        ? actual.lines.filter((l) => l.productId !== productId)
        : actual.lines.map((l) => (l.productId === productId ? { ...l, quantity } : l));
    this.estado.set(lineas.length === 0 ? null : { ...actual, lines: lineas, updatedAt: ahora() });
  }

  /** Quita una línea. Si no queda ninguna, el carrito vuelve a `null`. */
  remove(productId: string): void {
    this.setQuantity(productId, 0);
  }

  /** Vacía el carrito. */
  clear(): void {
    this.estado.set(null);
  }
}

function ahora(): string {
  return new Date().toISOString();
}
