import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ActorEvaluation } from './actor-evaluation';

const DELEGACION = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('ActorEvaluation', () => {
  let fixture: ComponentFixture<ActorEvaluation>;
  let component: ActorEvaluation;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActorEvaluation],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ActorEvaluation);
    component = fixture.componentInstance;
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

  function conDelegacion() {
    interno<{ patchValue: (v: Record<string, string>) => void }>('form').patchValue({
      practitionerDelegateAssignmentId: DELEGACION,
    });
  }

  it('sin delegación o sin propósito, la consulta ni sale', () => {
    interno<() => void>('submit')();

    conDelegacion();
    interno<() => void>('submit')();
    // Sigue faltando el propósito: `http.verify()` comprueba que nada viajó.
  });

  it('lo mínimo viaja con la delegación y el propósito, sin claves de más', () => {
    conDelegacion();
    interno<(v: unknown) => void>('elegirProposito')('BILLING');

    interno<() => void>('submit')();

    const req = http.expectOne('/authz/effective-actor/evaluate');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      practitionerDelegateAssignmentId: DELEGACION,
      purpose: 'BILLING',
    });

    req.flush({ allowed: true, requiresStepUp: false });
    expect(interno<() => { allowed: boolean } | null>('veredicto')()?.allowed).toBe(true);
  });

  it('el veredicto elige el tono por su contenido: step-up avisa, denegado alerta', () => {
    conDelegacion();
    interno<(v: unknown) => void>('elegirProposito')('TREATMENT');

    interno<() => void>('submit')();
    http
      .expectOne('/authz/effective-actor/evaluate')
      .flush({ allowed: true, requiresStepUp: true });
    expect(interno<() => string>('tonoDelVeredicto')()).toBe('warning');

    interno<() => void>('otraEvaluacion')();
    interno<() => void>('submit')();
    http
      .expectOne('/authz/effective-actor/evaluate')
      .flush({ allowed: false, requiresStepUp: false, reason: 'delegación vencida' });
    expect(interno<() => string>('tonoDelVeredicto')()).toBe('error');
  });

  it('un propósito fuera del contrato no entra', () => {
    interno<(v: unknown) => void>('elegirProposito')('RESEARCH');
    expect(interno<() => string | null>('purpose')()).toBeNull();
  });
});
