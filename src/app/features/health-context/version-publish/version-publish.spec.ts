import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { VersionPublished } from '../../../core/data-access/health-context/health-context.types';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { VersionPublish } from './version-publish';

const VERSION = '55555555-5555-4555-8555-555555555555';

describe('VersionPublish', () => {
  let fixture: ComponentFixture<VersionPublish>;
  let component: VersionPublish;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VersionPublish],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(VersionPublish);
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

  it('sin un identificador con forma de UUID no publica nada', () => {
    interno<{ setValue: (v: { versionId: string }) => void }>('form').setValue({
      versionId: 'no-uuid',
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('publica sin cuerpo útil pero con un objeto: null sería un 400', () => {
    interno<{ setValue: (v: { versionId: string }) => void }>('form').setValue({
      versionId: VERSION,
    });

    interno<() => void>('submit')();

    const req = http.expectOne(`/health-context/versions/${VERSION}/publish`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({
      id: VERSION,
      versionNumber: 4,
      statusConceptId: 'concept-published',
      countryHealthContextId: 'ctx-1',
      supersededVersionId: 'ver-anterior',
    });

    const publicada = interno<() => VersionPublished | null>('published')();
    expect(publicada?.versionNumber).toBe(4);
    expect(publicada?.supersededVersionId).toBe('ver-anterior');
  });

  it('una versión sin revisión aprobada es S4 con el motivo del backend', () => {
    interno<{ setValue: (v: { versionId: string }) => void }>('form').setValue({
      versionId: VERSION,
    });

    interno<() => void>('submit')();

    http.expectOne(`/health-context/versions/${VERSION}/publish`).flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'La versión no tiene revisión de calidad aprobada',
        timestamp: 't',
        path: '/p',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const estado = interno<() => ViewState<null>>('state')();
    expect(estado.status).toBe('validation');
    if (estado.status !== 'validation') return;
    expect(estado.issues[0]?.message).toContain('revisión de calidad');
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraPublicacion')();
    expect(interno<() => unknown>('published')()).toBeNull();
  });
});
