import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { PingIngest } from './ping-ingest';

const SUJETO = '7a0f6bd4-1c1e-4c8a-9c2a-1a2b3c4d5e6f';

describe('PingIngest', () => {
  let fixture: ComponentFixture<PingIngest>;
  let component: PingIngest;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PingIngest],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(PingIngest);
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

  interface Fila { patchValue: (v: object) => void }
  interface Repetidor { controls: readonly Fila[]; length: number }

  it('un punto sin longitud no sale a la red', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      trackedSubjectId: SUJETO,
    });
    interno<Repetidor>('filas').controls[0]?.patchValue({ latitude: '-34.6' });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('las coordenadas viajan como número: la asimetría con la lectura es del contrato', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      trackedSubjectId: SUJETO,
    });
    interno<Repetidor>('filas').controls[0]?.patchValue({
      latitude: '-34.603765',
      longitude: '-58.381592',
      accuracyM: '12.5',
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/geo/tracked-subjects/${SUJETO}/pings`);
    expect(req.request.body).toEqual({
      pings: [{ latitude: -34.603765, longitude: -58.381592, accuracyM: 12.5 }],
    });
    expect(typeof req.request.body.pings[0].latitude).toBe('number');
    req.flush({ recorded: 1 });

    expect(interno<() => number | null>('recorded')()).toBe(1);
  });

  it('agrega y quita filas, y la última no se puede quitar', () => {
    interno<() => void>('agregarFila')();
    expect(interno<Repetidor>('filas').length).toBe(2);

    interno<(i: number) => void>('quitarFila')(1);
    interno<(i: number) => void>('quitarFila')(0);
    expect(interno<Repetidor>('filas').length).toBe(1);
  });

  it('el lote entero viaja en una sola petición', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      trackedSubjectId: SUJETO,
    });
    interno<() => void>('agregarFila')();
    const filas = interno<Repetidor>('filas');
    filas.controls[0]?.patchValue({ latitude: '-34.60', longitude: '-58.38' });
    filas.controls[1]?.patchValue({ latitude: '-34.61', longitude: '-58.39' });

    interno<() => void>('submit')();

    const req = http.expectOne(`/geo/tracked-subjects/${SUJETO}/pings`);
    expect(req.request.body.pings).toHaveLength(2);
    req.flush({ recorded: 2 });
  });
});
