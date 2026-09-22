import type { PatientSettlementFields } from '../insurance/patient-insurance-settlement.types';

/** Wire contracts published by the pharmacy-orders API. */

export interface PharmacyOrderConceptDto {
  readonly code: string;
  readonly display: string;
}

export interface PharmacyOrderLineDto {
  readonly productId: string;
  readonly medicationConceptId: string | null;
  readonly productCode: string;
  readonly brandName: string | null;
  readonly genericName: string | null;
  readonly strengthText: string | null;
  readonly packageSizeText: string | null;
  readonly medication: PharmacyOrderConceptDto | null;
  readonly requestedQuantity: number;
  readonly reservedQuantity: number;
  readonly fulfilledQuantity: number;
  readonly unitPriceAmount: string | null;
  readonly currency: PharmacyOrderConceptDto | null;
  readonly status: PharmacyOrderConceptDto;
}

export interface PharmacyOrderSubstitutionDto {
  readonly id: string;
  readonly originalProductId: string;
  readonly originalName: string;
  readonly originalUnitPriceAmount: string | null;
  readonly proposedProductId: string;
  readonly proposedName: string;
  readonly proposedUnitPriceAmount: string | null;
  readonly currency: PharmacyOrderConceptDto | null;
  readonly status: PharmacyOrderConceptDto;
  readonly decidedAt: string | null;
}

export interface PharmacyOrderDto extends PatientSettlementFields {
  readonly id: string;
  readonly status: PharmacyOrderConceptDto;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly siteId: string;
  readonly siteName: string;
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly medicationRequestId: string | null;
  readonly patientName: string | null;
  readonly deliveryMode: PharmacyOrderConceptDto | null;
  readonly pickupCode: string | null;
  readonly totalAmount: string | null;
  readonly currency: PharmacyOrderConceptDto | null;
  readonly rejectionReasonText: string | null;
  /** Newest first, as returned by the substitutions repository. */
  readonly substitutions: readonly PharmacyOrderSubstitutionDto[];
  readonly lines: readonly PharmacyOrderLineDto[];
}

export interface PharmacyOrderListResponseDto {
  readonly items: readonly PharmacyOrderDto[];
  readonly count: number;
}

export interface CreatePharmacyOrderDto {
  readonly siteId: string;
  readonly medicationRequestId?: string;
  readonly deliveryMode: 'RETIRO';
  readonly idempotencyKey: string;
  readonly lines: readonly {
    readonly productId: string;
    readonly quantity: number;
  }[];
}

export type ConfirmOrderDecisionDto = 'NO_DISPONIBLE' | 'PROPONER_GENERICO';

export interface ConfirmPharmacyOrderDto {
  readonly adjustments?: readonly {
    readonly productId: string;
    readonly decision: ConfirmOrderDecisionDto;
    readonly proposedProductId?: string;
  }[];
}

export interface RejectPharmacyOrderDto {
  readonly reason: string;
}

export interface DispensePharmacyOrderDto {
  readonly pickupCode: string;
  readonly productIds?: readonly string[];
  readonly idempotencyKey: string;
}
