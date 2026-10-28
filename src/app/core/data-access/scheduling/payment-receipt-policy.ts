/**
 * Lo que la API acepta como comprobante de pago (v4.2.64).
 *
 * Es **la misma regla** que aplica el servidor (`PAYMENT_RECEIPT_MIME_TYPES`,
 * `PAYMENT_RECEIPT_MAX_BYTES` y los topes del DTO): repetirla acá sólo sirve
 * para avisar antes de subir. Si un día difieren, manda el 422 del servidor.
 *
 * Más estrecha que `UPLOAD_ACCEPT`: sin GIF, y con 5 MB y no 10.
 */
export const PAYMENT_RECEIPT_ACCEPT = 'image/png,image/jpeg,image/webp,application/pdf';

/** Cómo se dicen esos formatos en una pantalla. */
export const PAYMENT_RECEIPT_ACCEPT_LABEL = 'JPG, PNG, WEBP o PDF';

export const PAYMENT_RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

/** El motivo del rechazo: sin él, el paciente no sabe qué volver a subir. */
export const MIN_RECEIPT_REJECTION_LENGTH = 3;

/** Tope de la nota del paciente y del motivo del rechazo. */
export const MAX_RECEIPT_TEXT_LENGTH = 500;

/** El monto como lo valida la API: hasta diez enteros y dos decimales. */
export const RECEIPT_AMOUNT_PATTERN = /^\d{1,10}(\.\d{1,2})?$/;
