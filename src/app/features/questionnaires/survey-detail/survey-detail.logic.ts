import type { SurveyCatalogEntry } from '../../../core/data-access/surveys/surveys-catalog.client';
import type { ServiceSurveyAssignments } from '../../../core/data-access/surveys/surveys-service-assignments.types';
import type { AnswerType, SurveyQuestion, SurveyResponse } from '../../../core/data-access/surveys/surveys.types';

/* Pure helpers of the survey sheet: the per-question summary and the CSV. Split
   out of `survey-detail.ts` (frozen over 300 lines) so the screen stays small. */

/** Una barra del gráfico de una pregunta: cuántos eligieron esta opción, y qué porcentaje del total es. */
export interface SummaryBar {
  readonly etiqueta: string;
  readonly cantidad: number;
  /** 0 a 100, sobre quienes respondieron *esta* pregunta (no sobre toda la encuesta). */
  readonly porcentaje: number;
}

/**
 * El resumen de una pregunta: sus barras (vacío en texto libre, donde un
 * gráfico no dice nada) y, para escala, el promedio.
 */
export interface QuestionSummary {
  readonly questionId: string;
  readonly questionText: string;
  readonly answerType: AnswerType;
  readonly totalRespondida: number;
  readonly promedio: number | null;
  readonly barras: readonly SummaryBar[];
}

/**
 * Una barra por etiqueta, con su porcentaje sobre `total`.
 *
 * Es la parte de `resumirPregunta` que no depende de cómo llegaron las
 * respuestas: la reutiliza el resumen general del profesional
 * (`insights/survey-insights.logic.ts`), que recibe los conteos ya agregados por
 * el servidor en vez de respuestas sueltas.
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
 * El día de envío de una respuesta, `AAAA-MM-DD`, en UTC (el servidor lo manda
 * redondeado al día a medianoche UTC). Sin fecha, vacío. Nunca la hora.
 */
export function submissionDay(fecha: Date | null): string {
  return fecha === null || Number.isNaN(fecha.getTime()) ? '' : fecha.toISOString().slice(0, 10);
}

/** Arma el resumen (barras + promedio) de una pregunta a partir de las respuestas recibidas. */
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
      // Texto libre no se resume en barras: cada respuesta es distinta y
      // agruparlas no diría nada. La lista de respuestas de abajo ya las
      // muestra completas.
      break;
  }

  return {
    questionId: pregunta.id,
    questionText: pregunta.questionText,
    answerType: pregunta.answerType,
    totalRespondida: total,
    promedio,
    barras,
  };
}

/** Encierra en comillas sólo si hace falta, duplicando las internas (RFC 4180). */
export function celdaCsv(valor: string): string {
  return /[",\r\n]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

/** Nombre de archivo seguro a partir del título de la encuesta. */
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
export function sendingLabelOf(published: boolean, status: SendingStatus | null): { text: string; variant: 'success' | 'secondary' } {
  if (!published) return { text: 'Nunca se envió', variant: 'secondary' };
  if (status === null) return { text: 'Comprobando…', variant: 'secondary' };
  if (status === 'yes') return { text: 'Se envía', variant: 'success' };
  return { text: status === 'no' ? 'Ya no se envía' : 'Envío sin confirmar', variant: 'secondary' };
}
