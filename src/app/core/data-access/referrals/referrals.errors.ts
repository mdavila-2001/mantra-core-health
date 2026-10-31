import { HttpErrorResponse } from '@angular/common/http';

/**
 * Los sub-códigos estables de `ClinicalExtErrorReason` que la API devuelve en
 * `/referrals` (v4266, mergeada en `dev` y `test`).
 *
 * Viajan en `reason`, al lado de `code`. `readApiError` no los conserva —es
 * genérico—, así que se leen acá del cuerpo crudo: son lo único que distingue
 * «ya está cerrada» de «ya no está pendiente», que comparten el mismo código.
 *
 * No hay un «prohibido» por ser otro: quien no es destino recibe 404
 * `REFERRAL_NOT_FOUND`, igual que si no existiera (S6 no filtra existencia).
 */
export const REFERRAL_ERROR_REASONS = [
  'REFERRAL_TARGET_REQUIRED',
  'REFERRAL_SERVICE_INFORMATION_INCOMPLETE',
  'REFERRAL_TARGET_BRANCH_NOT_FOUND',
  'REFERRAL_CONSENT_LINK_NOT_ALLOWED',
  'REFERRAL_NOT_FOUND',
  'REFERRAL_NOT_PENDING',
  'REFERRAL_REJECT_REASON_REQUIRED',
  'REFERRAL_COUNTER_REFERRAL_NOT_ALLOWED',
  'REFERRAL_ALREADY_CLOSED',
  'TENANT_REQUIRED',
  // v4274: traslado y llegada.
  'TRANSFER_INCOMPLETE',
  'TRANSFER_UNSAFE_TRANSPORT',
  'TRANSFER_RECEIVER_NOT_CONTACTED',
  'TRANSFER_VITALS_OUT_OF_RANGE',
  'TRANSFER_DETAIL_REQUIRED',
  'TRANSFER_ARRIVAL_BEFORE_DEPARTURE',
  'REFERRAL_ARRIVAL_ALREADY_RECORDED',
] as const;

export type ReferralErrorReason = (typeof REFERRAL_ERROR_REASONS)[number];

/** Qué decirle a quien deriva o responde, por sub-código. Dice qué pasó y qué hacer. */
export const REFERRAL_REASON_MESSAGE: Readonly<Record<ReferralErrorReason, string>> = {
  REFERRAL_TARGET_REQUIRED:
    'Falta el destino: elija un profesional o una organización, o escriba el destino externo.',
  REFERRAL_SERVICE_INFORMATION_INCOMPLETE:
    'Faltan el servicio pedido o el resumen clínico: sin un servicio del destino, los dos son obligatorios.',
  REFERRAL_TARGET_BRANCH_NOT_FOUND:
    'La sede elegida ya no existe en esa organización. Elija otra o deje «Cualquier sede».',
  REFERRAL_CONSENT_LINK_NOT_ALLOWED:
    'El consentimiento no se adjunta al emitir: se registra después, sobre la derivación ya emitida.',
  REFERRAL_NOT_FOUND:
    'No encontramos esta derivación entre las que usted puede responder. Recargue la lista.',
  REFERRAL_NOT_PENDING: 'La derivación ya fue respondida. Recargue para ver su estado actual.',
  REFERRAL_REJECT_REASON_REQUIRED: 'Para rechazar, escriba el motivo.',
  REFERRAL_COUNTER_REFERRAL_NOT_ALLOWED:
    'En su estado actual la derivación no admite contrarreferencia: primero tiene que ser aceptada.',
  REFERRAL_ALREADY_CLOSED:
    'La derivación ya está cerrada: no admite este cambio. Recargue para ver su estado actual.',
  TENANT_REQUIRED:
    'Para responder una derivación elija primero la organización desde la que atiende.',
  TRANSFER_INCOMPLETE:
    'Faltan datos del traslado: si el paciente se traslada, indique el medio de transporte y su estado al salir.',
  TRANSFER_UNSAFE_TRANSPORT:
    'Un paciente inestable o crítico viaja en ambulancia y acompañado por personal de salud. Corrija el medio o el acompañante.',
  TRANSFER_RECEIVER_NOT_CONTACTED:
    'Con el paciente inestable o crítico, avise antes al establecimiento receptor y anote quién recibió el aviso.',
  TRANSFER_VITALS_OUT_OF_RANGE:
    'Hay signos vitales fuera de rango o la diastólica no es menor que la sistólica. Revíselos en la pestaña Traslado.',
  TRANSFER_DETAIL_REQUIRED: 'Con «Otro» medio de transporte, describa cuál es.',
  TRANSFER_ARRIVAL_BEFORE_DEPARTURE: 'La llegada no puede ser anterior a la salida registrada.',
  REFERRAL_ARRIVAL_ALREADY_RECORDED:
    'La llegada ya está registrada: el traslado no admite más cambios. Recargue para ver los datos actuales.',
};

/** Lo que el error de una derivación trae además del `code`. */
export interface ReferralErrorDetail {
  readonly reason: ReferralErrorReason;
  readonly message: string;
  /** `details.fields` de un 400: los campos que la API señaló. */
  readonly fields: readonly string[];
}

/**
 * El sub-código de un error de `/referrals`, ya en palabras, o `null` si el
 * error no trae uno conocido (entonces vale el mensaje genérico de S4–S9).
 */
export function referralErrorDetail(error: unknown): ReferralErrorDetail | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return null;
  const details = (body as Record<string, unknown>)['details'];
  const detailsRecord =
    typeof details === 'object' && details !== null ? (details as Record<string, unknown>) : undefined;
  // Los de `clinical_ext` viajan arriba; el de tenant (`TENANT_REQUIRED`), en `details`.
  const reason = (body as Record<string, unknown>)['reason'] ?? detailsRecord?.['reason'];
  if (typeof reason !== 'string' || !(REFERRAL_ERROR_REASONS as readonly string[]).includes(reason)) {
    return null;
  }
  const fields = detailsRecord?.['fields'];
  return {
    reason: reason as ReferralErrorReason,
    message: REFERRAL_REASON_MESSAGE[reason as ReferralErrorReason],
    fields: Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string') : [],
  };
}
