import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { RunFinished } from '../../../core/data-access/health-context/health-context.types';
import { CollectionRunFinish } from './collection-run-finish';

const CORRIDA = '77777777-7777-4777-8777-777777777777';

/**
 * Las dos reglas de esta pantalla: una corrida fallida declara qué salió mal
 * **antes** de gastar la petición, y los contadores del cierre se muestran
 * como el texto que son — `bigint` serializado, no `number`.
 */
describe('CollectionRunFinish', () => {
  let fixture: ComponentFixture<CollectionRunFinish>;
  let component: CollectionRunFinish;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CollectionRunFinish],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionRunFinish);
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

  function fijarCorrida(): void {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      collectionRunId: CORRIDA,
    });
  }

  it('una corrida fallida sin resumen de error no se cierra', () => {
    fijarCorrida();
    interno<{ set: (v: string) => void }>('outcome').set('FAILED');

    interno<() => void>('submit')();

    expect(interno<() => boolean>('exigeResumenDeError')()).toBe(true);
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('una corrida completa se cierra sin campos opcionales, y los omite del cuerpo', () => {
    fijarCorrida();
    interno<{ set: (v: string) => void }>('outcome').set('SUCCEEDED');

    interno<() => void>('submit')();

    const req = http.expectOne(`/health-context/collection-runs/${CORRIDA}/finish`);
    expect(req.request.body).toEqual({ outcome: 'SUCCEEDED' });

    req.flush({
      id: CORRIDA,
      statusConceptId: 'c-succeeded',
      observationsRead: '9007199254740993',
      observationsAccepted: '12',
      observationsRejected: '3',
      sourceCount: 2,
    });

    const cierre = interno<() => RunFinished | null>('finished')();
    // Texto, no número: 9007199254740993 > 2^53 y `Number` lo redondearía.
    expect(cierre?.observationsRead).toBe('9007199254740993');
  });

  it('una parcial viaja con su cursor de continuación como objeto, no como texto', () => {
    fijarCorrida();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      continuationCursorJson: '{"page": 3}',
    });
    interno<{ set: (v: string) => void }>('outcome').set('PARTIAL');

    interno<() => void>('submit')();

    const req = http.expectOne(`/health-context/collection-runs/${CORRIDA}/finish`);
    expect(req.request.body).toEqual({
      outcome: 'PARTIAL',
      continuationCursorJson: { page: 3 },
    });
    req.flush({
      id: CORRIDA,
      statusConceptId: 'c-partial',
      observationsRead: '10',
      observationsAccepted: '8',
      observationsRejected: '2',
      sourceCount: 1,
    });
  });

  it('un cursor que no es JSON válido no sale a la red', () => {
    fijarCorrida();
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      continuationCursorJson: '{roto',
    });
    interno<{ set: (v: string) => void }>('outcome').set('PARTIAL');

    interno<() => void>('submit')();
  });

  it('el selector acepta el valor del contrato y rechaza lo desconocido', () => {
    interno<(v: unknown) => void>('elegirResultado')('PARTIAL');
    expect(interno<() => string | null>('outcome')()).toBe('PARTIAL');

    interno<(v: unknown) => void>('elegirResultado')('CUALQUIER_COSA');
    // Un valor fuera del contrato no pisa nada.
    expect(interno<() => string | null>('outcome')()).toBeNull();
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otroCierre')();
    expect(interno<() => unknown>('finished')()).toBeNull();
  });
});
