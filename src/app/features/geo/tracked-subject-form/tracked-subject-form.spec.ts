import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { TrackedSubjectForm } from './tracked-subject-form';

const PERSONA = '7a0f6bd4-1c1e-4c8a-9c2a-1a2b3c4d5e6f';

describe('TrackedSubjectForm', () => {
  let fixture: ComponentFixture<TrackedSubjectForm>;
  let component: TrackedSubjectForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackedSubjectForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackedSubjectForm);
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

  it('el cuerpo NO lleva tenantId: lo pone la cabecera, no el formulario', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ subjectId: PERSONA });

    interno<() => void>('submit')();

    const req = http.expectOne('/geo/tracked-subjects');
    // El campo de propiedad se resuelve por `X-Tenant-Id`; repetirlo en el
    // cuerpo sería una segunda oportunidad de mandar el equivocado y comerse
    // un 403.
    expect(req.request.body).toEqual({ subjectId: PERSONA, subjectType: 'PERSON' });

    req.flush({
      id: 'ts-1',
      subjectId: PERSONA,
      subjectType: 'c-person',
      state: 'c-active',
      createdAt: '2026-08-11T00:00:00.000Z',
    });
  });

  it('el duplicado del backend es S4 con su mensaje, no un error opaco', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({ subjectId: PERSONA });

    interno<() => void>('submit')();

    http.expectOne('/geo/tracked-subjects').flush(
      {
        code: 'CONFLICT',
        message: 'Ya existe un sujeto activo con esa identidad',
        timestamp: 't',
        path: '/p',
      },
      { status: 409, statusText: 'Conflict' },
    );

    const estado = interno<() => ViewState<null>>('state')();
    expect(estado.status).toBe('validation');
    if (estado.status !== 'validation') return;
    expect(estado.issues[0]?.message).toContain('sujeto activo');
  });

  it('el selector acepta el valor del contrato y rechaza lo desconocido', () => {
    interno<(v: unknown) => void>('elegirTipo')('VEHICLE');
    expect(interno<() => string | null>('subjectType')()).toBe('VEHICLE');

    interno<(v: unknown) => void>('elegirTipo')('CUALQUIER_COSA');
    // Un valor fuera del contrato no pisa nada: el tipo por defecto queda.
    expect(interno<() => string | null>('subjectType')()).toBe('VEHICLE');
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraAlta')();
    expect(interno<() => unknown>('created')()).toBeNull();
  });
});
