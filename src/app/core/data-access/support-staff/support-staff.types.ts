/**
 * **Personal de apoyo** (la secretaria): el alta.
 *
 * La secretaria tiene su propio rol global, **`SUPPORT_STAFF`**, desde el alta
 * (`POST /iam/auth/register-support-staff`). Lo que **no** tiene por el rol es
 * acceso a nada: lo que ve sale de sus vínculos con hospitales y doctores, que se
 * piden y aceptan con el flujo de `core/data-access/support-access`.
 */

/**
 * `POST /iam/auth/register-support-staff`: el alta de la secretaria.
 *
 * Mismos nombres y mismas validaciones que el alta de paciente en lo que
 * comparten —identidad, documento, contacto y acceso—, sin los bloques clínicos,
 * de seguro ni de emergencia, que son de quien se atiende y no de quien trabaja.
 */
export interface SupportStaffRegistration {
  readonly nationalId: string;
  readonly issuerAdministrativeAreaConceptId: string;
  readonly password: string;
  readonly name: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly motherLastName?: string;
  readonly email: string;
  /** ISO `YYYY-MM-DD`. */
  readonly birthDate: string;
  readonly phone: string;
}

/** Respuesta del alta: la cuenta nace con el rol `SUPPORT_STAFF`. */
export interface RegisteredSupportStaff {
  readonly userId: string;
  readonly personId: string;
  readonly supportProfileId: string;
  readonly role: 'SUPPORT_STAFF';
  readonly emailVerificationSent: boolean;
}
