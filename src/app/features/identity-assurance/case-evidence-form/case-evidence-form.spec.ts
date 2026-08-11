import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CaseEvidenceForm } from './case-evidence-form';

const CASO = '11111111-1111-1111-1111-111111111111';
const CONCEPTO = '22222222-2222-2222-2222-222222222222';
const AUTORIDAD = '33333333-3333-3333-3333-333333333333';
const ARCHIVO = '44444444-4444-4444-4444-444444444444';

describe('CaseEvidenceForm', () => {
  let fixture: ComponentFixture<CaseEvidenceForm>;
  let component: CaseEvidenceForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaseEvidenceForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CaseEvidenceForm);
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

  it('aporta contra la ruta del caso pegado, con el tipo como único obligatorio', () => {
    formulario().patchValue({
      caseId: CASO,
      evidenceTypeConceptId: CONCEPTO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/evidence`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ evidenceTypeConceptId: CONCEPTO });

    req.flush({
      id: 'ev-1',
      verificationStatus: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
    expect(interno<() => { id: string } | null>('submitted')()?.id).toBe('ev-1');
  });

  it('las referencias viajan solo cuando se cargan: el documento nunca va en el cuerpo', () => {
    formulario().patchValue({
      caseId: CASO,
      evidenceTypeConceptId: CONCEPTO,
      issuerAuthorityId: AUTORIDAD,
      evidenceIdentifierHash: 'a1b2c3',
      evidenceFileId: ARCHIVO,
      encryptedEvidenceReference: 'vault://evidencias/ev-1',
      evidenceQualityConceptId: CONCEPTO,
      collectedUnderConsentId: AUTORIDAD,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/evidence`);
    expect(req.request.body).toEqual({
      evidenceTypeConceptId: CONCEPTO,
      issuerAuthorityId: AUTORIDAD,
      evidenceIdentifierHash: 'a1b2c3',
      evidenceFileId: ARCHIVO,
      encryptedEvidenceReference: 'vault://evidencias/ev-1',
      evidenceQualityConceptId: CONCEPTO,
      collectedUnderConsentId: AUTORIDAD,
    });

    req.flush({
      id: 'ev-2',
      verificationStatus: 'estado-uuid',
      createdAt: '2026-08-08T12:00:00.000Z',
    });
  });

  it('sin caso no viaja nada: la evidencia pertenece a un expediente', () => {
    formulario().patchValue({ evidenceTypeConceptId: CONCEPTO });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
