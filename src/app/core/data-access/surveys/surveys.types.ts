/**
 * Contratos de `surveys`: cuestionarios y encuestas de satisfacción.
 *
 * Son el espejo de los DTO del módulo `surveys` del backend. Las fechas viajan
 * como texto ISO y se convierten a `Date` en el cliente, igual que en el resto
 * de `data-access`: la pantalla no debería estar parseando cadenas.
 */

/** Tipos de respuesta que admite una pregunta. */
export type AnswerType =
  | 'TEXT'
  | 'SCALE'
  | 'BOOLEAN'
  | 'SINGLE_CHOICE'
  | 'MULTIPLE_CHOICE';

/** Estado de una encuesta. */
export type SurveyStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE';

/** Estado de un cuestionario repartido a un paciente. */
export type InvitationStatus = 'PENDING' | 'ANSWERED' | 'EXPIRED';

/** A qué se asocia una encuesta. */
export type SurveyTargetType = 'APPOINTMENT' | 'SERVICE' | 'CARE_TYPE';

/** Una pregunta del cuestionario. */
export interface SurveyQuestion {
  readonly id: string;
  readonly position: number;
  readonly questionText: string;
  readonly answerType: AnswerType;
  readonly required: boolean;
  readonly options?: readonly string[];
  readonly scaleMin?: number;
  readonly scaleMax?: number;
}

/** Fila del listado de encuestas del profesional. */
export interface SurveySummary {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: SurveyStatus;
  readonly latestVersionNumber: number;
  readonly published: boolean;
  readonly questionCount: number;
}

/** Encuesta con el cuestionario de su última versión. */
export interface SurveyDetail extends SurveySummary {
  readonly latestVersionId: string;
  readonly responseWindowDays: number;
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
  readonly questions: readonly SurveyQuestion[];
}

/** Alta de una encuesta. */
export interface NewSurvey {
  readonly title: string;
  readonly description?: string;
  readonly responseWindowDays?: number;
}

/** Resultado del alta: la encuesta y su versión 1 en borrador. */
export interface SurveyCreated {
  readonly id: string;
  readonly versionId: string;
  readonly versionNumber: number;
}

/** Alta de una pregunta. */
export interface NewSurveyQuestion {
  readonly questionText: string;
  readonly answerType: AnswerType;
  readonly required?: boolean;
  readonly options?: readonly string[];
  readonly scaleMin?: number;
  readonly scaleMax?: number;
}

/**
 * Cambios sobre una encuesta en borrador.
 *
 * Todo opcional: se manda sólo lo que cambió. Una clave ausente **no** es «poné
 * esto en vacío» — para vaciar la consigna se manda `description: ''`.
 */
export interface SurveyEdit {
  readonly title?: string;
  readonly description?: string;
  readonly responseWindowDays?: number;
}

/**
 * Cambios sobre una pregunta de una versión en borrador.
 *
 * Las opciones y los extremos de escala se reemplazan **enteros** cuando
 * viajan: no hay edición parcial de una opción suelta, porque el orden importa
 * y un parche por índice se rompe en cuanto alguien inserta una en el medio.
 */
export interface SurveyQuestionEdit {
  readonly questionText?: string;
  readonly answerType?: AnswerType;
  readonly required?: boolean;
  readonly options?: readonly string[];
  readonly scaleMin?: number;
  readonly scaleMax?: number;
}

/** Publicación de una versión, con su vigencia. */
export interface PublishSurvey {
  readonly effectiveFrom?: string;
  readonly effectiveTo?: string;
}

/** Asociación de una versión publicada a la cosa evaluada. */
export interface NewSurveyAssignment {
  readonly surveyVersionId: string;
  readonly targetType: SurveyTargetType;
  readonly targetId: string;
}

/** Resultado de emitir los cuestionarios de una atención completada. */
export interface InvitationsIssued {
  readonly ids: readonly string[];
  readonly alreadyIssued: number;
}

/** Un cuestionario repartido al paciente. */
export interface PatientInvitation {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly status: InvitationStatus;
  readonly issuedAt: Date | null;
  readonly expiresAt: Date | null;
  readonly answeredAt: Date | null;
  readonly appointmentBookingId: string;
}

/** El cuestionario a responder, con sus preguntas. */
export interface PatientQuestionnaire extends PatientInvitation {
  readonly questions: readonly SurveyQuestion[];
}

/** Una respuesta que el paciente envía. */
export interface SurveyAnswerInput {
  readonly questionId: string;
  readonly valueText?: string;
  readonly valueNumber?: number;
  readonly valueBoolean?: boolean;
  readonly valueChoices?: readonly string[];
}

/** Una respuesta ya dada, tal como la lee el profesional. */
export interface SurveyAnswer {
  readonly questionId: string;
  readonly questionText: string;
  readonly answerType: AnswerType;
  readonly valueText?: string;
  readonly valueNumber?: number;
  readonly valueBoolean?: boolean;
  readonly valueChoices?: readonly string[];
}

/**
 * Una respuesta completa recibida por la encuesta.
 *
 * **Sin identificador de paciente a propósito** (FT-29): para el profesional
 * la encuesta es anónima. El servidor tampoco lo manda en este contrato.
 */
export interface SurveyResponse {
  readonly id: string;
  readonly invitationId: string;
  readonly appointmentBookingId: string;
  readonly submittedAt: Date | null;
  readonly answers: readonly SurveyAnswer[];
}
