/**
 * Standard surveys per service (06/11/2026): the contract of
 * `GET /surveys/standard-catalog` and `GET|PUT|DELETE /surveys/service-assignments`.
 *
 * The practitioner no longer writes free surveys: they import one from the
 * standard catalog (public-domain or free-use instruments, in Spanish, with
 * their source) and attach it to each service. One active survey per service.
 * The medical appointment always uses the system base survey.
 */
import type { AnswerType } from './surveys.types';

/** Service kind that suggests which catalog template fits. Guides, never restricts. */
export type SurveyServiceKind =
  | 'CONSULTATION'
  | 'PROCEDURE'
  | 'LAB'
  | 'IMAGING'
  | 'TELEMEDICINE'
  | 'THERAPY'
  | 'HOME_CARE'
  | 'PHARMACY'
  | 'OTHER';

/** Where an instrument comes from and under which license it is used. */
export interface StandardSurveySource {
  readonly instrument: string;
  readonly license: string;
  readonly url?: string;
}

/** A catalog question, for the preview. Recommendation is `SCALE` 0–10. */
export interface StandardSurveyQuestion {
  readonly text: string;
  readonly answerType: AnswerType;
  readonly required: boolean;
  /** Stable slug of what the question measures (`tiempo_espera`, `recomendacion`…). */
  readonly dimension?: string;
  readonly options?: readonly string[];
  readonly scaleMin?: number;
  readonly scaleMax?: number;
}

/** One template of the standard catalog. */
export interface StandardSurvey {
  /** Stable, upper case (`STD_IMAGING_V1`); it is what the PUT sends. */
  readonly code: string;
  readonly title: string;
  readonly description: string;
  readonly serviceKinds: readonly SurveyServiceKind[];
  readonly source: StandardSurveySource;
  readonly additionalSources?: readonly StandardSurveySource[];
  readonly questions: readonly StandardSurveyQuestion[];
}

/** The fixed medical-appointment row: system survey, mandatory. */
export interface ConsultationSurveyInfo {
  readonly system: boolean;
  readonly title: string;
  readonly templateTitle: string;
  readonly questionCount: number;
  readonly replaceable: boolean;
  /** Additive, outside the contract: the question texts for «Ver preguntas». */
  readonly questions?: readonly StandardSurveyQuestion[];
}

/** The standard survey attached today to a service. */
export interface ServiceSurveyAssignment {
  readonly assignmentId: string;
  /** `null` when the attachment did not come from the catalog (legacy). */
  readonly catalogCode: string | null;
  readonly title: string;
  readonly templateId: string;
  readonly versionId: string;
  readonly assignedAt: Date | null;
}

/** A service of the practitioner and its survey (`null`: uses the service base survey). */
export interface ServiceSurveyRow {
  /** `billing.service_catalog.id`. */
  readonly serviceId: string;
  readonly serviceName: string;
  /** Additive, outside the contract: the service kind; inferred from the name when absent. */
  readonly serviceKind?: SurveyServiceKind;
  readonly assignment: ServiceSurveyAssignment | null;
}

/** `GET /surveys/service-assignments`. */
export interface ServiceSurveyAssignments {
  readonly consultation: ConsultationSurveyInfo;
  readonly services: readonly ServiceSurveyRow[];
}
