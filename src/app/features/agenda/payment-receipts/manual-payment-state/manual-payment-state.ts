import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';

import type {
  NewPaymentState,
  PaymentStateCode,
  PaymentStateInfo,
} from '../../../../core/data-access/scheduling/scheduling.types';
import { displayCurrency } from '../../../../core/money/display-currency';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { formatMoney } from '../../../../shared/utils/pdf-export/pdf-format';

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
 *
 * ## El monto viaja con la marca (FAC-01)
 *
 * Con la cita pagada, entera o en parte, se puede registrar lo recibido: sale
 * en el mismo `PUT payment-state` (`amountReceived`) y la API lo asienta en la
 * factura de la cita. Cada monto es **otro pago** que se suma, así que no hay
 * «cambiar monto»: «Recibido» es lo que la API dice que se cobró.
 */
@Component({
  selector: 'app-manual-payment-state',
  imports: [AppButton, FormField, Input, NavIcon],
  templateUrl: './manual-payment-state.html',
  styleUrl: './manual-payment-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualPaymentState {
  /** El estado vigente de la cita; `null` si nadie lo marcó. */
  readonly current = input<PaymentStateInfo | null>(null);

  /** Hay una operación en vuelo en el modal. */
  readonly disabled = input(false);

  /** La cita; sin ella no se ofrece el monto. */
  readonly bookingId = input('');

  readonly changed = output<NewPaymentState>();

  private static readonly AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

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

  /* -- Monto recibido: viaja al servidor con la marca ----------------------- */

  /** El monto se ofrece cuando el pago está hecho, entero o en parte. */
  protected readonly showsAmount = computed(() => {
    const state = this.current()?.state;
    return this.bookingId() !== '' && (state === 'PAID' || state === 'PARTIALLY_PAID');
  });

  /** Lo cobrado según la API; `''` si el pago se marcó sin monto. */
  protected readonly receivedLabel = computed(() => {
    const amount = this.current()?.amountPaid;
    return amount !== undefined && amount > 0
      ? formatMoney(amount, displayCurrency(this.current()?.currencyCode))
      : '';
  });

  protected readonly draft = signal<string | number | null>('');

  private readonly draftText = computed(() =>
    String(this.draft() ?? '')
      .trim()
      .replace(',', '.'),
  );

  /** Opcional: vacío no es error. Si se escribe algo, mayor que 0 y con dos decimales. */
  protected readonly problem = computed(() => {
    const text = this.draftText();
    if (text === '') return null;
    if (!ManualPaymentState.AMOUNT_PATTERN.test(text) || Number(text) <= 0) {
      return 'Escriba un monto mayor que 0, con hasta dos decimales.';
    }
    return null;
  });

  protected readonly canSave = computed(
    () => this.draftText() !== '' && this.problem() === null && !this.disabled(),
  );

  constructor() {
    // El monto se borra cuando la API devuelve el estado nuevo, no al pedirlo:
    // si rechaza (por ejemplo, pasa lo que falta pagar), lo escrito sigue ahí.
    effect(() => {
      this.current();
      untracked(() => this.draft.set(''));
    });
  }

  protected setDraft(value: string | number | null): void {
    this.draft.set(value);
  }

  /** Registra el pago con el estado vigente; si la API lo rechaza, el modal lo dice. */
  protected saveAmount(): void {
    const current = this.current();
    if (!this.canSave() || current === null) return;
    this.changed.emit({
      state: current.state,
      insuranceUsed: current.insuranceUsed,
      amountReceived: Number(this.draftText()),
    });
  }
}
