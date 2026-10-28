import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { switchMap } from 'rxjs';

import { FilesClient } from '../../../../core/data-access/files/files.client';
import { categoryForFile } from '../../../../core/data-access/files/upload-policy';
import {
  describeFailure,
  formatReceiptAmount,
  PAYMENT_RECEIPT_STATUS_LABELS,
  PAYMENT_RECEIPT_STATUS_VARIANTS,
} from '../../../../core/data-access/scheduling/payment-receipt-format';
import { PaymentReceiptsClient } from '../../../../core/data-access/scheduling/payment-receipts.client';
import {
  PAYMENT_RECEIPT_AMOUNT_PATTERN,
  PAYMENT_RECEIPT_MAX_BYTES,
  PAYMENT_RECEIPT_MIME_TYPES,
  PAYMENT_RECEIPT_TEXT_MAX_LENGTH,
  type NewPaymentReceipt,
  type PaymentReceipt,
} from '../../../../core/data-access/scheduling/payment-receipts.types';
import { SchedulingClient } from '../../../../core/data-access/scheduling/scheduling.client';
import type { PaymentStateInfo } from '../../../../core/data-access/scheduling/scheduling.types';
import { readApiError } from '../../../../core/http/api-error';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Input } from '../../../../shared/components/atoms/input/input';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Textarea } from '../../../../shared/components/atoms/textarea/textarea';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import type { AlertTone } from '../../../../shared/components/molecules/alert/alert.types';
import { FileInput } from '../../../../shared/components/molecules/file-input/file-input';
import { FormField } from '../../../../shared/components/molecules/form-field/form-field';
import { DatePicker } from '../../../../shared/components/organisms/date-picker/date-picker';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { nextControlId } from '../../../../shared/forms/form-control.context';
import { sufijoDeCodigo } from '../booking-status';

/**
 * Los estados en los que una cita no lleva pago (`STATES_WITHOUT_PAYMENT` de
 * la API, que responde 422 a un comprobante ahí). Es uno solo: rechazar una
 * solicitud no es un estado propio, la API la cancela con motivo. Por **sufijo
 * de código**, como el resto de esta pantalla; la garantía es el servidor,
 * esto es no ofrecer un botón que va a fallar.
 */
const CODES_WITHOUT_PAYMENT: ReadonlySet<string> = new Set(['BOOKING_CANCELLED']);

/** Por qué no se ofrece subir un comprobante, o `null` si se ofrece. */
type UploadBlocker = 'paid' | 'without-payment' | 'unknown-status';

interface UploadNotice {
  readonly tone: AlertTone;
  readonly title: string;
  readonly message: string;
}

/** La cita que el bloque muestra ahora. Cada carga es otra, aunque sea la misma cita. */
interface ShownBooking {
  readonly bookingId: string;
}

/**
 * «Comprobante de pago» en el detalle de una cita del paciente: subir la foto
 * o el PDF de lo que pagó y ver cómo quedó cada uno.
 *
 * ## Subir es de dos pasos
 *
 * Primero el archivo, por el camino de siempre (`FilesClient.upload`, con su
 * escaneo y su tipo real deducido de los bytes); después el comprobante, que
 * cuelga ese archivo de la cita. Si el segundo paso falla, el archivo queda
 * subido y sin usar: no se borra, porque borrarlo es otra petición que también
 * puede fallar, y un archivo huérfano no le muestra nada a nadie.
 *
 * ## Cuándo no se ofrece
 *
 * Con la cita pagada (409 de la API) o cancelada (422), el bloque lo dice en
 * vez de mostrar un formulario que va a volver con error. «Pagada» se sabe por
 * tres lados: el estado de pago de la cita, que el bloque lee él mismo al
 * abrirse (`GET /scheduling/bookings/:id`: la lista de citas puede ser de antes
 * de que el médico confirmara), un comprobante ya confirmado en la lista, o un
 * 409 al intentarlo.
 *
 * ## Otra cita es otro bloque
 *
 * La pantalla reutiliza este bloque y sólo le cambia `bookingId`. Cada carga
 * guarda **qué cita muestra** ({@link ShownBooking}) y toda respuesta —la
 * lista, el pago, una subida— se descarta si llega cuando ya se muestra otra:
 * lo de la cita A no puede caer en la B. La subida sale con la cita y los
 * datos del momento en que se envió, no con los de cuando termina el archivo.
 */
@Component({
  selector: 'app-booking-payment-receipts',
  imports: [
    Alert,
    AppButton,
    Badge,
    DatePicker,
    DatePipe,
    FileInput,
    FormField,
    Input,
    Skeleton,
    Textarea,
    ViewStateHost,
  ],
  templateUrl: './booking-payment-receipts.html',
  styleUrl: './booking-payment-receipts.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingPaymentReceipts {
  readonly bookingId = input.required<string>();
  /** El código de catálogo del estado de la cita; `''` mientras no se resolvió. */
  readonly statusCode = input('');

  private readonly receiptsClient = inject(PaymentReceiptsClient);
  private readonly filesClient = inject(FilesClient);
  private readonly scheduling = inject(SchedulingClient);

  protected readonly headingId = nextControlId('booking-payment-receipts');
  protected readonly accept = PAYMENT_RECEIPT_MIME_TYPES.join(',');
  protected readonly maxBytes = PAYMENT_RECEIPT_MAX_BYTES;
  protected readonly noteMaxLength = PAYMENT_RECEIPT_TEXT_MAX_LENGTH;
  /** Nadie paga en el futuro: la fecha del pago llega hasta hoy. */
  protected readonly today = new Date();
  protected readonly statusLabels = PAYMENT_RECEIPT_STATUS_LABELS;
  protected readonly statusVariants = PAYMENT_RECEIPT_STATUS_VARIANTS;

  protected readonly receipts = signal<ViewState<readonly PaymentReceipt[]>>(loading());
  protected readonly files = signal<readonly File[]>([]);
  protected readonly amount = signal('');
  protected readonly paidAt = signal<Date | null>(null);
  protected readonly note = signal('');
  protected readonly uploading = signal(false);
  protected readonly notice = signal<UploadNotice | null>(null);
  private readonly amountTouched = signal(false);
  /** El estado de pago de la cita; `undefined` mientras no llegó, `null` si nadie lo marcó. */
  private readonly paymentState = signal<PaymentStateInfo | null | undefined>(undefined);
  /** La API respondió 409 al subir: la cita está pagada aunque la lista de citas no lo sepa. */
  private readonly paidAccordingToApi = signal(false);
  private shown: ShownBooking = { bookingId: '' };

  /** Lo que ya subió, cuando la lista llegó. */
  protected readonly items = computed(() => {
    const state = this.receipts();
    return state.status === 'ready' ? state.data : null;
  });

  private readonly loaded = computed(() => this.items() ?? []);

  protected readonly blocker = computed<UploadBlocker | null>(() => {
    const code = this.statusCode();
    const payment = this.paymentState();
    if (
      this.paidAccordingToApi() ||
      payment?.state === 'PAID' ||
      this.loaded().some((receipt) => receipt.status === 'CONFIRMED')
    ) {
      return 'paid';
    }
    if (code === '' || payment === undefined) return 'unknown-status';
    return CODES_WITHOUT_PAYMENT.has(sufijoDeCodigo(code)) ? 'without-payment' : null;
  });

  /** El monto como lo espera la API: coma o punto, sin espacios, hasta dos decimales. */
  private readonly normalizedAmount = computed(() => this.amount().replace(/\s/g, '').replace(',', '.'));

  protected readonly amountProblem = computed(() => {
    const amount = this.normalizedAmount();
    if (amount === '' || PAYMENT_RECEIPT_AMOUNT_PATTERN.test(amount)) return null;
    return 'Escriba el monto en bolivianos, con hasta dos decimales: por ejemplo 150 o 150,50.';
  });

  protected readonly visibleAmountProblem = computed(() =>
    this.amountTouched() ? this.amountProblem() : null,
  );

  protected readonly canSubmit = computed(
    () => this.files().length === 1 && this.amountProblem() === null && !this.uploading(),
  );

  constructor() {
    // Otra cita elegida es otro bloque: la lista y el formulario empiezan de cero.
    effect(() => {
      const bookingId = this.bookingId();
      untracked(() => this.load(bookingId));
    });
  }

  protected amountOf(receipt: PaymentReceipt): string {
    return formatReceiptAmount(receipt.amount) ?? 'Sin monto declarado';
  }

  /** Reintentar la lista: la misma cita, sin tocar lo que se estaba escribiendo. */
  protected reload(): void {
    this.receipts.set(loading());
    this.requestReceipts(this.shown);
  }

  protected touchAmount(): void {
    this.amountTouched.set(true);
  }

  /** El envío nativo se frena: el comprobante sale en dos pasos, por la API. */
  protected submit(event: Event): void {
    event.preventDefault();
    this.amountTouched.set(true);
    const file = this.files()[0];
    if (file === undefined || !this.canSubmit()) return;

    const shown = this.shown;
    const details = this.receiptDetails();
    this.uploading.set(true);
    this.notice.set(null);
    this.filesClient
      .upload(file, categoryForFile(file), 'NORMAL')
      .pipe(switchMap(({ id }) => this.receiptsClient.upload(shown.bookingId, { fileId: id, ...details })))
      .subscribe({
        next: (receipt) => {
          if (!this.isShown(shown)) return;
          this.uploading.set(false);
          this.receipts.set(ready([receipt, ...this.loaded()]));
          this.resetForm();
          this.notice.set({
            tone: 'success',
            title: 'Comprobante enviado',
            message: 'Su médico lo va a revisar. Acá va a ver si lo confirma o si necesita otro.',
          });
        },
        error: (error: unknown) => {
          if (!this.isShown(shown)) return;
          this.uploading.set(false);
          this.notice.set(this.explain(error));
        },
      });
  }

  private load(bookingId: string): void {
    const shown: ShownBooking = { bookingId };
    this.shown = shown;
    this.receipts.set(loading());
    this.paymentState.set(undefined);
    this.notice.set(null);
    this.paidAccordingToApi.set(false);
    this.uploading.set(false);
    this.resetForm();
    this.requestReceipts(shown);
    this.requestPaymentState(shown);
  }

  private isShown(shown: ShownBooking): boolean {
    return shown === this.shown;
  }

  private requestReceipts(shown: ShownBooking): void {
    this.receiptsClient.list(shown.bookingId).subscribe({
      next: (items) => {
        if (!this.isShown(shown)) return;
        this.receipts.set(
          items.length === 0
            ? empty({ label: 'Suba su comprobante' }, 'Todavía no subió comprobantes para esta cita.')
            : ready(items),
        );
      },
      error: (error: unknown) => {
        if (this.isShown(shown)) this.receipts.set(errorToViewState(error));
      },
    });
  }

  private requestPaymentState(shown: ShownBooking): void {
    this.scheduling.getBooking(shown.bookingId).subscribe({
      next: (booking) => {
        if (this.isShown(shown)) this.paymentState.set(booking.paymentState ?? null);
      },
      // Sin la cita no se sabe si está pagada: se ofrece subir, y si ya lo
      // estaba la API responde 409 y el bloque lo explica (`explain`). El
      // fallo de la lista, en cambio, sí se muestra: es lo que se mira acá.
      error: () => {
        if (this.isShown(shown)) this.paymentState.set(null);
      },
    });
  }

  /** Lo que el paciente completó, sin el archivo: los opcionales sólo si se completaron. */
  private receiptDetails(): Omit<NewPaymentReceipt, 'fileId'> {
    const amount = this.normalizedAmount();
    const note = this.note().trim();
    const paidAt = this.paidAt();
    return {
      ...(amount === '' ? {} : { amount }),
      ...(paidAt === null ? {} : { paidAt }),
      ...(note === '' ? {} : { note }),
    };
  }

  private explain(error: unknown): UploadNotice {
    const code = error instanceof HttpErrorResponse ? readApiError(error)?.code : undefined;
    if (code === 'CONFLICT') {
      this.paidAccordingToApi.set(true);
      return {
        tone: 'info',
        title: 'La cita ya figura como pagada',
        message: 'Su médico ya registró el pago: no hace falta subir otro comprobante.',
      };
    }
    return { tone: 'error', title: 'No se pudo subir el comprobante', message: describeFailure(error) };
  }

  private resetForm(): void {
    this.files.set([]);
    this.amount.set('');
    this.paidAt.set(null);
    this.note.set('');
    this.amountTouched.set(false);
  }
}
