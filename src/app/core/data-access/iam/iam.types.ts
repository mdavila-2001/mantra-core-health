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
 * Alta de un profesional por sí mismo.
 *
 * A diferencia del paciente, acá el **correo es obligatorio** —es su
 * identificador de acceso— y hacen falta las dos credenciales que lo habilitan:
 * la matrícula y el número del colegio. Un profesional sin habilitación
 * comprobable no es un profesional.
 */
export interface PractitionerRegistration {
  readonly email: string;
  readonly password: string;
  readonly displayName: string;
  readonly licenseNumber: string;
  readonly credentialNumber: string;
  readonly professionalTitle?: string;
  readonly phone?: string;
}

export interface RegisteredPractitioner {
  readonly userId: string;
  readonly personId: string;
  readonly practitionerProfileId: string;
  readonly practitionerCode: string;
}

/**
 * Resultado de pedir la recuperación.
 *
 * El backend devuelve **siempre lo mismo**, exista o no la cuenta: decir «ese
 * correo no está registrado» permitiría averiguar quién tiene cuenta probando
 * direcciones.
 */
export interface PasswordResetRequested {
  readonly message: string;
}

/** Fijar la contraseña nueva con el token que llegó por correo. */
export interface PasswordReset {
  readonly token: string;
  readonly newPassword: string;
}

export interface PasswordResetResult {
  readonly userId: string;
  /** Sesiones que se cerraron al cambiar la contraseña. */
  readonly revokedSessions: number;
}

/** Alta de usuario hecha por un administrador. */
export interface NewUser {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly timeZone?: string;
}
