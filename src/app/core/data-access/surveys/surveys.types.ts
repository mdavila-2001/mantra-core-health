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

/**
 * De quién es una pregunta: de la encuesta base que emite el sistema o del
 * profesional. El backend la manda sólo cuando el cuestionario mezcla las dos
 * (la invitación lleva las preguntas base primero y las del médico después).
 */
export type QuestionSource = 'SYSTEM' | 'PRACTITIONER';

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
  /** Ausente en las respuestas que todavía no distinguen el origen. */
  readonly source?: QuestionSource;
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

/** Una asociación vigente de la encuesta con la cosa evaluada. */
export interface SurveyAssignmentInfo {
  readonly id: string;
  readonly targetType: SurveyTargetType;
  /** Según `targetType`: `billing.service_catalog.id` para `SERVICE`. */
  readonly targetId: string;
}

/** Encuesta con el cuestionario de su última versión. */
export interface SurveyDetail extends SurveySummary {
  readonly latestVersionId: string;
  readonly responseWindowDays: number;
  readonly effectiveFrom: Date | null;
  readonly effectiveTo: Date | null;
  readonly questions: readonly SurveyQuestion[];
  /**
   * A qué está asociada hoy.
   *
   * **Opcional a propósito**: el contrato de `GET /surveys/templates/:id` no lo
   * declara todavía (pendiente del backend, ver `docs`). Ausente significa «el
   * servidor no lo dijo», que NO es lo mismo que `[]` («no está asociada a
   * nada»): la pantalla sólo afirma lo segundo cuando lo recibe.
   */
  readonly assignments?: readonly SurveyAssignmentInfo[];
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

/**
 * De qué atención salió la invitación: una consulta médica o un servicio de
 * salud (laboratorio, imagenología, procedimiento…).
 */
export type InvitationKind = 'CONSULTATION' | 'SERVICE';

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
  /**
   * Campos aditivos y OPCIONALES con los que la API dice a qué atención
   * corresponde la invitación. Una API que todavía no los manda los deja
   * ausentes: la pantalla degrada al texto genérico de la encuesta.
   */
  readonly kind?: InvitationKind;
  /** Nombre del servicio, si `kind` es `SERVICE`. */
  readonly serviceName?: string | null;
  /** Nombre público de quien atendió, si `kind` es `CONSULTATION`. */
  readonly practitionerDisplayName?: string | null;
  /** Cuándo fue la atención. */
  readonly attendedAt?: Date | null;
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

/* ============================================================================
    Resumen general del profesional — `GET /surveys/insights`.

    Agregado puro: ningún campo identifica al paciente ni a la reserva.
    ========================================================================== */

/**
 * Los filtros del resumen. Fechas de DÍA (`YYYY-MM-DD`, nunca con hora)
 * **alineadas a meses calendario**: `from` es el día 1 de un mes y `to` el último
 * día de un mes, con un máximo de 12 meses. No hay rangos libres.
 */
export interface InsightsQuery {
  readonly from: string;
  readonly to: string;
  /** `billing.service_catalog.id`; ausente = todas sus consultas y servicios. */
  readonly serviceId?: string;
}

/** Cuántos cuestionarios se emitieron, cuántos se respondieron y qué proporción. */
export interface InsightsTotals {
  readonly issued: number;
  readonly answered: number;
  /** Fracción 0–1 tal como la manda el servidor. La pantalla la recalcula desde los dos conteos. */
  readonly responseRate: number;
}

/** Net Promoter Score del período. `value` es `null` sin datos suficientes (n = 0). */
export interface InsightsNps {
  readonly value: number | null;
  readonly promoters: number;
  readonly passives: number;
  readonly detractors: number;
  readonly n: number;
}

/** Cuántas respuestas hubo con un valor de escala. */
export interface InsightsBucket {
  readonly value: number;
  readonly count: number;
}

/** Cuántas respuestas eligieron una opción. */
export interface InsightsOptionCount {
  readonly option: string;
  readonly count: number;
}

/** Una pregunta (base o propia) resumida sobre todas las respuestas del período. */
export interface InsightsQuestion {
  readonly questionId: string;
  readonly text: string;
  /** Slug estable de la dimensión medida; las preguntas propias no lo tienen. */
  readonly dimension: string | null;
  readonly answerType: AnswerType;
  /**
   * `true` si el servidor la suprimió por tener menos de `minCohort` respuestas:
   * llega sin distribución, sin opciones y sin promedio (y `n` no es un dato).
   */
  readonly suppressed: boolean;
  /** Cuántas personas respondieron ESTA pregunta (no todo el cuestionario). */
  readonly n: number;
  readonly average: number | null;
  /** Para `SCALE`: cuántas respuestas hubo en cada valor, de menor a mayor. */
  readonly distribution: readonly InsightsBucket[];
  /** Para `SINGLE_CHOICE` y `MULTIPLE_CHOICE`. */
  readonly optionCounts: readonly InsightsOptionCount[];
}

/** Un punto de la tendencia: una semana (`YYYY-MM-DD`, su lunes) o un mes (`YYYY-MM`). */
export interface InsightsTrendPoint {
  readonly period: string;
  readonly answered: number;
  /** Promedio de satisfacción global del período, si hubo respuestas a esa pregunta. */
  readonly average: number | null;
}

/**
 * Un comentario abierto: SÓLO el texto. Sin autor, sin reserva, sin fecha ni mes
 * y sin orden (el servidor los manda mezclados), porque cada dato más permitiría
 * reconocer a quien lo escribió. Sólo vienen si hay al menos 5 en el alcance
 * filtrado; con menos, el arreglo llega vacío.
 */
export interface InsightsComment {
  readonly text: string;
}

/**
 * La regla anti-reidentificación del servidor.
 *
 * Con menos de `minCohort` respuestas en el alcance filtrado el servidor NO
 * calcula nada más que los totales: `suppressed` vale `true` y `nps`,
 * `byQuestion`, `trend`, `safetyAlerts` y `comments` vienen vacíos o ausentes.
 * Con tan pocas personas, un promedio o un comentario señalaría a alguien.
 */
export interface InsightsPrivacy {
  readonly minCohort: number;
  readonly suppressed: boolean;
}

/** El resumen general de todas las encuestas del profesional. */
export interface SurveyInsights {
  readonly privacy: InsightsPrivacy;
  readonly totals: InsightsTotals;
  readonly nps: InsightsNps;
  readonly byQuestion: readonly InsightsQuestion[];
  readonly trend: readonly InsightsTrendPoint[];
  readonly safetyAlerts: { readonly n: number };
  readonly comments: readonly InsightsComment[];
}
