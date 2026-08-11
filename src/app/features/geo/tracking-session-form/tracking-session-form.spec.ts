import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { TrackingSessionForm } from './tracking-session-form';

const SUJETO = '7a0f6bd4-1c1e-4c8a-9c2a-1a2b3c4d5e6f';

describe('TrackingSessionForm', () => {
  let fixture: ComponentFixture<TrackingSessionForm>;
  let component: TrackingSessionForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TrackingSessionForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(TrackingSessionForm);
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

  it('los opcionales vacíos se omiten del cuerpo, no viajan en blanco', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      trackedSubjectId: SUJETO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/geo/tracking-sessions');
    expect(req.request.body).toEqual({ trackedSubjectId: SUJETO });

    req.flush({
      id: 's-1',
      trackedSubjectId: SUJETO,
      status: 'c-open',
      startedAt: '2026-08-11T09:00:00.000Z',
      endedAt: null,
    });
  });

  it('con propósito y recurso, viajan completos y recortados', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      trackedSubjectId: SUJETO,
      purposeConceptId: '11111111-1111-4111-8111-111111111111',
      relatedResourceType: '  traslado  ',
      relatedResourceId: '22222222-2222-4222-8222-222222222222',
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/geo/tracking-sessions');
    expect(req.request.body).toEqual({
      trackedSubjectId: SUJETO,
      purposeConceptId: '11111111-1111-4111-8111-111111111111',
      relatedResourceType: 'traslado',
      relatedResourceId: '22222222-2222-4222-8222-222222222222',
    });

    req.flush({ id: 's-2', trackedSubjectId: SUJETO, status: 'c-open' });
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraApertura')();
    expect(interno<() => unknown>('created')()).toBeNull();
  });
});
