import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { API_BASE_URL } from '../../../core/data-access/api';
import { SurveyDetailScreen } from './survey-detail';

/* The sheet of a hand-made survey is READ-ONLY (06/11/2026): the API rejects
   non-catalog assignments (`SURVEY_ASSIGNMENT_REQUIRES_CATALOG_TEMPLATE`), so
   nothing here composes, publishes, attaches, deactivates or versions a survey.
   The questionnaire and the responses stay readable. */

const questions = [
  { id: 'q-1', position: 1, questionText: '¿Cómo fue la atención?', answerType: 'TEXT', required: false },
  { id: 'q-2', position: 2, questionText: '¿Volvería?', answerType: 'BOOLEAN', required: true },
];

function sheet(published: boolean): Record<string, unknown> {
  return {
    id: 's-1',
    title: 'Satisfacción con la consulta',
    status: published ? 'ACTIVE' : 'DRAFT',
    latestVersionNumber: 1,
    latestVersionId: 'ver-1',
    published,
    questionCount: questions.length,
    responseWindowDays: 7,
    effectiveFrom: null,
    effectiveTo: null,
    questions,
    assignments: [{ id: 'a-1', targetType: 'CARE_TYPE', targetId: 'c-1' }],
  };
}

describe('SurveyDetailScreen · solo lectura', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        provideRouter([{ path: 'questionnaires/:surveyId', component: SurveyDetailScreen }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/questionnaires/s-1', SurveyDetailScreen);
  });

  // `verify` also proves no service list nor any write is requested.
  afterEach(() => http.verify());

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  /**
   * The two reads that say whether the survey is sent today. `sentTemplate`
   * makes s-1 the template a service uses; `system` lists s-1 as a system base
   * survey; `assignmentsFail` breaks the service list (status unknown).
   */
  function respondSending(options: { sentTemplate?: string; system?: boolean; assignmentsFail?: boolean } = {}): void {
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/catalog').flush(options.system ? [{ id: 's-1', origin: 'SYSTEM', assignments: [] }] : []);
    const list = http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/service-assignments');
    if (options.assignmentsFail) {
      list.flush({ code: 'INTERNAL', message: '' }, { status: 500, statusText: 'x' });
      return;
    }
    list.flush({
      consultation: {},
      services: [
        {
          serviceId: 'svc',
          serviceName: 'Ecografía',
          assignment: options.sentTemplate === undefined ? null : { assignmentId: 'a', catalogCode: 'STD_IMAGING_V1', title: 'x', templateId: options.sentTemplate, versionId: 'v', assignedAt: null },
        },
      ],
    });
  }
  const tabLabels = (): string[] => [...root().querySelectorAll('[data-testid="survey-detail-tabs"] [role="tab"]')].map((t) => t.textContent?.trim() ?? '');
  const find = (selector: string): Element | null => root().querySelector(selector);

  function expectNoManagement(): void {
    for (const testId of ['asignacion-vigentes', 'asignacion-servicio', 'asignacion-guardar', 'encuesta-publicar', 'encuesta-agregar-pregunta', 'question-edit']) {
      expect(find(`[data-testid="${testId}"]`), testId).toBeNull();
    }
    expect(root().textContent).not.toMatch(/Asociar a un servicio|Desactivar encuesta|nueva versión|Publicar versión|Agregar pregunta/);
  }

  it('publicada: se leen las preguntas y las respuestas; no se gestiona nada', () => {
    respondSending();
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/templates/s-1').flush(sheet(true));
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/templates/s-1/responses').flush([]);
    harness.detectChanges();

    expect(root().textContent).toContain('¿Cómo fue la atención?');
    expect(root().textContent).toContain('¿Volvería?');
    // ONE card with tabs; the published one also has its summary and answers.
    expect(root().querySelectorAll('app-card')).toHaveLength(1);
    expect(tabLabels()).toEqual(['Preguntas', 'Resumen', 'Respuestas']);
    // A hand-made survey is not sent any more: never «Publicada» alone.
    expect(find('[data-testid="survey-detail-sending"]')?.textContent?.trim()).toBe('Ya no se envía');
    expectNoManagement();
  });

  it('la plantilla que hoy usa un servicio dice «Se envía»', () => {
    respondSending({ sentTemplate: 's-1' });
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(sheet(true));
    http.expectOne((r) => r.url === '/surveys/templates/s-1/responses').flush([]);
    harness.detectChanges();
    expect(find('[data-testid="survey-detail-sending"]')?.textContent?.trim()).toBe('Se envía');
  });

  it('dice que es de solo lectura y lleva a «Encuestas por servicio»', () => {
    respondSending();
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(sheet(true));
    http.expectOne((r) => r.url === '/surveys/templates/s-1/responses').flush([]);
    harness.detectChanges();

    expect(find('[data-testid="survey-detail-read-only"]')?.textContent).toContain('Solo lectura');
    expect(find('[data-testid="survey-detail-go-to-services"]')?.getAttribute('href')).toBe('/questionnaires?encuestas=servicios');
  });

  it('borrador viejo: tampoco se compone ni se publica, y no pide respuestas', () => {
    respondSending();
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(sheet(false));
    harness.detectChanges();

    expect(root().textContent).toContain('¿Cómo fue la atención?');
    expectNoManagement();
    expect(find('[data-testid="survey-detail-sending"]')?.textContent?.trim()).toBe('Nunca se envió');
    expect(tabLabels()).toEqual(['Preguntas']);
  });

  it('una encuesta base del sistema abierta por URL siempre «Se envía»', () => {
    respondSending({ system: true });
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(sheet(true));
    http.expectOne((r) => r.url === '/surveys/templates/s-1/responses').flush([]);
    harness.detectChanges();
    expect(find('[data-testid="survey-detail-sending"]')?.textContent?.trim()).toBe('Se envía');
  });

  it('mientras comprueba dice «Comprobando…»; si la lista de servicios falla, no afirma nada', () => {
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(sheet(true));
    http.expectOne((r) => r.url === '/surveys/templates/s-1/responses').flush([]);
    harness.detectChanges();
    expect(find('[data-testid="survey-detail-sending"]')?.textContent?.trim()).toBe('Comprobando…');

    respondSending({ assignmentsFail: true });
    harness.detectChanges();
    expect(find('[data-testid="survey-detail-sending"]')?.textContent?.trim()).toBe('Envío sin confirmar');
  });
});
