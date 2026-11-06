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

  /** Which services send which template today; `sentTemplate` makes s-1 the current one. */
  function respondAssignments(sentTemplate: string | null = null): void {
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/service-assignments').flush({
      consultation: {},
      services: [
        {
          serviceId: 'svc',
          serviceName: 'Ecografía',
          assignment: sentTemplate === null ? null : { assignmentId: 'a', catalogCode: 'STD_IMAGING_V1', title: 'x', templateId: sentTemplate, versionId: 'v', assignedAt: null },
        },
      ],
    });
  }
  const find = (selector: string): Element | null => root().querySelector(selector);

  function expectNoManagement(): void {
    for (const testId of ['asignacion-vigentes', 'asignacion-servicio', 'asignacion-guardar', 'encuesta-publicar', 'encuesta-agregar-pregunta', 'question-edit']) {
      expect(find(`[data-testid="${testId}"]`), testId).toBeNull();
    }
    expect(root().textContent).not.toMatch(/Asociar a un servicio|Desactivar encuesta|nueva versión|Publicar versión|Agregar pregunta/);
  }

  it('publicada: se leen las preguntas y las respuestas; no se gestiona nada', () => {
    respondAssignments();
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/templates/s-1').flush(sheet(true));
    http.expectOne((r) => r.method === 'GET' && r.url === '/surveys/templates/s-1/responses').flush([]);
    harness.detectChanges();

    expect(root().textContent).toContain('¿Cómo fue la atención?');
    expect(root().textContent).toContain('¿Volvería?');
    expect(find('#respuestas')).not.toBeNull();
    // A hand-made survey is not sent any more: never «Publicada» alone.
    expect(find('[data-testid="survey-detail-sending"]')?.textContent?.trim()).toBe('Ya no se envía');
    expectNoManagement();
  });

  it('la plantilla que hoy usa un servicio dice «Se envía»', () => {
    respondAssignments('s-1');
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(sheet(true));
    http.expectOne((r) => r.url === '/surveys/templates/s-1/responses').flush([]);
    harness.detectChanges();
    expect(find('[data-testid="survey-detail-sending"]')?.textContent?.trim()).toBe('Se envía');
  });

  it('dice que es de solo lectura y lleva a «Encuestas por servicio»', () => {
    respondAssignments();
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(sheet(true));
    http.expectOne((r) => r.url === '/surveys/templates/s-1/responses').flush([]);
    harness.detectChanges();

    expect(find('[data-testid="survey-detail-read-only"]')?.textContent).toContain('solo lectura');
    expect(find('[data-testid="survey-detail-go-to-services"]')?.getAttribute('href')).toBe('/questionnaires?encuestas=servicios');
  });

  it('borrador viejo: tampoco se compone ni se publica, y no pide respuestas', () => {
    respondAssignments();
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(sheet(false));
    harness.detectChanges();

    expect(root().textContent).toContain('¿Cómo fue la atención?');
    expectNoManagement();
    expect(find('[data-testid="survey-detail-sending"]')?.textContent?.trim()).toBe('Nunca se envió');
    expect(find('#respuestas')).toBeNull();
  });
});
