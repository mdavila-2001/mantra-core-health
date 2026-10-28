import { HttpErrorResponse } from '@angular/common/http';

/**
 * Los sub-códigos estables de `clinical_ext.error-reasons.ts` (API b19cc52d + 415f1fe4).
 *
 * Viajan en `reason`, al lado de `code`. `readApiError` no los conserva —es
 * genérico—, así que se leen acá del cuerpo crudo: son lo único que distingue
 * «ya está cerrada» de «ya no está pendiente»,
 * que comparten el mismo código.
 */
export const REFERRAL_ERROR_REASONS = [
  'REFERRAL_TARGET_REQUIRED',
  'REFERRAL_SERVICE_INFORMATION_INCOMPLETE',
  'REFERRAL_TARGET_BRANCH_NOT_FOUND',
  'REFERRAL_CONSENT_LINK_NOT_ALLOWED',
  'REFERRAL_NOT_FOUND',
  'REFERRAL_NOT_PENDING',
  'REFERRAL_REJECT_REASON_REQUIRED',
  'REFERRAL_RESPOND_FORBIDDEN',
  'REFERRAL_COUNTER_REFERRAL_FORBIDDEN',
  'REFERRAL_COUNTER_REFERRAL_NOT_ALLOWED',
  'REFERRAL_ALREADY_CLOSED',
] as const;

export type ReferralErrorReason = (typeof REFERRAL_ERROR_REASONS)[number];

/** Qué decirle a quien deriva, por sub-código. Dice qué pasó y qué hacer. */
export const MENSAJE_DEL_MOTIVO: Readonly<Record<ReferralErrorReason, string>> = {
  REFERRAL_TARGET_REQUIRED:
    'Falta el destino: elegí un profesional, una organización o escribí el destino externo.',
  REFERRAL_SERVICE_INFORMATION_INCOMPLETE:
    'Faltan el servicio pedido o el resumen clínico: los dos son obligatorios para derivar.',
  REFERRAL_TARGET_BRANCH_NOT_FOUND:
    'La sede elegida ya no existe en esa organización. Elegí otra o dejá «Cualquier sede».',
  REFERRAL_CONSENT_LINK_NOT_ALLOWED:
    'El consentimiento no se adjunta al emitir: se registra después, sobre la derivación ya emitida.',
  REFERRAL_NOT_FOUND: 'La derivación ya no existe. Recargá la lista.',
  REFERRAL_NOT_PENDING:
    'La derivación ya fue respondida. Recargá para ver su estado actual.',
  REFERRAL_REJECT_REASON_REQUIRED: 'Para rechazar, escribí el motivo.',
  REFERRAL_RESPOND_FORBIDDEN:
    'Sólo el destino de la derivación (el profesional o su organización) puede aceptarla o rechazarla.',
  REFERRAL_COUNTER_REFERRAL_FORBIDDEN:
    'Sólo el destino de la derivación (o su organización) registra la contrarreferencia.',
  REFERRAL_COUNTER_REFERRAL_NOT_ALLOWED:
    'En su estado actual la derivación no admite contrarreferencia: primero tiene que ser aceptada.',
  REFERRAL_ALREADY_CLOSED: 'La derivación ya está cerrada: no se puede anular.',
};

/** Lo que el error de una derivación trae además del `code`. */
export interface MotivoDeDerivacion {
  readonly reason: ReferralErrorReason;
  readonly mensaje: string;
  /** `details.fields` de un 400: los campos que la API señaló. */
  readonly campos: readonly string[];
}

/**
 * El sub-código de un error de `/referrals`, ya en palabras, o `null` si el
 * error no trae uno conocido (entonces vale el mensaje genérico de S4–S9).
 */
export function motivoDeDerivacion(error: unknown): MotivoDeDerivacion | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const cuerpo: unknown = error.error;
  if (typeof cuerpo !== 'object' || cuerpo === null) return null;
  const reason = (cuerpo as Record<string, unknown>)['reason'];
  if (typeof reason !== 'string' || !(REFERRAL_ERROR_REASONS as readonly string[]).includes(reason)) {
    return null;
  }
  const details = (cuerpo as Record<string, unknown>)['details'];
  const fields =
    typeof details === 'object' && details !== null
      ? (details as Record<string, unknown>)['fields']
      : undefined;
  return {
    reason: reason as ReferralErrorReason,
    mensaje: MENSAJE_DEL_MOTIVO[reason as ReferralErrorReason],
    campos: Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string') : [],
  };
}
