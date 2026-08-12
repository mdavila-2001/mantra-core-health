import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { ConsentRevocation } from './consent-revocation';

const SUJETO = '7a0f6bd4-1c1e-4c8a-9c2a-1a2b3c4d5e6f';

describe('ConsentRevocation', () => {
  let fixture: ComponentFixture<ConsentRevocation>;
  let component: ConsentRevocation;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConsentRevocation],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ConsentRevocation);
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

  it('sin un identificador con forma de UUID no revoca nada', () => {
    interno<{ setValue: (v: { trackedSubjectId: string }) => void }>('form').setValue({
      trackedSubjectId: 'no-uuid',
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('revoca con un objeto vacío como cuerpo, no null', () => {
    interno<{ setValue: (v: { trackedSubjectId: string }) => void }>('form').setValue({
      trackedSubjectId: SUJETO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/geo/tracked-subjects/${SUJETO}/revoke-consent`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({ ok: true });
    expect(interno<() => string | null>('revoked')()).toBe(SUJETO);
  });

  it('re-revocar un sujeto ya suspendido es S4 con el motivo del backend', () => {
    interno<{ setValue: (v: { trackedSubjectId: string }) => void }>('form').setValue({
      trackedSubjectId: SUJETO,
    });

    interno<() => void>('submit')();

    http.expectOne(`/geo/tracked-subjects/${SUJETO}/revoke-consent`).flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'El sujeto ya está suspendido',
        timestamp: 't',
        path: '/p',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const estado = interno<() => ViewState<null>>('state')();
    expect(estado.status).toBe('validation');
    if (estado.status !== 'validation') return;
    expect(estado.issues[0]?.message).toContain('suspendido');
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraRevocacion')();
    expect(interno<() => unknown>('revoked')()).toBeNull();
  });
});
