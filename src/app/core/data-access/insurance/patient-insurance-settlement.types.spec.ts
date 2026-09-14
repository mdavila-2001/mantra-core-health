import {
  patientSettlementFixture,
  patientSettlementForItems,
} from '../../mock/fixtures/patient-settlements';
import {
  normalizePatientSettlement,
  PatientInsuranceSettlement,
} from './patient-insurance-settlement.types';
import { pharmacyOrderFromDto } from '../pharmacy-orders/pharmacy-orders.adapter';
import { pharmacyOrderDtoFixture } from '../pharmacy-orders/pharmacy-orders.spec-fixtures';

describe('patient settlement normalization', () => {
  it('keeps every mock exclusion within the billed pharmacy item and reconciles the order', () => {
    const settlement = patientSettlementForItems('order', 'PARTIALLY_APPROVED', [
      { id: 'enalapril', name: 'Enalapril', unitAmount: '8.00', quantity: 1 },
      { id: 'atorvastatin', name: 'Atorvastatina', unitAmount: '21.50', quantity: 1 },
    ]).insuranceSettlement!;
    expect(settlement).toMatchObject({
      totalBilledAmount: '29.50',
      totalApprovedAmount: '14.75',
      totalPatientAmount: '5.90',
      totalDeniedAmount: '8.85',
    });
    expect(settlement.exclusions.map((item) => [item.itemId, item.amount])).toEqual([
      ['enalapril', '2.40'],
      ['atorvastatin', '6.45'],
    ]);
  });

  it('treats an older API as unavailable', () => {
    expect(normalizePatientSettlement({})).toEqual({
      insuranceSettlementAvailability: 'NOT_AVAILABLE',
      insuranceSettlement: null,
    });
  });
  it('withdraws stale contents when a replacement is pending', () => {
    const original = patientSettlementFixture('order', 'APPROVED');
    expect(
      normalizePatientSettlement({
        ...original,
        insuranceSettlementAvailability: 'PENDING_PUBLICATION',
      }).insuranceSettlement,
    ).toBeNull();
  });
  it('withdraws incomplete publications without guessing a currency or zero', () => {
    const original = patientSettlementFixture('order', 'APPROVED');
    const result = normalizePatientSettlement({
      ...original,
      insuranceSettlement: { ...original.insuranceSettlement!, currencyCode: '' },
    });
    expect(result.insuranceSettlementAvailability).toBe('UNDER_REVIEW');
    expect(result.insuranceSettlement).toBeNull();
  });
  it.each([
    { carrierName: ' ' },
    { adjudicationVersion: 0 },
    { totalPatientAmount: null },
    { exclusions: [null] },
    {
      exclusions: [
        {
          claimLineId: 'line',
          itemId: 'item',
          itemName: 'Servicio',
          amount: '-1.00',
          policyClauseReference: '14.2',
        },
      ],
    },
    {
      exclusions: [
        {
          claimLineId: 'line',
          itemId: 'item',
          itemName: 'Servicio',
          amount: '1.00',
          policyClauseReference: ' ',
        },
      ],
    },
  ])('withdraws malformed publication fields: %j', (incomplete) => {
    const original = patientSettlementFixture('order', 'PARTIALLY_APPROVED');
    const result = normalizePatientSettlement({
      ...original,
      insuranceSettlement: {
        ...original.insuranceSettlement!,
        ...incomplete,
      } as unknown as PatientInsuranceSettlement,
    });
    expect(result).toEqual({
      insuranceSettlementAvailability: 'UNDER_REVIEW',
      insuranceSettlement: null,
    });
  });
  it('preserves exact decimal strings through the pharmacy adapter and excludes staff', () => {
    const publication = patientSettlementFixture('order', 'APPROVED', '9007199254740993.12');
    const dto = { ...pharmacyOrderDtoFixture(), ...publication };
    expect(pharmacyOrderFromDto(dto).insuranceSettlement?.totalBilledAmount).toBe(
      '9007199254740993.12',
    );
    expect(pharmacyOrderFromDto(dto, 'staff').insuranceSettlement).toBeNull();
  });
});
