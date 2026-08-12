import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { VersionForm } from './version-form';

const CONTEXTO = '99999999-9999-4999-8999-999999999999';
const CORRIDA = '77777777-7777-4777-8777-777777777777';
const OBSERVACION = '88888888-8888-4888-8888-888888888888';

/**
 * La regla que esta pantalla no puede dejar pasar: **un hecho sin evidencia no
 * viaja**. El backend lo rechazaría igual, pero gastarle la petición a un error
 * que se conoce de antemano es usar la red como validador.
 */
describe('VersionForm', () => {
  let fixture: ComponentFixture<VersionForm>;
  let component: VersionForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VersionForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(VersionForm);
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

  interface Fila {
    patchValue: (v: object) => void;
    controls: { evidencias: { controls: readonly { patchValue: (v: object) => void }[] } };
  }
  interface Repetidor { controls: readonly Fila[]; length: number }

  function completarCabecera(): void {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      contextId: CONTEXTO,
      collectionRunId: CORRIDA,
      contextPayloadJson: '{"cobertura": "universal"}',
    });
  }

  it('un hecho con la evidencia vacía no sale a la red', () => {
    completarCabecera();
    interno<Repetidor>('hechos').controls[0]?.patchValue({
      factKey: 'poblacion.total',
      valueType: 'number',
      valueJson: '{"total": 47000000}',
      // La fila de evidencia existe pero está vacía: inválida.
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('el borrador viaja con hechos, evidencia anidada y JSON parseado', () => {
    completarCabecera();
    const hecho = interno<Repetidor>('hechos').controls[0];
    hecho?.patchValue({
      factKey: 'poblacion.total',
      valueType: 'number',
      valueJson: '{"total": 47000000}',
      confidenceScore: '0.98',
    });
    hecho?.controls.evidencias.controls[0]?.patchValue({
      sourceObservationId: OBSERVACION,
      relevanceScore: '0.9',
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/health-context/contexts/${CONTEXTO}/versions`);
    expect(req.request.body).toEqual({
      collectionRunId: CORRIDA,
      contextPayloadJson: { cobertura: 'universal' },
      facts: [
        {
          factKey: 'poblacion.total',
          valueType: 'number',
          valueJson: { total: 47000000 },
          confidenceScore: '0.98',
          evidence: [{ sourceObservationId: OBSERVACION, relevanceScore: '0.9' }],
        },
      ],
    });
    req.flush({
      id: 'ver-1',
      versionNumber: 1,
      statusConceptId: 'c-draft',
      contentHash: 'h',
      factIds: ['f-1'],
      evidenceCount: 1,
    });
  });

  it('cada hecho nace con una fila de evidencia y la última no se quita', () => {
    const hechos = interno<Repetidor>('hechos');
    const hecho = hechos.controls[0];
    if (hecho === undefined) {
      throw new Error('el editor nace con un hecho');
    }

    expect(hecho.controls.evidencias.controls).toHaveLength(1);

    interno<(h: Fila, i: number) => void>('quitarEvidencia')(hecho, 0);
    expect(hecho.controls.evidencias.controls).toHaveLength(1);

    interno<(h: Fila) => void>('agregarEvidencia')(hecho);
    expect(hecho.controls.evidencias.controls).toHaveLength(2);
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraVersion')();
    expect(interno<() => unknown>('drafted')()).toBeNull();
  });
});
