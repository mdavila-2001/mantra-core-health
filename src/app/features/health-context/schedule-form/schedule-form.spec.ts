import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ScheduleForm } from './schedule-form';

const PAIS = '11111111-1111-4111-8111-111111111111';
const AGENTE = '33333333-3333-4333-8333-333333333333';

describe('ScheduleForm', () => {
  let fixture: ComponentFixture<ScheduleForm>;
  let component: ScheduleForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ScheduleForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ScheduleForm);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (component as unknown as Record<string, unknown>)[nombre];
    if (typeof valor !== 'function') return valor as T;
    const esSenal = 'set' in valor || 'update' in valor || 'asReadonly' in valor;
    return (esSenal ? valor : valor.bind(component)) as T;
  }

  it('una vigencia menor a 60 segundos no sale a la red: el contrato la rechaza', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      countryConceptId: PAIS,
      agentId: AGENTE,
      scheduleExpression: '0 3 * * *',
      freshnessTtlSeconds: '30',
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('los números viajan como números y los opcionales vacíos se omiten', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      countryConceptId: PAIS,
      agentId: AGENTE,
      scheduleExpression: '0 3 * * *',
      lookbackDays: '7',
      freshnessTtlSeconds: '3600',
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/health-context/schedules');
    expect(req.request.body).toEqual({
      countryConceptId: PAIS,
      agentId: AGENTE,
      scheduleExpression: '0 3 * * *',
      lookbackDays: 7,
      freshnessTtlSeconds: 3600,
    });
    req.flush({
      id: 'sch-1',
      agentId: AGENTE,
      statusConceptId: 'c-active',
      nextRunAt: '2026-08-12T03:00:00.000Z',
    });
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraAgenda')();
    expect(interno<() => unknown>('created')()).toBeNull();
  });
});
