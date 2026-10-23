/* ============================================================================
    C-01 · Comprobantes de pago del paciente (contrato de la API, 2026-10-23).

    El cargo de una consulta ES el encuentro: `chargeId` es el id del
    encuentro. El dinero viaja en unidades menores (centavos) con su moneda.
    Un cargo sin pago confirmado no se cierra ni se factura: la API responde
    422 `PRECONDITION_FAILED` con `details.reason = 'PAYMENT_REQUIRED'`.
    ========================================================================== */

export type PaymentProofMethod = 'QR_TRANSFER' | 'CASH';
export type PaymentProofStatus = 'PENDING_REVIEW' | 'ACCEPTED' | 'REJECTED';
/** Derivado del comprobante aceptado o de la cuenta saldada. */
export type ChargePaymentStatus = 'PENDING' | 'PAID' | 'NOT_PRICED';
export type CoverageStatus =
  | 'COVERED_BY_CONTRACT'
  | 'NEEDS_APPROVAL'
  | 'APPROVED'
  | 'DENIED'
  | 'NO_COVERAGE';

export interface PaymentProof {
  readonly id: string;
  readonly chargeId: string;
  readonly patientProfileId: string;
  readonly method: PaymentProofMethod;
  readonly fileId: string | null;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: PaymentProofStatus;
  readonly rejectionReason: string | null;
  readonly reviewedAt: string | null;
  readonly reviewedByUserId: string | null;
  readonly createdAt: string;
}

export interface PatientShare {
  readonly coveragePercent: number;
  readonly patientAmountMinor: number;
  readonly insurerAmountMinor: number;
  readonly approval: {
    readonly status: CoverageStatus;
    readonly priorAuthorizationRequestId?: string;
    readonly reason?: string;
  };
}

/** `GET /billing/me/charges/:chargeId/payment-context` (paciente). */
export interface PaymentContext {
  readonly chargeId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: ChargePaymentStatus;
  readonly patientShare: PatientShare;
  readonly site: { readonly id: string; readonly name: string; readonly bankQrFileId: string | null } | null;
  readonly proofs: readonly PaymentProof[];
  readonly latestProof: PaymentProof | null;
}

export interface CreatePaymentProofInput {
  readonly method: PaymentProofMethod;
  readonly fileId?: string;
  readonly amountMinor: number;
}

/** `GET /billing/charges/:chargeId/payment-proofs` (médico). */
export interface ChargeProofs {
  readonly chargeId: string;
  readonly status: ChargePaymentStatus;
  readonly amountMinor: number;
  readonly currency: string;
  readonly items: readonly PaymentProof[];
}

export interface ProofReview {
  readonly id: string;
  readonly status: 'ACCEPTED' | 'REJECTED';
  readonly chargeStatus: ChargePaymentStatus;
}

/** Una sesión de la tabla de pagos del prestador (Q-P3). */
export interface ProviderPaymentRow {
  readonly chargeId: string;
  readonly startAt: string;
  readonly patientProfileId: string;
  readonly patientName: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly patientAmountMinor: number;
  readonly insurerAmountMinor: number;
  readonly coverageStatus: CoverageStatus;
  readonly status: ChargePaymentStatus;
  readonly proof: PaymentProof | null;
  readonly invoiced: boolean;
}

export interface ProviderPaymentTablePage {
  readonly items: readonly ProviderPaymentRow[];
  readonly nextCursor: string | null;
  readonly totals: {
    readonly sessions: number;
    readonly amountMinor: number;
    readonly paidMinor: number;
    readonly pendingMinor: number;
  };
}

export interface ProviderPaymentTableQuery {
  readonly from?: string;
  readonly to?: string;
  readonly patientProfileId?: string;
  readonly cursor?: string | null;
  readonly limit?: number;
}

/** Monto en unidades menores → texto «Bs 150,00». */
export function formatMinor(amountMinor: number, currency = 'BOB'): string {
  const simbolo = currency === 'BOB' ? 'Bs' : currency;
  const signo = amountMinor < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(amountMinor));
  const entero = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${signo}${simbolo} ${entero},${String(abs % 100).padStart(2, '0')}`;
}

export const PROOF_STATUS_LABEL: Readonly<Record<PaymentProofStatus, string>> = {
  PENDING_REVIEW: 'Por revisar',
  ACCEPTED: 'Aceptado',
  REJECTED: 'Rechazado',
};

export const CHARGE_STATUS_LABEL: Readonly<Record<ChargePaymentStatus, string>> = {
  // «Pendiente» y no «Pendiente de pago»: va en la columna «Estado» de una
  // tabla de pagos, y en 390 px la etiqueta larga le comía el ancho al nombre.
  PENDING: 'Pendiente',
  PAID: 'Pagado',
  NOT_PRICED: 'Sin precio',
};

export const METHOD_LABEL: Readonly<Record<PaymentProofMethod, string>> = {
  QR_TRANSFER: 'Transferencia por QR',
  CASH: 'Efectivo',
};

export const COVERAGE_LABEL: Readonly<Record<CoverageStatus, string>> = {
  COVERED_BY_CONTRACT: 'Cubierto por contrato',
  NEEDS_APPROVAL: 'Requiere aprobación',
  APPROVED: 'Aprobado',
  DENIED: 'Rechazado por el seguro',
  NO_COVERAGE: 'Sin seguro',
};
