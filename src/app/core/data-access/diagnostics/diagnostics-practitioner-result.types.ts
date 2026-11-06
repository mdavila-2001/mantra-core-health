/* ============================================================================
 * The released report, read by the practitioner (06/11/2026)
 *
 * `GET /diagnostics/patients/:patientProfileId/reports/:reportId`
 * (`PractitionerDiagnosticResultDto`). Same gate as the practitioner's orders
 * list: 403 without access to the record; an identical 404
 * (`DIAGNOSTICS_RESOURCE_NOT_AVAILABLE`) for a report that does not exist,
 * belongs to another patient or organization, or is not released. Nullables
 * always arrive, with `null`: the type keeps them so.
 * ========================================================================== */

/** How the value is written (`value` always arrives as text). */
export type PractitionerResultValueKind =
  | 'QUANTITY'
  | 'DECIMAL'
  | 'INTEGER'
  | 'TEXT'
  | 'BOOLEAN'
  | 'CONCEPT'
  | 'DATETIME'
  | 'DATE';

export interface PractitionerResultRange {
  /** Exact decimal text («0.4»), like the value. */
  readonly low: string | null;
  readonly high: string | null;
  /** The printed range when it is not numeric («Negativo»). */
  readonly text: string | null;
  readonly unitConceptId: string | null;
  readonly unit: string | null;
}

/** A value of the report. */
export interface PractitionerResultValue {
  readonly observationId: string;
  readonly codeConceptId: string;
  readonly name: string | null;
  /**
   * The value as text: numbers as exact decimals («126.0»), booleans
   * «true»/«false», a concept by its label, ISO dates or `YYYY-MM-DD`.
   */
  readonly value: string | null;
  readonly valueKind: PractitionerResultValueKind | null;
  readonly valueConceptId: string | null;
  readonly unitConceptId: string | null;
  readonly unit: string | null;
  readonly referenceRange: PractitionerResultRange | null;
  readonly interpretationConceptId: string | null;
  /** The lab's code («H»). Not translated in the client. */
  readonly interpretationCode: string | null;
  /** The interpretation's label («Alto»): what is shown. */
  readonly interpretation: string | null;
  readonly statusConceptId: string;
  readonly effectiveAt: string | null;
}

export interface PractitionerResultFile {
  readonly id: string;
  /** The file; downloaded through the report's route, not `/common/files`. */
  readonly fileId: string;
  readonly name: string | null;
  readonly contentRoleConceptId: string;
  readonly presentationFormatConceptId: string | null;
  readonly ordinal: number | null;
}

export interface PractitionerDiagnosticResult {
  readonly reportId: string;
  readonly patientProfileId: string;
  readonly serviceRequestId: string | null;
  readonly codeConceptId: string;
  readonly codeDisplay: string | null;
  readonly categoryConceptId: string | null;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly clinicalStatusConceptId: string;
  readonly issuedAt: Date | null;
  readonly releasedAt: Date;
  /** `false`: released, but not published to the patient. */
  readonly patientVisible: boolean;
  readonly conclusionText: string | null;
  readonly values: readonly PractitionerResultValue[];
  readonly files: readonly PractitionerResultFile[];
}
