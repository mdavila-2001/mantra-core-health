import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AssertionRevokeForm } from './assertion-revoke-form';

const ASERCION = '11111111-1111-1111-1111-111111111111';
const CONCEPTO = '22222222-2222-2222-2222-222222222222';

describe('AssertionRevokeForm', () => {
  let fixture: ComponentFixture<AssertionRevokeForm>;
  let component: AssertionRevokeForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AssertionRevokeForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AssertionRevokeForm);
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

  it('revoca contra la aserción pegada; el mínimo lleva solo el switch explícito', () => {
    formulario().patchValue({ assertionId: ASERCION });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/assertions/${ASERCION}/revoke`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ raiseFraudSignal: false });

    req.flush({
      id: ASERCION,
      revokedAt: '2026-08-08T12:00:00.000Z',
      caseStatus: 'revocado-uuid',
    });

    const revocada = interno<() => { revokedAt: Date } | null>('revoked')();
    expect(revocada?.revokedAt).toEqual(new Date('2026-08-08T12:00:00.000Z'));
  });

  it('la revocación por fraude deriva la señal con sus conceptos', () => {
    formulario().patchValue({
      assertionId: ASERCION,
      revocationReasonConceptId: CONCEPTO,
      raiseFraudSignal: true,
      fraudSignalTypeConceptId: CONCEPTO,
      fraudSeverityConceptId: CONCEPTO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/assertions/${ASERCION}/revoke`);
    expect(req.request.body).toEqual({
      revocationReasonConceptId: CONCEPTO,
      fraudSignalTypeConceptId: CONCEPTO,
      fraudSeverityConceptId: CONCEPTO,
      raiseFraudSignal: true,
    });

    req.flush({
      id: ASERCION,
      revokedAt: '2026-08-08T12:00:00.000Z',
      caseStatus: 'revocado-uuid',
    });
  });

  it('sin aserción no viaja nada: revocar exige decir cuál', () => {
    formulario().patchValue({ revocationReasonConceptId: CONCEPTO });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
