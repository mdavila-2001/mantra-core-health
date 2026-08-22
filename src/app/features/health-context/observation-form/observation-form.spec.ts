import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ObservationForm } from './observation-form';

const CORRIDA = '77777777-7777-4777-8777-777777777777';
const FUENTE = '88888888-8888-4888-8888-888888888888';

describe('ObservationForm', () => {
  let fixture: ComponentFixture<ObservationForm>;
  let component: ObservationForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObservationForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ObservationForm);
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

  /** Todo el formulario en el grupo, desde que lo sirve el motor. */
  function completarMinimo(extra: Record<string, unknown> = {}): void {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      collectionRunId: CORRIDA,
      sourceId: FUENTE,
      contentHash: 'sha256:abc',
      status: 'ACCEPTED',
      ...extra,
    });
  }

  it('un contenido extraído que no es un objeto JSON no sale a la red', () => {
    // La regla la aplica ahora el validador `objetoJson` del control, así que
    // el formulario entero queda inválido y `http.verify()` comprueba que nada
    // viajó.
    completarMinimo({ extractedPayloadJson: '[1,2,3]' });

    interno<() => void>('submit')();

    const control = interno<{ controls: Record<string, { invalid: boolean }> }>('form')
      .controls['extractedPayloadJson'];
    expect(control?.invalid).toBe(true);
  });

  it('la observación viaja con el JSON parseado, no como texto', () => {
    completarMinimo({ extractedPayloadJson: '{"casos": 12}' });

    interno<() => void>('submit')();

    const req = http.expectOne(`/health-context/collection-runs/${CORRIDA}/observations`);
    expect(req.request.body).toEqual({
      sourceId: FUENTE,
      contentHash: 'sha256:abc',
      status: 'ACCEPTED',
      extractedPayloadJson: { casos: 12 },
    });
    req.flush({ id: 'o-1', statusConceptId: 'c-accepted', duplicate: false });
  });

  it('tras registrar, «otra» conserva la corrida: lo normal es cargar varias seguidas', () => {
    completarMinimo();
    interno<() => void>('submit')();
    http
      .expectOne(`/health-context/collection-runs/${CORRIDA}/observations`)
      .flush({ id: 'o-1', statusConceptId: 'c-accepted', duplicate: false });

    interno<() => void>('otraObservacion')();

    const form = interno<{ getRawValue: () => { collectionRunId: string; sourceId: string } }>(
      'form',
    );
    expect(form.getRawValue().collectionRunId).toBe(CORRIDA);
    expect(form.getRawValue().sourceId).toBe('');
  });
});
