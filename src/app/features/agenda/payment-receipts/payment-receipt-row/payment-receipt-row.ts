import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import {
  describeReceipt,
  formatReceiptAmount,
  isPdfReceipt,
  PAYMENT_RECEIPT_STATUS_LABELS,
  PAYMENT_RECEIPT_STATUS_VARIANTS,
} from '../../../../core/data-access/scheduling/payment-receipt-format';
import type { PaymentReceipt } from '../../../../core/data-access/scheduling/payment-receipts.types';
import type { PaymentStateInfo } from '../../../../core/data-access/scheduling/scheduling.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { previewUrlOf, type ReceiptFileState } from '../receipt-files';

/**
 * Un comprobante de pago en la lista del modal: miniatura, lo que el paciente
 * declaró, quién lo subió, cómo quedó y —si espera revisión— las dos
 * acciones.
 *
 * Presentacional: no pide nada ni decide nada. Emite lo que se tocó y el modal
 * resuelve.
 *
 * ## Las acciones dicen sobre qué comprobante actúan
 *
 * «Confirmar» repetido en tres filas es tres botones con el mismo nombre para
 * quien usa lector de pantalla. Cada uno lleva el monto y el día —«Confirmar
 * comprobante de 150,00 Bs del 27/10»—, que es lo que los distingue.
 *
 * ## Con la cita pagada ya no se confirma
 *
 * Confirmar un comprobante es dar la cita por pagada; si ya lo está, otro
 * confirmado no cobra nada y se leería como un segundo pago. «Rechazar» sí
 * sigue: decirle al paciente que esa prueba no sirve no toca el pago, y la API
 * lo admite con la cita pagada.
 */
@Component({
  selector: 'app-payment-receipt-row',
  imports: [AppButton, Badge, DatePipe, Skeleton],
  templateUrl: './payment-receipt-row.html',
  styleUrl: './payment-receipt-row.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'payment-receipt-row',
    '[attr.data-status]': 'receipt().status',
    '[attr.data-receipt-id]': 'receipt().id',
  },
})
export class PaymentReceiptRow {
  readonly receipt = input.required<PaymentReceipt>();

  /** El archivo, para la miniatura de una imagen. Un PDF no la pide. */
  readonly file = input<ReceiptFileState | undefined>(undefined);

  /** Si se ofrecen «Confirmar» y «Rechazar»; el modal lo apaga mientras se escribe el motivo. */
  readonly reviewable = input(true);

  /** Hay una operación en vuelo en el modal: ninguna acción sale hasta que termine. */
  readonly disabled = input(false);

  /** Esta fila es la que se está confirmando: su botón muestra la espera. */
  readonly confirming = input(false);

  /** El estado de pago actual de la cita; `null` si nadie lo marcó. */
  readonly paymentState = input<PaymentStateInfo | null>(null);

  readonly viewRequested = output<void>();
  readonly confirmRequested = output<void>();
  readonly rejectRequested = output<void>();

  protected readonly isPdf = computed(() => isPdfReceipt(this.receipt()));
  protected readonly amount = computed(() => formatReceiptAmount(this.receipt().amount));
  protected readonly summary = computed(() => describeReceipt(this.receipt()));
  protected readonly statusLabel = computed(() => PAYMENT_RECEIPT_STATUS_LABELS[this.receipt().status]);
  protected readonly statusVariant = computed(
    () => PAYMENT_RECEIPT_STATUS_VARIANTS[this.receipt().status],
  );

  /** Sólo lo pendiente se revisa: confirmado y rechazado son finales. */
  protected readonly showActions = computed(
    () => this.reviewable() && this.receipt().status === 'PENDING',
  );

  /** Ver el encabezado: con la cita pagada, sólo queda rechazar. */
  protected readonly canConfirm = computed(() => this.paymentState()?.state !== 'PAID');

  protected readonly thumbnailUrl = computed(() => previewUrlOf(this.file()));

  protected readonly thumbnailFailed = computed(() => this.file()?.status === 'failed');

  /** Bajó, pero no es un formato que se muestre: va el ícono de archivo. */
  protected readonly downloadOnly = computed(
    () => this.file()?.status === 'ready' && this.thumbnailUrl() === null,
  );
}
