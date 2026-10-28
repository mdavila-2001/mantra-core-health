import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import type { PaymentStateInfo } from '../../../core/data-access/scheduling/scheduling.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../shared/components/atoms/nav-icon/nav-icon';
import { PaymentReceiptsDialog, type PaymentReceiptsMode } from './payment-receipts-dialog';

/**
 * El botón «Comprobante(s) de pago» de una cita, con su modal.
 *
 * ## Por qué un disparador y no el modal suelto
 *
 * La agenda del médico y «Mis citas» del paciente son pantallas enormes: cada
 * una tendría que guardar qué cita tiene el modal abierto, abrirlo, cerrarlo y
 * releer al cambiar. Acá ese estado vive **con el botón** y la pantalla sólo
 * dice de qué cita es y qué hacer cuando algo cambió.
 *
 * En el modo `paciente` además muestra «Pagada» cuando la cita lo está: es la
 * respuesta a «¿ya me confirmaron?» sin abrir nada.
 */
@Component({
  selector: 'app-payment-receipts-trigger',
  imports: [AppButton, Badge, NavIcon, PaymentReceiptsDialog],
  templateUrl: './payment-receipts-trigger.html',
  styleUrl: './payment-receipts-trigger.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentReceiptsTrigger {
  readonly bookingId = input.required<string>();

  /** La cita en palabras: para el encabezado del modal y el nombre del botón. */
  readonly cita = input.required<string>();

  readonly mode = input.required<PaymentReceiptsMode>();

  /** El pago de la cita, si alguien lo marcó. Pagada no admite otro comprobante. */
  readonly pago = input<PaymentStateInfo | null>(null);

  /**
   * Se subió, confirmó o rechazó un comprobante: quien lo usa relee la cita.
   *
   * **Al cerrar el modal, no en el momento.** Releer redibuja la fila, y este
   * botón —con el modal que cuelga de él— vive en la fila: avisar en caliente
   * cerraba el modal en la cara de quien estaba revisando.
   */
  readonly changed = output<void>();

  protected readonly abierto = signal(false);

  private huboCambios = false;

  protected anotarCambio(): void {
    this.huboCambios = true;
  }

  protected cerrar(): void {
    this.abierto.set(false);
    if (this.huboCambios) {
      this.huboCambios = false;
      this.changed.emit();
    }
  }
}
