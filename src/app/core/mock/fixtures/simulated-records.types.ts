/* ============================================================================
    Shapes of the simulator's clinical records and bookings. They live apart
    from the fixtures that build them so that the patient network's data can
    name them without importing `clinic.ts` or `agenda.ts`, which in turn
    import that data (that closed import cycles).
    ========================================================================== */

import type { FollowUpOrigin } from '../../data-access/scheduling/scheduling.types';
import type { SimulatedNoteRow } from './clinic-notes.data';

/**
 * La evidencia que respalda una decisión sobre un presuntivo (C3, P41): una
 * nota del expediente o un análisis —la orden y, si existe, su informe—.
 */
export interface SimulatedEvidence {
  readonly kind: 'NOTE' | 'ANALYSIS';
  readonly noteId?: string;
  readonly encounterId?: string;
  readonly serviceRequestId?: string;
  readonly diagnosticReportId?: string;
}

/** La decisión de C3 sobre un presuntivo, con sus instantes en ISO. */
export interface SimulatedVerification {
  readonly outcome: 'CONFIRMED' | 'REFUTED';
  readonly decidedAt: string;
  readonly decidedByProfileId: string;
  readonly reasonText: string | null;
  readonly basedOn: SimulatedEvidence | null;
}

export interface SimulatedCondition {
  readonly id: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
  readonly clinicalStatusConceptId: string;
  readonly verificationStatusConceptId: string;
  /** Sólo después de confirmar o rechazar (C3). Un presuntivo no la tiene. */
  readonly verification?: SimulatedVerification;
  readonly severityConceptId: string;
  readonly lateralityConceptId?: string;
  /** Curso clínico: agudo, crónico, subagudo, recurrente (Patch v4.0.8). */
  readonly clinicalCourseConceptId?: string;
  readonly encounterId?: string;
  readonly onsetAt: string;
  /** Fecha esperada de resolución. Sólo tiene sentido en curso agudo o subagudo. */
  readonly expectedResolutionAt?: string;
  readonly resolvedAt?: string;
  readonly noteText: string;
  /** Only on a ruled-out one: the diagnosis that replaced it (patch v4291). */
  readonly replacedByConditionId?: string;
  /** The custodian (API fbf18626). The seed does not bring it: then it is not filtered by. */
  readonly custodianTenantId?: string;
  readonly createdAt: string;
}

export interface SimulatedPrescription {
  /** La respuesta del formulario médico de la que sale (P43). */
  readonly formInstanceId?: string;
  readonly id: string;
  readonly patientProfileId: string;
  readonly medicationConceptId: string;
  /** La consulta en la que se prescribió, si nació de una. */
  readonly encounterId?: string;
  /** El diagnóstico que la motiva (v4.1.6). */
  readonly indicationConditionId?: string;
  /** El motivo escrito a mano, cuando no hay diagnóstico detrás. Ver P24. */
  readonly indicationText?: string;
  /**
   * The prescription that replaced this one (`medication_requests.replaced_by_request_id`).
   * Careful: the API's `GET …/summary` does not publish it yet; it lives in the seed.
   */
  readonly replacedByRequestId?: string;
  readonly statusConceptId: string;
  readonly prescriberProfileId: string;
  readonly doseText: string;
  readonly frequencyText: string;
  readonly validFrom: string;
  readonly validTo: string | null; // `null`: sin fin de vigencia, como en la API
  readonly patientInstructionsText: string;
  readonly signedAt: string | null;
  readonly issuedAt: string | null;
  readonly createdAt: string;
}

export interface SimulatedObservation {
  readonly id: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly statusConceptId: string;
  readonly valueDecimal: string;
  readonly quantityValue: string;
  readonly quantityUnitConceptId: string;
  readonly effectiveStartAt: string;
  readonly encounterId?: string;
  /** Cómo se lee el valor. Opcional: el fixture no la trae y el alta sí. */
  readonly interpretationConceptId?: string;
  /** De dónde sale la medición: signos vitales, laboratorio, examen físico. */
  readonly categoryConceptId?: string;
}

export interface SimulatedEncounter {
  readonly id: string;
  readonly patientProfileId: string;
  readonly episodeId?: string;
  readonly statusConceptId: string;
  readonly classConceptId: string;
  readonly primaryPractitionerId: string;
  readonly reasonText: string;
  readonly startAt: string;
  readonly endAt: string | null;
}

export interface SimulatedNote {
  readonly id: string;
  readonly noteId: string;
  readonly patientProfileId: string;
  readonly encounterId?: string;
  readonly noteTypeConceptId: string;
  readonly lifecycleStatusConceptId: string;
  readonly currentVersionId: string;
  readonly versionNumber: number;
  readonly authorProfileId: string;
  /**
   * Las filas campo/valor de C1 (P39). Las notas viejas —las SOAP de antes del
   * 25/09/2026— no las tienen y traen su texto en los cinco apartados.
   */
  readonly entries?: readonly SimulatedNoteRow[];
  readonly chiefComplaintText: string;
  readonly subjectiveText: string;
  readonly objectiveText: string;
  readonly assessmentText: string;
  readonly planText: string;
  readonly signedAt: string | null;
  readonly releasedToPatient: boolean;
  readonly createdAt: string;
}

export interface SimulatedOrder {
  /** La respuesta del formulario médico de la que sale (P43). */
  readonly formInstanceId?: string;
  readonly id: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly categoryConceptId: string;
  readonly priorityConceptId: string;
  readonly statusConceptId: string;
  readonly requesterProfileId: string;
  readonly encounterId?: string;
  readonly reasonText: string;
  readonly createdAt: string;
  /**
   * Antiduplicación de estudios (v4.2.17, T-26, subtarea 3.2): el informe
   * previo que satisface esta orden, cuando el médico decidió reutilizarlo o
   * repetir el estudio con justificación. Ausente en cualquier otra orden —
   * ninguna de las cuatro sembradas por paciente lo trae.
   */
  readonly previousDiagnosticReportId?: string;
  readonly duplicateOverrideReason?: string;
  /** Quién ejecuta el procedimiento, según el médico (CONTRATO §3, centros médicos). */
  readonly performerSelectionConceptId?: string;
  readonly performerPractitionerProfileId?: string;
  readonly suggestedPracticeSiteId?: string;
  /** P40 (C2): las notas médicas que motivan la orden, en el orden citado. */
  readonly basedOnNoteIds?: readonly string[];
  /** The diagnosis it was ordered for (patch v4291). */
  readonly reasonConditionId?: string;
}

export interface ReservaSimulada {
  readonly id: string;
  readonly patientProfileId: string;
  readonly resourceId: string;
  readonly bookableSlotId: string;
  readonly appointmentId: string | null;
  readonly typeConceptId: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly statusConceptId: string;
  readonly serviceConceptId: string;
  readonly bookingChannelConceptId: string;
  readonly confirmedAt: string | null;
  readonly checkedInAt: string | null;
  readonly reasonText: string;
  readonly patientName: string;
  readonly insuranceCarrierName: string | null;
  readonly rescheduledFrom: string | null;
  readonly statusReason: { reasonText: string; actorKind: 'PATIENT' | 'PROVIDER'; toStateConceptId: string; changedAt: string } | null;
  readonly delayNotice: { delayMinutes: number; message: string; announcedAt: string } | null;
  readonly paymentState: { state: 'PENDING' | 'PARTIALLY_PAID' | 'PAID'; label: string; conceptId: string; insuranceUsed: boolean; markedByUserId: string; markedAt: string } | null;
  /** Importe del pago QR confirmado en la maqueta, en bolivianos. */
  readonly paymentAmount?: string;
  /**
   * De qué cita salió ésta, si es una reconsulta (C4). `null` es lo corriente.
   *
   * El contrato equivalente es `Booking.followUpOf` de `scheduling.types.ts`;
   * acá el instante viaja en texto, como todo lo que sirve el simulador.
   */
  readonly followUpOf: FollowUpOrigin | null;
  /** La oferta de servicio que se reservó (v4.2.40). Ausente ≡ consulta. */
  readonly serviceOfferingId?: string | null;
  /** Lo que el paciente aceptó al reservar el servicio, congelado. */
  readonly service?: {
    readonly offeringId: string;
    readonly name: string;
    readonly price: string;
    readonly minDurationMinutes: number;
    readonly maxDurationMinutes: number;
    readonly requiresApproval: boolean;
  } | null;
  readonly createdAt: string;
}
