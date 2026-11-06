import type { SurveyCatalogEntry } from '../../../core/data-access/surveys/surveys-catalog.client';
import type { ServiceSurveyAssignments } from '../../../core/data-access/surveys/surveys-service-assignments.types';
import type { AnswerType, SurveyQuestion, SurveyResponse } from '../../../core/data-access/surveys/surveys.types';

/* Pure helpers of the survey sheet: the per-question summary and the CSV. Split
   out of `survey-detail.ts` (frozen over 300 lines) so the screen stays small. */

/**
 * The privacy minimum (D-13): below this many answers no aggregate is shown —
 * not for the survey, not for a single question — and no CSV is offered. Same
 * rule as the server applies to the «Cómo le va» summary. Scope: aggregates and
 * the CSV only. The «Respuestas» tab still lists each answer as received (day
 * only, no patient identity), including those of a question suppressed here.
 */
export const MIN_COHORT = 5;

/** One bar of a question's chart: how many chose this option and its share. */
export interface SummaryBar {
  readonly etiqueta: string;
  readonly cantidad: number;
  /** 0 to 100, over those who answered THIS question (not the whole survey). */
  readonly porcentaje: number;
}

/**
 * A question's summary: its bars (none for free text, where a chart says
 * nothing) and, for a scale, the average. `suppressed` when 1–4 people
 * answered it: then there are no bars nor average (privacy minimum).
 */
export interface QuestionSummary {
  readonly questionId: string;
  readonly questionText: string;
  readonly answerType: AnswerType;
  readonly totalRespondida: number;
  readonly promedio: number | null;
  readonly barras: readonly SummaryBar[];
  readonly suppressed: boolean;
}

/**
 * One bar per label, with its share of `total`. The part of `resumirPregunta`
 * that does not depend on how the answers arrived: the practitioner's overall
 * summary (`insights/survey-insights.logic.ts`) reuses it with the counts the
 * server already aggregated.
 */
export function armarBarras(
  total: number,
  etiquetas: readonly string[],
  cantidadDe: (etiqueta: string) => number,
): readonly SummaryBar[] {
  return etiquetas.map((etiqueta) => {
    const cantidad = cantidadDe(etiqueta);
    return { etiqueta, cantidad, porcentaje: total === 0 ? 0 : Math.round((cantidad / total) * 100) };
  });
}

/**
 * The day an answer was sent, `YYYY-MM-DD`, in UTC (the server rounds it to
 * midnight UTC). Empty without a date. Never the time.
 */
export function submissionDay(fecha: Date | null): string {
  return fecha === null || Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString().slice(0, 10);
}

/** Builds a question's summary (bars + average) from the answers received. */
export function resumirPregunta(
  pregunta: SurveyQuestion,
  respuestas: readonly SurveyResponse[],
): QuestionSummary {
  const respondidas = respuestas
    .map((r) => r.answers.find((a) => a.questionId === pregunta.id))
    .filter((a): a is SurveyResponse['answers'][number] => a !== undefined);
  const total = respondidas.length;

  const withBars = (etiquetas: readonly string[], cantidadDe: (etiqueta: string) => number) =>
    armarBarras(total, etiquetas, cantidadDe);

  let barras: readonly SummaryBar[] = [];
  let promedio: number | null = null;

  switch (pregunta.answerType) {
    case 'BOOLEAN':
      barras = withBars(
        ['Sí', 'No'],
        (etiqueta) => respondidas.filter((a) => a.valueBoolean === (etiqueta === 'Sí')).length,
      );
      break;
    case 'SINGLE_CHOICE':
    case 'MULTIPLE_CHOICE':
      barras = withBars(
        pregunta.options ?? [],
        (opcion) => respondidas.filter((a) => a.valueChoices?.includes(opcion)).length,
      );
      break;
    case 'SCALE': {
      const min = pregunta.scaleMin ?? 1;
      const max = pregunta.scaleMax ?? 5;
      const valores = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
      barras = withBars(
        valores.map(String),
        (etiqueta) => respondidas.filter((a) => a.valueNumber === Number(etiqueta)).length,
      );
      const numeros = respondidas
        .map((a) => a.valueNumber)
        .filter((n): n is number => n !== undefined);
      promedio = numeros.length === 0 ? null : numeros.reduce((a, b) => a + b, 0) / numeros.length;
      break;
    }
    case 'TEXT':
      // Free text has no bars: each answer is different; the «Respuestas» tab shows them whole.
      break;
  }

  // ONE privacy rule: a question with 1–4 answers shows no aggregate either.
  const suppressed = total > 0 && total < MIN_COHORT;
  return {
    questionId: pregunta.id,
    questionText: pregunta.questionText,
    answerType: pregunta.answerType,
    totalRespondida: total,
    promedio: suppressed ? null : promedio,
    barras: suppressed ? [] : barras,
    suppressed,
  };
}

/** Quotes only when needed, doubling inner quotes (RFC 4180). */
export function celdaCsv(valor: string): string {
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** A safe file name from the survey's title. */
export function slugify(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'encuesta'
  );
}

/** The sheet's tabs, in order; the fragment of each deep-links to it (index + 1). */
export const SHEET_TABS = ['resumen', 'respuestas'] as const;

/** The tab a URL fragment asks for: `resumen` → 1, `respuestas` → 2, anything else → 0. */
export function tabOfFragment(fragment: string | null): number {
  return SHEET_TABS.indexOf(fragment as (typeof SHEET_TABS)[number]) + 1;
}

/** How a survey that is no longer sent is called, in the Buzón and in its sheet. */
export const PAST_SURVEY_LABEL = 'Encuesta anterior (ya no se envía)';

/** Whether a survey is sent today: `unknown` when the service list could not be read. */
export type SendingStatus = 'yes' | 'no' | 'unknown';

/**
 * A system base survey is always sent; any other only while a service uses its
 * template (`GET /surveys/service-assignments`, legacy attachments already read
 * as none). Without the service list it is `unknown` — never claimed either way.
 */
export function sendingStatusOf(
  surveyId: string,
  catalog: readonly SurveyCatalogEntry[] | null,
  assignments: ServiceSurveyAssignments | null,
): SendingStatus {
  if (catalog?.some((entry) => entry.id === surveyId && entry.origin === 'SYSTEM')) return 'yes';
  if (assignments === null) return 'unknown';
  return assignments.services.some((row) => row.assignment?.templateId === surveyId) ? 'yes' : 'no';
}

/** The «Estado» badge: neutral while checking, never just «Publicada». */
export function sendingLabelOf(published: boolean, status: SendingStatus | null): { text: string; variant: 'success' | 'secondary' | 'warning' } {
  if (!published) return { text: 'Nunca se envió', variant: 'secondary' };
  if (status === null) return { text: 'Comprobando…', variant: 'secondary' };
  if (status === 'yes') return { text: 'Se envía', variant: 'success' };
  // Same words and tint as the Buzón's past surveys: clearly not «Se envía».
  return status === 'no' ? { text: PAST_SURVEY_LABEL, variant: 'warning' } : { text: 'Envío sin confirmar', variant: 'secondary' };
}
