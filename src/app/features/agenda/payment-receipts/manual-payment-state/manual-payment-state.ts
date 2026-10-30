import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import type {
  NewPaymentState,
  PaymentStateCode,
  PaymentStateInfo,
} from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Input } from '../../../../shared/components/atoms/input/input';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '../../../../shared/components/atoms/nav-icon/nav-icon.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { formatBolivianos, ReceivedAmountStore } from '../received-amount-store';

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
  imports: [Alert, AppButton, FormField, Input, NavIcon],
  templateUrl: './manual-payment-state.html',
  styleUrl: './manual-payment-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualPaymentState {
  /** El estado vigente de la cita; `null` si nadie lo marcó. */
  readonly current = input<PaymentStateInfo | null>(null);

  /** Hay una operación en vuelo en el modal. */
  readonly disabled = input(false);

  /** La cita, para anotar el monto recibido; sin ella no se ofrece el monto. */
  readonly bookingId = input('');

  readonly changed = output<NewPaymentState>();

  private readonly amounts = inject(ReceivedAmountStore);
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

  /* -- Monto recibido (solo en este navegador; ver `ReceivedAmountStore`) --- */

  /** El monto se ofrece cuando el pago está hecho, entero o en parte. */
  protected readonly showsAmount = computed(() => {
    const state = this.current()?.state;
    return this.bookingId() !== '' && (state === 'PAID' || state === 'PARTIALLY_PAID');
  });

  protected readonly savedAmount = computed(() => this.amounts.get(this.bookingId()));
  protected readonly savedLabel = computed(() => {
    const saved = this.savedAmount();
    return saved === null ? '' : `Bs ${formatBolivianos(saved.amount)}`;
  });
  protected readonly editing = signal(false);
  protected readonly draft = signal<string | number | null>('');
  private readonly storageFailed = signal(false);

  /** `true` si se ve el campo: no hay monto guardado, o se pidió cambiarlo. */
  protected readonly showsField = computed(() => this.savedAmount() === null || this.editing());

  private readonly draftText = computed(() => String(this.draft() ?? '').trim().replace(',', '.'));

  /** Opcional: vacío no es error. Si se escribe algo, mayor que 0 y con dos decimales. */
  protected readonly problem = computed(() => {
    if (this.storageFailed()) return 'No se pudo guardar en este navegador.';
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

  protected setDraft(value: string | number | null): void {
    this.storageFailed.set(false);
    this.draft.set(value);
  }

  protected startEditing(): void {
    this.setDraft(String(this.savedAmount()?.amount ?? ''));
    this.editing.set(true);
  }

  protected saveAmount(): void {
    if (!this.canSave()) return;
    if (!this.amounts.set(this.bookingId(), Number(this.draftText()))) {
      this.storageFailed.set(true);
      return;
    }
    this.editing.set(false);
    this.draft.set('');
  }
}
