import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ReviewDecisionForm } from './review-decision-form';

const REVISION = '11111111-1111-1111-1111-111111111111';

describe('ReviewDecisionForm', () => {
  let fixture: ComponentFixture<ReviewDecisionForm>;
  let component: ReviewDecisionForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReviewDecisionForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ReviewDecisionForm);
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

  it('la aprobación viaja a la revisión pegada; sin motivo, el cuerpo es la decisión sola', () => {
    formulario().patchValue({ reviewId: REVISION });
    interno<(valor: unknown) => void>('elegirDecision')('APPROVED');

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/manual-review/${REVISION}/decision`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'APPROVED' });

    req.flush({ id: REVISION, status: 'decidida-uuid', caseStatus: 'aprobado-uuid' });
    expect(interno<() => { caseStatus: string } | null>('decided')()?.caseStatus).toBe(
      'aprobado-uuid',
    );
  });

  it('el rechazo lleva el motivo recortado cuando se escribe', () => {
    formulario().patchValue({
      reviewId: REVISION,
      decisionReason: '  La evidencia no coincide con el registro civil.  ',
    });
    interno<(valor: unknown) => void>('elegirDecision')('REJECTED');

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/manual-review/${REVISION}/decision`);
    expect(req.request.body).toEqual({
      decision: 'REJECTED',
      decisionReason: 'La evidencia no coincide con el registro civil.',
    });

    req.flush({ id: REVISION, status: 'decidida-uuid', caseStatus: 'rechazado-uuid' });
  });

  it('sin decisión elegida no viaja nada: la radio arranca sin marcar', () => {
    formulario().patchValue({ reviewId: REVISION });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
