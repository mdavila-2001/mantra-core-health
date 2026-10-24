/**
 * Cuerpo de `POST /referrals`: lo que el médico manda al derivar a una persona
 * a otro profesional (pedido del propietario, 24/10/2026).
 *
 * `referringProfileId` no se manda: la API lo toma del token, porque un campo
 * que el cliente puede falsear no dice quién recomienda.
 */
export interface NewReferral {
  /** La persona derivada. */
  readonly patientProfileId: string;
  /**
   * El encuentro desde el que se deriva. Es lo que le permite a la API
   * comprobar la relación asistencial y avisarle a la persona: sin encuentro la
   * derivación se guarda, pero **no** se avisa.
   */
  readonly sourceEncounterId: string;
  /** El profesional recomendado (`profileId` del directorio de médicos). */
  readonly targetProfileId: string;
  /** Por qué se la recomienda; lo lee la persona en su aviso. */
  readonly reasonText?: string;
}

/** Lo que responde `POST /referrals`. */
export interface ReferralCreated {
  readonly id: string;
  readonly patientProfileId: string;
  readonly statusConceptId: string;
  readonly createdAt: string;
}
