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
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      outcome: 'REJECTED',
      issuesJson: '{"faltantes": 2}',
      notes: 'Faltan dos hechos con evidencia.',
    });

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
    // El motor sólo ofrece los del contrato; la comprobación sigue al armar el
    // cuerpo, que es lo que llega al backend venga de donde venga el valor.
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      versionId: VERSION,
      reviewTypeConceptId: TIPO,
      outcome: 'CUALQUIER_COSA',
    });
    interno<() => void>('submit')();
    // Nada viajó: `http.verify()` lo comprueba.
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraRevision')();
    expect(interno<() => unknown>('recorded')()).toBeNull();
  });
});
