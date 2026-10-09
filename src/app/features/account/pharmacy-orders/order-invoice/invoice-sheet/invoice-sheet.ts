import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import { ROTULOS_DE_FACTURA, type DocumentoDeFactura } from '../order-invoice.types';
import { displayCurrency } from '../../../../../core/money/display-currency';
import { withDisplayCurrency } from '../../../../../core/money/display-currency';

/**
 * **La hoja de la factura** (T-E4): el documento entero, presentacional puro.
 *
 * No sabe de pedidos ni de farmacias: recibe un `DocumentoDeFactura` ya
 * armado, así que el supermercado (T-E5) lo reutiliza con otro emisor. La
 * `nota` es el cartel de datos de ejemplo; quien arma el documento sabe si
 * corresponde.
 */
@Component({
  selector: 'app-invoice-sheet',
  imports: [Badge, Chip, DatePipe],
  templateUrl: './invoice-sheet.html',
  styleUrl: './invoice-sheet.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InvoiceSheet {

  /**
   * La moneda visible de un importe: «Bs» para el boliviano y la UMA del
   * arancel, el código tal cual para cualquier otra. Ver `display-currency.ts`.
   */
  protected currency(code?: string | null): string {
    return displayCurrency(code);
  }
  readonly documento = input.required<DocumentoDeFactura>();
  readonly nota = input<string | null>(null);

  protected readonly labels = ROTULOS_DE_FACTURA;

  /** «61.20 BOB», o el vacío honesto cuando falta un precio publicado. */
  protected amount(valor: string | null): string {
    return valor === null
      ? 'No disponible: falta algún precio publicado'
      : withDisplayCurrency(valor, this.documento().moneda);
  }
}
