import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { CartStore } from '../../../../core/data-access/pharmacy-cart/cart.store';
import type { CartLine } from '../../../../core/data-access/pharmacy-cart/pharmacy-cart.types';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import { PharmacyClient } from '../../../../core/data-access/pharmacy/pharmacy.client';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../../../shared/components/molecules/empty-state/empty-state';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { withDisplayCurrency } from '../../../../core/money/display-currency';
import { PHARMACY_ROUTE, pharmacyStoreRoute } from '../pharmacy.routes';
import { PHARMACY_TESTIDS } from '../pharmacy.testids';

/**
 * El carrito de farmacia (H5, carril 41/46 del plan `04-farmacia-ecommerce`).
 *
 * Todo lo que pinta viene de `CartStore`: esta pantalla no guarda estado
 * propio del carrito, sólo el de su propia interacción («Continuar»
 * revisando disponibilidad). El diseño calca `new-order.html` — mismo tipo de
 * pantalla de revisión con renglones y total — porque es el vecino más
 * cercano en el mismo dominio.
 */
@Component({
  selector: 'app-pharmacy-cart-page',
  imports: [RouterLink, AppButton, AppButtonLink, Alert, EmptyState, PageHeader],
  templateUrl: './cart-page.html',
  styleUrl: './cart-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CartPage {
  private readonly cartStore = inject(CartStore);
  private readonly pharmacy = inject(PharmacyClient);
  private readonly orders = inject(PharmacyOrdersClient);
  private readonly router = inject(Router);
  private readonly dialogs = inject(DialogService);
  private readonly navigation = inject(NavigationService);

  protected readonly cart = this.cartStore.cart;
  protected readonly estimatedTotal = this.cartStore.estimatedTotal;
  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly testids = PHARMACY_TESTIDS;
  protected readonly pharmacyRoute = PHARMACY_ROUTE;

  /** Mientras se revisa disponibilidad al tocar «Continuar». */
  protected readonly continuando = signal(false);
  /** Sin alert propio: se pinta con `app-alert` y no bloquea el resto de la pantalla. */
  protected readonly errorAlContinuar = signal<string | null>(null);

  protected readonly withDisplayCurrency = withDisplayCurrency;

  protected seguirComprandoRoute(): string {
    const carrito = this.cart();
    return carrito === null
      ? this.pharmacyRoute
      : pharmacyStoreRoute(carrito.site.pharmacyId, carrito.site.siteId);
  }

  protected incrementar(linea: CartLine): void {
    this.cartStore.setQuantity(linea.productId, linea.quantity + 1);
  }

  protected decrementar(linea: CartLine): void {
    this.cartStore.setQuantity(linea.productId, linea.quantity - 1);
  }

  protected quitar(productId: string): void {
    this.cartStore.remove(productId);
  }

  protected async vaciar(): Promise<void> {
    const confirmado = await this.dialogs.confirm({
      title: 'Vaciar el carrito',
      message: 'Se quitan todas las líneas. Podés volver a agregarlas desde la tienda.',
      confirmLabel: 'Vaciar',
      destructive: true,
    });
    if (confirmado) {
      this.cartStore.clear();
    }
  }

  /**
   * Revalida disponibilidad contra la sede del carrito **antes** de armar el
   * borrador: una promoción o un stock pueden haber cambiado desde que se
   * agregó la primera línea. Si la sede ya no aparece, se dice y no navega
   * (H5.S1.M4).
   */
  protected continuar(): void {
    const carrito = this.cart();
    if (carrito === null || this.continuando()) {
      return;
    }
    this.continuando.set(true);
    this.errorAlContinuar.set(null);
    this.pharmacy
      .availability({ productIds: carrito.lines.map((linea) => linea.productId) })
      .subscribe({
        next: (resultado) => {
          this.continuando.set(false);
          const sede = resultado.items.find((item) => item.siteId === carrito.site.siteId);
          if (sede === undefined) {
            this.errorAlContinuar.set(
              'Esa sede ya no publica disponibilidad. Volvé a la tienda para elegir otra.',
            );
            return;
          }
          this.orders.prepararBorrador(this.cartStore.toDraft(sede));
          void this.router.navigateByUrl('/my-account/pharmacy-orders/new');
        },
        error: () => {
          this.continuando.set(false);
          this.errorAlContinuar.set('No pudimos revisar la disponibilidad. Probá de nuevo.');
        },
      });
  }
}
