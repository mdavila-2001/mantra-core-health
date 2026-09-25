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

  /** Tarea 3 · H8: los data-testid que usa el Playwright de exclusiones. */
  it('expone data-testid en los cuatro importes, la exclusión y su cláusula como badge', () => {
    const fixture = TestBed.createComponent(PatientInsuranceSettlement);
    fixture.componentRef.setInput('availability', 'AVAILABLE');
    fixture.componentRef.setInput(
      'settlement',
      patientSettlementFixture('partial', 'PARTIALLY_APPROVED').insuranceSettlement,
    );
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    for (const testid of [
      'settlement-total-billed',
      'settlement-total-approved',
      'settlement-total-patient',
      'settlement-total-denied',
      'settlement-exclusion',
      'settlement-exclusion-clause',
      'settlement-exclusion-rationale',
    ]) {
      expect(element.querySelector(`[data-testid="${testid}"]`)).not.toBeNull();
    }
    expect(
      element.querySelector('[data-testid="settlement-exclusion-clause"]')?.textContent,
    ).toContain(SETTLEMENT_CLAUSE);
  });

  it('degrada un AVAILABLE con importes incompletos a revisión, sin anunciar disponibilidad', () => {
    const fixture = TestBed.createComponent(PatientInsuranceSettlement);
    const incompleto = {
      ...patientSettlementFixture('approved', 'APPROVED').insuranceSettlement,
      totalPatientAmount: '',
    };
    fixture.componentRef.setInput('availability', 'AVAILABLE');
    fixture.componentRef.setInput('settlement', incompleto);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('dl')).toBeNull();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('en revisión');
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
