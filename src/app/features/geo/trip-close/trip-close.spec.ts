import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Trip } from '../../../core/data-access/geo/geo.types';
import { TripClose } from './trip-close';

const VIAJE = '9c2f8df6-3e30-4eac-9e4c-3c4d5e6f7a81';

describe('TripClose', () => {
  let fixture: ComponentFixture<TripClose>;
  let component: TripClose;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripClose],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TripClose);
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

  function completar(campos: object): void {
    interno<{ patchValue: (v: object) => void }>('form').patchValue(campos);
  }

  it('una medida negativa no sale a la red', () => {
    completar({ tripId: VIAJE, distanceM: '-5' });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('sin medidas el cuerpo va vacío: mandarlas en null sería un 400', () => {
    completar({ tripId: VIAJE });

    interno<() => void>('submit')();

    const req = http.expectOne(`/geo/trips/${VIAJE}/close`);
    expect(req.request.body).toEqual({});
    req.flush({ id: VIAJE, status: 'concept-completed' });
  });

  it('las medidas viajan como número y la distancia vuelve como texto', () => {
    completar({ tripId: VIAJE, distanceM: '1250', durationS: '900' });

    interno<() => void>('submit')();

    const req = http.expectOne(`/geo/trips/${VIAJE}/close`);
    expect(req.request.body).toEqual({ distanceM: 1250, durationS: 900 });

    req.flush({
      id: VIAJE,
      trackingSessionId: 's-1',
      status: 'concept-completed',
      distanceM: '1250.00',
      durationS: 900,
      startedAt: '2026-08-11T09:00:00.000Z',
      endedAt: '2026-08-11T09:15:00.000Z',
    });

    const cerrado = interno<() => Trip | null>('closed')();
    // `numeric` de Postgres: al volver es texto y así se muestra.
    expect(cerrado?.distanceM).toBe('1250.00');
    expect(cerrado?.durationS).toBe(900);
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otroCierre')();
    expect(interno<() => unknown>('closed')()).toBeNull();
  });
});
