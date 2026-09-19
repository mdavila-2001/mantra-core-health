import { DatePipe, isPlatformBrowser } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import type { EstadoDePedido } from '../../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { AppButtonLink } from '../../../../../shared/components/atoms/button/button-link';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { MIS_PEDIDOS_ROUTE } from '../../pharmacy-orders.routes';
import { NOTA_DE_EJEMPLO } from '../order-invoice.fixtures';
import { ROTULOS_DE_FACTURA, type DocumentoDeFactura } from '../order-invoice.types';
import { displayCurrency } from '../../../../../core/money/display-currency';

/**
 * **«Tu factura», dentro del detalle del pedido** (T-E4 · AC-T-E4-02).
 *
 * Con factura: su resumen con los rótulos del mostrador, el acceso al
 * documento y la descarga. Sin factura: el vacío honesto de siempre. En los
 * dos casos, el comprobante interno queda como enlace **aparte**: es otro
 * papel y dice que no es una factura.
 *
 * El PDF se carga recién al tocar «Descargar»: el detalle no tiene por qué
 * traer el maquetador de PDF en su bundle.
 */
@Component({
  selector: 'app-tu-factura',
  imports: [AppButton, AppButtonLink, Badge, Chip, DatePipe, RouterLink],
  templateUrl: './tu-factura.html',
  styleUrl: './tu-factura.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TuFactura {

  /**
   * La moneda visible de un importe: «Bs» para el boliviano y la UMA del
   * arancel, el código tal cual para cualquier otra. Ver `display-currency.ts`.
   */
  protected moneda(code?: string | null): string {
    return displayCurrency(code);
  }
  private readonly esBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly orderId = input.required<string>();
  readonly estado = input.required<EstadoDePedido>();
  readonly factura = input<DocumentoDeFactura | null>(null);

  protected readonly rotulos = ROTULOS_DE_FACTURA;
  protected readonly nota = NOTA_DE_EJEMPLO;

  protected readonly rutaDeFactura = computed(() => `${MIS_PEDIDOS_ROUTE}/${this.orderId()}/invoice`);
  protected readonly rutaDeComprobante = computed(
    () => `${MIS_PEDIDOS_ROUTE}/${this.orderId()}/receipt`,
  );

  /** Por qué todavía no hay factura, dicho según dónde está el pedido. */
  protected readonly motivoSinFactura = computed(() =>
    this.estado() === 'RETIRADO'
      ? 'La factura de este pedido todavía no está disponible en la app.'
      : 'La farmacia emite tu factura cuando te entrega el pedido.',
  );

  protected readonly descargaFallida = signal(false);

  protected descargar(): void {
    const factura = this.factura();
    if (!this.esBrowser || factura === null) {
      return;
    }
    this.descargaFallida.set(false);
    import('../order-invoice.pdf')
      .then((pdf) => pdf.downloadInvoicePdf(factura))
      .catch(() => this.descargaFallida.set(true));
  }
}
