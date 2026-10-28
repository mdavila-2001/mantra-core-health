import { errorToViewState } from '../../http/error-to-view-state';
import { withDisplayCurrency } from '../../money/display-currency';
import type { PaymentReceipt, PaymentReceiptStatus } from './payment-receipts.types';

/* ============================================================================
    Cómo se dice un comprobante de pago en pantalla.

    Lo comparten el modal de quien atiende (agenda) y el bloque del paciente
    («Mis citas»): los dos nombran el mismo comprobante, y dos redacciones de
    lo mismo terminan diciendo cosas distintas. Vive acá, junto al contrato,
    y no en una de las dos pantallas: ninguna es dueña de la otra.
    ========================================================================== */

/**
 * El tono de la insignia de una revisión.
 *
 * Literal y no el `BadgeVariant` de `shared/`: `core/` no importa de `shared/`
 * (`check-architecture`). Los tres son tonos de `Tone`, así que la insignia
 * los acepta tal cual.
 */
export type PaymentReceiptStatusTone = 'warning' | 'success' | 'error';

/**
 * La palabra de cada revisión.
 *
 * La API publica claves estables (`PENDING`, `CONFIRMED`, `REJECTED`) y no
 * una etiqueta, a diferencia del estado de pago de la cita: la palabra se
 * pone acá, una vez.
 */
export const PAYMENT_RECEIPT_STATUS_LABELS: Readonly<Record<PaymentReceiptStatus, string>> = {
  PENDING: 'Pendiente',
  CONFIRMED: 'Confirmado',
  REJECTED: 'Rechazado',
};

/** El tono de la insignia de cada revisión. */
export const PAYMENT_RECEIPT_STATUS_VARIANTS: Readonly<
  Record<PaymentReceiptStatus, PaymentReceiptStatusTone>
> = {
  PENDING: 'warning',
  CONFIRMED: 'success',
  REJECTED: 'error',
};

const PDF_MIME_TYPE = 'application/pdf';

/** La extensión de reserva de cada formato, para nombrar la descarga. */
const EXTENSION_BY_MIME_TYPE: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  [PDF_MIME_TYPE]: 'pdf',
};

export function isPdfReceipt(receipt: Pick<PaymentReceipt, 'mimeType'>): boolean {
  return receipt.mimeType === PDF_MIME_TYPE;
}

/**
 * El monto como se lee en Bolivia: «150,00 Bs».
 *
 * No pasa por `Number`: el monto es dinero y llega como texto exacto. Se
 * cambia el punto por la coma y se completan los dos decimales, nada más.
 *
 * @returns `null` si el paciente no declaró monto.
 */
export function formatReceiptAmount(amount: string | null): string | null {
  if (amount === null || amount.trim() === '') return null;
  const [integer = '0', fraction = ''] = amount.trim().split('.');
  return withDisplayCurrency(`${integer},${fraction.padEnd(2, '0').slice(0, 2)}`);
}

/** «27/10»: día y mes en hora local, sin depender del idioma registrado. */
export function formatDayMonth(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

/**
 * El comprobante en pocas palabras, para el nombre accesible de sus acciones:
 * «comprobante de 150,00 Bs del 27/10».
 *
 * La fecha es la del pago si el paciente la dijo, y si no la de la subida:
 * siempre hay una, y es la que distingue dos comprobantes del mismo monto.
 */
export function describeReceipt(receipt: Pick<PaymentReceipt, 'amount' | 'paidAt' | 'uploadedAt'>): string {
  const amount = formatReceiptAmount(receipt.amount);
  const day = formatDayMonth(receipt.paidAt ?? receipt.uploadedAt);
  return amount === null ? `comprobante del ${day}` : `comprobante de ${amount} del ${day}`;
}

/** El nombre con que se descarga: el original, o uno armado con su formato. */
export function receiptFileName(receipt: Pick<PaymentReceipt, 'originalName' | 'mimeType'>): string {
  if (receipt.originalName !== null && receipt.originalName.trim() !== '') {
    return receipt.originalName;
  }
  return `comprobante-de-pago.${EXTENSION_BY_MIME_TYPE[receipt.mimeType] ?? 'bin'}`;
}

/**
 * El motivo de un fallo sin explicación propia, en palabras de la API cuando
 * las hay. Un error inesperado (S9) lleva el código de la petición: es lo que
 * busca soporte.
 */
export function describeFailure(error: unknown): string {
  const state = errorToViewState<null>(error);
  switch (state.status) {
    case 'offline':
      return 'No hay conexión. Revise su conexión e intente de nuevo.';
    case 'validation':
      return state.issues.map((issue) => issue.message).join(' ');
    case 'forbidden':
      return state.message ?? 'Intente de nuevo en unos segundos.';
    case 'error':
      return `${state.message ?? 'Intente de nuevo en unos segundos.'} Código de soporte: ${state.requestId}.`;
    default:
      return 'Intente de nuevo en unos segundos.';
  }
}
