import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import type { PlanBenefit } from '../../../core/data-access/insurance/insurance.types';
import { ApprovalRulesDialog } from './approval-rules-dialog';

const PLAN_ID = 'pl-1';
const BENEFIT_ID = 'bn-1';

function benefit(requiredDocuments: PlanBenefit['approvalRules']['requiredDocuments']): PlanBenefit {
  return {
    id: BENEFIT_ID,
    category: { conceptId: 'c-1', code: 'CONSULTA', display: 'Consulta ambulatoria' },
    service: null,
    coveragePercent: '80',
    copayAmount: null,
    deductibleAmount: null,
    annualLimitAmount: null,
    requiresPriorAuthorization: false,
    approvalRules: { requiredDocuments, exclusionNotes: null },
    effectiveFrom: null,
    effectiveTo: null,
  } as unknown as PlanBenefit;
}

describe('ApprovalRulesDialog — documentos requeridos', () => {
  let fixture: ComponentFixture<ApprovalRulesDialog>;
  let http: HttpTestingController;

  function mount(documents: PlanBenefit['approvalRules']['requiredDocuments']): void {
    fixture = TestBed.createComponent(ApprovalRulesDialog);
    fixture.componentRef.setInput('planId', PLAN_ID);
    fixture.componentRef.setInput('planName', 'Plan Integral');
    fixture.componentRef.setInput('benefit', benefit(documents));
    fixture.detectChanges();
  }

  function documentLabels(): HTMLLabelElement[] {
    const group = (fixture.nativeElement as HTMLElement).querySelector('app-checkbox-group');
    return Array.from(group?.querySelectorAll<HTMLLabelElement>('label.checkbox-container') ?? []);
  }

  function checked(): boolean[] {
    return documentLabels().map((label) => label.querySelector('input')?.checked === true);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('cada casilla tiene su propio id: ninguna etiqueta apunta a otra', () => {
    mount([]);
    const ids = documentLabels().map((label) => label.querySelector('input')?.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    documentLabels().forEach((label) => {
      expect(label.getAttribute('for')).toBe(label.querySelector('input')?.id);
    });
  });

  it('pulsar «Sello profesional» marca esa casilla y no «Firma del médico»', () => {
    mount([]);
    documentLabels()[1].click();
    fixture.detectChanges();
    expect(checked()).toEqual([false, true, false, false]);
  });

  it('abre con lo guardado marcado y guarda en el orden de la lista', () => {
    mount(['INFORME_CLINICO', 'FIRMA_MEDICO']);
    expect(checked()).toEqual([true, false, false, true]);

    documentLabels()[2].click();
    fixture.detectChanges();
    (fixture.componentInstance as unknown as { submit(): void }).submit();

    const request = http.expectOne(`/insurance-plans/${PLAN_ID}/benefits/${BENEFIT_ID}/rules`);
    expect(request.request.body.requiredDocuments).toEqual([
      'FIRMA_MEDICO',
      'ORDEN_MEDICA',
      'INFORME_CLINICO',
    ]);
  });
});
