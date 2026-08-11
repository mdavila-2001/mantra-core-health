import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { TripForm } from './trip-form';

const SESION = '8b1e7ce5-2d2f-4d9b-8d3b-2b3c4d5e6f70';

describe('TripForm', () => {
  let fixture: ComponentFixture<TripForm>;
  let component: TripForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TripForm);
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

  it('sin direcciones, el cuerpo lleva solo la sesión', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      trackingSessionId: SESION,
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/geo/trips');
    expect(req.request.body).toEqual({ trackingSessionId: SESION });
    req.flush({ id: 't-1', trackingSessionId: SESION, status: 'c-in-progress' });
  });

  it('un segundo viaje en curso es S4 con el motivo del backend', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      trackingSessionId: SESION,
    });

    interno<() => void>('submit')();

    http.expectOne('/geo/trips').flush(
      {
        code: 'CONFLICT',
        message: 'La sesión ya tiene un viaje en curso',
        timestamp: 't',
        path: '/p',
      },
      { status: 409, statusText: 'Conflict' },
    );

    const estado = interno<() => ViewState<null>>('state')();
    expect(estado.status).toBe('validation');
    if (estado.status !== 'validation') return;
    expect(estado.issues[0]?.message).toContain('viaje en curso');
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otroViaje')();
    expect(interno<() => unknown>('created')()).toBeNull();
  });
});
