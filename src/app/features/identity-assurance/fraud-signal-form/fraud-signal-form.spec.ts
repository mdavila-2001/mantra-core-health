import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FraudSignalForm } from './fraud-signal-form';

const CASO = '11111111-1111-1111-1111-111111111111';
const CONCEPTO = '22222222-2222-2222-2222-222222222222';

describe('FraudSignalForm', () => {
  let fixture: ComponentFixture<FraudSignalForm>;
  let component: FraudSignalForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FraudSignalForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(FraudSignalForm);
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

  it('la señal mínima viaja al caso pegado con tipo y severidad', () => {
    formulario().patchValue({
      caseId: CASO,
      signalTypeConceptId: CONCEPTO,
      severityConceptId: CONCEPTO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/fraud-signals`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      signalTypeConceptId: CONCEPTO,
      severityConceptId: CONCEPTO,
    });

    req.flush({ id: 'fs-1', resolution: 'sin-resolver-uuid', caseStatus: 'estado-uuid' });
    expect(interno<() => { id: string } | null>('raised')()?.id).toBe('fs-1');
  });

  it('la confianza viaja como texto, con la fuente y la referencia solo si se cargan', () => {
    formulario().patchValue({
      caseId: CASO,
      signalTypeConceptId: CONCEPTO,
      severityConceptId: CONCEPTO,
      confidenceScore: '0.75',
      sourceConceptId: CONCEPTO,
      evidenceReference: 'audit://senales/fs-2',
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/fraud-signals`);
    expect(req.request.body).toEqual({
      signalTypeConceptId: CONCEPTO,
      severityConceptId: CONCEPTO,
      confidenceScore: '0.75',
      sourceConceptId: CONCEPTO,
      evidenceReference: 'audit://senales/fs-2',
    });

    req.flush({ id: 'fs-2', resolution: 'sin-resolver-uuid', caseStatus: 'estado-uuid' });
  });

  it('un puntaje que no es número frena el envío', () => {
    formulario().patchValue({
      caseId: CASO,
      signalTypeConceptId: CONCEPTO,
      severityConceptId: CONCEPTO,
      confidenceScore: 'alta',
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
