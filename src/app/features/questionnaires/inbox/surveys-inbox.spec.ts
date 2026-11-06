import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { API_BASE_URL } from '../../../core/data-access/api';
import { SurveyInsightsPanel } from '../insights/survey-insights';
import { SurveysInbox } from './surveys-inbox';

/**
 * «Cómo le va» has its own spec and its own requests. Here it is replaced by a
 * stub so `http.verify()` keeps demanding that the only reads are
 * `GET /surveys/catalog` and `GET /surveys/service-assignments`.
 */
@Component({ selector: 'app-survey-insights', template: '' })
class InsightsStub {}

/* ============================================================================
    The «Buzón» is READ-ONLY (product decision, 06/11/2026). What is pinned:

    1. Nothing manages a survey: no «Abrir», no status filter, no drafts, no
       «Nueva encuesta».
    2. A practitioner survey is current ONLY when it is the template imported
       for one of their services; any other hand-made one is a past survey
       («Encuesta anterior (ya no se envía)»), never «Activa».
    3. Search narrows by title and description, accent-insensitive; «no
       matches» and «no surveys» are two different states.
   ========================================================================== */

function wireSurvey(
  id: string,
  title: string,
  status: 'DRAFT' | 'ACTIVE' | 'INACTIVE',
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    title,
    status,
    latestVersionNumber: 1,
    published: status !== 'DRAFT',
    questionCount: 3,
    origin: 'PRACTITIONER',
    assignments: [],
    ...extra,
  };
}

const CATALOG: readonly Record<string, unknown>[] = [
  wireSurvey('base-c', 'Encuesta de su consulta médica', 'ACTIVE', { origin: 'SYSTEM', scope: 'CONSULTATION' }),
  wireSurvey('legacy', 'Satisfacción con la consulta', 'ACTIVE', {
    description: 'Cómo le fue con la atención.',
    assignments: [{ id: 'a0', targetType: 'CARE_TYPE', targetId: 'c1' }],
  }),
  wireSurvey('std', 'Estudios por imágenes', 'ACTIVE', {
    description: 'Privacidad y explicación del estudio.',
    assignments: [{ id: 'a1', targetType: 'SERVICE', targetId: 'svc-eco', targetName: 'Ecocardiograma' }],
  }),
  wireSurvey('old', 'Derivación a kinesiología', 'INACTIVE'),
  wireSurvey('draft', 'Borrador sin enviar', 'DRAFT'),
];

const SERVICE_ASSIGNMENTS = {
  consultation: { system: true, title: 'Cita médica', templateTitle: 'x', questionCount: 1, replaceable: false },
  services: [
    {
      serviceId: 'svc-eco',
      serviceName: 'Ecocardiograma',
      assignment: { assignmentId: 'a1', catalogCode: 'STD_IMAGING_V1', title: 'Estudios por imágenes', templateId: 'std', versionId: 'v', assignedAt: null },
    },
  ],
};

describe('SurveysInbox · Buzón de solo lectura', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
        provideRouter([{ path: 'questionnaires', component: SurveysInbox }]),
      ],
    });
    TestBed.overrideComponent(SurveysInbox, {
      remove: { imports: [SurveyInsightsPanel] },
      add: { imports: [InsightsStub] },
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/questionnaires', SurveysInbox);
  });

  afterEach(() => http.verify());

  function respond(catalog: readonly Record<string, unknown>[] = CATALOG, assignments: object | null = SERVICE_ASSIGNMENTS): void {
    http.expectOne((r) => r.url === '/surveys/catalog').flush(catalog);
    const read = http.expectOne((r) => r.url === '/surveys/service-assignments');
    if (assignments === null) read.flush({ code: 'INTERNAL', message: '' }, { status: 500, statusText: 'x' });
    else read.flush(assignments);
    harness.detectChanges();
  }

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const find = (selector: string): HTMLElement | null => root().querySelector(selector);
  const titles = (): readonly string[] =>
    Array.from(root().querySelectorAll('.tarjeta__titulo')).map((node) => node.textContent?.trim() ?? '');
  const statusOf = (id: string): string => find(`[data-testid="survey-card-status-${id}"]`)?.textContent?.trim() ?? '';

  function type(text: string): void {
    const field = root().querySelector<HTMLInputElement>('[data-testid="surveys-inbox-search"] input');
    expect(field).not.toBeNull();
    field!.value = text;
    field!.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  it('«Cómo le va» va ARRIBA de la lista', () => {
    respond();
    const summary = find('app-survey-insights');
    const list = find('[data-testid="surveys-inbox-list"]');
    expect(summary!.compareDocumentPosition(list!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  describe('qué se envía y qué es anterior', () => {
    beforeEach(() => respond());

    it('la base del sistema y la importada para un servicio se envían; la hecha a mano es «anterior»', () => {
      expect(statusOf('base-c')).toBe('Se envía');
      expect(statusOf('std')).toBe('Se envía');
      expect(statusOf('legacy')).toBe('Encuesta anterior (ya no se envía)');
      expect(statusOf('old')).toBe('Encuesta anterior (ya no se envía)');
    });

    it('nunca dice «Activa» ni ofrece gestionar: sin «Abrir», sin filtro por estado, sin borradores', () => {
      expect(root().textContent).not.toMatch(/\bActiva\b|Borradores?|Desactivad|\bAbrir\b|Nueva encuesta/);
      expect(titles()).not.toContain('Borrador sin enviar');
      expect(find('app-segmented-control')).toBeNull();
      expect(root().querySelectorAll('a[data-testid^="survey-responses-"]')).toHaveLength(4);
    });
  });

  it('si la lectura de servicios falla, el Buzón igual se ve y decide por las asociaciones a servicios', () => {
    respond(CATALOG, null);
    expect(statusOf('std')).toBe('Se envía');
    expect(statusOf('legacy')).toBe('Encuesta anterior (ya no se envía)');
  });

  describe('el buscador', () => {
    beforeEach(() => respond());

    it('acota por título sin distinguir mayúsculas ni acentos, y por la consigna', () => {
      type('SATISFACCION');
      expect(titles()).toEqual(['Satisfacción con la consulta']);
      type('privacidad');
      expect(titles()).toEqual(['Estudios por imágenes']);
    });

    it('sin coincidencias NO es el vacío del dominio, y «Borrar la búsqueda» devuelve todo', () => {
      type('radiología');
      expect(find('[data-testid="surveys-inbox-no-results"]')).not.toBeNull();
      expect(find('[data-testid="surveys-inbox-empty"]')).toBeNull();
      expect(find('[data-testid="surveys-inbox-search"]')).not.toBeNull();

      find('[data-testid="surveys-inbox-clear-search"]')!.click();
      harness.detectChanges();
      expect(titles()).toHaveLength(4);
    });
  });

  it('sin encuestas con respuestas: S3 que manda a «Encuestas por servicio», sin buscador', () => {
    respond([wireSurvey('draft', 'Borrador sin enviar', 'DRAFT')], { ...SERVICE_ASSIGNMENTS, services: [] });

    expect(find('[data-testid="surveys-inbox-empty"]')).not.toBeNull();
    expect(find('[data-testid="surveys-inbox-search"]')).toBeNull();
    const inbox = harness.routeDebugElement!.componentInstance as SurveysInbox;
    let asked = 0;
    inbox.goToServices.subscribe(() => (asked += 1));
    find('[data-testid="surveys-go-to-services"]')!.click();
    expect(asked).toBe(1);
  });
});
