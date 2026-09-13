import type {
  PatientInsuranceSettlement,
  PatientSettlementFields,
} from '../../data-access/insurance/patient-insurance-settlement.types';
import { uuid } from '../mock-store';

export const SETTLEMENT_CLAUSE =
  'Cláusula 14.2: la prestación requiere una indicación incluida expresamente en el plan contratado. La exclusión afecta únicamente al ítem identificado en esta liquidación y no asigna automáticamente su importe al paciente. Puede solicitarse una revisión con la documentación clínica correspondiente.';

export function patientSettlementFixture(
  orderId: string,
  result: PatientInsuranceSettlement['result'],
  amount = '100.00',
  itemName = 'Prestación solicitada',
): PatientSettlementFields {
  const [integer, fraction = ''] = amount.split('.');
  const cents = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  const approved =
    result === 'DENIED' ? 0n : result === 'APPROVED' ? (cents * 80n) / 100n : (cents * 50n) / 100n;
  const patient =
    result === 'DENIED' ? 0n : result === 'APPROVED' ? cents - approved : (cents * 20n) / 100n;
  const excluded = cents - approved - patient;
  const decimal = (value: bigint) =>
    `${value / 100n}.${(value % 100n).toString().padStart(2, '0')}`;
  return {
    insuranceSettlementAvailability: 'AVAILABLE',
    insuranceSettlement: {
      claimId: uuid(`claim-${orderId}`),
      claimIdentifier: `REC-${orderId.slice(-8)}`,
      adjudicationVersionId: uuid(`adjudication-${orderId}`),
      adjudicationVersion: 1,
      eobId: uuid(`eob-${orderId}`),
      carrierName: 'Seguros Andina',
      policyIdentifier: 'POL-24816',
      totalBilledAmount: amount,
      totalApprovedAmount: decimal(approved),
      totalPatientAmount: decimal(patient),
      totalDeniedAmount: decimal(excluded),
      currencyCode: 'BOB',
      result,
      exclusions:
        excluded === 0n
          ? []
          : [
              {
                claimLineId: uuid(`claim-line-${orderId}`),
                itemId: uuid(`item-${orderId}`),
                itemName,
                amount: decimal(excluded),
                policyClauseReference: SETTLEMENT_CLAUSE,
                denialRationale:
                  result === 'DENIED'
                    ? null
                    : 'La prestación excede el beneficio específico registrado.',
              },
            ],
    },
  };
}

/** Mirrors a whole pharmacy claim with an exclusion identity for each frozen item. */
export function patientSettlementForItems(
  orderId: string,
  result: PatientInsuranceSettlement['result'],
  items: readonly { id: string; name: string; unitAmount: string; quantity: number }[],
): PatientSettlementFields {
  const cents = (amount: string) => {
    const [integer, fraction = ''] = amount.split('.');
    return BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0').slice(0, 2));
  };
  const decimal = (amount: bigint) =>
    `${amount / 100n}.${(amount % 100n).toString().padStart(2, '0')}`;
  const parts = items.map(
    (item) =>
      patientSettlementFixture(
        `${orderId}:${item.id}`,
        result,
        decimal(cents(item.unitAmount) * BigInt(item.quantity)),
        item.name,
      ).insuranceSettlement!,
  );
  const base = patientSettlementFixture(orderId, result).insuranceSettlement!;
  const sum = (
    field: 'totalBilledAmount' | 'totalApprovedAmount' | 'totalPatientAmount' | 'totalDeniedAmount',
  ) => decimal(parts.reduce((total, part) => total + cents(part[field]), 0n));
  return {
    insuranceSettlementAvailability: 'AVAILABLE',
    insuranceSettlement: {
      ...base,
      totalBilledAmount: sum('totalBilledAmount'),
      totalApprovedAmount: sum('totalApprovedAmount'),
      totalPatientAmount: sum('totalPatientAmount'),
      totalDeniedAmount: sum('totalDeniedAmount'),
      exclusions: parts.flatMap((part, index) =>
        part.exclusions.map((exclusion) => ({ ...exclusion, itemId: items[index].id })),
      ),
    },
  };
}
