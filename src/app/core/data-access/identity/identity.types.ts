/** Tipos de la vista para `identity` (verificación de identidad y matrícula). */

/**
 * Solicitud de verificación. La evidencia se sube antes con el cliente de
 * archivos: acá sólo viaja su identificador.
 */
export interface VerificationRequest {
  readonly evidenceFileId: string;
}

/** Solicitud de verificación de matrícula: admite acotar la jurisdicción. */
export interface LicenseVerificationRequest extends VerificationRequest {
  readonly jurisdictionAuthorizationId?: string;
}

export interface VerificationRequestResult {
  readonly caseId: string;
  readonly checkId: string;
  readonly status: string;
}

/** Estado del caso propio, mientras se espera el veredicto de la autoridad. */
export interface VerificationCase {
  readonly id: string;
  readonly status: string;
  readonly openedAt?: Date;
  readonly completedAt?: Date;
}
