import { Injectable, computed, effect, inject, signal } from '@angular/core';

import { AuthService } from '../../auth/auth.service';
import type { AvailabilitySite } from '../pharmacy/pharmacy.types';
import { aCentavos, aTexto } from '../pharmacy-campaigns/pharmacy-campaigns.money';
import type { BorradorDePedido, LineaDePedido } from '../pharmacy-orders/pharmacy-orders.types';
import { CART_STORAGE } from './cart.storage';
import type { AddOutcome, CartLine, CartSite, CartState } from './pharmacy-cart.types';

/** Lo que hace falta para agregar una línea: todo `CartLine` menos la cantidad. */
export type NuevaLineaDeCarrito = Omit<CartLine, 'quantity'>;

const CLAVE_BASE = 'mantra.pharmacy.cart';

/**
 * El carrito de farmacia (`core/data-access/pharmacy-cart`).
 *
 * Persistido por cuenta sobre `localStorage` (H3.S1). La carga al cambiar de
 * cuenta usa el mismo `effect()` que `TutorialProgressStore`
 * (`core/tutorials/tutorial-progress.store.ts`); la escritura, en cambio,
 * **no** es un segundo `effect()` sobre el propio estado: un `effect()` recién
 * corre en el primer flush de cambios (el próximo `tick`), así que si algo
 * mutara el carrito antes de ese flush, el `effect()` de carga —que sí
 * depende sólo de `auth.userId()` y también espera al mismo flush— podría
 * correr primero y pisar lo recién escrito con lo que hubiera en el
 * almacenamiento (vacío). Por eso se persiste **síncronamente dentro de cada
 * mutador** (`persistir()`), exactamente como `TutorialProgressStore.guardar()`.
 * Un carrito es de **una sola sede**: agregar algo de otra sede no se resuelve
 * solo — se dice (`conflict`) y decide la persona, nunca el store.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly auth = inject(AuthService);
  private readonly storage = inject(CART_STORAGE);

  private readonly estado = signal<CartState | null>(null);

  constructor() {
    // Cambiar de cuenta cambia el carrito: sin esto, quien entra después ve
    // el de quien estuvo antes en el mismo navegador — un mostrador
    // compartido es el caso normal en una clínica.
    effect(() => {
      this.estado.set(this.storage.read(claveDe(this.idDeUsuario())));
    });
  }

  /**
   * `auth.userId()`, tolerando un doble de prueba incompleto.
   *
   * En producción `AuthService.userId` siempre es la señal real. Pero un
   * test que reemplaza `AuthService`/`SessionStore` por un `useValue`
   * parcial —hay decenas así, ninguno pensado para el carrito— deja
   * `userId` en `undefined`, y llamarlo revienta **de forma asíncrona**
   * dentro del `effect()` de arriba: no en el test que tiene el doble
   * incompleto, sino en el que esté corriendo cuando el scheduler lo
   * flushee, que puede ser cualquier otro archivo del mismo worker. Ver
   * H2 del carril M6 (2026-09-26): así se destapó, con
   * `pharmacy-inbox.spec.ts`.
   */
  private idDeUsuario(): string | null {
    return typeof this.auth.userId === 'function' ? this.auth.userId() : null;
  }

  /** Escribe (o borra) el carrito bajo la clave de la cuenta vigente, ahora mismo. */
  private persistir(carrito: CartState | null): void {
    const clave = claveDe(this.idDeUsuario());
    if (carrito === null) {
      this.storage.clear(clave);
    } else {
      this.storage.write(clave, carrito);
    }
  }

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

    const siguiente: CartState = { site, requestId, lines: lineas, updatedAt: ahora() };
    this.estado.set(siguiente);
    this.persistir(siguiente);
    return 'added';
  }

  /** Vacía el carrito y lo arma de nuevo con estas líneas, de esta sede. */
  replaceWith(site: CartSite, lines: readonly CartLine[], requestId: string | null): void {
    const siguiente: CartState = { site, requestId, lines, updatedAt: ahora() };
    this.estado.set(siguiente);
    this.persistir(siguiente);
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
    const siguiente = lineas.length === 0 ? null : { ...actual, lines: lineas, updatedAt: ahora() };
    this.estado.set(siguiente);
    this.persistir(siguiente);
  }

  /** Quita una línea. Si no queda ninguna, el carrito vuelve a `null`. */
  remove(productId: string): void {
    this.setQuantity(productId, 0);
  }

  /** Vacía el carrito. */
  clear(): void {
    this.estado.set(null);
    this.persistir(null);
  }

  /**
   * El borrador de pedido (H3.S2), revalidado contra una disponibilidad
   * fresca de la sede — la misma forma que produce `borradorDePedido()` de
   * `where-to-buy.ts` para "Dónde comprar mi receta".
   *
   * Precio, moneda y disponibilidad salen de `site.products` (lo que la sede
   * publica **ahora**, al tocar «Continuar»), no del precio que el carrito
   * tenía guardado: una promoción puede haber terminado entre que se agregó
   * la línea y que se confirma el pedido. La presentación sí viaja del
   * carrito: no cambia entre agregar y confirmar, y `site.products` no
   * siempre trae el mismo formato para recalcularla.
   */
  toDraft(site: AvailabilitySite): BorradorDePedido {
    const carrito = this.estado();
    const porProducto = new Map(site.products.map((producto) => [producto.productId, producto]));
    const lineas: readonly LineaDePedido[] = (carrito?.lines ?? []).map((linea): LineaDePedido => {
      const producto = porProducto.get(linea.productId);
      const disponible = producto !== undefined && !site.missingProductIds.includes(linea.productId);
      const precio = producto?.price?.patientAmount ?? producto?.price?.unitAmount ?? null;
      return {
        productId: linea.productId,
        medicamento: linea.name,
        presentacion: linea.presentation,
        cantidad: linea.quantity,
        precio: disponible ? precio : null,
        moneda:
          disponible && precio !== null
            ? (producto?.price?.currency?.code ?? site.currency?.code ?? null)
            : null,
        disponible,
      };
    });
    return {
      requestId: carrito?.requestId ?? '',
      siteId: site.siteId,
      pharmacyId: site.pharmacyId,
      farmacia: site.pharmacyName,
      sede: site.siteName,
      direccion: site.addressText,
      lineas,
      totalEstimado: site.totalAmount,
      moneda: site.currency?.code ?? null,
    };
  }
}

/** La clave de `localStorage` para una cuenta. Sin cuenta, «anonimo» — el mismo criterio que `TutorialProgressStore`. */
function claveDe(usuario: string | null): string {
  return `${CLAVE_BASE}.${usuario ?? 'anonimo'}`;
}

function ahora(): string {
  return new Date().toISOString();
}
