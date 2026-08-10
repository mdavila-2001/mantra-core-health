import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { VerificationPolicyForm } from './verification-policy-form';

const CONCEPTO = '11111111-1111-1111-1111-111111111111';
const IAL2 = '22222222-2222-2222-2222-222222222222';

describe('VerificationPolicyForm', () => {
  let fixture: ComponentFixture<VerificationPolicyForm>;
  let component: VerificationPolicyForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VerificationPolicyForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(VerificationPolicyForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') return valor as T;
    const esSenal = 'set' in valor || 'update' in valor || 'asReadonly' in valor;
    return (esSenal ? valor : valor.bind(component)) as T;
  }

  function formulario(): { patchValue: (v: object) => void } {
    return interno<{ patchValue: (v: object) => void }>('form');
  }

  it('el cuerpo mínimo lleva las cuatro claves del contrato', () => {
    formulario().patchValue({
      policyCode: '  IAL2-PACIENTE  ',
      subjectTypeConceptId: CONCEPTO,
      transactionRiskConceptId: CONCEPTO,
      requiredIdentityAssuranceLevelConceptId: IAL2,
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/identity/verification-policies');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      policyCode: 'IAL2-PACIENTE',
      subjectTypeConceptId: CONCEPTO,
      transactionRiskConceptId: CONCEPTO,
      requiredIdentityAssuranceLevelConceptId: IAL2,
    });

    req.flush({
      id: 'p-1',
      policyCode: 'IAL2-PACIENTE',
      status: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
    expect(interno<() => { id: string } | null>('created')()?.id).toBe('p-1');
  });

  it('una evidencia que no es JSON frena el envío; válida, viaja parseada con la versión', () => {
    formulario().patchValue({
      policyCode: 'IAL3-PROFESIONAL',
      subjectTypeConceptId: CONCEPTO,
      transactionRiskConceptId: CONCEPTO,
      requiredIdentityAssuranceLevelConceptId: IAL2,
      evidenceRequirementsJson: '{documentos: 2}',
    });

    interno<() => void>('submit')();
    // Nada salió: el objeto no parsea. `http.verify()` lo confirma al final.

    formulario().patchValue({
      versionNumber: 2,
      requiredAuthenticatorAssuranceLevelConceptId: CONCEPTO,
      evidenceRequirementsJson: '{"documentos": 2}',
      fraudControlsJson: '{"scoreMinimo": "0.8"}',
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/identity/verification-policies');
    expect(req.request.body).toEqual({
      policyCode: 'IAL3-PROFESIONAL',
      subjectTypeConceptId: CONCEPTO,
      transactionRiskConceptId: CONCEPTO,
      requiredIdentityAssuranceLevelConceptId: IAL2,
      requiredAuthenticatorAssuranceLevelConceptId: CONCEPTO,
      evidenceRequirementsJson: { documentos: 2 },
      fraudControlsJson: { scoreMinimo: '0.8' },
      versionNumber: 2,
    });

    req.flush({
      id: 'p-2',
      policyCode: 'IAL3-PROFESIONAL',
      status: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
  });

  it('la versión 0 no pasa: empieza en 1', () => {
    formulario().patchValue({
      policyCode: 'IAL2-PACIENTE',
      subjectTypeConceptId: CONCEPTO,
      transactionRiskConceptId: CONCEPTO,
      requiredIdentityAssuranceLevelConceptId: IAL2,
      versionNumber: 0,
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
