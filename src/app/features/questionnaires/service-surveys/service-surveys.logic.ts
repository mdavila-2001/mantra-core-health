import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { forbidden, unexpectedError } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import type {
  ServiceSurveyAssignments,
  ServiceSurveyRow,
  StandardSurvey,
  StandardSurveyQuestion,
  SurveyServiceKind,
} from '../../../core/data-access/surveys/surveys-service-assignments.types';

/** Diacritics left loose by `normalize('NFD')`. */
const DIACRITICS = /[̀-ͯ]/g;

function normalize(text: string): string {
  return text.normalize('NFD').replace(DIACRITICS, '').toLowerCase();
}

/** Words of a service name that suggest each kind, by priority (telemedicine before consultation). */
const KIND_HINTS: readonly (readonly [SurveyServiceKind, RegExp])[] = [
  ['TELEMEDICINE', /\b(tele|video|virtual|remot)/],
  ['IMAGING', /\b(eco|ecograf|ecocardio|radiograf|rayos|tomograf|resonancia|mamograf|densitometr|doppler|imagen)/],
  ['LAB', /\b(laborator|analisis|hemograma|perfil|muestra|cultivo|orina|sangre)/],
  ['THERAPY', /\b(terapia|kinesio|fisio|rehabilit|psicolog|psicoterap|fonoaudi|nutric)/],
  ['HOME_CARE', /\b(domicili|a casa|en casa)/],
  ['PHARMACY', /\b(farmac|medicament|vacun)/],
  ['CONSULTATION', /\b(consulta|control|certificado|evaluacion)/],
  ['PROCEDURE', /\b(electro|holter|ergometr|esfuerzo|prueba|procedim|cirug|biopsia|endoscop|monitoreo|mapa|infiltr|sutur|curacion)/],
];

/**
 * A service's kind. The API's `serviceKind` wins; without it, inferred from the
 * name. It only orders the picker (recommended first); any template can be chosen.
 */
export function serviceKindOf(name: string, reported?: SurveyServiceKind | null): SurveyServiceKind {
  if (reported) return reported;
  const text = normalize(name);
  for (const [kind, pattern] of KIND_HINTS) {
    if (pattern.test(text)) return kind;
  }
  return 'OTHER';
}

/** The catalog with the recommended ones for that kind first; server order within each group. */
export function sortForService(
  catalog: readonly StandardSurvey[],
  kind: SurveyServiceKind,
): readonly { readonly entry: StandardSurvey; readonly recommended: boolean }[] {
  return catalog
    .map((entry, index) => ({ entry, index, recommended: entry.serviceKinds.includes(kind) }))
    .sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.index - b.index)
    .map(({ entry, recommended }) => ({ entry, recommended }));
}

/**
 * How the patient answers each question, in words. Recommendation travels as
 * `SCALE` 0–10 and is shown as «Recomendación», never by the indicator's brand.
 */
export function answerFormat(question: StandardSurveyQuestion): string {
  const optional = question.required ? '' : ' · opcional';
  switch (question.answerType) {
    case 'BOOLEAN':
      return `Sí / No${optional}`;
    case 'SCALE': {
      // The text already spells the scale out («(1 = Nunca, 5 = Siempre)»): only the type.
      if (/\(\s*\d+\s*=/.test(question.text)) return `Escala${optional}`;
      const min = question.scaleMin ?? 1;
      const max = question.scaleMax ?? 5;
      const recommendation =
        question.dimension?.startsWith('recomendacion') === true ||
        (question.dimension === undefined && /recomend/i.test(question.text));
      return `${recommendation ? 'Recomendación' : 'Escala'} del ${min} al ${max}${optional}`;
    }
    case 'SINGLE_CHOICE':
      return question.options && question.options.length > 0
        ? `Una opción: ${question.options.join(' · ')}${optional}`
        : `Una opción${optional}`;
    case 'MULTIPLE_CHOICE':
      return question.options && question.options.length > 0
        ? `Una o varias: ${question.options.join(' · ')}${optional}`
        : `Una o varias opciones${optional}`;
    case 'TEXT':
      return `Texto libre${optional}`;
    default:
      return `Respuesta${optional}`;
  }
}

/** The sources line, «Ítems adaptados de …»: never presents a template as the instrument itself. */
export function sourcesLine(entry: StandardSurvey): string {
  const all = [entry.source, ...(entry.additionalSources ?? [])];
  return `Ítems adaptados de ${all.map((source) => `${source.instrument} — ${source.license}`).join('; ')}`;
}

/** «1 pregunta» / «7 preguntas». */
export function questionCount(n: number): string {
  return `${n} ${n === 1 ? 'pregunta' : 'preguntas'}`;
}

/** What «Ver preguntas» shows. */
export interface QuestionsView {
  readonly title: string;
  readonly subtitle: string;
  readonly questions: readonly StandardSurveyQuestion[];
  /** How many there are, when the server does not send the list (system survey). */
  readonly total: number;
}

/** What «Ver preguntas» shows for the fixed appointment row. */
export function appointmentQuestions({ consultation }: ServiceSurveyAssignments): QuestionsView {
  return {
    title: consultation.templateTitle,
    subtitle: 'Encuesta del sistema para toda cita médica. Es obligatoria y no se puede reemplazar.',
    questions: consultation.questions ?? [],
    total: consultation.questionCount,
  };
}

/** What «Ver preguntas» shows for a service with a catalog survey. */
export function serviceQuestions(row: ServiceSurveyRow, entry: StandardSurvey): QuestionsView {
  return {
    title: entry.title,
    subtitle: `Encuesta estándar de «${row.serviceName}». ${sourcesLine(entry)}.`,
    questions: entry.questions,
    total: entry.questions.length,
  };
}

/** The list with one row replaced by the server's, keeping the kind it already had. */
export function withRow(data: ServiceSurveyAssignments, next: ServiceSurveyRow): ServiceSurveyAssignments {
  const services = data.services.map((row) =>
    row.serviceId === next.serviceId ? { ...next, ...(row.serviceKind ? { serviceKind: row.serviceKind } : {}) } : row,
  );
  return { ...data, services };
}

/** What the screen does after a failed write, besides saying why. */
export type FailureFollowUp = 'reload-list' | 'reload-catalog' | null;

export interface WriteFailure {
  readonly title: string;
  /** In the person's words; never the server's text. */
  readonly message: string;
  readonly followUp: FailureFollowUp;
}

/** Status and stable reason of an HTTP failure, if it is one. */
function statusAndReason(error: unknown): { status: number | undefined; reason: string | undefined } {
  if (!(error instanceof HttpErrorResponse)) return { status: undefined, reason: undefined };
  return { status: error.status, reason: readApiError(error)?.reason };
}

/** Shared by both writes: no practitioner profile, offline, or a foreign service. */
function commonFailure(status: number | undefined, service: string): string | null {
  if (status === 412) return 'Su cuenta no tiene un perfil profesional asociado. Complete su perfil profesional para elegir encuestas.';
  if (status === 403) return `«${service}» no figura entre sus servicios, así que no puede cambiar su encuesta.`;
  if (status === 0) return 'No hay conexión con el servidor. Revise su red y vuelva a intentar.';
  return null;
}

/**
 * Why an import (`PUT`) failed for a service, and what to refresh.
 * 404 `SURVEY_CATALOG_CODE_UNKNOWN` → the catalog changed: reload it.
 * 409 `ASSIGNMENT_ALREADY_ACTIVE` → another session changed the row: reload the list.
 */
export function importFailure(error: unknown, service: string): WriteFailure {
  const title = `No se pudo importar la encuesta de «${service}»`;
  const { status, reason } = statusAndReason(error);
  if (status === 404 || reason === 'SURVEY_CATALOG_CODE_UNKNOWN') {
    return { title, message: 'Esa encuesta ya no está en el catálogo. Actualizamos el catálogo: elija otra.', followUp: 'reload-catalog' };
  }
  if (status === 409 || reason === 'ASSIGNMENT_ALREADY_ACTIVE') {
    return {
      title,
      message: `La encuesta de «${service}» cambió al mismo tiempo en otra sesión. Actualizamos la lista: revísela.`,
      followUp: 'reload-list',
    };
  }
  return { title, message: commonFailure(status, service) ?? `El servidor no pudo guardar el cambio. «${service}» sigue con la encuesta que tenía.`, followUp: null };
}

/** Why a removal (`DELETE`) failed. The API's removal is idempotent: it only refuses (403/412) or fails. */
export function removeFailure(error: unknown, service: string): WriteFailure {
  const title = `No se pudo quitar la encuesta de «${service}»`;
  const { status } = statusAndReason(error);
  return { title, message: commonFailure(status, service) ?? `El servidor no pudo quitar la encuesta. «${service}» sigue usándola.`, followUp: null };
}

/** A refusal (403/412) cannot succeed by retrying: it gets the S5 anatomy, without «Reintentar». */
function isRefusal(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 403 || error.status === 412);
}

/**
 * Any failure drawn with the host's anatomy, with our own title and message:
 * never the server's text. A refusal (403/412) is S5 (no retry); a request that
 * never arrived keeps S8; anything else is S9 with support code and retry.
 */
export function failureState(error: unknown, title: string, message: string): ViewState<never> {
  const base = errorToViewState<never>(error);
  if (base.status === 'offline') return base;
  const fromBase = 'requestId' in base ? base.requestId : undefined;
  const fromBody = error instanceof HttpErrorResponse ? (readApiError(error)?.correlationId ?? error.headers.get('x-request-id')) : null;
  const requestId = fromBase ?? fromBody ?? undefined;
  if (isRefusal(error)) return forbidden({ message: `${title}. ${message}`, ...(requestId ? { requestId } : {}) });
  return unexpectedError(requestId ?? 'sin-id', message, {
    title,
    hint: 'Intente de nuevo en unos segundos. Si vuelve a pasar, comparta el código de soporte con el equipo de ayuda.',
  });
}

/** A failed READ: S9 keeps its anatomy but says it was a read (nothing the person typed). */
export function readFailureState<T>(error: unknown, title: string, message: string): ViewState<T> {
  const base = errorToViewState<T>(error);
  return base.status === 'error' ? { ...base, title, message } : base;
}

/** The confirmation asked before removing a service's survey. */
export function removeConfirmation(row: ServiceSurveyRow): { title: string; message: string; confirmLabel: string; destructive: boolean } {
  return {
    title: 'Quitar la encuesta del servicio',
    message: `«${row.serviceName}» deja de usar «${row.assignment?.title ?? 'su encuesta'}». Desde ahora sus pacientes recibirán la encuesta base de servicios. Las respuestas que ya recibió no se borran.`,
    confirmLabel: 'Quitar',
    destructive: true,
  };
}
