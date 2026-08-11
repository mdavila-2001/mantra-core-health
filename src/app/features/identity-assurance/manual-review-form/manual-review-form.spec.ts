import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { ManualReviewForm } from './manual-review-form';

const CASO = '11111111-1111-1111-1111-111111111111';
const CONCEPTO = '22222222-2222-2222-2222-222222222222';
const REVISOR = '33333333-3333-3333-3333-333333333333';

describe('ManualReviewForm', () => {
  let fixture: ComponentFixture<ManualReviewForm>;
  let component: ManualReviewForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ManualReviewForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ManualReviewForm);
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

  it('escala contra la ruta del caso pegado; sin revisor, el cuerpo es solo el motivo', () => {
    formulario().patchValue({
      caseId: CASO,
      reviewReasonConceptId: CONCEPTO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/manual-review`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reviewReasonConceptId: CONCEPTO });

    req.flush({ id: 'mr-1', status: 'abierta-uuid', caseStatus: 'en-revision-uuid' });
    expect(interno<() => { id: string } | null>('opened')()?.id).toBe('mr-1');
  });

  it('el revisor asignado viaja solo cuando se elige', () => {
    formulario().patchValue({
      caseId: CASO,
      reviewReasonConceptId: CONCEPTO,
      assignedToUserId: REVISOR,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/identity/verification-cases/${CASO}/manual-review`);
    expect(req.request.body).toEqual({
      reviewReasonConceptId: CONCEPTO,
      assignedToUserId: REVISOR,
    });

    req.flush({ id: 'mr-2', status: 'abierta-uuid', caseStatus: 'en-revision-uuid' });
  });

  it('sin motivo no viaja nada: escalar exige decir por qué', () => {
    formulario().patchValue({ caseId: CASO });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que nada salió.
  });
});

/**
 * Prefill desde la cola de revisión.
 *
 * Va en un bloque propio porque necesita una `ActivatedRoute` con parámetros,
 * y el `beforeEach` de arriba monta el componente sin ninguno.
 */
describe('ManualReviewForm · caso precargado desde la cola', () => {
  function montar(queryParams: Record<string, string>) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ManualReviewForm],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
        },
      ],
    });
    const fixture = TestBed.createComponent(ManualReviewForm);
    fixture.detectChanges();
    const form = (fixture.componentInstance as unknown as Record<string, unknown>)['form'] as {
      getRawValue: () => { caseId: string };
    };
    return { fixture, form };
  }

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('toma el caseId de la query y lo deja puesto', () => {
    const { form } = montar({ caseId: CASO });
    expect(form.getRawValue().caseId).toBe(CASO);
  });

  it('descarta un caseId que no sea uuid en vez de dejar el formulario inválido solo', () => {
    const { form } = montar({ caseId: 'no-es-un-uuid' });
    expect(form.getRawValue().caseId).toBe('');
  });

  it('sin query param arranca vacío, como siempre', () => {
    const { form } = montar({});
    expect(form.getRawValue().caseId).toBe('');
  });
});
