/**
 * Lo que la molécula de reparto de un cobro necesita pintar.
 *
 * Todos los importes llegan como cadenas decimales tal cual las devuelve el
 * servidor: la molécula no suma, no resta y no redondea nada (REQ-16-031: el
 * cálculo es el del servidor, no se recalcula en el front).
 */

/** Estado de la aprobación previa de una línea, tal como lo informa la cotización. */
export type ClaimQuoteAuthorizationStatus =
  | 'NOT_REQUIRED'
  | 'APPROVED'
  | 'MISSING'
  | 'PENDING'
  | 'DENIED'
  | 'EXPIRED'
  | 'MISMATCH'
  | 'AMOUNT_EXCEEDED';

/** Una línea del reparto, ya con su texto de servicio y su rótulo de autorización. */
export interface ClaimQuoteBreakdownLine {
  readonly key: string;
  readonly serviceLabel: string;
  readonly billedAmount: string;
  /** `null` si el plan no cubre el servicio: entonces no hay reparto que mostrar. */
  readonly coveragePercent: string | null;
  readonly copayAmount: string | null;
  readonly patientAmount: string | null;
  readonly insurerAmount: string | null;
  readonly covered: boolean;
  readonly authorizationStatus: ClaimQuoteAuthorizationStatus | null;
  readonly authorizationLabel: string;
}

/** Las cuatro cifras de cabecera del cobro. `null` se dice como «Sin calcular». */
export interface ClaimQuoteBreakdownHeadline {
  readonly coverage: string | null;
  readonly copay: string | null;
  readonly patient: string | null;
  readonly insurer: string | null;
}

/** Vista completa de la molécula. Un único input: el contrato lo fijan las pantallas que la usan. */
export interface ClaimQuoteBreakdownVm {
  /** Código de moneda del dato (`BOB`), o `null` si no viaja. */
  readonly currencyCode: string | null;
  readonly headline: ClaimQuoteBreakdownHeadline;
  readonly lines: readonly ClaimQuoteBreakdownLine[];
}
