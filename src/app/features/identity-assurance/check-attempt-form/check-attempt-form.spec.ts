import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CheckAttemptForm } from './check-attempt-form';

const CHECK = '11111111-1111-1111-1111-111111111111';
const ENDPOINT = '22222222-2222-2222-2222-222222222222';
const MENSAJE = '33333333-3333-3333-3333-333333333333';

describe('CheckAttemptForm', () => {
  let fixture: ComponentFixture<CheckAttemptForm>;
  let component: CheckAttemptForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckAttemptForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CheckAttemptForm);
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

  it('el mínimo viaja al check pegado con los defaults explícitos del contrato', () => {
    formulario().patchValue({
      checkId: CHECK,
      identityAuthorityEndpointId: ENDPOINT,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/checks/${CHECK}/attempts`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      identityAuthorityEndpointId: ENDPOINT,
      outcome: 'SUCCESS',
      retryEligible: false,
    });

    req.flush({
      id: 'at-1',
      attemptNumber: 1,
      outcome: 'SUCCESS',
      checkStatus: 'estado-uuid',
    });
    expect(interno<() => { attemptNumber: number } | null>('recorded')()?.attemptNumber).toBe(1);
  });

  it('un intento fallido lleva el desenlace elegido, el error y la correlación', () => {
    formulario().patchValue({
      checkId: CHECK,
      identityAuthorityEndpointId: ENDPOINT,
      idempotencyKey: 'intento-7',
      requestMessageId: MENSAJE,
      responseMessageId: MENSAJE,
      technicalErrorCode: 'TIMEOUT',
      retryEligible: true,
    });
    interno<(valor: unknown) => void>('elegirResultado')('FAILED');

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/checks/${CHECK}/attempts`);
    expect(req.request.body).toEqual({
      identityAuthorityEndpointId: ENDPOINT,
      outcome: 'FAILED',
      idempotencyKey: 'intento-7',
      requestMessageId: MENSAJE,
      responseMessageId: MENSAJE,
      technicalErrorCode: 'TIMEOUT',
      retryEligible: true,
    });

    req.flush({
      id: 'at-2',
      attemptNumber: 2,
      outcome: 'FAILED',
      checkStatus: 'estado-uuid',
    });
  });

  it('sin check no viaja nada: el intento pertenece a un check planificado', () => {
    formulario().patchValue({ identityAuthorityEndpointId: ENDPOINT });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
