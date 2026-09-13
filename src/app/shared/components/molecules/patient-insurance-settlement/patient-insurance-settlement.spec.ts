import { TestBed } from '@angular/core/testing';
import {
  patientSettlementFixture,
  SETTLEMENT_CLAUSE,
} from '../../../../core/mock/fixtures/patient-settlements';
import { PatientInsuranceSettlement } from './patient-insurance-settlement';

describe('PatientInsuranceSettlement', () => {
  it('keeps an exclusion distinct from a confirmed patient charge', () => {
    const fixture = TestBed.createComponent(PatientInsuranceSettlement);
    fixture.componentRef.setInput('availability', 'AVAILABLE');
    fixture.componentRef.setInput(
      'settlement',
      patientSettlementFixture('denied', 'DENIED').insuranceSettlement,
    );
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const rows = [...element.querySelectorAll('dl > div')];
    expect(rows.find((row) => row.textContent?.includes('A tu cargo'))?.textContent).toContain(
      '0.00 Bs',
    );
    expect(
      rows.find((row) => row.textContent?.includes('Excluido sin asignar'))?.textContent,
    ).toContain('100.00 Bs');
    expect(element.textContent).toContain(SETTLEMENT_CLAUSE);
    expect(element.textContent).toContain('Justificación: No informada');
  });

  it.each(['PENDING_PUBLICATION', 'UNDER_REVIEW', 'NOT_AVAILABLE'])(
    'does not show a definitive charge for %s',
    (availability) => {
      const fixture = TestBed.createComponent(PatientInsuranceSettlement);
      fixture.componentRef.setInput('availability', availability);
      fixture.componentRef.setInput(
        'settlement',
        patientSettlementFixture('approved', 'APPROVED').insuranceSettlement,
      );
      fixture.detectChanges();
      const element = fixture.nativeElement as HTMLElement;
      expect(element.querySelector('dl')).toBeNull();
      expect(element.querySelector('[role="status"]')).not.toBeNull();
    },
  );
});
