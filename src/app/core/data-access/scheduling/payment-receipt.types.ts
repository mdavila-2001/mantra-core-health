import type { PaymentStateInfo } from './scheduling.types';

/**
 * En qué quedó un comprobante de pago (v4.2.64).
 *
 * `PENDING` hasta que el prestador lo mira. Confirmar uno deja la cita pagada;
 * rechazarlo no toca el pago y el paciente puede subir otro.
 */
export type PaymentReceiptStatus = 'PENDING' | 'CONFIRMED' | 'REJECTED';

/** Quién hizo algo con un comprobante, con el nombre que se muestra. */
export interface PaymentReceiptActor {
  readonly userId: string;
  readonly displayName: string;
}

/**
 * Un comprobante de pago de una cita, tal como lo lee la pantalla.
 *
 * El archivo **no viaja acá**: se baja aparte por la ruta de la cita
 * (`content`), porque quien lo revisa es el médico y `common/files` sólo se lo
 * daría a quien lo subió.
 */
export interface PaymentReceipt {
  readonly id: string;
  readonly bookingId: string;
  readonly fileId: string;
  readonly mimeType: string;
  readonly originalName?: string;
  /** Decimal como texto, tal como lo declaró el paciente: `"150.00"`. */
  readonly amount?: string;
  readonly paidAt?: Date;
  readonly note?: string;
  readonly uploadedAt: Date;
  readonly uploadedBy: PaymentReceiptActor;
  readonly status: PaymentReceiptStatus;
  readonly reviewedAt?: Date;
  readonly reviewedBy?: PaymentReceiptActor;
  readonly rejectionReason?: string;
}

/**
 * Cuerpo de `POST /scheduling/bookings/:id/payment-receipts`.
 *
 * `fileId` es un archivo que el **propio paciente** subió a `common/files`;
 * uno ajeno responde 422. Lo demás es lo que él declara, y es opcional.
 */
export interface NewPaymentReceipt {
  readonly fileId: string;
  readonly amount?: string;
  readonly paidAt?: Date;
  readonly note?: string;
}

/** Respuesta de confirmar: el comprobante y cómo quedó el pago de la cita. */
export interface PaymentReceiptConfirmed {
  readonly receipt: PaymentReceipt;
  readonly paymentState: PaymentStateInfo;
}
