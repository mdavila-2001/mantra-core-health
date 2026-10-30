import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import type { PaymentStateInfo } from '../../../../core/data-access/scheduling/scheduling.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { nextControlId } from '../../../../shared/forms/form-control.context';
import { appointmentPaymentView } from '../appointment-payment.view';
import { BookingPaymentReceipts } from '../booking-payment-receipts/booking-payment-receipts';
import { sufijoDeCodigo } from '../booking-status';

/**
 * La insignia de pago de una fila de «Mis citas» (H03), junto al estado de la
 * cita. La etiqueta es la que manda la API; sin `paymentState`, nada.
 */
@Component({
  selector: 'app-appointment-payment-badge',
  imports: [Badge],
  template: `
    @if (view(); as payment) {
      <app-badge data-testid="appointment-payment-badge" [variant]="payment.tone">
        {{ payment.label }}
        @if (payment.amountText !== '') {
          · {{ payment.amountText }}
        }
      </app-badge>
    }
  `,
  styles: ':host { display: contents; }',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentPaymentBadge {
  readonly paymentState = input<PaymentStateInfo | undefined>(undefined);

  protected readonly view = computed(() => appointmentPaymentView(this.paymentState()));
}

/**
 * Los estados en que una cita ya está aceptada y lleva pago: se ofrece subir el
 * comprobante. Por sufijo de código, como el resto de la pantalla; la garantía
 * es el servidor (422 o 409), esto es no ofrecer un botón que va a fallar.
 */
const CODES_THAT_TAKE_A_RECEIPT: ReadonlySet<string> = new Set([
  'BOOKING_CONFIRMED',
  'BOOKING_CHECKED_IN',
]);

/**
 * «Subir comprobante» en la fila de «Mis citas» (H03).
 *
 * El bloque del comprobante sólo existía en el detalle del calendario, que ya
 * no se ofrece. Acá se monta el mismo `app-booking-payment-receipts`, sin
 * copiarlo, a pedido: abrirlo en cada fila pediría el pago y los comprobantes
 * de todas las citas de la lista. Con la cita pagada no se ofrece.
 */
@Component({
  selector: 'app-appointment-receipt-upload',
  imports: [AppButton, BookingPaymentReceipts],
  templateUrl: './appointment-receipt-upload.html',
  styleUrl: './appointment-receipt-upload.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentReceiptUpload {
  readonly bookingId = input.required<string>();
  /** El código de catálogo del estado de la cita; `''` mientras no se resolvió. */
  readonly statusCode = input('');
  readonly paymentState = input<PaymentStateInfo | undefined>(undefined);

  protected readonly panelId = nextControlId('appointment-receipt');
  protected readonly open = signal(false);

  protected readonly offered = computed(
    () =>
      CODES_THAT_TAKE_A_RECEIPT.has(sufijoDeCodigo(this.statusCode())) &&
      this.paymentState()?.state !== 'PAID',
  );

  protected toggle(): void {
    this.open.update((open) => !open);
  }
}
