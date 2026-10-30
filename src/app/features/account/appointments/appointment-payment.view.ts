import type { PaymentStateInfo } from '../../../core/data-access/scheduling/scheduling.types';
import { displayCurrency } from '../../../core/money/display-currency';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';
import { formatMoney } from '../../../shared/utils/pdf-export/pdf-format';

/** La insignia de pago de una fila de «Mis citas». */
export interface AppointmentPaymentView {
  /** La etiqueta que manda la API, tal cual: la pantalla no inventa estados. */
  readonly label: string;
  readonly tone: BadgeVariant;
  /** «150,00 Bs» cuando la API manda un monto mayor que cero; `''` si no. Nunca «Pagada · 0,00 Bs». */
  readonly amountText: string;
}

/**
 * Cómo se ve el pago de una cita en la lista (H03).
 *
 * Sin `paymentState` no hay insignia: ausente no es «pendiente», es que nadie
 * lo marcó (`scheduling.types.ts`, `Booking.paymentState`).
 */
export function appointmentPaymentView(
  paymentState: PaymentStateInfo | undefined,
): AppointmentPaymentView | null {
  if (paymentState === undefined) return null;
  // FAC-01: lo cobrado viaja en el estado de pago, solo si se facturó.
  const { amountPaid, currencyCode } = paymentState;
  return {
    label: paymentState.label,
    tone: paymentState.state === 'PAID' ? 'success' : 'warning',
    amountText:
      typeof amountPaid === 'number' && Number.isFinite(amountPaid) && amountPaid > 0
        ? formatMoney(amountPaid, displayCurrency(currencyCode))
        : '',
  };
}
