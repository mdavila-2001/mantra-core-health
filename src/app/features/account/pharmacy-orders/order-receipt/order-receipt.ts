import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import type { PedidoFarmacia } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import {
  dataOf,
  empty,
  loading,
  notFound,
  ready,
} from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { comprobanteDesdePedido } from '../../../../shared/utils/receipt-pdf/from-pedido';
import { downloadReceiptPdf } from '../../../../shared/utils/receipt-pdf/receipt-pdf';
import { displayCurrency } from '../../../../core/money/display-currency';

/** A dónde vuelve quien llegó a un comprobante que no existe. */
const LISTA_ROUTE = '/my-account/pharmacy-orders';

/**
 * **El comprobante interno de pago** (carril FAR-I5): lo que el paciente
 * recibe cuando el pago quedó registrado — por el mostrador o por el QR de
 * la demo.
 *
 * La pantalla y su PDF salen de la MISMA proyección
 * (`comprobanteDesdePedido`): no hay forma de que digan cosas distintas.
 * Un pedido sin pago registrado no tiene comprobante: se dice con el estado
 * vacío honesto y la salida al pedido — jamás un comprobante en blanco.
 *
 * Es un comprobante interno, con esa palabra: ni «factura» ni número fiscal
 * (la factura real es de billing y de la pasarela futura).
 */
@Component({
  selector: 'app-order-receipt',
  imports: [AppButton, AppButtonLink, Badge, DatePipe, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './order-receipt.html',
  styleUrl: './order-receipt.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderReceipt {

  /**
   * La moneda visible de un importe: «Bs» para el boliviano y la UMA del
   * arancel, el código tal cual para cualquier otra. Ver `display-currency.ts`.
   */
  protected moneda(code?: string | null): string {
    return displayCurrency(code);
  }
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly route = inject(ActivatedRoute);
  private readonly navigation = inject(NavigationService);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly breadcrumbs = this.navigation.breadcrumbs;

  protected readonly state = signal<ViewState<PedidoFarmacia>>(loading());
  protected readonly pedido = computed(() => dataOf(this.state()));
  protected readonly comprobante = computed(() => {
    const pedido = this.pedido();
    return pedido === null ? null : comprobanteDesdePedido(pedido);
  });

  private orderId: string | null = null;

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.orderId = params.get('orderId');
      this.cargar();
    });
  }

  protected cargar(): void {
    const orderId = this.orderId;
    if (orderId === null || orderId === '') {
      this.state.set(notFound({ label: 'Volver a mis pedidos', route: LISTA_ROUTE }));
      return;
    }
    this.state.set(loading());
    this.ordersClient.pedido(orderId).subscribe({
      next: (pedido) => {
        if (comprobanteDesdePedido(pedido) === null) {
          // Payment is not part of the pharmacy-orders API. Do not fabricate a receipt.
          this.state.set(
            empty(
              { label: 'Ver el pedido', route: this.rutaDelPedido(pedido.id) },
              'Este pedido todavía no tiene un pago registrado.',
            ),
          );
          return;
        }
        this.state.set(ready(pedido));
      },
      error: (error: unknown) => this.state.set(errorToViewState<PedidoFarmacia>(error)),
    });
  }

  protected rutaDelPedido(id: string): string {
    return `${LISTA_ROUTE}/${id}`;
  }

  /** Descarga el PDF — el mismo contenido que esta pantalla, por diseño. */
  protected descargar(): void {
    const pedido = this.pedido();
    const comprobante = pedido === null ? null : comprobanteDesdePedido(pedido);
    if (!this.esBrowser || comprobante === null) {
      return;
    }
    downloadReceiptPdf(comprobante);
  }
}
