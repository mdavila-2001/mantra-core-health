import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { AgentForm } from './agent-form';

const TIPO = '11111111-1111-4111-8111-111111111111';

describe('AgentForm', () => {
  let fixture: ComponentFixture<AgentForm>;
  let component: AgentForm;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AgentForm],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(AgentForm);
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

  it('el alta viaja recortada y sin opcionales vacíos', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      code: '  boletin-scraper  ',
      name: 'Scraper del boletín',
      agentTypeConceptId: TIPO,
    });

    interno<() => void>('submit')();

    const req = http.expectOne('/health-context/agents');
    expect(req.request.body).toEqual({
      code: 'boletin-scraper',
      name: 'Scraper del boletín',
      agentTypeConceptId: TIPO,
    });
    req.flush({ id: 'a-1', code: 'boletin-scraper', statusConceptId: 'c-active' });
  });

  it('el código duplicado es S4 con el mensaje del backend', () => {
    interno<{ patchValue: (v: object) => void }>('form').patchValue({
      code: 'boletin-scraper',
      name: 'Otro',
      agentTypeConceptId: TIPO,
    });

    interno<() => void>('submit')();

    http.expectOne('/health-context/agents').flush(
      { code: 'CONFLICT', message: 'El código de agente ya existe', timestamp: 't', path: '/p' },
      { status: 409, statusText: 'Conflict' },
    );

    const estado = interno<() => ViewState<null>>('state')();
    expect(estado.status).toBe('validation');
    if (estado.status !== 'validation') return;
    expect(estado.issues[0]?.message).toContain('ya existe');
  });

  it('la pantalla se reinicia para otra carga', () => {
    interno<() => void>('otraAlta')();
    expect(interno<() => unknown>('created')()).toBeNull();
  });
});
