import type { LabOrder } from './lab-portal.types';

/**
 * Which of the three ways an order reached the center: the QR the patient sent, a doctor's referral
 * (already accepted by the patient) or the center's own registration. `CLINIC` is the order that
 * already came addressed to the center.
 */
export type LabOrderOrigin = 'PATIENT_QR' | 'DOCTOR_REFERRAL' | 'LAB_OWN' | 'CLINIC';

/** The patient that holds a national id, enough to confirm at the counter (`POST …/patients/lookup`). */
export interface LabPatientMatch {
  readonly patientProfileId: string;
  readonly displayName: string;
  readonly patientCode: string | null;
}

/** Body of `POST /diagnostics/lab/orders`: the center registers a paper/counter order. */
export interface NewLabOrder {
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly category: 'LAB' | 'IMAGING';
  readonly priorityConceptId?: string;
  readonly externalRequesterName?: string;
  readonly externalRequesterLicense?: string;
}

/** An order created from the patient's QR; `created` is `false` when the code was already used. */
export interface LabOrderFromQr {
  readonly order: LabOrder;
  readonly created: boolean;
}
