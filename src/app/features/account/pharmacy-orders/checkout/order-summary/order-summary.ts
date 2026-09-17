import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { ROTULOS_DE_FACTURA } from '../../order-invoice/order-invoice.types';
import type { ResumenDelPedido } from './order-summary.types';

/**
 * **El resumen del pedido** del checkout (T-E3 · F2.1.8, F2.2.3, F2.2.5, F4.2).
 *
 * Presentacional: recibe el resumen ya calculado y lo pinta. Sin cliente, sin
 * pedido y sin identificadores, para que el supermercado (T-E5) lo monte con
 * sus renglones.
 *
 * Los rótulos «Descuento red AloVida» y «Coaseguro» son los de la factura
 * (T-E4): el mismo concepto se nombra igual antes y después de pagar.
 */
@Component({
  selector: 'app-order-summary',
  imports: [Badge, NgTemplateOutlet],
  templateUrl: './order-summary.html',
  styleUrl: './order-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSummary {
  readonly resumen = input.required<ResumenDelPedido>();

  protected readonly rotulos = ROTULOS_DE_FACTURA;

  /** «108.00 BOB», o «No disponible» cuando la cifra no se puede afirmar. */
  protected importe(valor: string | null): string {
    if (valor === null) {
      return 'No disponible';
    }
    const moneda = this.resumen().moneda;
    return moneda === null ? valor : `${valor} ${moneda}`;
  }
}
