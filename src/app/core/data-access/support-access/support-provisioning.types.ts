/**
 * Tipos de datos para la provisión directa de cuentas de secretaria
 * y vinculación inmediata desde la sesión de doctor u organización.
 */
export interface CreateSecretaryBasePayload {
  readonly nationalId: string;
  readonly issuerAdministrativeAreaConceptId: string;
  readonly password?: string;
  readonly name: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly motherLastName?: string;
  readonly email: string;
  readonly birthDate: string;
  readonly phone: string;
  readonly gender?: string;
  readonly timeZone?: string;
}

/** Carga útil para que el doctor cree a su secretaria y la vincule de inmediato. */
export interface CreatePractitionerSecretaryPayload extends CreateSecretaryBasePayload {
  readonly practitionerRoleAssignmentId: string;
}

/** Carga útil para que el hospital cree a su secretaria y la vincule de inmediato. */
export interface CreateOrgSecretaryPayload extends CreateSecretaryBasePayload {
  readonly targetKind?: 'ORGANIZATION' | 'SITE' | 'SERVICE' | 'SPACE' | 'PRACTITIONER';
  readonly practiceSiteId?: string;
  readonly clinicalUnitId?: string;
  readonly careSpaceId?: string;
  readonly practitionerRoleAssignmentId?: string;
}

/** Respuesta de la API tras crear la cuenta y activar el vínculo. */
export interface CreatedSupportStaffResponse {
  readonly userId: string;
  readonly personId: string;
  readonly supportProfileId: string;
  readonly linkId: string;
  readonly status: 'ACTIVE';
  readonly organizationName?: string;
}
