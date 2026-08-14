import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { ContextForm } from './context-form';

const PAIS = '11111111-1111-4111-8111-111111111111';
const DOMINIO = '22222222-2222-4222-8222-222222222222';

describe('ContextForm', () => {
  let fixture: ComponentFixture<ContextForm>;
  let component: ContextForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContextForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ContextForm);
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

  it('un concepto que no tiene forma de UUID no sale a la red', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      countryConceptId: 'argentina',
      contextDomainConceptId: DOMINIO,
      contextKey: 'k',
      title: 't',
    });

    interno<() => void>('submit')();
    // `http.verify()` comprueba que no salió ninguna petición.
  });

  it('el alta viaja completa, con la descripción solo si se escribió', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      countryConceptId: PAIS,
      contextDomainConceptId: DOMINIO,
      contextKey: 'cobertura.publica',
      title: 'Cobertura pública',
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/health-context/contexts');
    expect(req.request.body).toEqual({
      countryConceptId: PAIS,
      contextDomainConceptId: DOMINIO,
      contextKey: 'cobertura.publica',
      title: 'Cobertura pública',
    });
    req.flush({ id: 'ctx-1', contextKey: 'cobertura.publica', statusConceptId: 'c-draft' });
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraAlta')();
    expect(interno<() => unknown>('created')()).toBeNull();
  });
});
