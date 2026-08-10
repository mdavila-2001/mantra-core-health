import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import type { FormArray, FormGroup } from '@angular/forms';
import { provideRouter } from '@angular/router';

import { CheckPlanForm } from './check-plan-form';

const CASO = '11111111-1111-1111-1111-111111111111';
const CONCEPTO = '22222222-2222-2222-2222-222222222222';
const AUTORIDAD = '33333333-3333-3333-3333-333333333333';

describe('CheckPlanForm', () => {
  let fixture: ComponentFixture<CheckPlanForm>;
  let component: CheckPlanForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckPlanForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckPlanForm);
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

  function filas(): FormArray<FormGroup> {
    return interno<FormArray<FormGroup>>('filas');
  }

  it('una fila mínima viaja al segmento checks:plan con el caso pegado', () => {
    formulario().patchValue({ caseId: CASO });
    filas().at(0).patchValue({ checkTypeConceptId: CONCEPTO });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/checks:plan`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      checks: [{ checkTypeConceptId: CONCEPTO, required: true }],
    });

    req.flush({ caseId: CASO, checkIds: ['ch-1'], caseStatus: 'estado-uuid' });
    expect(interno<() => { checkIds: readonly string[] } | null>('planned')()?.checkIds).toEqual([
      'ch-1',
    ]);
  });

  it('la segunda fila y la autoridad viajan; el switch apagado es decisión explícita', () => {
    formulario().patchValue({ caseId: CASO });
    filas().at(0).patchValue({ checkTypeConceptId: CONCEPTO });

    interno<() => void>('agregarFila')();
    filas().at(1).patchValue({
      checkTypeConceptId: CONCEPTO,
      authorityId: AUTORIDAD,
      required: false,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/checks:plan`);
    expect(req.request.body).toEqual({
      checks: [
        { checkTypeConceptId: CONCEPTO, required: true },
        { checkTypeConceptId: CONCEPTO, authorityId: AUTORIDAD, required: false },
      ],
    });

    req.flush({ caseId: CASO, checkIds: ['ch-1', 'ch-2'], caseStatus: 'estado-uuid' });
  });

  it('sin caso, o con una fila incompleta, el plan no viaja', () => {
    // Fila válida pero sin caso: nada sale.
    filas().at(0).patchValue({ checkTypeConceptId: CONCEPTO });
    interno<() => void>('submit')();

    // Caso válido pero la fila nueva quedó vacía: tampoco.
    formulario().patchValue({ caseId: CASO });
    interno<() => void>('agregarFila')();
    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
