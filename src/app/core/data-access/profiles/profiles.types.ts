/** Tipos de la vista para `profiles`. Se mapean desde los DTOs, no son ellos. */

/** Alta de un perfil de paciente hecha por personal (no auto-registro). */
export interface NewPatientProfile {
  readonly patientCode: string;
  readonly displayName?: string;
  /** ISO `YYYY-MM-DD`. */
  readonly birthDate?: string;
  /**
   * Conceptos de terminología: van por identificador, nunca por etiqueta. El
   * modelo prohíbe fijar valores de vocabulario en el código.
   */
  readonly administrativeGenderConceptId?: string;
  readonly sexAtBirthConceptId?: string;
}

export interface PatientProfile {
  readonly profileId: string;
  readonly personId: string;
  readonly patientCode: string;
  readonly recordLinkageStatus: string;
  readonly createdAt: Date;
}

/**
 * Alta de un profesional. La matrícula y la credencial son obligatorias: el
 * backend no admite un profesional sin habilitación comprobable.
 */
export interface NewPractitionerProfile {
  readonly practitionerCode: string;
  readonly licenseNumber: string;
  readonly credentialNumber: string;
  readonly personId?: string;
  readonly displayName?: string;
  readonly professionalTitle?: string;
  readonly practitionerCategoryConceptId?: string;
  readonly jurisdictionConceptId?: string;
  readonly regulatoryAuthority?: string;
}

export interface PractitionerProfile {
  readonly profileId: string;
  readonly personId: string;
  readonly practitionerCode: string;
  readonly verificationStatus: string;
  readonly practiceStatus: string;
  readonly licenseId: string;
  readonly credentialId: string;
  readonly createdAt: Date;
}

/** Vínculo entre una persona del directorio y una cuenta de acceso. */
export interface AccountLink {
  readonly id: string;
  readonly personId: string;
  readonly userId: string;
  readonly status: string;
  readonly validFrom: Date;
}
