import type { PaymentStateInfo } from './scheduling.types';

/* ============================================================================
    Comprobantes de pago de una cita: el paciente sube la prueba de lo que pagó
    y quien atiende la revisa.

    Copia del contrato publicado por la API en
    `scheduling/presentation/dto/scheduling-bookings.dto.ts`
    (`PaymentReceiptDto`, `UploadPaymentReceiptDto`, `RejectPaymentReceiptDto`,
    `ConfirmPaymentReceiptResponseDto`) y de los límites de
    `scheduling/domain/booking/payment-receipt.ts`. Los nombres, los tipos y
    los topes son los de allá: si cambian, se cambian en los dos lados.
    ========================================================================== */

/**
 * Cómo quedó la revisión de un comprobante (`PAYMENT_RECEIPT_STATUSES`).
 *
 * Viajan como **claves estables** y no como uuid de concepto porque así las
 * publica la API —igual que `PaymentStateCode`—: el servidor traduce a su
 * concepto y el cliente no necesita conocerlo.
 */
export type PaymentReceiptStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

/** Los formatos que acepta un comprobante (`PAYMENT_RECEIPT_MIME_TYPES`). */
export const PAYMENT_RECEIPT_MIME_TYPES: readonly string[] = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
];

/** El tope de un comprobante: 5 MB (`PAYMENT_RECEIPT_MAX_BYTES`). */
export const PAYMENT_RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

/** Largo mínimo del motivo de rechazo (`MIN_RECEIPT_REJECTION_LENGTH`). */
export const PAYMENT_RECEIPT_REJECTION_MIN_LENGTH = 3;

/** Largo máximo del motivo de rechazo y de la nota (`MAX_RECEIPT_TEXT_LENGTH`). */
export const PAYMENT_RECEIPT_TEXT_MAX_LENGTH = 500;

/**
 * El monto como lo valida la API: hasta diez enteros y dos decimales, con
 * punto. Es dinero y viaja como texto: un `number` no guarda «150.10» sin
 * redondeo.
 */
export const PAYMENT_RECEIPT_AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;

/** Quién hizo algo con un comprobante, con su nombre para mostrar. */
export interface PaymentReceiptActor {
  readonly userId: string;
  readonly displayName: string;
}

/**
 * Un comprobante de pago tal como se lee, con los instantes ya convertidos.
 *
 * Los opcionales del contrato llegan **siempre**, como `null`: se conservan
 * así porque la API los declara presentes y nulos, no ausentes.
 */
export interface PaymentReceipt {
  readonly id: string;
  readonly bookingId: string;
  readonly fileId: string;
  /** `image/png` · `image/jpeg` · `image/webp` · `application/pdf`. */
  readonly mimeType: string;
  readonly originalName: string | null;
  /** Decimal como texto: `"150.00"`. Lo que el paciente dice que pagó. */
  readonly amount: string | null;
  /** Cuándo dice el paciente que pagó. */
  readonly paidAt: Date | null;
  readonly note: string | null;
  readonly uploadedAt: Date;
  readonly uploadedBy: PaymentReceiptActor;
  readonly status: PaymentReceiptStatus;
  readonly reviewedAt: Date | null;
  readonly reviewedBy: PaymentReceiptActor | null;
  readonly rejectionReason: string | null;
}

/**
 * Cuerpo de `POST /scheduling/bookings/:id/payment-receipts`.
 *
 * Solo `fileId` es obligatorio. Los opcionales se **omiten** cuando no hay
 * valor: la API valida con `forbidNonWhitelisted` y una clave en `undefined`
 * no viaja, pero una en `null` sí y la rechaza.
 */
export interface NewPaymentReceipt {
  /** El archivo ya subido a `common/files` por el propio paciente. */
  readonly fileId: string;
  /** Decimal con punto y hasta dos decimales ({@link PAYMENT_RECEIPT_AMOUNT_PATTERN}). */
  readonly amount?: string;
  readonly paidAt?: Date;
  readonly note?: string;
}

/** Cuerpo de `POST …/payment-receipts/:receiptId/reject`. */
export interface PaymentReceiptRejection {
  /** De 3 a 500 caracteres. El paciente lo lee para saber qué volver a subir. */
  readonly reason: string;
}

/**
 * Respuesta de confirmar: el comprobante y el pago de la cita, que en la misma
 * transacción quedó `PAID`.
 */
export interface PaymentReceiptConfirmation {
  readonly receipt: PaymentReceipt;
  readonly paymentState: PaymentStateInfo;
}
