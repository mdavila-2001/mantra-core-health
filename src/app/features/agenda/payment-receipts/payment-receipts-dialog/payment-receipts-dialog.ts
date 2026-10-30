import { formatDate } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  LOCALE_ID,
  output,
  signal,
  untracked,
  type OnInit,
} from '@angular/core';

import {
  describeReceipt,
  isPdfReceipt,
} from '../../../../core/data-access/scheduling/payment-receipt-format';
import type { PaymentReceipt } from '../../../../core/data-access/scheduling/payment-receipts.types';
import type {
  NewPaymentState,
  PaymentStateInfo,
} from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { EmptyState } from '../../../../shared/components/molecules/empty-state/empty-state';
import { ContentDialog } from '../../../../shared/components/organisms/content-dialog/content-dialog';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { nextControlId } from '../../../../shared/forms/form-control.context';
import { BookingPaymentStates } from '../booking-payment-states';
import { ManualPaymentState } from '../manual-payment-state/manual-payment-state';
import { PaymentReceiptRejectionForm } from '../payment-receipt-rejection-form/payment-receipt-rejection-form';
import { PaymentReceiptRow } from '../payment-receipt-row/payment-receipt-row';
import { PaymentReceiptViewer } from '../payment-receipt-viewer/payment-receipt-viewer';
import { PaymentReceiptsReview } from '../payment-receipts-review';
import { ReceiptFiles } from '../receipt-files';

/**
 * «Estado del pago» de una cita: los comprobantes que subió el paciente, para
 * revisarlos sin salir de la agenda.
 *
 * Contenedor: carga, confirma y rechaza por {@link PaymentReceiptsReview}, baja
 * los archivos por {@link ReceiptFiles} y compone las piezas presentacionales —
 * la fila, el visor, el motivo del rechazo y el marcado a mano—.
 *
 * ## El foco no se pierde nunca
 *
 * El modal es un `<dialog>` nativo (`app-content-dialog`): el foco queda
 * atrapado adentro y `Escape` lo cierra. Lo que este contenedor cuida es lo que
 * el navegador no sabe: cuando un botón desaparece —la fila confirmada pierde
 * sus acciones, el visor se cierra— el foco va a algo que sigue ahí, y no al
 * documento de atrás.
 *
 * ## El pago de la cita se pinta con lo que devolvió la API
 *
 * Confirmar o marcar a mano anotan el estado nuevo en
 * {@link BookingPaymentStates}; la insignia de este modal y la de la agenda lo
 * leen de ahí, así que cambian juntas y sin releer nada.
 */
@Component({
  selector: 'app-payment-receipts-dialog',
  imports: [
    Alert,
    AppButton,
    Badge,
    ContentDialog,
    EmptyState,
    ManualPaymentState,
    PaymentReceiptRejectionForm,
    PaymentReceiptRow,
    PaymentReceiptViewer,
    Skeleton,
    ViewStateHost,
  ],
  providers: [PaymentReceiptsReview, ReceiptFiles],
  templateUrl: './payment-receipts-dialog.html',
  styleUrl: './payment-receipts-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentReceiptsDialog implements OnInit {
  readonly bookingId = input.required<string>();
  /** A quién se atiende, como lo nombra la agenda (con su misma compuerta). */
  readonly patientName = input.required<string>();
  readonly startsAt = input<Date | null>(null);
  /** El estado de pago con que la agenda leyó la cita. */
  readonly paymentState = input<PaymentStateInfo | null>(null);

  readonly closed = output<void>();

  protected readonly review = inject(PaymentReceiptsReview);
  protected readonly files = inject(ReceiptFiles);
  private readonly paymentStates = inject(BookingPaymentStates);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly locale = inject(LOCALE_ID);

  /** El comprobante abierto en el visor; `null` muestra la lista. */
  protected readonly viewing = signal<PaymentReceipt | null>(null);
  /** El comprobante cuyo motivo de rechazo se está escribiendo. */
  protected readonly rejecting = signal<string | null>(null);
  protected readonly manualOpen = signal(false);
  protected readonly manualPanelId = nextControlId('payment-manual');

  protected readonly currentPaymentState = computed(() =>
    this.paymentStates.resolve(this.bookingId(), this.paymentState()),
  );

  /** Pagada o pagada en parte: sin comprobantes, el pago se marcó a mano (H04). */
  protected readonly paidWithoutReceipt = computed(() => {
    const state = this.currentPaymentState()?.state;
    return state === 'PAID' || state === 'PARTIALLY_PAID';
  });

  protected readonly description = computed(() => {
    const startsAt = this.startsAt();
    return startsAt === null
      ? this.patientName()
      : `${this.patientName()} · ${formatDate(startsAt, "EEEE d 'de' MMMM, HH:mm", this.locale)}`;
  });

  protected readonly receipts = computed(() => {
    const state = this.review.receipts();
    return state.status === 'ready' ? state.data : null;
  });

  constructor() {
    // Las miniaturas: sólo las imágenes, una vez por comprobante.
    effect(() => {
      const receipts = this.receipts();
      if (receipts === null) return;
      untracked(() => {
        for (const receipt of receipts) {
          if (!isPdfReceipt(receipt)) this.files.request(this.bookingId(), receipt);
        }
      });
    });

    // Un fallo se trae a la vista: el cuerpo del modal se recorre, y el aviso
    // de una acción al pie de la lista no puede quedar arriba, fuera. Un
    // éxito no: el foco ya fue a la fila que cambió, que es donde se mira.
    effect(() => {
      const tone = this.review.notice()?.tone;
      if (tone !== 'error' && tone !== 'warning') return;
      this.afterRender(() =>
        this.scrollIntoView(this.query('[data-testid="payment-receipts-notice"]')),
      );
    });
  }

  ngOnInit(): void {
    this.review.load(this.bookingId());
  }

  protected summaryOf(receipt: PaymentReceipt): string {
    return describeReceipt(receipt);
  }

  protected isConfirming(receiptId: string): boolean {
    const action = this.review.action();
    return action?.kind === 'confirm' && action.receiptId === receiptId;
  }

  protected isRejecting(receiptId: string): boolean {
    const action = this.review.action();
    return action?.kind === 'reject' && action.receiptId === receiptId;
  }

  protected reload(): void {
    this.review.load(this.bookingId());
  }

  protected async confirm(receipt: PaymentReceipt): Promise<void> {
    if (await this.review.confirm(receipt)) {
      // La fila perdió sus botones: el foco pasa a su monto.
      this.focusRow(receipt.id);
    }
  }

  protected startRejecting(receipt: PaymentReceipt): void {
    this.rejecting.set(receipt.id);
  }

  protected cancelRejecting(receiptId: string): void {
    this.rejecting.set(null);
    this.focusInRow(receiptId, '[data-testid="payment-receipt-reject"]');
  }

  protected async reject(receipt: PaymentReceipt, reason: string): Promise<void> {
    if (await this.review.reject(receipt, reason)) {
      this.rejecting.set(null);
      this.focusRow(receipt.id);
    }
  }

  protected openViewer(receipt: PaymentReceipt): void {
    this.viewing.set(receipt);
    this.files.request(this.bookingId(), receipt);
  }

  protected closeViewer(): void {
    const receiptId = this.viewing()?.id;
    this.viewing.set(null);
    if (receiptId !== undefined) {
      this.focusInRow(receiptId, '[data-testid="payment-receipt-view"]');
    }
  }

  protected retryFile(receipt: PaymentReceipt): void {
    this.files.request(this.bookingId(), receipt);
  }

  protected toggleManual(): void {
    if (this.manualOpen()) {
      this.manualOpen.set(false);
      return;
    }
    this.openManual();
  }

  /** Abre el marcado a mano y lleva el foco a su primera opción disponible. */
  protected openManual(): void {
    this.manualOpen.set(true);
    this.afterRender(() => {
      const panel = this.query(`#${this.manualPanelId}`);
      this.scrollIntoView(panel);
      panel?.querySelector<HTMLElement>('button:not([disabled])')?.focus();
    });
  }

  protected async markManually(change: NewPaymentState): Promise<void> {
    await this.review.markManually(change);
  }

  /* -- foco ----------------------------------------------------------------- */

  private focusRow(receiptId: string): void {
    this.focusInRow(receiptId, '[data-testid="payment-receipt-amount"]');
  }

  private focusInRow(receiptId: string, selector: string): void {
    this.afterRender(() =>
      this.query(`[data-receipt-id="${receiptId}"] ${selector}`)?.focus(),
    );
  }

  private afterRender(task: () => void): void {
    afterNextRender(task, { injector: this.injector });
  }

  private query(selector: string): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>(selector);
  }

  /** jsdom no implementa `scrollIntoView`: sin él no hay nada que mover. */
  private scrollIntoView(element: HTMLElement | null): void {
    if (element !== null && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'nearest' });
    }
  }
}
