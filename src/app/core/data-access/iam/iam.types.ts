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
/**
 * Lo que devuelve el reenvío de la verificación de correo.
 *
 * **El mensaje es siempre el mismo**, exista o no la cuenta: si cambiara,
 * el formulario se convertiría en una forma de averiguar qué correos están
 * registrados en el sistema.
 */
export interface VerificationResent {
  readonly message: string;
}

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

/**
 * Roles con los que puede nacer una cuenta creada por un administrador.
 *
 * Son **los dos que el backend acepta** (`@IsIn(['USER', 'SECURITY_ADMIN'])`), no
 * los 90 y pico del sistema: el resto se concede después, por su propia vía.
 */
export type InitialRole = 'USER' | 'SECURITY_ADMIN';

/** Alta de usuario hecha por un administrador (`POST /iam/users`, UC-01-01). */
export interface NewUser {
  readonly displayName: string;
  readonly email: string;
  readonly password: string;
  readonly phone?: string;
  readonly timeZone?: string;
  /** Ausente = `USER`, que es el valor con el que el backend completa. */
  readonly initialRole?: InitialRole;
}

/**
 * Lo que devuelve el alta de usuario. `status` es un **concept id**, no una
 * etiqueta: mostrarlo crudo sería exactamente lo que las convenciones prohíben
 * («en lectura se muestra siempre la etiqueta, nunca el UUID»).
 */
export interface CreatedUser {
  readonly id: string;
  readonly displayName: string;
  readonly statusConceptId: string;
  readonly createdAt: Date;
}

/**
 * Alta asistida de un paciente que no puede registrarse por sí mismo
 * (`POST /iam/users/assisted-registration`, C-18 / CAN-IDENT).
 *
 * **No lleva contraseña**: la fija el titular al activar. El `motivo` no es
 * burocracia — queda en la trazabilidad C-18, que es lo que justifica que
 * alguien haya creado una cuenta a nombre de otra persona.
 */
export interface AssistedPatientRegistration {
  readonly displayName: string;
  readonly email: string;
  readonly reason: string;
  readonly timeZone?: string;
  /** Representación legal formal, si está registrada. */
  readonly legalRepresentationId?: string;
  /** El representante, cuando no hay representación formal cargada. */
  readonly legalRepresentativeUserId?: string;
}

/**
 * Resultado del alta asistida.
 *
 * El `activationToken` es **de un solo uso y se muestra una sola vez**: hay que
 * entregárselo al titular por un canal seguro. Nunca es una contraseña.
 */
export interface AssistedRegistrationResult {
  readonly userId: string;
  readonly activationToken: string;
  readonly activationExpiresAt: Date;
  /** Estado de la cuenta recién creada, p. ej. `PENDING_ACTIVATION`. */
  readonly status: string;
}
