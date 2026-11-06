import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { API_BASE_URL } from '../../../core/data-access/api';
import { SurveyDetailScreen } from './survey-detail';

/* The sheet's tabs: «Resumen» in every answers state (bars, below the minimum,
   none, refused, failed, missing, offline) through ONE view state; deep links
   clamped to the tabs actually drawn; the open tab written back to the URL. */

const questions = [
  { id: 'q-1', position: 1, questionText: '¿Volvería?', answerType: 'BOOLEAN', required: true },
  { id: 'q-2', position: 2, questionText: '¿Qué mejoraría?', answerType: 'TEXT', required: false },
  { id: 'q-3', position: 3, questionText: '¿Usó el estacionamiento?', answerType: 'BOOLEAN', required: false },
];

const sheet = (published = true) => ({
  id: 's-1', title: 'Satisfacción', status: published ? 'ACTIVE' : 'DRAFT', latestVersionNumber: 1, latestVersionId: 'v-1',
  published, questionCount: 2, responseWindowDays: 7, effectiveFrom: null, effectiveTo: null, questions,
});

const answer = (n: number) => ({
  id: `r-${n}`,
  invitationId: `i-${n}`,
  submittedAt: '2026-10-28T00:00:00.000Z',
  answers: [
    { questionId: 'q-1', questionText: '¿Volvería?', answerType: 'BOOLEAN', valueBoolean: n % 2 === 0 },
    { questionId: 'q-2', questionText: '¿Qué mejoraría?', answerType: 'TEXT', valueText: `Comentario ${n}` },
    // Optional and answered only by the first two: below the minimum on its own.
    ...(n <= 2 ? [{ questionId: 'q-3', questionText: '¿Usó el estacionamiento?', answerType: 'BOOLEAN', valueBoolean: true }] : []),
  ],
});

const apiError = (status: number, code: string) => ({
  body: { statusCode: status, code, message: 'RAW', timestamp: '', path: '', correlationId: 'corr-9' },
  init: { status, statusText: 'x' },
});

describe('SurveyDetailScreen · pestañas', () => {
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
  });

  afterEach(() => http.verify());

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const find = (selector: string): HTMLElement | null => root().querySelector(selector);
  const tabs = (): HTMLButtonElement[] => [...root().querySelectorAll<HTMLButtonElement>('[data-testid="survey-detail-tabs"] [role="tab"]')];

  /** Opens the sheet at `url`; answers: a list, or an HTTP failure, or `null` when not asked (unpublished). */
  async function open(url: string, published: boolean, answers: object[] | { body: object; init: object } | 'offline' | null): Promise<void> {
    await harness.navigateByUrl(url, SurveyDetailScreen);
    http.expectOne((r) => r.url === '/surveys/catalog').flush([]);
    http.expectOne((r) => r.url === '/surveys/service-assignments').flush({ consultation: {}, services: [] });
    http.expectOne((r) => r.url === '/surveys/templates/s-1').flush(sheet(published));
    if (answers !== null) {
      const read = http.expectOne((r) => r.url === '/surveys/templates/s-1/responses');
      if (answers === 'offline') read.error(new ProgressEvent('error'), { status: 0 });
      else if (Array.isArray(answers)) read.flush(answers);
      else read.flush(answers.body, answers.init);
    }
    harness.detectChanges();
  }

  describe('«Resumen» (#resumen)', () => {
    it('con 5 o más respuestas dibuja las barras por pregunta', async () => {
      await open('/questionnaires/s-1#resumen', true, [1, 2, 3, 4, 5].map(answer));
      expect(tabs()[1]!.getAttribute('aria-selected')).toBe('true');
      const bars = find('[data-testid="survey-detail-summary-bars"]');
      expect(bars?.textContent).toContain('¿Volvería?');
      expect(bars?.querySelectorAll('.encuesta__barra-fila')).toHaveLength(2);
      expect(bars?.textContent).toContain('Texto libre');
    });

    it('UNA regla de privacidad: una pregunta con 1–4 respuestas dice «Sin datos suficientes», sin barras ni promedio', async () => {
      await open('/questionnaires/s-1#resumen', true, [1, 2, 3, 4, 5].map(answer));
      const suppressed = find('[data-testid="survey-detail-question-suppressed"]');
      expect(suppressed?.textContent).toContain('Sin datos suficientes: menos de 5 respuestas a esta pregunta');
      const item = suppressed!.closest('li')!;
      expect(item.textContent).toContain('¿Usó el estacionamiento?');
      expect(item.querySelector('.encuesta__barra-fila')).toBeNull();
      expect(item.textContent).not.toContain('100%');
    });

    it('con menos de 5 dice que el resumen no se muestra y cuántas lleva, sin barras', async () => {
      await open('/questionnaires/s-1#resumen', true, [1, 2, 3].map(answer));
      const notice = find('[data-testid="survey-detail-summary-below-minimum"]');
      // Same anatomy and words as the «Cómo le va» summary.
      expect(notice?.textContent).toContain('El resumen todavía no se muestra');
      expect(notice?.textContent).toContain('se necesitan al menos 5 para proteger la privacidad de sus pacientes; llevan 3');
      expect(find('[data-testid="survey-detail-summary-bars"]')).toBeNull();
    });

    it('sin respuestas es S3 con próxima acción, no un resumen vacío', async () => {
      await open('/questionnaires/s-1#resumen', true, []);
      const summary = find('[data-testid="survey-detail-summary"]');
      expect(summary?.textContent).toContain('Todavía no respondió nadie');
      expect(summary?.querySelector('a')?.getAttribute('href')).toBe('/questionnaires?encuestas=servicios');
    });

    it('403: S5, nunca «nadie respondió»', async () => {
      await open('/questionnaires/s-1#resumen', true, apiError(403, 'FORBIDDEN'));
      const summary = find('[data-testid="survey-detail-summary"]');
      expect(summary?.textContent).toContain('No tiene acceso');
      expect(summary?.textContent).not.toContain('nadie respondió');
    });

    it('500: S9 con código y «Reintentar», que vuelve a pedir las respuestas', async () => {
      await open('/questionnaires/s-1#resumen', true, apiError(500, 'INTERNAL'));
      const summary = find('[data-testid="survey-detail-summary"]')!;
      expect(summary.textContent).toContain('No pudimos cargar las respuestas');
      expect(summary.textContent).toContain('corr-9');
      expect(summary.textContent).not.toContain('RAW');
      [...summary.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('Reintentar'))!.click();
      http.expectOne((r) => r.url === '/surveys/templates/s-1/responses').flush([1, 2, 3, 4, 5].map(answer));
      harness.detectChanges();
      expect(find('[data-testid="survey-detail-summary-bars"]')).not.toBeNull();
    });

    it('404: S6, tampoco se lee como «nadie respondió»', async () => {
      await open('/questionnaires/s-1#resumen', true, apiError(404, 'NOT_FOUND'));
      expect(find('[data-testid="survey-detail-summary"]')?.textContent).toContain('No encontramos');
      expect(find('[data-testid="survey-detail-summary"]')?.textContent).not.toContain('nadie respondió');
    });

    it('sin conexión: S8 con «Reintentar»', async () => {
      await open('/questionnaires/s-1#resumen', true, 'offline');
      const summary = find('[data-testid="survey-detail-summary"]')!;
      expect(summary.textContent).toContain('Reintentar');
      expect(summary.textContent).not.toContain('nadie respondió');
    });
  });

  it('una encuesta sin publicar: un solo panel sin tira de pestañas; #respuestas no deja un panel vacío y la URL lo dice', async () => {
    await open('/questionnaires/s-1#respuestas', false, null);
    await harness.fixture.whenStable();
    expect(tabs()).toHaveLength(0);
    expect(find('[data-testid="survey-detail-single"]')).not.toBeNull();
    expect(find('[data-testid="survey-detail-questions"]')?.textContent).toContain('¿Volvería?');
    expect(TestBed.inject(Router).url).toBe('/questionnaires/s-1');
  });

  it('cambiar de pestaña la escribe en el fragmento de la URL', async () => {
    await open('/questionnaires/s-1', true, [1, 2, 3, 4, 5].map(answer));
    tabs()[2]!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(TestBed.inject(Router).url).toBe('/questionnaires/s-1#respuestas');
    expect(find('[data-testid="survey-detail-answer-list"]')?.textContent).toContain('Comentario 1');

    tabs()[0]!.click();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/questionnaires/s-1');
  });
});
