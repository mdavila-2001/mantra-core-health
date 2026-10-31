/**
 * Los rechazos de un inicio de sesión que vienen de la **política de sesión de la
 * organización** (`iam.session_policies`), no de una contraseña equivocada.
 *
 * La API los dice con `details.reason` en un `401`; se ramifica por ese código y
 * nunca por el mensaje:
 *
 * - `MFA_REQUIRED` y `MFA_INVALID`: la cuenta tiene un factor confirmado y falta o
 *   falla el código. La pantalla **pide el código** y reenvía el mismo formulario.
 * - `OUTSIDE_ALLOWED_HOURS`: fuera de la franja laboral.
 * - `OUTSIDE_ALLOWED_NETWORK`: el origen no está en las redes de la organización.
 *   El front ya manejaba `NETWORK_NOT_ALLOWED` (y suponía un 403); la API responde
 *   `OUTSIDE_ALLOWED_NETWORK` con 401. Se aceptan **los dos nombres**.
 *
 * **`MFA_ENROLLMENT_REQUIRED` ya no es un rechazo.** Cuando una política exige el
 * segundo paso y la cuenta no tiene un factor, la API deja **entrar** y responde
 * `mfaEnrollmentRequired: true`; el cliente lleva a la persona a darlo de alta y
 * restringe la aplicación hasta que lo haga (`mfaEnrollmentGuard`). Un 401 con ese
 * motivo es un nombre que la API nunca emite y cae en «las credenciales no son válidas».
 */
export type LoginPolicyReason =
  | 'MFA_REQUIRED'
  | 'MFA_INVALID'
  | 'OUTSIDE_ALLOWED_HOURS'
  | 'OUTSIDE_ALLOWED_NETWORK'
  | 'NETWORK_NOT_ALLOWED';

export interface LoginPolicyOutcome {
  readonly reason: LoginPolicyReason;
  /** `ask-code`: se muestra el campo del código. `blocked`: no se puede entrar ahora. */
  readonly kind: 'ask-code' | 'blocked';
  readonly message: string;
}

const MENSAJE_DE_RED =
  'Su organización solo permite entrar desde su propia red. Conéctese a la red de la organización y vuelva a intentar.';

const OUTCOMES: Readonly<Record<LoginPolicyReason, Omit<LoginPolicyOutcome, 'reason'>>> = {
  MFA_REQUIRED: {
    kind: 'ask-code',
    message: 'Ingrese el código de verificación de su aplicación de autenticación.',
  },
  MFA_INVALID: {
    kind: 'ask-code',
    message: 'El código de verificación no es válido. Revíselo y vuelva a intentar.',
  },
  OUTSIDE_ALLOWED_HOURS: {
    kind: 'blocked',
    message:
      'Su organización solo permite entrar en ciertos días y horas, y ahora está fuera de ese horario. Vuelva a intentar dentro del horario laboral.',
  },
  OUTSIDE_ALLOWED_NETWORK: {
    kind: 'blocked',
    message: MENSAJE_DE_RED,
  },
  NETWORK_NOT_ALLOWED: {
    kind: 'blocked',
    message: MENSAJE_DE_RED,
  },
};

/** El rechazo de política que corresponde a ese `details.reason`, o `null` si no es de política. */
export function loginPolicyOutcome(reason: unknown): LoginPolicyOutcome | null {
  if (typeof reason !== 'string' || !Object.prototype.hasOwnProperty.call(OUTCOMES, reason)) return null;
  const code = reason as LoginPolicyReason;
  return { reason: code, ...OUTCOMES[code] };
}
