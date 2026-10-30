/**
 * Afiliación médico-centro por procedimiento (centros médicos, CM-07).
 *
 * Forma del contrato `CONTRATO.md` §2, tal cual. El estado viaja como concepto
 * (`statusConceptId`) y su código (`statusCode`): el front decide por el código,
 * nunca por el uuid ni por un texto.
 */
export type RoleAssignmentInitiator = 'PRACTICE' | 'PRACTITIONER';

/** Una fila de afiliación: **un** procedimiento de **una** sede. */
export interface RoleAssignmentRow {
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly practitionerName: string;
  readonly practiceId: string;
  readonly practiceSiteId: string;
  readonly healthcareServiceId: string | null;
  readonly serviceConceptId: string | null;
  readonly serviceDisplay: string | null;
  readonly statusConceptId: string;
  readonly statusCode: string;
  readonly initiatedBy: RoleAssignmentInitiator;
}

/** Cuerpo de `POST /practices/:practiceId/role-assignments/invitations`. */
export interface PracticeInvitationInput {
  readonly practitionerProfileId: string;
  readonly practiceSiteId: string;
  readonly healthcareServiceIds: readonly string[];
}
