/** Tipos de la vista para `quotations` (FT-24). Se mapean desde los DTOs, no son ellos. */

/**
 * Cada cuánto vence una cuota. Es sólo el **punto de partida** del cronograma:
 * cada fecha se puede mover después, una por una.
 */
export const PAYMENT_FREQUENCIES = ['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const;
export type PaymentFrequency = (typeof PAYMENT_FREQUENCIES)[number];

/**
 * Una cuota del plan de pagos. **Sin interés**: una fecha y un monto, nada más
 * —el mismo par que guarda `payments.installment_schedules` (`due_date`,
 * `amount`)—. Los montos no tienen por qué ser iguales: el plan es flexible.
 */
export interface Installment {
  readonly installmentNumber: number;
  /** ISO `YYYY-MM-DD`. */
  readonly dueDate: string;
  readonly amount: number;
}

/**
 * Alta de una cotización (FT-24).
 *
 * `appointmentId` es opcional a propósito: cotizar no exige tener una cita
 * agendada, y el formulario lo deja vacío cuando no hay una elegida.
 */
export interface NewQuotation {
  readonly practiceId: string;
  readonly patientProfileId: string;
  /** ISO `YYYY-MM-DD`. */
  readonly attentionDate: string;
  readonly appointmentId?: string;
  readonly serviceCatalogId: string;
  readonly offeredPrice: number;
  readonly currencyConceptId?: string;
  readonly paymentPlanInstallmentCount: number;
  /** Lo que se paga el día de la atención, antes de la primera cuota. Cero si no hay. */
  readonly downPaymentAmount: number;
  readonly paymentFrequency: PaymentFrequency;
  /**
   * El cronograma tal como quedó en pantalla, con los cambios a mano. Anticipo
   * más cuotas suman exactamente `offeredPrice`: el formulario no deja guardar
   * otra cosa.
   */
  readonly installments: readonly Installment[];
  /** ISO `YYYY-MM-DD`. */
  readonly validUntil: string;
}

/**
 * El estado de una cotización, tal como lo declare el backend.
 *
 * Se deja como texto abierto y no como unión cerrada: el contrato de FT-24
 * todavía se está terminando del lado de la API, y una unión cerrada acá
 * rompería en cuanto el backend agregue un estado que este cliente no
 * anticipó. Quien lo muestre lo hace con lo que llegue, sin comparar contra
 * una lista propia.
 */
export type QuotationStatus = string;

/**
 * La cotización ya guardada.
 *
 * `serviceNameSnapshot` es el nombre del servicio **congelado al crearla**: si
 * el catálogo cambia el nombre después, esta cotización sigue mostrando el que
 * tenía cuando se ofreció, que es lo que de verdad se le mostró a la persona.
 */
export interface Quotation extends NewQuotation {
  readonly id: string;
  readonly serviceNameSnapshot: string;
  readonly status: QuotationStatus;
}

/**
 * Fila del listado por paciente (resumen): lo justo para decidir cuál abrir,
 * sin el detalle de cuotas de {@link Quotation}.
 */
export interface QuotationListItem {
  readonly id: string;
  readonly patientProfileId: string;
  readonly serviceNameSnapshot: string;
  readonly offeredPrice: number;
  readonly status: QuotationStatus;
  /** ISO `YYYY-MM-DD`. */
  readonly attentionDate: string;
  /** ISO `YYYY-MM-DD`. */
  readonly validUntil: string;
}
