/**
 * El pago de la agenda visto desde facturación (FAC-01).
 *
 * La agenda es donde se registra el pago y facturación es su asiento: al
 * marcar un pago con monto, la API crea (una sola vez) la cuenta por cobrar de
 * la cita y le asigna lo recibido, en la misma transacción.
 */

/** Por qué un pago no llegó a facturación. */
export type BookingBillingReason = 'NO_PRACTICE' | 'NO_PRICE' | 'NO_AMOUNT';

/** Cómo quedó la facturación de la cita después de marcar el pago. */
export interface BookingBillingLink {
  readonly linked: boolean;
  readonly invoiceId: string | null;
  /** Lo que se le cobra por la cita, en Bs. */
  readonly amountBilled: number | null;
  /** Lo recibido hasta ahora, en Bs. */
  readonly amountPaid: number | null;
  readonly currencyCode: 'BOB' | null;
  /** `null` si se facturó. */
  readonly reason: BookingBillingReason | null;
}

/** Lo cobrado de una cita, cuando su pago ya está facturado. */
export interface PaymentAmounts {
  /** En Bs. Ausente si el pago no se facturó (se marcó sin monto). */
  readonly amountPaid?: number;
  readonly currencyCode?: 'BOB';
  /** Solo en la respuesta de marcar el pago o confirmar un comprobante. */
  readonly billing?: BookingBillingLink;
}

/** El monto que acompaña a una marca de pago. */
export interface PaymentAmountReceived {
  /**
   * Bs recibidos **en este pago**, mayor que 0 y con hasta dos decimales. Se
   * suma a lo que ya se había recibido; solo con «pagada» o «pago parcial».
   */
  readonly amountReceived?: number;
}

/** El precio de un turno: el de la consulta de la práctica. */
export interface SlotPricing {
  /** `null` si la práctica todavía no publicó un precio mayor que 0. */
  readonly price?: { readonly amount: number; readonly currencyCode: 'BOB' } | null;
}
