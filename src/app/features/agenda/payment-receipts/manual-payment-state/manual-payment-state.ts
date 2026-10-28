import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import type {
  NewPaymentState,
  PaymentStateCode,
  PaymentStateInfo,
} from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';

/** Los tres estados, en el orden en que se muestran. La etiqueta viene del servidor al leer. */
const PAYMENT_STATE_OPTIONS: readonly {
  readonly code: PaymentStateCode;
  readonly label: string;
  readonly icon: NavIconName;
}[] = [
  { code: 'PENDING', label: 'Pendiente de pago', icon: 'clock' },
  { code: 'PARTIALLY_PAID', label: 'Parcialmente pagada', icon: 'billing' },
  { code: 'PAID', label: 'Pagada', icon: 'check-circle' },
];

/**
 * «Marcar sin comprobante…»: el estado de pago a mano, para el efectivo.
 *
 * Es el menú de estados que la agenda tenía en «Estado del pago» (TAREA-13,
 * punto 5), mudado adentro del modal de comprobantes: el pago se sigue pudiendo
 * marcar sin que el paciente suba nada, y sigue saliendo por
 * `PUT payment-state`.
 *
 * ## El seguro se conserva al cambiar el estado, y viceversa
 *
 * Son dos preguntas distintas y cambiar una no puede responder la otra por su
 * cuenta: pasar de «pendiente» a «pagada» no borra que la cita se cubrió con
 * seguro. Por eso cada cambio sale con las dos mitades.
 */
@Component({
  selector: 'app-manual-payment-state',
  imports: [AppButton, NavIcon],
  templateUrl: './manual-payment-state.html',
  styleUrl: './manual-payment-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualPaymentState {
  /** El estado vigente de la cita; `null` si nadie lo marcó. */
  readonly current = input<PaymentStateInfo | null>(null);

  /** Hay una operación en vuelo en el modal. */
  readonly disabled = input(false);

  readonly changed = output<NewPaymentState>();

  protected readonly options = PAYMENT_STATE_OPTIONS;

  protected selectState(state: PaymentStateCode): void {
    this.changed.emit({ state, insuranceUsed: this.current()?.insuranceUsed ?? false });
  }

  /** La marca de seguro acompaña a un estado: sin estado no se ofrece. */
  protected toggleInsurance(): void {
    const current = this.current();
    if (current === null) return;
    this.changed.emit({ state: current.state, insuranceUsed: !current.insuranceUsed });
  }
}
