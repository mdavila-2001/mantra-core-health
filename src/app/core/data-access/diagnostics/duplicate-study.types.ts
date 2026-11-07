/* ============================================================================
    Study de-duplication (v4.2.17, subtask 3.2, T-26). The check before the
    order is created: «did the patient already have this study recently?».
    ========================================================================== */

/** What is needed to pre-validate duplication before ordering a study. */
export interface DuplicateStudyCheck {
  readonly patientProfileId: string;
  readonly codeConceptId?: string;
  readonly diagnosticStudyOfferingId?: string;
  readonly encounterId: string;
  readonly windowDays?: number;
}

/** The previous study that satisfies (or nearly satisfies) the new order. */
export interface PreviousStudy {
  /** Absent when what exists is an active order that has no report yet. */
  readonly reportId?: string;
  readonly serviceRequestId?: string;
  readonly studyName: string;
  readonly providerName: string;
  readonly performedAt: Date;
  readonly daysAgo: number;
  readonly resultsAvailable: boolean;
  /** `undefined` unless the report belongs to the requester's own organization. */
  readonly conclusionText?: string;
  /** No download endpoint for the practitioner today: always absent. */
  readonly reportDownloadUrl?: string;
  readonly sameOrganization: boolean;
}

/** Answer of the duplication check. */
export interface DuplicateStudyCheckResult {
  readonly isDuplicate: boolean;
  readonly previousStudy?: PreviousStudy;
  /** Spanish text ready to show, when there was a duplicate. */
  readonly warningMessage?: string;
  readonly requiresJustification: boolean;
  /** Whether a report of the same study is still unreleased inside the window. */
  readonly pendingReport: boolean;
  readonly windowDays: number;
}
