import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { PaymentStateInfo } from './scheduling.types';
import type {
  NewPaymentReceipt,
  PaymentReceipt,
  PaymentReceiptConfirmation,
  PaymentReceiptRejection,
} from './payment-receipts.types';

/**
 * Cliente de los comprobantes de pago de una cita
 * (`scheduling-bookings.controller.ts`, rutas `:id/payment-receipts`).
 *
 * ## Quién usa cada método
 *
 * - El paciente **sube** (`upload`) y **lee** (`list`, `content`) los de su
 *   cita. Subir es de dos pasos: primero el archivo por `FilesClient.upload`,
 *   después esto con el `fileId` que devolvió.
 * - Quien atiende **lee**, **confirma** y **rechaza**. Confirmar uno deja la
 *   cita pagada en la misma transacción y devuelve el `paymentState` nuevo, que
 *   es lo que la agenda pinta sin volver a pedir la cita.
 *
 * ## Por qué el contenido pasa por acá y no por `FilesClient`
 *
 * `GET /common/files/:id/content` sólo se lo da a quien subió el archivo, y
 * quien tiene que mirar un comprobante es el médico. La ruta de la cita lo
 * autoriza por la cita, no por el archivo.
 *
 * ## Los errores que importan
 *
 * Se ramifican por `code` del cuerpo (`readApiError`), nunca por el mensaje:
 * `CONFLICT` (409) es «ya se revisó en el otro sentido» o «la cita ya está
 * pagada»; `PRECONDITION_FAILED` (422) es «la cita está cancelada» o «el
 * archivo no sirve»; `NOT_FOUND` (404) es «no es suya o no existe», sin decir
 * cuál.
 */
@Injectable({
  providedIn: 'root',
})
export class PaymentReceiptsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET …/payment-receipts` — del más reciente al más viejo.
   *
   * El orden lo pone el cliente, por `uploadedAt`, y no se confía en el de la
   * respuesta: las dos pantallas lo prometen, y quien revisa lee primero lo
   * último que subió el paciente.
   */
  list(bookingId: string): Observable<readonly PaymentReceipt[]> {
    return this.http
      .get<readonly WirePaymentReceipt[]>(this.receiptsUrl(bookingId))
      .pipe(map((items) => items.map(toPaymentReceipt).sort(newestFirst)));
  }

  /**
   * `POST …/payment-receipts` — el paciente adjunta un archivo propio.
   *
   * Los opcionales se mandan sólo si tienen valor (ver {@link NewPaymentReceipt}).
   */
  upload(bookingId: string, receipt: NewPaymentReceipt): Observable<PaymentReceipt> {
    return this.http
      .post<WirePaymentReceipt>(this.receiptsUrl(bookingId), toUploadBody(receipt))
      .pipe(map(toPaymentReceipt));
  }

  /** `POST …/:receiptId/confirm` — la cita queda pagada. Idempotente en el servidor. */
  confirm(bookingId: string, receiptId: string): Observable<PaymentReceiptConfirmation> {
    return this.http
      .post<WireConfirmation>(`${this.receiptUrl(bookingId, receiptId)}/confirm`, {})
      .pipe(
        map(({ receipt, paymentState }) => ({
          receipt: toPaymentReceipt(receipt),
          paymentState: { ...paymentState, markedAt: new Date(paymentState.markedAt) },
        })),
      );
  }

  /** `POST …/:receiptId/reject` — guarda el motivo. No cambia el estado de pago. */
  reject(
    bookingId: string,
    receiptId: string,
    rejection: PaymentReceiptRejection,
  ): Observable<PaymentReceipt> {
    return this.http
      .post<WirePaymentReceipt>(`${this.receiptUrl(bookingId, receiptId)}/reject`, {
        reason: rejection.reason,
      })
      .pipe(map(toPaymentReceipt));
  }

  /**
   * `GET …/:receiptId/content` — los bytes del archivo, con su tipo real.
   *
   * Por `HttpClient` y no como `src` de un `<img>`: la ruta exige
   * `Authorization`, y un `<img>` no manda cabeceras.
   */
  content(bookingId: string, receiptId: string): Observable<Blob> {
    return this.http.get(`${this.receiptUrl(bookingId, receiptId)}/content`, {
      responseType: 'blob',
    });
  }

  private receiptsUrl(bookingId: string): string {
    return apiUrl(
      this.baseUrl,
      `/scheduling/bookings/${encodeURIComponent(bookingId)}/payment-receipts`,
    );
  }

  private receiptUrl(bookingId: string, receiptId: string): string {
    return `${this.receiptsUrl(bookingId)}/${encodeURIComponent(receiptId)}`;
  }
}

/* ============================================================================
    La forma del transporte: los instantes en texto ISO.
    ========================================================================== */

type WirePaymentReceipt = Omit<PaymentReceipt, 'paidAt' | 'uploadedAt' | 'reviewedAt'> & {
  readonly paidAt: string | null;
  readonly uploadedAt: string;
  readonly reviewedAt: string | null;
};

interface WireConfirmation {
  readonly receipt: WirePaymentReceipt;
  readonly paymentState: Omit<PaymentStateInfo, 'markedAt'> & { readonly markedAt: string };
}

function toPaymentReceipt({
  paidAt,
  uploadedAt,
  reviewedAt,
  ...rest
}: WirePaymentReceipt): PaymentReceipt {
  return {
    ...rest,
    paidAt: paidAt === null ? null : new Date(paidAt),
    uploadedAt: new Date(uploadedAt),
    reviewedAt: reviewedAt === null ? null : new Date(reviewedAt),
  };
}

function newestFirst(a: PaymentReceipt, b: PaymentReceipt): number {
  return b.uploadedAt.getTime() - a.uploadedAt.getTime();
}

/** El cuerpo de la subida, clave a clave: lo ausente no viaja. */
function toUploadBody(receipt: NewPaymentReceipt): Record<string, string> {
  return {
    fileId: receipt.fileId,
    ...(receipt.amount === undefined ? {} : { amount: receipt.amount }),
    ...(receipt.paidAt === undefined ? {} : { paidAt: receipt.paidAt.toISOString() }),
    ...(receipt.note === undefined ? {} : { note: receipt.note }),
  };
}
