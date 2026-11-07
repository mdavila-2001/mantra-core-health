/* Orders the laboratory / imaging center enters itself: the paper order a
   patient brings or a walk-in request (API v4.2.96, `/diagnostics/lab/…`). */

/** What a laboratory / imaging center performs. */
export type LabOrderCategory = 'LAB' | 'IMAGING';

/** The patient holding a national id, enough to confirm at the counter. */
export interface LabPatientMatch {
  readonly patientProfileId: string;
  readonly displayName: string;
  readonly patientCode: string | null;
}

/** The editable part of a center-registered order. Every field is replaced on edit. */
export interface LabOrderIntakeFields {
  readonly codeConceptId: string;
  readonly category: LabOrderCategory;
  readonly priorityConceptId?: string;
  /** Who signed the paper order; absent for a study the patient asks for. */
  readonly externalRequesterName?: string;
  readonly externalRequesterLicense?: string;
}

export interface NewLabOrder extends LabOrderIntakeFields {
  readonly patientProfileId: string;
}
