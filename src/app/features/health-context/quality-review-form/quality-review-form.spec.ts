import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { QualityReviewForm } from './quality-review-form';

const VERSION = '55555555-5555-4555-8555-555555555555';
const TIPO = '11111111-1111-4111-8111-111111111111';

describe('QualityReviewForm', () => {
  let fixture: ComponentFixture<QualityReviewForm>;
  let component: QualityReviewForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QualityReviewForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(QualityReviewForm);
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

  it('sin veredicto no registra nada', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      versionId: VERSION,
      reviewTypeConceptId: TIPO,
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('el rechazo viaja con sus problemas como objeto JSON', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      versionId: VERSION,
      reviewTypeConceptId: TIPO,
    });
    interno<{ set: (v: string) => void }>('outcome').set('REJECTED');
    interno<{ set: (v: string) => void }>('issuesJson').set('{"faltantes": 2}');
    interno<{ set: (v: string) => void }>('notes').set('Faltan dos hechos con evidencia.');

    interno<() => void>('submit')();

    const req = http.expectOne(`/health-context/versions/${VERSION}/quality-reviews`);
    expect(req.request.body).toEqual({
      reviewTypeConceptId: TIPO,
      outcome: 'REJECTED',
      issuesJson: { faltantes: 2 },
      notes: 'Faltan dos hechos con evidencia.',
    });
    req.flush({
      id: 'qr-1',
      contextVersionId: VERSION,
      versionStatusConceptId: 'c-rejected',
    });
  });

  it('el selector acepta el valor del contrato y rechaza lo desconocido', () => {
    interno<(v: unknown) => void>('elegirVeredicto')('APPROVED');
    expect(interno<() => string | null>('outcome')()).toBe('APPROVED');

    interno<(v: unknown) => void>('elegirVeredicto')('CUALQUIER_COSA');
    // Un valor fuera del contrato no pisa nada.
    expect(interno<() => string | null>('outcome')()).toBeNull();
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraRevision')();
    expect(interno<() => unknown>('recorded')()).toBeNull();
  });
});
