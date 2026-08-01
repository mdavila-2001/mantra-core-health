/**
 * Tipos de la vista para `iam`. **No son los DTOs de la API**: se mapean en el
 * cliente. Que la API devuelva una fecha como texto ISO es asunto del
 * transporte, no de la pantalla.
 */

/**
 * Credenciales de inicio de sesión.
 *
 * Unión discriminada y no un objeto con dos campos opcionales porque el backend
 * exige **uno u otro identificador, nunca ambos** (`LoginDto` valida el correo
 * sólo cuando no vino documento). Con dos opcionales, mandar los dos compilaría
 * y fallaría recién contra el servidor; así no se puede ni escribir.
 */
export type LoginCredentials =
  | {
      readonly kind: 'email';
      /** Alta por correo: personal y administradores. */
      readonly email: string;
      readonly password: string;
      readonly mfaCode?: string;
    }
  | {
      readonly kind: 'nationalId';
      /** Documento de identidad: pacientes auto-registrados. */
      readonly nationalId: string;
      readonly password: string;
      readonly mfaCode?: string;
    };

/** Sesión abierta. `expiresAt` ya es una fecha, no el texto ISO del transporte. */
export interface Session {
  readonly accessToken: string;
  /** Se entrega una sola vez: si se pierde, hay que volver a iniciar sesión. */
  readonly refreshToken: string;
  readonly expiresAt: Date;
}

/** Alta de un paciente por sí mismo. El identificador de acceso es el documento. */
export interface PatientRegistration {
  readonly nationalId: string;
  readonly password: string;
  readonly displayName: string;
  /** Opcional y no condiciona el acceso: la cuenta queda usable igual. */
  readonly email?: string;
  /** Fecha en formato ISO `YYYY-MM-DD`, tal como la valida el backend. */
  readonly birthDate?: string;
  readonly timeZone?: string;
}

export interface RegisteredPatient {
  readonly userId: string;
  readonly personId: string;
  readonly patientProfileId: string;
  readonly patientCode: string;
  /** `false` cuando no se aportó correo: no es un fallo. */
  readonly emailVerificationSent: boolean;
}

export interface VerifiedEmail {
  readonly userId: string;
  readonly emailVerified: boolean;
}

/** Activación de una cuenta creada por otra persona (registro asistido). */
export interface AccountActivation {
  readonly activationToken: string;
  readonly newPassword: string;
}

export interface ActivationResult {
  readonly userId: string;
  readonly status: string;
  readonly activated: boolean;
}

/**
 * Solicitud de restablecimiento de contraseña (UC-01-13).
 *
 * **No es la unión discriminada del login.** Acá el backend acepta un solo campo `identifier` sin
 * distinguir si es correo o documento, y tiene sentido que así sea: la respuesta es idéntica en
 * todos los casos, así que ramificar el contrato no cambiaría nada de lo que pasa después.
 */
export interface PasswordResetRequest {
  /** Correo o documento, el mismo con el que la persona entra. */
  readonly identifier: string;
}

/**
 * Respuesta de la solicitud. **Nunca dice si la cuenta existe**: el mensaje es el mismo exista o
 * no, porque un «no encontramos ese correo» convertiría el formulario en un oráculo de qué
 * direcciones están registradas en una plataforma de salud. Se muestra tal cual viene.
 */
export interface PasswordResetRequested {
  readonly message: string;
}

/** Consumo del token que llegó por correo. */
export interface PasswordReset {
  readonly token: string;
  /** Mínimo 8 caracteres, tal como lo valida el backend. */
  readonly newPassword: string;
}

export interface PasswordResetResult {
  readonly userId: string;
  /** Cambiar la clave cierra **todas** las sesiones abiertas: quien recupera su cuenta lo hace
   *  porque perdió el control de la anterior. */
  readonly revokedSessions: number;
}

/** Alta de usuario hecha por un administrador. */
export interface NewUser {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly timeZone?: string;
}
