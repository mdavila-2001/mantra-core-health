import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { GeofenceEventForm } from './geofence-event-form';

const GEOCERCA = '11111111-1111-4111-8111-111111111111';
const SUJETO = '7a0f6bd4-1c1e-4c8a-9c2a-1a2b3c4d5e6f';

describe('GeofenceEventForm', () => {
  let fixture: ComponentFixture<GeofenceEventForm>;
  let component: GeofenceEventForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GeofenceEventForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(GeofenceEventForm);
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

  it('sin sentido elegido no registra nada', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      geofenceId: GEOCERCA,
      trackedSubjectId: SUJETO,
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('el cruce viaja con su sentido y sin opcionales vacíos', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      geofenceId: GEOCERCA,
      trackedSubjectId: SUJETO,
    });
    interno<{ set: (v: string) => void }>('eventType').set('ENTER');

    interno<() => void>('submit')();

    const req = http.expectOne('/geo/geofence-events');
    expect(req.request.body).toEqual({
      geofenceId: GEOCERCA,
      trackedSubjectId: SUJETO,
      eventType: 'ENTER',
    });
    req.flush({
      id: 'e-1',
      geofenceId: GEOCERCA,
      trackedSubjectId: SUJETO,
      eventType: 'c-enter',
      recordedAt: '2026-08-11T10:00:00.000Z',
    });
  });

  it('el mismo sentido dos veces seguidas es S4: ya estaba de ese lado', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      geofenceId: GEOCERCA,
      trackedSubjectId: SUJETO,
    });
    interno<{ set: (v: string) => void }>('eventType').set('ENTER');

    interno<() => void>('submit')();

    http.expectOne('/geo/geofence-events').flush(
      { code: 'CONFLICT', message: 'El sujeto ya está dentro del área', timestamp: 't', path: '/p' },
      { status: 409, statusText: 'Conflict' },
    );

    const estado = interno<() => ViewState<null>>('state')();
    expect(estado.status).toBe('validation');
    if (estado.status !== 'validation') return;
    expect(estado.issues[0]?.message).toContain('dentro del área');
  });

  it('el selector acepta el valor del contrato y rechaza lo desconocido', () => {
    interno<(v: unknown) => void>('elegirSentido')('EXIT');
    expect(interno<() => string | null>('eventType')()).toBe('EXIT');

    interno<(v: unknown) => void>('elegirSentido')('CUALQUIER_COSA');
    // Un valor fuera del contrato no pisa nada.
    expect(interno<() => string | null>('eventType')()).toBeNull();
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otroCruce')();
    expect(interno<() => unknown>('created')()).toBeNull();
  });
});
