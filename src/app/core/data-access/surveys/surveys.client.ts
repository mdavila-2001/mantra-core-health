import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate } from '../wire';
import { normalizarInsights } from './surveys-insights.wire';
import type {
  InsightsQuery,
  PatientInvitation,
  PatientQuestionnaire,
  SurveyAnswerInput,
  SurveyDetail,
  SurveyInsights,
  SurveyQuestion,
  SurveyResponse,
} from './surveys.types';

/**
 * Cliente de `surveys`: cuestionarios y encuestas de satisfacción.
 *
 * ## Two faces, two surfaces
 *
 * The practitioner **reads** their surveys and answers (`/surveys/templates`,
 * read-only since 06/11/2026: each service's survey is imported from the
 * standard catalog) and the patient **answers** (`/surveys/me/invitations`).
 * They are not two views of one resource: they are two route sets with
 * different authorization, so the methods here are grouped as in the backend.
 *
 * ## El identificador del paciente no viaja nunca
 *
 * Ninguna de las rutas `/surveys/me/*` acepta `patientProfileId`: el servidor lo
 * toma del claim de la sesión. **Es a propósito y no hay que "arreglarlo"** — si
 * el cliente pudiera mandarlo, cualquiera podría pedir los cuestionarios de otra
 * persona, y las respuestas de una encuesta son privadas por contrato.
 *
 * ## Agregados: sólo el resumen general, sólo para el profesional
 *
 * `GET /surveys/insights` devuelve el resumen de TODAS las encuestas del
 * profesional (promedios, NPS, distribuciones, comentarios), sin identificar al
 * paciente ni a la reserva. No decide cuándo ocultar nada: manda siempre el `n`
 * y es la pantalla la que marca «pocas respuestas». La exportación anonimizada
 * sigue sin existir (decisión D-13, el umbral mínimo de participantes).
 */
@Injectable({
  providedIn: 'root',
})
export class SurveysClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* --- Practitioner reads (read-only since 06/11/2026) ----------------------- */

  /**
   * `GET /surveys/templates/:id` — la encuesta con su cuestionario.
   *
   * @param surveyId - Identificador de la encuesta.
   * @returns La encuesta, su vigencia y las preguntas de su última versión.
   */
  getSurvey(surveyId: string): Observable<SurveyDetail> {
    return this.http
      .get<WireSurveyDetail>(this.url(`/surveys/templates/${surveyId}`))
      .pipe(
        map(({ assignments, ...body }) => ({
          ...body,
          effectiveFrom: maybeDate(body.effectiveFrom) ?? null,
          effectiveTo: maybeDate(body.effectiveTo) ?? null,
          // `null` y ausente significan lo mismo: el servidor no lo informó.
          ...(assignments ? { assignments } : {}),
        })),
      );
  }

  /**
   * `GET /surveys/templates/:id/responses` — las respuestas recibidas.
   *
   * @param surveyId - Identificador de la encuesta.
   * @returns Las respuestas, con el enunciado de cada pregunta al lado.
   */
  listResponses(surveyId: string): Observable<readonly SurveyResponse[]> {
    return this.http
      .get<WireSurveyResponse[]>(
        this.url(`/surveys/templates/${surveyId}/responses`),
      )
      .pipe(
        map((items) =>
          items.map(({ appointmentBookingId, ...resto }) => ({
            ...resto,
            // La reserva ya no viaja; una API vieja que la mande en `null` no
            // debe dejarla como clave declarada.
            ...(appointmentBookingId ? { appointmentBookingId } : {}),
            submittedAt: maybeDate(resto.submittedAt) ?? null,
          })),
        ),
      );
  }

  /**
   * `GET /surveys/insights?from&to&serviceId` — «cómo me va».
   *
   * @param consulta - Período y, opcional, el servicio
   *   (`billing.service_catalog.id`; sin él, todas sus atenciones). `from` y `to`
   *   son fechas de DÍA (`YYYY-MM-DD`, nunca con hora) y el rango no pasa de 366
   *   días.
   * @returns El agregado del período. Nunca trae datos individuales; con menos
   *   de `privacy.minCohort` respuestas trae sólo `totals` y `privacy.suppressed`.
   */
  getInsights(consulta: InsightsQuery): Observable<SurveyInsights> {
    // Un parámetro ausente no se manda: `forbidNonWhitelisted` y un `serviceId=`
    // vacío darían un 400 por un UUID inválido.
    let params = new HttpParams().set('from', consulta.from).set('to', consulta.to);
    if (consulta.serviceId !== undefined) params = params.set('serviceId', consulta.serviceId);
    return this.http
      .get<unknown>(this.url('/surveys/insights'), { params })
      .pipe(map((cuerpo) => normalizarInsights(cuerpo)));
  }

  /* --- Autoservicio del paciente ----------------------------------------- */

  /**
   * `GET /surveys/me/invitations` — mis cuestionarios.
   *
   * @returns Los cuestionarios del paciente de la sesión, recientes primero.
   */
  listMyQuestionnaires(): Observable<readonly PatientInvitation[]> {
    return this.http
      .get<WirePatientInvitation[]>(this.url('/surveys/me/invitations'))
      .pipe(map((items) => items.map((item) => toInvitation(item))));
  }

  /**
   * `GET /surveys/me/invitations/:id` — el cuestionario a responder.
   *
   * @param invitationId - Identificador del cuestionario repartido.
   * @returns El cuestionario con sus preguntas.
   */
  getMyQuestionnaire(invitationId: string): Observable<PatientQuestionnaire> {
    return this.http
      .get<WirePatientQuestionnaire>(
        this.url(`/surveys/me/invitations/${invitationId}`),
      )
      .pipe(
        map((body) => ({ ...toInvitation(body), questions: body.questions })),
      );
  }

  /**
   * `POST /surveys/me/invitations/:id/responses` — responde el cuestionario.
   *
   * El envío es único y atómico: o entran todas las respuestas —con las
   * obligatorias completas— o no entra ninguna.
   *
   * @param invitationId - Identificador del cuestionario repartido.
   * @param answers - Las respuestas del cuestionario.
   * @returns El identificador de la respuesta registrada.
   */
  submitAnswers(
    invitationId: string,
    answers: readonly SurveyAnswerInput[],
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ id: string }>(
      this.url(`/surveys/me/invitations/${invitationId}/responses`),
      { answers },
    );
  }

  /** Resuelve una ruta de la API contra la raíz configurada. */
  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* ============================================================================
    La forma del transporte. Las fechas viajan como texto ISO y los opcionales
    vacíos llegan como `null`, no ausentes — ver `wire.ts`.
    ========================================================================== */

/** `GET /surveys/templates/:id` tal como viaja. */
type WireSurveyDetail = Omit<SurveyDetail, 'effectiveFrom' | 'effectiveTo' | 'assignments'> & {
  readonly assignments?: SurveyDetail['assignments'] | null;
  readonly effectiveFrom?: string | null;
  readonly effectiveTo?: string | null;
};

/** Una respuesta recibida, tal como viaja. */
type WireSurveyResponse = Omit<SurveyResponse, 'submittedAt' | 'appointmentBookingId'> & {
  readonly appointmentBookingId?: string | null;
  readonly submittedAt?: string | null;
};

/** Un cuestionario repartido, tal como viaja. */
type WirePatientInvitation = Omit<
  PatientInvitation,
  'issuedAt' | 'expiresAt' | 'answeredAt' | 'attendedAt'
> & {
  readonly issuedAt?: string | null;
  readonly expiresAt?: string | null;
  readonly answeredAt?: string | null;
  readonly attendedAt?: string | null;
};

/** El cuestionario a responder, tal como viaja. */
type WirePatientQuestionnaire = WirePatientInvitation & {
  readonly questions: readonly SurveyQuestion[];
};

/**
 * Normaliza las marcas de tiempo de un cuestionario repartido.
 *
 * `attendedAt` es aditivo: si la API no lo manda, la clave queda AUSENTE (no
 * `null`), para que «no sé cuándo fue» se distinga de «la API aún no lo dice».
 */
function toInvitation(body: WirePatientInvitation): PatientInvitation {
  const { attendedAt, ...resto } = body;
  const atencion = attendedAt === undefined ? undefined : (maybeDate(attendedAt) ?? null);
  return {
    ...resto,
    issuedAt: maybeDate(body.issuedAt) ?? null,
    expiresAt: maybeDate(body.expiresAt) ?? null,
    answeredAt: maybeDate(body.answeredAt) ?? null,
    ...(atencion === undefined ? {} : { attendedAt: atencion }),
  };
}
