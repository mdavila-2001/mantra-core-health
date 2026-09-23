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

/**
 * Un check del caso, tal como corrió: qué se revisó y con qué resultado.
 * Es el trace visual de FT-32-R05, no el registro append-only completo.
 */
export interface CaseCheck {
  readonly checkTypeConceptId: string;
  readonly status: string;
  readonly resultConceptId?: string;
  readonly checkedAt?: Date;
}

/** Estado del caso propio, mientras se espera el veredicto de la autoridad. */
export interface VerificationCase {
  readonly id: string;
  readonly status: string;
  /**
   * Código del tipo de solicitud: `PRACTITIONER_IDENTITY`,
   * `PRACTITIONER_LICENSE`, `PATIENT_IDENTITY`, `TENANT_VERIFICATION` o
   * `UNKNOWN`. El backend lo deriva del sujeto del caso.
   */
  readonly type: string;
  /** Archivo de evidencia aportado (`common.files`), si el backend lo resolvió. */
  readonly evidenceFileId?: string;
  /**
   * Motivo registrado por quien decidió el caso en revisión manual. Un caso
   * resuelto sin escalar no tiene motivo de texto — sólo el trace de `checks`.
   */
  readonly reasonText?: string;
  /** Sólo viene poblado en el detalle (`getVerificationCase`), no en la lista. */
  readonly checks?: readonly CaseCheck[];
  readonly openedAt?: Date;
  readonly completedAt?: Date;
}

/** Un tipo de solicitud de verificación disponible para "nueva solicitud". */
export interface VerificationType {
  readonly code: string;
  readonly label: string;
  readonly jurisdictionAuthorizationId?: string;
  readonly hasPendingRequest: boolean;
}
