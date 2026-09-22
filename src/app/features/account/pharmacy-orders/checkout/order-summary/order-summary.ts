import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import type { ResumenDelPedido } from './order-summary.types';

/**
 * **El resumen del pedido** del checkout.
 *
 * Presentacional: recibe el resumen ya calculado y lo pinta. Sin cliente, sin
 * pedido y sin identificadores.
 *
 * **Sólo renglones y total** (R-T-E3): el backend no publica descuento de red,
 * coaseguro, envío ni puntos antes de crear el pedido, así que acá no se pinta
 * ninguna de esas líneas. El coaseguro llega con la liquidación del seguro,
 * después de la adjudicación, y lo muestra el detalle del pedido.
 */
@Component({
  selector: 'app-order-summary',
  imports: [Badge],
  templateUrl: './order-summary.html',
  styleUrl: './order-summary.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderSummary {
  readonly resumen = input.required<ResumenDelPedido>();

  /** El importe con su moneda, o `null` cuando la cifra no se puede afirmar. */
  protected importe(valor: string | null): string | null {
    if (valor === null) {
      return null;
    }
    const moneda = this.resumen().moneda;
    return moneda === null ? valor : `${valor} ${moneda}`;
  }
}
