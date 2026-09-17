import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { AuthService } from '@core/auth/auth.service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { RateEncounterDialog } from './rate-encounter-dialog';

const RESUMEN = '/clinical/patients/pat-1/summary';
const RESEÑA = '/patients/me/reviews';

/** Un encuentro tal como llega en el resumen clínico. */
const atencion = (over: Record<string, unknown> = {}) => ({
  id: 'enc-1',
  statusConceptId: 'ENC_FINISHED',
  reasonText: 'Control',
  startAt: '2026-08-01T10:00:00.000Z',
  ...over,
});

/** Un resumen clínico con los bloques que el contrato declara. */
const resumen = (encounters: readonly unknown[]) => ({
  conditions: [],
  allergies: [],
  medicationRequests: [],
  observations: [],
  encounters,
});

async function montar(patientProfileId: string | null = 'pat-1') {
  const toasts = { success: vi.fn(), error: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [RateEncounterDialog],
    providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: AuthService, useValue: { patientProfileId: signal(patientProfileId) } },
      { provide: ToastService, useValue: toasts },
    ],
  }).compileComponents();

  const fixture: ComponentFixture<RateEncounterDialog> =
    TestBed.createComponent(RateEncounterDialog);
  fixture.componentRef.setInput('professionalName', 'Dra. Pérez');
  fixture.detectChanges();
  return { fixture, http: TestBed.inject(HttpTestingController), toasts };
}

/**
 * Una señal, una computada o un método del componente.
 *
 * Invocarlo devuelve `unknown` —que es lo correcto: el helper no sabe qué
 * guarda cada señal—, así que el tipo se declara en la prueba que sí lo sabe.
 */
interface UnMiembro {
  (): unknown;
  set(valor: unknown): void;
}

/** Los miembros protegidos, para hablar de lo que hace sin pasar por el DOM. */
function api(fixture: ComponentFixture<RateEncounterDialog>): Record<string, UnMiembro> {
  return fixture.componentInstance as unknown as Record<string, UnMiembro>;
}

describe('RateEncounterDialog (C.2)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('sólo ofrece las atenciones TERMINADAS: una en curso el servidor la rechaza', async () => {
    const { fixture, http } = await montar();
    http.expectOne(RESUMEN).flush(
      resumen([
        atencion({ id: 'enc-cerrada' }),
        atencion({ id: 'enc-en-curso', statusConceptId: 'ENC_IN_PROGRESS' }),
      ]),
    );
    fixture.detectChanges();

    const opciones = api(fixture)['opciones']() as readonly { value: string }[];
    expect(opciones.map((o) => o.value)).toEqual(['enc-cerrada']);
    http.verify();
  });

  it('con una sola atención la elige sola: no hay nada que decidir', async () => {
    const { fixture, http } = await montar();
    http.expectOne(RESUMEN).flush(resumen([atencion()]));
    fixture.detectChanges();

    expect(api(fixture)['encuentro']()).toBe('enc-1');
    http.verify();
  });

  it('sin atenciones cerradas lo dice, en vez de un formulario que no puede terminar', async () => {
    const { fixture, http } = await montar();
    http.expectOne(RESUMEN).flush(resumen([]));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="calificar-sin-atenciones"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="calificar-enviar"]'),
    ).toBeNull();
    http.verify();
  });

  it('publica nombrando la ATENCIÓN, nunca la vitrina del profesional', async () => {
    // Es el motivo entero de la ruta: la ficha pública no publica su id.
    const { fixture, http, toasts } = await montar();
    http.expectOne(RESUMEN).flush(resumen([atencion()]));
    fixture.detectChanges();
    const componente = api(fixture);

    componente['comentario'].set('  Muy clara al explicar.  ');
    componente['puntaje'].set(4);
    componente['enviar']();

    const req = http.expectOne(RESEÑA);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      verifiedEncounterId: 'enc-1',
      overallRating: 4,
      reviewText: 'Muy clara al explicar.',
      displayMode: 'ANONYMOUS',
    });
    req.flush({ id: 'r-1', overallRating: 4, verified: true });

    expect(toasts.success).toHaveBeenCalled();
    http.verify();
  });

  it('un comentario en blanco no viaja: vacío no es un texto', async () => {
    const { fixture, http } = await montar();
    http.expectOne(RESUMEN).flush(resumen([atencion()]));
    const componente = api(fixture);

    componente['comentario'].set('   ');
    componente['anonimo'].set(false);
    componente['enviar']();

    const req = http.expectOne(RESEÑA);
    expect(req.request.body).toEqual({
      verifiedEncounterId: 'enc-1',
      overallRating: 5,
      displayMode: 'REAL_NAME',
    });
    req.flush({ id: 'r-1', overallRating: 5, verified: true });
    http.verify();
  });

  it('muestra el 422 del servidor TAL COMO VIENE, que es la única pista de qué corregir', async () => {
    const { fixture, http } = await montar();
    http.expectOne(RESUMEN).flush(resumen([atencion()]));
    fixture.detectChanges();

    api(fixture)['enviar']();
    // El envoltorio del contrato: `errorToViewState` despacha por `code`, no
    // por el número de estado. La `PreconditionFailedException` del proyecto
    // responde 422 con este código.
    http.expectOne(RESEÑA).flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'La atención declarada no fue con este profesional',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('[data-testid="calificar-error"]');
    expect(error).not.toBeNull();
    expect(error.textContent).toContain('no fue con este profesional');
    http.verify();
  });

  it('sin perfil de paciente no pide nada al servidor', async () => {
    const { fixture, http } = await montar(null);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="calificar-sin-atenciones"]'),
    ).not.toBeNull();
    http.verify();
  });
});
