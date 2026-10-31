/**
 * Tipos de la verificación en dos pasos de la propia cuenta
 * (`iam/presentation/dto/my-mfa.dto.ts`).
 */

/** Un factor de la propia cuenta; nunca trae el secreto. */
export interface MfaFactor {
  readonly id: string;
  /** `TOTP`, `WEBAUTHN` o `UNKNOWN`. */
  readonly type: string;
  /** `PENDING` (sin confirmar), `VERIFIED`, `REVOKED` o `UNKNOWN`. */
  readonly state: string;
  readonly label?: string;
  readonly verifiedAt?: Date;
  readonly createdAt: Date;
}

/** `GET /iam/me/mfa`. */
export interface MfaStatus {
  /** ¿Alguna política de sus organizaciones le exige el segundo paso? */
  readonly required: boolean;
  /** ¿Tiene al menos un factor confirmado? */
  readonly enrolled: boolean;
  /** `required` sin `enrolled`: debe dar de alta un factor. */
  readonly enrollmentRequired: boolean;
  readonly factors: readonly MfaFactor[];
}

/** `POST /iam/me/mfa/totp`: el factor pendiente y su secreto, que solo llega en esta respuesta. */
export interface MfaTotpStarted {
  /** El factor pendiente, para confirmarlo. */
  readonly factorId: string;
  /** El secreto en base32, para escribirlo a mano en la app. */
  readonly secret: string;
  /** `otpauth://totp/...`: lo que lleva el QR. */
  readonly otpauthUri: string;
}

/** `POST /iam/me/mfa/totp/:factorId/confirm`. */
export interface MfaTotpConfirmed {
  /** Siempre `true`: con un código inválido la respuesta es 422. */
  readonly verified: boolean;
  readonly factorId: string;
  readonly verifiedAt: Date;
}

/**
 * La **reautenticación** que la API exige para dar de alta o quitar un método: la contraseña actual **o** un código
 * vigente de un factor que ya está verificado (`currentPassword` o `mfaCode`). Sin ninguna, `422 MFA_REAUTH_REQUIRED`;
 * si no valen, `422 MFA_REAUTH_FAILED`. Quien tuviera un token robado no puede agregar ni retirar un factor.
 */
export type MfaReauth = { readonly currentPassword: string } | { readonly mfaCode: string };

/** `POST /iam/me/mfa/:factorId/revoke`. */
export interface MfaFactorRevoked {
  /** Siempre `true`. */
  readonly revoked: boolean;
  /** Cuántos factores confirmados le quedan. Con `0`, el segundo paso de la cuenta queda apagado. */
  readonly remainingVerified: number;
}
