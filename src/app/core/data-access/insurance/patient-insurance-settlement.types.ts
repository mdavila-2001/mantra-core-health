/** Published, patient-specific adjudication. Decimal strings remain exact. */
export type InsuranceSettlementAvailability =
  'AVAILABLE' | 'PENDING_PUBLICATION' | 'UNDER_REVIEW' | 'NOT_AVAILABLE';

export interface InsuranceSettlementExclusion {
  readonly claimLineId: string;
  readonly itemId: string;
  readonly itemName: string;
  readonly amount: string;
  readonly policyClauseReference: string;
  readonly denialRationale: string | null;
}

export interface PatientInsuranceSettlement {
  readonly claimId: string;
  readonly claimIdentifier: string;
  readonly adjudicationVersionId: string;
  readonly adjudicationVersion: number;
  readonly eobId: string;
  readonly carrierName: string;
  readonly policyIdentifier: string | null;
  readonly totalBilledAmount: string;
  readonly totalApprovedAmount: string;
  readonly totalPatientAmount: string;
  readonly totalDeniedAmount: string;
  readonly currencyCode: string;
  readonly result: 'APPROVED' | 'PARTIALLY_APPROVED' | 'DENIED';
  readonly exclusions: readonly InsuranceSettlementExclusion[];
}

export interface PatientSettlementFields {
  readonly insuranceSettlementAvailability?: InsuranceSettlementAvailability;
  readonly insuranceSettlement?: PatientInsuranceSettlement | null;
}

/** An older API does not establish financial responsibility. */
export function normalizePatientSettlement(
  value: PatientSettlementFields,
): Required<PatientSettlementFields> {
  if (
    value.insuranceSettlementAvailability === 'AVAILABLE' &&
    completeSettlement(value.insuranceSettlement)
  ) {
    return {
      insuranceSettlementAvailability: 'AVAILABLE',
      insuranceSettlement: value.insuranceSettlement,
    };
  }
  return {
    insuranceSettlementAvailability:
      value.insuranceSettlementAvailability === 'AVAILABLE'
        ? 'UNDER_REVIEW'
        : (value.insuranceSettlementAvailability ?? 'NOT_AVAILABLE'),
    insuranceSettlement: null,
  };
}

function completeSettlement(
  value: PatientInsuranceSettlement | null | undefined,
): value is PatientInsuranceSettlement {
  if (!value) return false;
  const identifiers = [
    value.currencyCode,
    value.eobId,
    value.claimId,
    value.claimIdentifier,
    value.adjudicationVersionId,
    value.carrierName,
  ];
  const amounts = [
    value.totalBilledAmount,
    value.totalApprovedAmount,
    value.totalPatientAmount,
    value.totalDeniedAmount,
  ];
  return (
    identifiers.every(nonEmptyText) &&
    Number.isInteger(value.adjudicationVersion) &&
    value.adjudicationVersion > 0 &&
    amounts.every(decimalAmount) &&
    ['APPROVED', 'PARTIALLY_APPROVED', 'DENIED'].includes(value.result) &&
    Array.isArray(value.exclusions) &&
    value.exclusions.every(
      (exclusion) =>
        exclusion !== null &&
        exclusion !== undefined &&
        [
          exclusion.claimLineId,
          exclusion.itemId,
          exclusion.itemName,
          exclusion.policyClauseReference,
        ].every(nonEmptyText) &&
        decimalAmount(exclusion.amount),
    )
  );
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function decimalAmount(value: unknown): value is string {
  return typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value);
}
