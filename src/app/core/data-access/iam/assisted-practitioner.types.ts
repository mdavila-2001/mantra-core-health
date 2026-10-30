/* ============================================================================
    Alta administrativa de un médico (`POST /iam/users/assisted-practitioner-registration`).

    Es la contraparte de `POST /iam/users/assisted-registration` (paciente): un
    `SECURITY_ADMIN` da de alta al profesional **sin fijar su contraseña**. La
    API devuelve un código de activación de un solo uso que se entrega al
    titular por un canal seguro; con él elige su propia clave.

    Sólo se tipan los campos que esta pantalla pide. El contrato admite muchos
    más (domicilio, coordenadas, credenciales con PDF, consultorio propio): el
    médico los completa después en su perfil.
    ========================================================================== */

export interface AssistedPractitionerRegistration {
  /** Correo de acceso del médico: con él activa la cuenta e inicia sesión. */
  readonly email: string;
  readonly name: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly motherLastName?: string;
  /** Matrícula profesional. Nace PENDIENTE de verificación. */
  readonly licenseNumber: string;
  /** Cédula de identidad: el contrato la exige junto con su departamento emisor. */
  readonly nationalId: string;
  /** Concepto de `VS_BO_DEPARTMENT` que expidió la cédula. */
  readonly issuerAdministrativeAreaConceptId: string;
  /** Conceptos de `VS_MEDICAL_SPECIALTY`; el contrato admite hasta 4. */
  readonly specialtyConceptIds?: readonly string[];
  /** Códigos de `GET /authz/roles` con los que el médico queda operativo. */
  readonly clinicalRoles?: readonly string[];
  /** Motivo del alta: queda en la trazabilidad C-18. Máximo 500 caracteres. */
  readonly reason: string;
}

/**
 * Lo que devuelve el alta. El `activationToken` es de un solo uso y **se
 * muestra una sola vez**; nunca es una contraseña.
 */
export interface AssistedPractitionerResult {
  readonly userId: string;
  readonly personId: string;
  readonly practitionerProfileId: string;
  readonly practitionerCode: string;
  readonly licenseId: string;
  /** Estado de la matrícula; recién creada, pendiente de verificación. */
  readonly verificationStatus: string;
  readonly activationToken: string;
  readonly activationExpiresAt: Date;
  /** Roles asistenciales efectivamente concedidos. */
  readonly clinicalRoles: readonly string[];
}
