import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { TrackingSession } from '../../../core/data-access/geo/geo.types';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { TrackingSessionClose } from './tracking-session-close';

const SESION = '8b1e7ce5-2d2f-4d9b-8d3b-2b3c4d5e6f70';

describe('TrackingSessionClose', () => {
  let fixture: ComponentFixture<TrackingSessionClose>;
  let component: TrackingSessionClose;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackingSessionClose],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackingSessionClose);
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

  it('sin un identificador con forma de UUID no cierra nada', () => {
    interno<{ setValue: (v: { sessionId: string }) => void }>('form').setValue({
      sessionId: 'no-uuid',
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('cierra con objeto vacío y muestra la sesión con sus dos marcas', () => {
    interno<{ setValue: (v: { sessionId: string }) => void }>('form').setValue({
      sessionId: SESION,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/geo/tracking-sessions/${SESION}/close`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({
      id: SESION,
      trackedSubjectId: 'ts-1',
      status: 'concept-closed',
      startedAt: '2026-08-11T09:00:00.000Z',
      endedAt: '2026-08-11T11:00:00.000Z',
    });

    const cerrada = interno<() => TrackingSession | null>('closed')();
    expect(cerrada?.endedAt).toBeInstanceOf(Date);
  });

  it('con viajes en curso el backend rechaza y la pantalla lo muestra como S4', () => {
    interno<{ setValue: (v: { sessionId: string }) => void }>('form').setValue({
      sessionId: SESION,
    });

    interno<() => void>('submit')();

    http.expectOne(`/geo/tracking-sessions/${SESION}/close`).flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'La sesión tiene viajes en curso',
        timestamp: 't',
        path: '/p',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const estado = interno<() => ViewState<null>>('state')();
    expect(estado.status).toBe('validation');
    if (estado.status !== 'validation') return;
    expect(estado.issues[0]?.message).toContain('viajes en curso');
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otroCierre')();
    expect(interno<() => unknown>('closed')()).toBeNull();
  });
});
