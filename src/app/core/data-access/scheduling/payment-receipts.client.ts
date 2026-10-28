import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { sinNulos } from '../wire';
import type {
  NewPaymentReceipt,
  PaymentReceipt,
  PaymentReceiptActor,
  PaymentReceiptConfirmed,
  PaymentReceiptStatus,
} from './payment-receipt.types';
import type { PaymentStateInfo } from './scheduling.types';

/**
 * Cliente de los **comprobantes de pago** de una cita (v4.2.64).
 *
 * El paciente sube lo que pagó y el prestador lo revisa. Confirmar deja la
 * cita pagada en la misma transacción; rechazar no toca el pago. Quién puede
 * cada cosa lo decide la API —404 para quien no es de la cita—, no estos
 * métodos.
 *
 * Vive aparte de `SchedulingClient` porque es un recurso propio de la cita,
 * con su ciclo, y aquél ya pasó de largo su tamaño razonable.
 */
@Injectable({
  providedIn: 'root',
})
export class PaymentReceiptsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `POST /scheduling/bookings/:id/payment-receipts` — el paciente adjunta el
   * comprobante de un archivo que ya subió él mismo.
   *
   * 422 si el archivo no sirve (otro formato, más de 5 MB, no es suyo) o la cita
   * está cancelada; 409 si la cita ya está pagada.
   *
   * El cuerpo se arma campo a campo: un opcional en `undefined` viaja como
   * clave declarada y el backend lo rechaza (`forbidNonWhitelisted`).
   */
  upload(bookingId: string, body: NewPaymentReceipt): Observable<PaymentReceipt> {
    return this.http
      .post<WirePaymentReceipt>(this.url(bookingId), {
        fileId: body.fileId,
        ...(body.amount === undefined ? {} : { amount: body.amount }),
        ...(body.paidAt === undefined ? {} : { paidAt: body.paidAt.toISOString() }),
        ...(body.note === undefined ? {} : { note: body.note }),
      })
      .pipe(map(toPaymentReceipt));
  }

  /** `GET /scheduling/bookings/:id/payment-receipts` — del más reciente al más viejo. */
  list(bookingId: string): Observable<readonly PaymentReceipt[]> {
    return this.http
      .get<readonly WirePaymentReceipt[]>(this.url(bookingId))
      .pipe(map((items) => items.map(toPaymentReceipt)));
  }

  /**
   * `GET …/payment-receipts/:receiptId/content` — los bytes del comprobante.
   *
   * Por la ruta de la cita y no por `common/files/:id/content`: ésa sólo le da
   * el archivo a quien lo subió, y quien tiene que mirarlo es el médico.
   */
  content(bookingId: string, receiptId: string): Observable<Blob> {
    return this.http.get(this.url(bookingId, receiptId, 'content'), { responseType: 'blob' });
  }

  /**
   * `POST …/payment-receipts/:receiptId/confirm` — el comprobante vale y la cita
   * queda pagada. Volver a confirmarlo devuelve lo mismo sin escribir.
   *
   * 409 si ya se rechazó; 422 si la cita está cancelada.
   */
  confirm(bookingId: string, receiptId: string): Observable<PaymentReceiptConfirmed> {
    return this.http
      .post<WirePaymentReceiptConfirmed>(this.url(bookingId, receiptId, 'confirm'), {})
      .pipe(
        map(({ receipt, paymentState }) => ({
          receipt: toPaymentReceipt(receipt),
          paymentState: { ...paymentState, markedAt: new Date(paymentState.markedAt) },
        })),
      );
  }

  /**
   * `POST …/payment-receipts/:receiptId/reject` — con su motivo, que el paciente
   * lee en el aviso. No cambia el estado de pago. 409 si ya se confirmó.
   */
  reject(bookingId: string, receiptId: string, reason: string): Observable<PaymentReceipt> {
    return this.http
      .post<WirePaymentReceipt>(this.url(bookingId, receiptId, 'reject'), { reason })
      .pipe(map(toPaymentReceipt));
  }

  private url(bookingId: string, receiptId?: string, accion?: string): string {
    const base = `/scheduling/bookings/${encodeURIComponent(bookingId)}/payment-receipts`;
    const resto =
      receiptId === undefined ? '' : `/${encodeURIComponent(receiptId)}/${accion ?? ''}`;
    return apiUrl(this.baseUrl, `${base}${resto}`);
  }
}

/* ============================================================================
    La forma del transporte: fechas en texto, opcionales que llegan en `null`.
    Ver `wire.ts` para el porqué de normalizarlos en la frontera.
    ========================================================================== */

interface WirePaymentReceipt {
  readonly id: string;
  readonly bookingId: string;
  readonly fileId: string;
  readonly mimeType: string;
  readonly originalName: string | null;
  readonly amount: string | null;
  readonly paidAt: string | null;
  readonly note: string | null;
  readonly uploadedAt: string;
  readonly uploadedBy: PaymentReceiptActor;
  readonly status: PaymentReceiptStatus;
  readonly reviewedAt: string | null;
  readonly reviewedBy: PaymentReceiptActor | null;
  readonly rejectionReason: string | null;
}

interface WirePaymentReceiptConfirmed {
  readonly receipt: WirePaymentReceipt;
  readonly paymentState: Omit<PaymentStateInfo, 'markedAt'> & { readonly markedAt: string };
}

/** Los `null` del contrato se vuelven claves ausentes, y las fechas, `Date`. */
function toPaymentReceipt(wire: WirePaymentReceipt): PaymentReceipt {
  const { paidAt, uploadedAt, reviewedAt, ...resto } = wire;
  return {
    ...sinNulos(resto),
    uploadedAt: new Date(uploadedAt),
    ...(paidAt === null ? {} : { paidAt: new Date(paidAt) }),
    ...(reviewedAt === null ? {} : { reviewedAt: new Date(reviewedAt) }),
  } as PaymentReceipt;
}
