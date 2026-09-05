/** Tipos de la vista para `quotations` (FT-24). Se mapean desde los DTOs, no son ellos. */

/** Los dos métodos de cálculo de interés que ofrece el simulador. */
export const INTEREST_CALCULATION_METHODS = ['FLAT', 'FRENCH'] as const;
export type InterestCalculationMethod = (typeof INTEREST_CALCULATION_METHODS)[number];

/**
 * Lo que se manda a simular: los mismos parámetros que el formulario ajusta en
 * vivo, sin guardar nada todavía.
 *
 * Las fechas viajan como `YYYY-MM-DD`: es el contrato asumido del backend
 * (FT-24, en desarrollo en paralelo) y evita la conversión de huso horario que
 * un `Date` completo arrastraría para un dato que sólo importa por día.
 */
export interface SimulatePaymentPlanRequest {
  readonly offeredPrice: number;
  readonly installmentCount: number;
  readonly interestRatePercent: number;
  readonly interestCalculationMethod: InterestCalculationMethod;
  /** ISO `YYYY-MM-DD`. */
  readonly attentionDate: string;
}

/** Una cuota del plan de pagos, simulada o ya guardada. */
export interface Installment {
  readonly installmentNumber: number;
  /** ISO `YYYY-MM-DD`. */
  readonly dueDate: string;
  readonly principalAmount: number;
  readonly interestAmount: number;
  readonly totalAmount: number;
}

/** La respuesta del simulador: sólo el plan, nada persiste todavía. */
export interface SimulatePaymentPlanResponse {
  readonly installments: readonly Installment[];
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
  readonly interestRatePercent: number;
  readonly interestCalculationMethod: InterestCalculationMethod;
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
  readonly installments: readonly Installment[];
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
