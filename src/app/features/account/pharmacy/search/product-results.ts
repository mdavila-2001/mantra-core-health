import { booleanAttribute, ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { CartLine, CartSite } from '../../../../core/data-access/pharmacy-cart/pharmacy-cart.types';
import { CartStore } from '../../../../core/data-access/pharmacy-cart/cart.store';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { PHARMACY_PRESCRIPTIONS_ROUTE, pharmacyStoreRoute } from '../pharmacy.routes';
import { PHARMACY_TESTIDS } from '../pharmacy.testids';
import type { ProductHit } from './pharmacy-search.types';

/** Un envase por «Agregar»: la cantidad se ajusta después, en el carrito. */
const CANTIDAD_INICIAL = 1;

/**
 * Los resultados del modo **Productos**: una fila por producto y sede.
 *
 * ## Qué se pinta y qué no
 *
 * Nombre y presentación, dónde se consigue, **el precio que publicó esa sede**
 * —o «Precio no publicado», que es una respuesta válida y no un hueco— y la
 * distancia que calculó la API —o la invitación a elegir desde dónde medir—.
 * Ningún importe se compone acá: llega en {@link ProductHit.unitAmount} como
 * texto exacto y sólo puede haber salido de `availability()`.
 *
 * ## Receta obligatoria: insignia, no botón
 *
 * Un producto que exige receta no entra al carrito libre. La fila no muestra
 * «Agregar»: muestra la insignia y el camino real —elegir la receta y volcarla
 * entera desde «Dónde comprar»—. Es la misma regla que ya honra el `CartStore`
 * devolviendo `requires-prescription`; acá se evita llegar a pedírselo.
 */
@Component({
  selector: 'app-product-results',
  imports: [AppButton, Badge, Link, RouterLink],
  templateUrl: './product-results.html',
  styleUrl: './product-results.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductResults {
  private readonly cart = inject(CartStore);
  private readonly dialogs = inject(DialogService);

  readonly items = input.required<readonly ProductHit[]>();

  /** Se pidió ordenar por distancia sin origen: las distancias son todas `null`. */
  readonly sinOrigen = input(false, { transform: booleanAttribute });

  protected readonly testids = PHARMACY_TESTIDS;
  protected readonly rutaDeRecetas = PHARMACY_PRESCRIPTIONS_ROUTE;

  protected readonly porId = (fila: ProductHit): string => fila.id;

  /**
   * La tienda de la farmacia, partida en ruta y parámetro.
   *
   * `pharmacyStoreRoute(pharmacyId, siteId)` devuelve la URL con `?site=`
   * pegada, y `routerLink` no acepta una cadena con query. Se usa la misma
   * función para la ruta y se pasa `site` por `queryParams`: el `href` que
   * sale es idéntico, y la constante del contrato sigue siendo la única que
   * sabe cómo se arma.
   */
  protected rutaDeTienda(fila: ProductHit): string {
    return pharmacyStoreRoute(fila.pharmacyId);
  }

  protected parametrosDeTienda(fila: ProductHit): Record<string, string> {
    return { site: fila.siteId };
  }

  /** «12.50 BOB», o la falta dicha con todas las letras. */
  protected precioDe(fila: ProductHit): string {
    if (fila.unitAmount === null) {
      return 'Precio no publicado';
    }
    // Espacio duro: el importe no se separa de su moneda al partir el renglón.
    return fila.currency === null
      ? fila.unitAmount
      : `${fila.unitAmount}\u00A0${fila.currency}`;
  }

  /** «1,2 km», o por qué no hay distancia. */
  protected distanciaDe(fila: ProductHit): string {
    if (fila.distanceKm === null) {
      return 'Elegí desde dónde medir';
    }
    return `${fila.distanceKm.toLocaleString('es-BO', { maximumFractionDigits: 1 })} km`;
  }

  /**
   * Agrega la fila al carrito.
   *
   * Un carrito es de una sola sede: si ya hay uno de otra, el store devuelve
   * `conflict` **sin cambiar nada** y la decisión es de la persona. Cancelar
   * deja el carrito exactamente como estaba.
   */
  protected async agregar(fila: ProductHit): Promise<void> {
    const resultado = this.cart.add(sedeDe(fila), lineaDe(fila));
    if (resultado !== 'conflict') {
      return;
    }
    const confirmado = await this.dialogs.confirm({
      title: 'Vaciar y cambiar de farmacia',
      message: `Tu carrito es de otra farmacia. Si seguís, se vacía y queda sólo ${fila.name} de ${fila.pharmacyName}.`,
      confirmLabel: 'Vaciar y cambiar',
      cancelLabel: 'Dejarlo como está',
      destructive: true,
    });
    if (!confirmado) {
      return;
    }
    this.cart.replaceWith(sedeDe(fila), [{ ...lineaDe(fila), quantity: CANTIDAD_INICIAL }], null);
  }
}

/** La sede a la que quedaría atado el carrito. */
function sedeDe(fila: ProductHit): CartSite {
  return {
    pharmacyId: fila.pharmacyId,
    pharmacyName: fila.pharmacyName,
    siteId: fila.siteId,
    siteName: fila.siteName,
    addressText: fila.addressText,
  };
}

/** La línea sin cantidad: la pone el store, que es el que sabe si ya estaba. */
function lineaDe(fila: ProductHit): Omit<CartLine, 'quantity'> {
  return {
    productId: fila.productId,
    name: fila.name,
    presentation: fila.presentation,
    unitAmount: fila.unitAmount,
    currency: fila.currency,
    requiresPrescription: fila.requiresPrescription,
    medicationConceptId: fila.medicationConceptId,
  };
}
