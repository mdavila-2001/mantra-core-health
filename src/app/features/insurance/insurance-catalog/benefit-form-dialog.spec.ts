import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BenefitFormDialog } from './benefit-form-dialog';

const PLAN_ID = 'pl-1';
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';
const SERVICE_CONCEPT_ID = '33333333-3333-4333-8333-333333333333';

describe('BenefitFormDialog', () => {
  let fixture: ComponentFixture<BenefitFormDialog>;
  let component: BenefitFormDialog;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(BenefitFormDialog);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('mode', 'create');
    fixture.componentRef.setInput('planId', PLAN_ID);
    fixture.componentRef.setInput('planName', 'Plan Oro');
    fixture.detectChanges();
    // El selector de categoría pide su value set al montar; no es lo que se prueba.
    http.match(() => true);
  });

  afterEach(() => http.verify());

  /** Signals y el formulario, tal cual: `bind` sobre un signal le quita `.set`. */
  function member<T>(name: string): T {
    return (component as unknown as Record<string, unknown>)[name] as T;
  }

  function call<T>(name: string): T {
    return member<(...args: unknown[]) => unknown>(name).bind(component) as T;
  }

  function fill(coverage: string): void {
    member<{ controls: { coveragePercent: { setValue(v: string): void } } }>(
      'form',
    ).controls.coveragePercent.setValue(coverage);
  }

  it('guarda el servicio de la cláusula por el conceptId del arancel', () => {
    member<{ set(v: string): void }>('categoryConceptId').set(CATEGORY_ID);
    member<{ set(v: string): void }>('serviceConceptId').set(SERVICE_CONCEPT_ID);
    fill('80');

    call<() => void>('submit')();

    const request = http.expectOne(`/insurance-plans/${PLAN_ID}/benefits`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      benefitCategoryConceptId: CATEGORY_ID,
      serviceConceptId: SERVICE_CONCEPT_ID,
      coveragePercent: '80',
    });
    request.flush({ id: 'b-9' });
  });

  it('no guarda una cláusula sin servicio', () => {
    member<{ set(v: string): void }>('categoryConceptId').set(CATEGORY_ID);
    fill('80');

    call<() => void>('submit')();

    http.expectNone(`/insurance-plans/${PLAN_ID}/benefits`);
  });

  it('no guarda una cláusula sin porcentaje de pago', () => {
    member<{ set(v: string): void }>('categoryConceptId').set(CATEGORY_ID);
    member<{ set(v: string): void }>('serviceConceptId').set(SERVICE_CONCEPT_ID);

    call<() => void>('submit')();

    http.expectNone(`/insurance-plans/${PLAN_ID}/benefits`);
  });

  it('busca los servicios en el mismo arancel del que importa el médico', () => {
    call<(term: string) => void>('searchServices')('ecog');

    const request = http.expectOne(
      (r) => r.url === '/billing/service-catalog/procedures' && r.params.get('q') === 'ecog',
    );
    request.flush({
      items: [
        {
          conceptId: SERVICE_CONCEPT_ID,
          code: '40.01',
          display: 'Ecografía abdominal',
          specialty: 'Imagenología',
          group: 'Imagenología',
          referencePrice: '20',
          priceUnit: 'UMA',
          ocrSuspect: false,
        },
      ],
      nextCursor: null,
    });

    expect(member<() => unknown>('serviceOptions')()).toEqual([
      { value: SERVICE_CONCEPT_ID, label: 'Ecografía abdominal', hint: '40.01 · Imagenología' },
    ]);
  });
});
