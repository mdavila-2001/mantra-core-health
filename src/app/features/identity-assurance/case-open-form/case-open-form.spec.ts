import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CaseOpenForm } from './case-open-form';

const POLITICA = '11111111-1111-1111-1111-111111111111';
const CONCEPTO = '22222222-2222-2222-2222-222222222222';
const SUJETO = '33333333-3333-3333-3333-333333333333';
const CORRELACION = '44444444-4444-4444-4444-444444444444';

describe('CaseOpenForm', () => {
  let fixture: ComponentFixture<CaseOpenForm>;
  let component: CaseOpenForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CaseOpenForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CaseOpenForm);
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

  it('el cuerpo mínimo lleva la política y el sujeto; las fechas vuelven como Date', () => {
    formulario().patchValue({
      identityVerificationPolicyId: POLITICA,
      subjectTypeConceptId: CONCEPTO,
      subjectEntityId: SUJETO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/identity/verification-cases');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      identityVerificationPolicyId: POLITICA,
      subjectTypeConceptId: CONCEPTO,
      subjectEntityId: SUJETO,
    });

    req.flush({
      id: 'caso-1',
      status: 'estado-uuid',
      openedAt: '2026-08-08T12:00:00.000Z',
      expiresAt: '2026-08-11T12:00:00.000Z',
    });

    const abierto = interno<() => { id: string; expiresAt?: Date } | null>('opened')();
    expect(abierto?.id).toBe('caso-1');
    expect(abierto?.expiresAt).toEqual(new Date('2026-08-11T12:00:00.000Z'));
  });

  it('el nivel solicitado, la correlación y el TTL viajan solo cuando se cargan', () => {
    formulario().patchValue({
      identityVerificationPolicyId: POLITICA,
      subjectTypeConceptId: CONCEPTO,
      subjectEntityId: SUJETO,
      requestedAssuranceLevelConceptId: CONCEPTO,
      correlationId: CORRELACION,
      expiresInHours: 48,
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/identity/verification-cases');
    expect(req.request.body).toEqual({
      identityVerificationPolicyId: POLITICA,
      subjectTypeConceptId: CONCEPTO,
      subjectEntityId: SUJETO,
      requestedAssuranceLevelConceptId: CONCEPTO,
      correlationId: CORRELACION,
      expiresInHours: 48,
    });

    req.flush({ id: 'caso-2', status: 'estado-uuid' });
  });

  it('un TTL de 0 horas frena el envío: la vigencia empieza en 1', () => {
    formulario().patchValue({
      identityVerificationPolicyId: POLITICA,
      subjectTypeConceptId: CONCEPTO,
      subjectEntityId: SUJETO,
      expiresInHours: 0,
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});
