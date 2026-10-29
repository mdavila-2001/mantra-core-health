import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { describeFailure } from '../../../core/data-access/scheduling/payment-receipt-format';
import { PaymentReceiptsClient } from '../../../core/data-access/scheduling/payment-receipts.client';
import type { PaymentReceipt } from '../../../core/data-access/scheduling/payment-receipts.types';
import { SchedulingClient } from '../../../core/data-access/scheduling/scheduling.client';
import type {
  NewPaymentState,
  PaymentStateInfo,
} from '../../../core/data-access/scheduling/scheduling.types';
import { empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type { AlertTone } from '../../../shared/components/molecules/alert/alert.types';
import { formatMoney } from '../../../shared/utils/pdf-export/pdf-format';
import { BookingPaymentStates } from './booking-payment-states';

/** La operación en vuelo: sobre qué comprobante y cuál, o el marcado a mano. */
export type PaymentReviewAction =
  { readonly kind: 'confirm' | 'reject'; readonly receiptId: string } | { readonly kind: 'manual' };

/** Lo que el modal le dice a quien revisa después de una operación. */
export interface PaymentReviewNotice {
  readonly tone: AlertTone;
  readonly title: string;
  readonly message: string;
}

/** Cómo se explica cada fallo de una operación. */
interface FailureCopy {
  /** Título de un fallo sin explicación propia. */
  readonly failed: string;
  /** El 409: el comprobante ya se revisó en el otro sentido. */
  readonly conflict?: PaymentReviewNotice;
}

const CONFIRM_FAILURES: FailureCopy = {
  failed: 'No se pudo confirmar el comprobante',
  conflict: {
    tone: 'warning',
    title: 'Este comprobante ya estaba rechazado',
    message:
      'Lo rechazaron mientras usted lo revisaba, así que ya no se puede confirmar. La lista muestra cómo quedó.',
  },
};

const REJECT_FAILURES: FailureCopy = {
  failed: 'No se pudo rechazar el comprobante',
  conflict: {
    tone: 'warning',
    title: 'Este comprobante ya estaba confirmado',
    message:
      'Lo confirmaron mientras usted lo revisaba, así que ya no se puede rechazar: la cita figura como pagada. La lista muestra cómo quedó.',
  },
};

const MANUAL_FAILURES: FailureCopy = {
  failed: 'No se pudo cambiar el estado del pago',
};

/** El 404 de una revisión: el comprobante o la cita ya no están al alcance. */
const GONE_NOTICE: PaymentReviewNotice = {
  tone: 'warning',
  title: 'El comprobante ya no está disponible',
  message: 'La lista se actualizó con lo que hay ahora.',
};

/** La próxima acción del vacío: sin comprobante, el pago se puede marcar a mano. */
const EMPTY_NEXT_ACTION = { label: 'Marcar sin comprobante…' } as const;

/**
 * La revisión de los comprobantes de **una** cita: cargarlos, confirmarlos,
 * rechazarlos y marcar el pago a mano.
 *
 * Es el estado del modal, separado de su plantilla. Se provee por modal: cada
 * apertura empieza de cero.
 *
 * ## Una operación a la vez
 *
 * `action` frena el doble envío: mientras hay una en vuelo, las demás no
 * salen. Es lo que hace la agenda con `operando`, por la misma razón —el
 * segundo clic de un botón lento es la causa más común de un pago marcado dos
 * veces—.
 *
 * ## Lo que cambia la cita sale de la respuesta
 *
 * Confirmar y marcar a mano devuelven el `paymentState` nuevo: se anota en
 * {@link BookingPaymentStates} y la agenda lo pinta sin releerse.
 */
@Injectable()
export class PaymentReceiptsReview {
  private readonly receiptsClient = inject(PaymentReceiptsClient);
  private readonly scheduling = inject(SchedulingClient);
  private readonly paymentStates = inject(BookingPaymentStates);

  readonly receipts = signal<ViewState<readonly PaymentReceipt[]>>(loading());
  readonly action = signal<PaymentReviewAction | null>(null);
  readonly notice = signal<PaymentReviewNotice | null>(null);
  readonly busy = computed(() => this.action() !== null);

  private bookingId = '';

  /** Carga los comprobantes de la cita, con su esqueleto. */
  load(bookingId: string): void {
    this.bookingId = bookingId;
    this.receipts.set(loading());
    this.requestList();
  }

  /** Vuelve a pedirlos sin pasar por el esqueleto. */
  reload(): void {
    this.requestList();
  }

  /** @returns Si quedó confirmado. */
  async confirm(receipt: PaymentReceipt): Promise<boolean> {
    return this.run({ kind: 'confirm', receiptId: receipt.id }, CONFIRM_FAILURES, async () => {
      const confirmation = await firstValueFrom(
        this.receiptsClient.confirm(this.bookingId, receipt.id),
      );
      this.replace(confirmation.receipt);
      this.paymentStates.record(this.bookingId, confirmation.paymentState);
      return {
        tone: 'success',
        title: 'Comprobante confirmado',
        message: `La cita quedó ${confirmation.paymentState.label.toLocaleLowerCase('es')}.`,
      };
    });
  }

  /** @returns Si quedó rechazado. */
  async reject(receipt: PaymentReceipt, reason: string): Promise<boolean> {
    return this.run({ kind: 'reject', receiptId: receipt.id }, REJECT_FAILURES, async () => {
      const rejected = await firstValueFrom(
        this.receiptsClient.reject(this.bookingId, receipt.id, { reason }),
      );
      this.replace(rejected);
      return {
        tone: 'info',
        title: 'Comprobante rechazado',
        message: 'El paciente va a ver el motivo y puede subir otro. El estado del pago no cambió.',
      };
    });
  }

  /**
   * Marca el pago sin comprobante —el efectivo—, por `PUT payment-state`.
   *
   * @returns Si se marcó.
   */
  async markManually(change: NewPaymentState): Promise<boolean> {
    return this.run({ kind: 'manual' }, MANUAL_FAILURES, async () => {
      const state = await firstValueFrom(this.scheduling.setPaymentState(this.bookingId, change));
      this.paymentStates.record(this.bookingId, state);
      return {
        tone: 'success',
        title: 'Estado del pago actualizado',
        message: [
          state.insuranceUsed ? `${state.label}, con seguro.` : `${state.label}.`,
          billingNote(change, state),
        ]
          .filter(Boolean)
          .join(' '),
      };
    });
  }

  /**
   * Corre una operación con su candado y su aviso.
   *
   * @returns `true` si terminó bien; `false` si ya había otra en vuelo o falló.
   */
  private async run(
    action: PaymentReviewAction,
    failures: FailureCopy,
    operation: () => Promise<PaymentReviewNotice>,
  ): Promise<boolean> {
    if (this.busy()) return false;
    this.action.set(action);
    this.notice.set(null);
    try {
      this.notice.set(await operation());
      return true;
    } catch (error: unknown) {
      this.notice.set(this.explain(error, failures));
      return false;
    } finally {
      this.action.set(null);
    }
  }

  /**
   * Traduce un fallo a lo que se le dice a quien revisa, por `code` y nunca por
   * el mensaje. El 409 y el 404 además releen la lista: lo que se muestra
   * quedó viejo.
   */
  private explain(error: unknown, failures: FailureCopy): PaymentReviewNotice {
    const code = error instanceof HttpErrorResponse ? readApiError(error)?.code : undefined;
    if (code === 'CONFLICT' && failures.conflict !== undefined) {
      this.reload();
      return failures.conflict;
    }
    if (code === 'NOT_FOUND') {
      this.reload();
      return GONE_NOTICE;
    }
    return { tone: 'error', title: failures.failed, message: describeFailure(error) };
  }

  private requestList(): void {
    const bookingId = this.bookingId;
    this.receiptsClient.list(bookingId).subscribe({
      next: (items) =>
        this.receipts.set(
          items.length === 0
            ? empty(EMPTY_NEXT_ACTION, 'El paciente todavía no subió comprobantes')
            : ready(items),
        ),
      error: (error: unknown) => this.receipts.set(errorToViewState(error)),
    });
  }

  private replace(updated: PaymentReceipt): void {
    const current = this.receipts();
    if (current.status !== 'ready') return;
    this.receipts.set(
      ready(current.data.map((receipt) => (receipt.id === updated.id ? updated : receipt))),
    );
  }
}

/**
 * Qué pasó con el monto en facturación (FAC-01). Solo se dice si se mandó un
 * monto: sin él, que no se facture es lo esperado.
 */
function billingNote(change: NewPaymentState, state: PaymentStateInfo): string {
  if (change.amountReceived === undefined) return '';
  const billing = state.billing;
  if (billing?.linked && billing.amountPaid !== null && billing.amountBilled !== null) {
    return `Recibido: ${formatMoney(billing.amountPaid, 'Bs')} de ${formatMoney(billing.amountBilled, 'Bs')}.`;
  }
  return billing?.reason === 'NO_PRACTICE'
    ? 'El monto no se facturó: la agenda no está ligada a un consultorio.'
    : 'El monto no se facturó: el consultorio todavía no publicó el precio de la consulta.';
}
