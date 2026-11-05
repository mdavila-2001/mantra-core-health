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
  /**
   * `null` en la solicitud de un doctor que canjeó un QR multiuso: nace sin sede ni servicio asignados y la organización
   * decide. La pantalla la muestra en toda sede para que se pueda aprobar.
   */
  readonly practiceSiteId: string | null;
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
