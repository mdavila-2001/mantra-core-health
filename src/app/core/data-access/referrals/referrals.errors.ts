import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../http/api-error';

/**
 * Los sub-códigos estables de `ClinicalExtErrorReason` que la API devuelve en
 * `/referrals` (v4266, mergeada en `dev` y `test`).
 *
 * Viajan en `reason` al lado de `code` (los `DomainException` de
 * `clinical_ext`: 400, 404, 409) o en `details.reason` (los
 * `PreconditionFailedException`: 422). Se leen **de los dos lugares**, así
 * que la pantalla no cambia el día que la API los unifique. Son lo único que
 * distingue «ya está cerrada» de «ya no está pendiente», o el encuentro del
 * servicio en un 404, que comparten el mismo código.
 *
 * No hay un «prohibido» por ser otro: quien no es destino recibe 404
 * `REFERRAL_NOT_FOUND`, igual que si no existiera (S6 no filtra existencia).
 */
export const REFERRAL_ERROR_REASONS = [
  'REFERRAL_TARGET_REQUIRED',
  'REFERRAL_TARGET_NOT_FOUND',
  'REFERRAL_TARGET_QUERY_TOO_SHORT',
  'REFERRAL_SERVICE_NOT_FOUND',
  'REFERRAL_SERVICE_INACTIVE',
  'REFERRAL_SERVICE_TARGET_MISMATCH',
  'REFERRAL_ENCOUNTER_NOT_FOUND',
  'REFERRAL_ALREADY_EXISTS',
  'REFERRAL_SERVICE_INFORMATION_INCOMPLETE',
  'REFERRAL_TARGET_BRANCH_NOT_FOUND',
  'REFERRAL_CONSENT_LINK_NOT_ALLOWED',
  'REFERRAL_NOT_FOUND',
  'REFERRAL_NOT_PENDING',
  'REFERRAL_REJECT_REASON_REQUIRED',
  'REFERRAL_COUNTER_REFERRAL_NOT_ALLOWED',
  'REFERRAL_ALREADY_CLOSED',
  'TENANT_REQUIRED',
] as const;

export type ReferralErrorReason = (typeof REFERRAL_ERROR_REASONS)[number];

/** Qué decirle a quien deriva o responde, por sub-código. Dice qué pasó y qué hacer. */
export const REFERRAL_REASON_MESSAGE: Readonly<Record<ReferralErrorReason, string>> = {
  REFERRAL_TARGET_REQUIRED:
    'Falta el destino: elija un profesional o una organización, o escriba el destino externo.',
  REFERRAL_TARGET_NOT_FOUND:
    'El destino elegido ya no está disponible en la plataforma. Vuelva a buscarlo o elija otro.',
  REFERRAL_TARGET_QUERY_TOO_SHORT: 'Escriba al menos dos letras del nombre para buscar.',
  REFERRAL_SERVICE_NOT_FOUND:
    'El servicio elegido ya no está en el catálogo del destino. Elija otro o derive sin un servicio en particular.',
  REFERRAL_SERVICE_INACTIVE:
    'El destino dio de baja ese servicio. Elija otro o derive sin un servicio en particular.',
  REFERRAL_SERVICE_TARGET_MISMATCH:
    'Ese servicio no lo ofrece el destino elegido. Vuelva a elegirlo de la lista de servicios del destino.',
  REFERRAL_ENCOUNTER_NOT_FOUND:
    'No encontramos este encuentro entre los de esta persona. Vuelva a abrirlo y pruebe de nuevo.',
  REFERRAL_ALREADY_EXISTS: 'En este encuentro ya hay una derivación equivalente. No hace falta otra.',
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
  REFERRAL_ALREADY_CLOSED: 'La derivación ya está cerrada: no se puede anular.',
  TENANT_REQUIRED:
    'Para responder una derivación elija primero la organización desde la que atiende.',
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
  // `readApiError` da el contrato (`code`, `details`); el `reason` de arriba
  // no es parte de él, así que se toma del cuerpo. Sin `code` conocido
  // (otra forma de cuerpo) se lee igual: el sub-código es lo que manda.
  const raw = body as Record<string, unknown>;
  const details = readApiError(error)?.details ?? recordOf(raw['details']);
  const reason = raw['reason'] ?? details?.['reason'];
  if (!isReferralErrorReason(reason)) {
    return null;
  }
  const fields = details?.['fields'];
  return {
    reason,
    message: REFERRAL_REASON_MESSAGE[reason],
    fields: Array.isArray(fields) ? fields.filter((f): f is string => typeof f === 'string') : [],
  };
}

function isReferralErrorReason(value: unknown): value is ReferralErrorReason {
  return typeof value === 'string' && (REFERRAL_ERROR_REASONS as readonly string[]).includes(value);
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
