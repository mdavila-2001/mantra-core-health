import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate } from '../wire';
import type {
  InvitationsIssued,
  NewSurvey,
  NewSurveyAssignment,
  NewSurveyQuestion,
  PatientInvitation,
  PatientQuestionnaire,
  PublishSurvey,
  SurveyAnswerInput,
  SurveyCreated,
  SurveyDetail,
  SurveyQuestion,
  SurveyResponse,
  SurveySummary,
} from './surveys.types';

/**
 * Cliente de `surveys`: cuestionarios y encuestas de satisfacción.
 *
 * ## Dos caras, dos superficies
 *
 * El profesional **autora** el instrumento (`/surveys/templates`,
 * `/surveys/assignments`, `/surveys/invitations`) y el paciente **responde**
 * (`/surveys/me/invitations`). No son dos vistas del mismo recurso: son dos
 * conjuntos de rutas con autorizaciones distintas, y por eso los métodos de acá
 * están agrupados igual que en el backend.
 *
 * ## El identificador del paciente no viaja nunca
 *
 * Ninguna de las rutas `/surveys/me/*` acepta `patientProfileId`: el servidor lo
 * toma del claim de la sesión. **Es a propósito y no hay que "arreglarlo"** — si
 * el cliente pudiera mandarlo, cualquiera podría pedir los cuestionarios de otra
 * persona, y las respuestas de una encuesta son privadas por contrato.
 *
 * ## Lo que este cliente no hace
 *
 * Indicadores agregados y exportación anonimizada: el backend no los expone
 * porque la decisión D-13 del proyecto —el umbral mínimo de participantes— sigue
 * abierta y congela toda la parte de agregación.
 */
@Injectable({
  providedIn: 'root',
})
export class SurveysClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /* --- Autoría del profesional ------------------------------------------- */

  /**
   * `POST /surveys/templates` — crea la encuesta y su versión 1 en borrador.
   *
   * @param survey - Título, consigna y plazo de respuesta.
   * @returns La encuesta creada junto con su primera versión.
   */
  createSurvey(survey: NewSurvey): Observable<SurveyCreated> {
    return this.http.post<SurveyCreated>(
      this.url('/surveys/templates'),
      survey,
    );
  }

  /**
   * `GET /surveys/templates` — las encuestas del profesional de la sesión.
   *
   * @returns Las encuestas propias, más recientes primero.
   */
  listSurveys(): Observable<readonly SurveySummary[]> {
    return this.http.get<SurveySummary[]>(this.url('/surveys/templates'));
  }

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
        map((body) => ({
          ...body,
          effectiveFrom: maybeDate(body.effectiveFrom) ?? null,
          effectiveTo: maybeDate(body.effectiveTo) ?? null,
        })),
      );
  }

  /**
   * `POST /surveys/templates/:id/questions` — agrega una pregunta.
   *
   * Solo funciona mientras la versión sigue en borrador: publicar congela el
   * cuestionario, y el backend devuelve 422 si se intenta después.
   *
   * @param surveyId - Identificador de la encuesta.
   * @param question - Enunciado, tipo de respuesta y obligatoriedad.
   * @returns La pregunta creada, con la posición que le tocó.
   */
  addQuestion(
    surveyId: string,
    question: NewSurveyQuestion,
  ): Observable<SurveyQuestion> {
    return this.http.post<SurveyQuestion>(
      this.url(`/surveys/templates/${surveyId}/questions`),
      question,
    );
  }

  /**
   * `POST /surveys/templates/:id/versions/:n/publish` — publica y fija vigencia.
   *
   * @param surveyId - Identificador de la encuesta.
   * @param versionNumber - Número de la versión a publicar.
   * @param vigencia - Inicio y fin de vigencia, ambos opcionales.
   * @returns Confirmación de la operación.
   */
  publishSurvey(
    surveyId: string,
    versionNumber: number,
    vigencia: PublishSurvey = {},
  ): Observable<{ readonly ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      this.url(
        `/surveys/templates/${surveyId}/versions/${versionNumber}/publish`,
      ),
      vigencia,
    );
  }

  /**
   * `POST /surveys/templates/:id/deactivate` — corta las emisiones nuevas.
   *
   * No borra nada: lo ya emitido sigue siendo contestable y lo ya respondido,
   * legible.
   *
   * @param surveyId - Identificador de la encuesta.
   * @returns Confirmación de la operación.
   */
  deactivateSurvey(surveyId: string): Observable<{ readonly ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      this.url(`/surveys/templates/${surveyId}/deactivate`),
      {},
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
          items.map((item) => ({
            ...item,
            submittedAt: maybeDate(item.submittedAt) ?? null,
          })),
        ),
      );
  }

  /**
   * `POST /surveys/assignments` — asocia una versión publicada a un destino.
   *
   * @param assignment - Versión, tipo de destino e identificador del destino.
   * @returns El identificador de la asignación creada.
   */
  assignSurvey(
    assignment: NewSurveyAssignment,
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ id: string }>(
      this.url('/surveys/assignments'),
      assignment,
    );
  }

  /**
   * `POST /surveys/invitations` — emite los cuestionarios de una atención.
   *
   * Es idempotente: repetir la llamada sobre la misma reserva no vuelve a
   * reclamarle el cuestionario al paciente, lo informa en `alreadyIssued`.
   *
   * @param appointmentBookingId - La reserva completada.
   * @returns Los identificadores emitidos y cuántos ya existían.
   */
  issueInvitations(
    appointmentBookingId: string,
  ): Observable<InvitationsIssued> {
    return this.http.post<InvitationsIssued>(this.url('/surveys/invitations'), {
      appointmentBookingId,
    });
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
type WireSurveyDetail = Omit<SurveyDetail, 'effectiveFrom' | 'effectiveTo'> & {
  readonly effectiveFrom?: string | null;
  readonly effectiveTo?: string | null;
};

/** Una respuesta recibida, tal como viaja. */
type WireSurveyResponse = Omit<SurveyResponse, 'submittedAt'> & {
  readonly submittedAt?: string | null;
};

/** Un cuestionario repartido, tal como viaja. */
type WirePatientInvitation = Omit<
  PatientInvitation,
  'issuedAt' | 'expiresAt' | 'answeredAt'
> & {
  readonly issuedAt?: string | null;
  readonly expiresAt?: string | null;
  readonly answeredAt?: string | null;
};

/** El cuestionario a responder, tal como viaja. */
type WirePatientQuestionnaire = WirePatientInvitation & {
  readonly questions: readonly SurveyQuestion[];
};

/** Normaliza las tres marcas de tiempo de un cuestionario repartido. */
function toInvitation(body: WirePatientInvitation): PatientInvitation {
  return {
    ...body,
    issuedAt: maybeDate(body.issuedAt) ?? null,
    expiresAt: maybeDate(body.expiresAt) ?? null,
    answeredAt: maybeDate(body.answeredAt) ?? null,
  };
}
