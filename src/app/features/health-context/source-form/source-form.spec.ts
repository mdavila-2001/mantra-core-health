import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SourceForm } from './source-form';

const TIPO = '11111111-1111-4111-8111-111111111111';
const CONFIANZA = '22222222-2222-4222-8222-222222222222';

describe('SourceForm', () => {
  let fixture: ComponentFixture<SourceForm>;
  let component: SourceForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SourceForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(SourceForm);
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

  it('sin nivel de confianza no se registra: es lo que gobierna qué se acepta', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      code: 'msal',
      name: 'Ministerio de Salud',
      sourceTypeConceptId: TIPO,
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('la licencia viaja con la fuente cuando se carga', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      code: 'msal',
      name: 'Ministerio de Salud',
      sourceTypeConceptId: TIPO,
      trustTierConceptId: CONFIANZA,
    });
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      licenseText: 'CC BY 4.0',
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/health-context/sources');
    expect(req.request.body).toEqual({
      code: 'msal',
      name: 'Ministerio de Salud',
      sourceTypeConceptId: TIPO,
      trustTierConceptId: CONFIANZA,
      licenseText: 'CC BY 4.0',
    });
    req.flush({ id: 's-1', code: 'msal', statusConceptId: 'c-active' });
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraAlta')();
    expect(interno<() => unknown>('created')()).toBeNull();
  });
});
