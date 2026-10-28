import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

import {
  PAYMENT_RECEIPT_REJECTION_MIN_LENGTH,
  PAYMENT_RECEIPT_TEXT_MAX_LENGTH,
} from '../../../../core/data-access/scheduling/payment-receipts.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';

/**
 * El motivo de un rechazo, pedido **en el mismo modal**, debajo del
 * comprobante que se rechaza.
 *
 * No es `DialogService.confirmWithReason`: aquél apila otro diálogo encima y
 * tapa justo el comprobante que se está juzgando. Acá el motivo se escribe con
 * el comprobante a la vista.
 *
 * ## La regla es la de la API
 *
 * De 3 a 500 caracteres (`RejectPaymentReceiptDto`). Se mide **sin los espacios
 * de los bordes**, porque la API guarda el motivo recortado: «  a » pasaría su
 * validación y llegaría al paciente como «a». Mientras no se cumpla, el botón
 * queda deshabilitado; el error aparece en el campo en cuanto se lo deja.
 */
@Component({
  selector: 'app-payment-receipt-rejection-form',
  imports: [AppButton, FormField, Textarea],
  templateUrl: './payment-receipt-rejection-form.html',
  styleUrl: './payment-receipt-rejection-form.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentReceiptRejectionForm {
  /** De qué comprobante es el motivo, para el nombre accesible del formulario. */
  readonly receiptLabel = input.required<string>();

  /** El rechazo está en vuelo: el botón espera y no sale otro. */
  readonly submitting = input(false);

  /** El motivo, ya recortado. */
  readonly submitted = output<string>();
  readonly cancelled = output<void>();

  protected readonly maxLength = PAYMENT_RECEIPT_TEXT_MAX_LENGTH;
  protected readonly reason = signal('');
  private readonly touched = signal(false);
  private readonly field = viewChild.required<ElementRef<HTMLElement>>('field');

  private readonly trimmed = computed(() => this.reason().trim());

  protected readonly problem = computed(() => {
    const length = this.trimmed().length;
    if (length < PAYMENT_RECEIPT_REJECTION_MIN_LENGTH) {
      return `Escriba el motivo, con al menos ${PAYMENT_RECEIPT_REJECTION_MIN_LENGTH} caracteres: el paciente lo lee para saber qué volver a subir.`;
    }
    if (length > PAYMENT_RECEIPT_TEXT_MAX_LENGTH) {
      return `El motivo no puede pasar de ${PAYMENT_RECEIPT_TEXT_MAX_LENGTH} caracteres.`;
    }
    return null;
  });

  /** El error se muestra después de dejar el campo, no mientras se empieza a escribir. */
  protected readonly visibleProblem = computed(() => (this.touched() ? this.problem() : null));

  protected readonly canSubmit = computed(() => this.problem() === null && !this.submitting());

  constructor() {
    // Se abre para escribir: el foco va al campo, no al botón que lo abrió.
    afterNextRender(() => this.field().nativeElement.querySelector('textarea')?.focus());
  }

  protected markTouched(): void {
    this.touched.set(true);
  }

  /** El envío nativo del formulario se frena: el motivo sale por `submitted`. */
  protected submit(event: Event): void {
    event.preventDefault();
    this.touched.set(true);
    if (!this.canSubmit()) return;
    this.submitted.emit(this.trimmed());
  }
}
