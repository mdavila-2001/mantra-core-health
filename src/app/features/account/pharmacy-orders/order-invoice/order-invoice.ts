import { isPlatformBrowser } from '@angular/common';
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
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { dataOf, empty, loading, notFound, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { MIS_PEDIDOS_ROUTE } from '../pharmacy-orders.routes';
import { HojaDeFactura } from './hoja-de-factura/hoja-de-factura';
import { facturaDelPedido, NOTA_DE_EJEMPLO } from './order-invoice.fixtures';
import { downloadInvoicePdf } from './order-invoice.pdf';
import type { DocumentoDeFactura } from './order-invoice.types';

/**
 * **La factura del pedido** (T-E4 · F2.1.12, F3.3): la pantalla hija
 * `my-account/pharmacy-orders/:orderId/invoice`.
 *
 * El pedido llega por el cliente real de siempre; la factura, en cambio, no
 * tiene contrato todavía y la arma `facturaDelPedido` con datos de ejemplo,
 * rotulados. Un pedido sin factura —la mayoría, y todos con la API real— se
 * dice con el vacío honesto y la salida al pedido: jamás una factura en blanco.
 *
 * No es el comprobante interno (`order-receipt`): ese papel dice que no es una
 * factura, y se enlaza aparte.
 */
@Component({
  selector: 'app-order-invoice',
  imports: [AppButton, AppButtonLink, HojaDeFactura, PageHeader, RouterLink, ViewStateHost],
  templateUrl: './order-invoice.html',
  styleUrl: './order-invoice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderInvoice {
  private readonly ordersClient = inject(PharmacyOrdersClient);
  private readonly route = inject(ActivatedRoute);
  private readonly navigation = inject(NavigationService);
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  protected readonly breadcrumbs = this.navigation.breadcrumbs;
  protected readonly nota = NOTA_DE_EJEMPLO;

  protected readonly state = signal<ViewState<DocumentoDeFactura>>(loading());
  protected readonly documento = computed(() => dataOf(this.state()));

  private readonly orderId = signal<string | null>(null);

  protected readonly rutaDelPedido = computed(() => `${MIS_PEDIDOS_ROUTE}/${this.orderId() ?? ''}`);
  protected readonly rutaDelComprobante = computed(() => `${this.rutaDelPedido()}/receipt`);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.orderId.set(params.get('orderId'));
      this.cargar();
    });
  }

  protected cargar(): void {
    const orderId = this.orderId();
    if (orderId === null || orderId === '') {
      this.state.set(notFound({ label: 'Volver a mis pedidos', route: MIS_PEDIDOS_ROUTE }));
      return;
    }
    this.state.set(loading());
    this.ordersClient.pedido(orderId).subscribe({
      next: (pedido) => {
        const factura = facturaDelPedido(pedido);
        this.state.set(
          factura === null
            ? empty(
                { label: 'Ver el pedido', route: `${MIS_PEDIDOS_ROUTE}/${pedido.id}` },
                'Este pedido todavía no tiene factura.',
              )
            : ready(factura),
        );
      },
      error: (error: unknown) => this.state.set(errorToViewState<DocumentoDeFactura>(error)),
    });
  }

  /** Descarga el PDF: el mismo documento que esta pantalla. */
  protected descargar(): void {
    const factura = this.documento();
    if (!this.esBrowser || factura === null) {
      return;
    }
    downloadInvoicePdf(factura);
  }
}
