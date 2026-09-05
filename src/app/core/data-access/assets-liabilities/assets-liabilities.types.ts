/**
 * FT-26 — auto-servicio de activos y pasivos del doctor.
 *
 * Los importes viajan como texto decimal, igual que en `accounting.types.ts`
 * y por la misma razón: no perder precisión al deserializar. No se convierten
 * a `number` acá — se formatean para mostrar, y punto.
 */

export interface AssetSummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly statusConceptId: string;
  readonly bookValue?: string;
  readonly acquisitionCost?: string;
  readonly automated: boolean;
}

export interface LiabilitySummary {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly creditorName?: string;
  readonly principalAmount?: string;
  readonly outstandingAmount?: string;
  readonly statusConceptId: string;
  readonly automated: boolean;
}

export interface LiabilitySchedule {
  readonly id: string;
  readonly installmentNumber: number;
  readonly dueDate?: string;
  readonly principalDue?: string;
  readonly interestDue?: string;
  readonly paidAmount?: string;
  readonly statusConceptId: string;
}

export interface LiabilityCreated {
  readonly id: string;
  readonly code: string;
  readonly schedule: readonly LiabilitySchedule[];
}

/** Cuerpo de "dar de alta un activo propio" — mismo contrato que `SECURITY_ADMIN`. */
export interface CapitalizeOwnAssetInput {
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly acquisitionAccountId: string;
  readonly offsetAccountId: string;
  /** Decimal como texto. */
  readonly acquisitionCost: string;
  /** `YYYY-MM-DD`. */
  readonly acquisitionDate: string;
  readonly usefulLifeMonths?: number;
  readonly salvageValue?: string;
}

export interface CreateOwnLiabilityInput {
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  readonly creditorName?: string;
  readonly accountId: string;
  /** Decimal como texto. */
  readonly principalAmount: string;
  /** Tasa anual en por ciento, decimal como texto (`"12.00"` = 12 %). */
  readonly interestRate?: string;
  readonly installments: number;
  /** `YYYY-MM-DD`. */
  readonly startDate: string;
  readonly automated?: boolean;
}

export interface RegisterAssetProgressInput {
  readonly depreciationExpenseAccountId: string;
  readonly accumulatedDepreciationAccountId: string;
}

export interface RegisterLiabilityProgressInput {
  readonly bankAccountId: string;
  readonly interestExpenseAccountId: string;
}

export interface ProgressRegistered {
  readonly transactionId: string;
  readonly installmentNumber?: number;
  /** Decimal como texto. */
  readonly amount: string;
}
