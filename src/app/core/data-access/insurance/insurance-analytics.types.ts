import type { InsuranceConcept } from './insurance.types';

/**
 * Tipos del tablero de siniestralidad de la aseguradora (subtarea 3.1,
 * v4.2.14). Todos los importes viajan como cadena decimal, tal cual la base
 * los devuelve — nunca se recalculan en el navegador. Las tasas y el loss
 * ratio son `string | null`: `null` significa «no computable» (denominador
 * en cero), nunca `'0.00'`.
 */

/** Filtros del tablero. Sin `startDate`/`endDate` la API usa los últimos 12 meses. */
export interface InsuranceAnalyticsQuery {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly planId?: string;
}

export interface LossRatioKpis {
  readonly totalClaimsCount: number;
  readonly adjudicatedClaimsCount: number;
  readonly pendingClaimsCount: number;
  readonly otherCurrencyClaimsCount: number;
  readonly totalBilledAmount: string;
  readonly totalApprovedAmount: string;
  readonly totalPatientCopayAmount: string;
  readonly totalDeniedAmount: string;
  readonly approvalRatePercent: string | null;
  readonly activeAffiliatesCount: number;
  readonly periodMonths: string;
  readonly averageMonthlyPerCapitaExpense: string | null;
  readonly averageAnnualPerCapitaExpense: string | null;
  readonly estimatedPremiumsTotal: string;
  readonly coveragesWithoutPremiumCount: number;
  readonly lossRatioPercent: string | null;
}

export interface MonthlyTrend {
  /** `YYYY-MM`. */
  readonly period: string;
  readonly billedAmount: string;
  readonly approvedAmount: string;
  readonly claimsCount: number;
}

export interface TopMedication {
  readonly medicationCode: string | null;
  readonly medicationName: string;
  readonly dispensationsCount: string;
  readonly totalExpenseAmount: string;
  readonly sharePercent: string;
}

/**
 * Consultas por especialidad de la POBLACIÓN AFILIADA, no del reclamo: el
 * reclamo no enlaza al encuentro clínico. `totalExpenseAmount` es siempre
 * `null` por eso — no lo ocultes, mostralo con la nota de la pantalla.
 */
export interface SpecialtyDistribution {
  readonly specialtyCode: string | null;
  readonly specialtyName: string;
  readonly consultationsCount: number;
  readonly totalExpenseAmount: string | null;
}

/** Patologías CIE-10 de la POBLACIÓN AFILIADA en el periodo. */
export interface PrevalentPathology {
  readonly code: string;
  readonly description: string;
  readonly casesCount: number;
  readonly percentage: string;
}

/** Cobertura de inmunización ACUMULADA: un piso, no una tasa real. */
export interface ImmunizationRate {
  readonly vaccinatedCount: number;
  readonly unvaccinatedCount: number;
  readonly vaccinationRatePercent: string | null;
}

export interface InsuranceDashboardAnalytics {
  readonly carrierId: string;
  readonly carrierLegalName: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly currency: InsuranceConcept | null;
  readonly kpis: LossRatioKpis;
  readonly monthlyTrends: readonly MonthlyTrend[];
  readonly topMedications: readonly TopMedication[];
  readonly specialties: readonly SpecialtyDistribution[];
  readonly prevalentPathologies: readonly PrevalentPathology[];
  readonly immunization: ImmunizationRate;
}
