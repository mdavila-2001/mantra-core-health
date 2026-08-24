import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { CollectionRunStarted } from '../../../core/data-access/health-context/health-context.types';
import { CollectionRunForm } from './collection-run-form';

const AGENDA = '44444444-4444-4444-8444-444444444444';
const AGENTE = '33333333-3333-4333-8333-333333333333';
const PAIS = '11111111-1111-4111-8111-111111111111';

/**
 * La regla de esta pantalla es la del modelo: **una corrida manual dice agente
 * y país, o viene de una programación** — deducirlos sería inventarlos.
 */
describe('CollectionRunForm', () => {
  let fixture: ComponentFixture<CollectionRunForm>;
  let component: CollectionRunForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionRunForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionRunForm);
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

  it('sin agenda y sin agente+país, no arranca: el origen no se deduce', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      idempotencyKey: 'run-1',
      agentId: AGENTE,
      // Falta el país: agente solo no alcanza.
    });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ trigger: 'MANUAL' });

    interno<() => void>('submit')();

    expect(interno<() => boolean>('faltaOrigen')()).toBe(true);
  });

  it('con agenda alcanza, y el duplicado de idempotencia se informa sin error', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      idempotencyKey: 'run-2026-08-11',
      scheduleId: AGENDA,
    });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ trigger: 'SCHEDULED' });

    interno<() => void>('submit')();

    const req = http.expectOne('/health-context/collection-runs');
    expect(req.request.body).toEqual({
      idempotencyKey: 'run-2026-08-11',
      trigger: 'SCHEDULED',
      scheduleId: AGENDA,
    });
    req.flush({ id: 'run-1', statusConceptId: 'c-running', duplicate: true });

    const corrida = interno<() => CollectionRunStarted | null>('started')();
    expect(corrida?.duplicate).toBe(true);
  });

  it('manual con agente y país viaja completa', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      idempotencyKey: 'run-manual',
      agentId: AGENTE,
      countryConceptId: PAIS,
    });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ trigger: 'MANUAL' });

    interno<() => void>('submit')();

    const req = http.expectOne('/health-context/collection-runs');
    expect(req.request.body).toEqual({
      idempotencyKey: 'run-manual',
      trigger: 'MANUAL',
      agentId: AGENTE,
      countryConceptId: PAIS,
    });
    req.flush({ id: 'run-2', statusConceptId: 'c-running', duplicate: false });
  });

  it('el selector acepta el valor del contrato y rechaza lo desconocido', () => {
    // El motor sólo ofrece los dos disparadores del contrato; la comprobación
    // sigue al armar el cuerpo, que es lo que llega al backend.
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ trigger: 'CUALQUIER_COSA' });
    interno<() => void>('submit')();
    // Nada viajó: `http.verify()` lo comprueba.
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraCorrida')();
    expect(interno<() => unknown>('started')()).toBeNull();
  });
});
