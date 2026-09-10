import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Chip } from '../../../../../shared/components/atoms/chip/chip';
import {
  NOTA_DE_DATOS_DE_EJEMPLO,
  type FacturaDeEjemplo,
} from '../../pharmacy-inbox.fixtures';

/**
 * **El resumen de la factura del pedido** (carril FAR-I3) — el registro del
 * cliente, literal: «factura de manera normal y se envía a través de la APP
 * (factura de manera directa la Farmacia)».
 *
 * Presentacional puro: recibe la factura ya armada y no sabe de dónde salió.
 * La descarga no la resuelve acá —no tiene servicios— sino que la pide al
 * detalle con `descargaSolicitada`, que es quien conoce el contexto.
 *
 * El documento completo —el comprobante que el paciente abre en su app— es
 * otra pantalla, del lado de la persona. Acá sólo va lo que el mostrador
 * necesita para responder «¿ya te llegó la factura?».
 */
@Component({
  selector: 'app-resumen-de-factura',
  imports: [AppButton, Badge, Chip, DatePipe],
  templateUrl: './resumen-de-factura.html',
  styleUrl: './resumen-de-factura.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumenDeFactura {
  readonly factura = input.required<FacturaDeEjemplo>();

  /** El mostrador pidió el PDF. Quien contiene a este componente resuelve. */
  readonly descargaSolicitada = output<void>();

  protected readonly notaDeEjemplo = NOTA_DE_DATOS_DE_EJEMPLO;
}
