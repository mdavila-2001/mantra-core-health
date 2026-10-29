/* ============================================================================
    Estado de verificación de un profesional — el adaptador ÚNICO.

    La API decide si alguien está verificado; el front sólo lo pinta. Ocultar la
    insignia no es seguridad y mostrarla no otorga nada: por eso este módulo
    NUNCA infiere un «verificado» que la API no dijo.

    Dos formas de contrato conviven:

      · `verification: { status, verifiedAt, validUntil }` — la nueva, aditiva;
      · `verified: boolean` — la de siempre, que la API sigue enviando.

    `verificationOf` prefiere la primera y, si no viene, deriva de la segunda
    (`true` → VERIFIED, `false` → UNVERIFIED), así nada se rompe con la API
    actual ni con los mocks que todavía no la envían.
    ========================================================================== */

/** Los cinco estados que la API puede declarar. */
export const VERIFICATION_STATUSES = [
  'VERIFIED',
  'IN_REVIEW',
  'UNVERIFIED',
  'SUSPENDED',
  'EXPIRED',
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/**
 * El objeto `verification` como viaja por el cable.
 *
 * Fechas como texto ISO (`2026-03-12` o `2026-03-12T10:00:00Z`) y `null` donde
 * el backend no omite la clave. `status` es `string` a propósito: un estado que
 * esta versión del front no conoce llega igual, y se trata como no verificado.
 */
export interface VerificationDto {
  readonly status?: string | null;
  readonly verifiedAt?: string | null;
  readonly validUntil?: string | null;
}

/** Lo que un DTO de profesional puede traer: la forma nueva, la vieja, o ambas. */
export interface WithVerification {
  readonly verification?: VerificationDto | null;
  readonly verified?: boolean | null;
}

/** La verificación ya normalizada, lista para pintar. */
export interface VerificationInfo {
  readonly status: VerificationStatus;
  readonly verifiedAt: Date | null;
  readonly validUntil: Date | null;
}

/** Sin dato alguno: lo que se pinta cuando no hay nada que decir de la verificación. */
export const NO_VERIFICATION: VerificationInfo = Object.freeze({
  status: 'UNVERIFIED',
  verifiedAt: null,
  validUntil: null,
});

/**
 * Un texto de estado → un estado conocido.
 *
 * Mayúsculas/minúsculas y espacios no importan; lo que no sea uno de los cinco
 * —incluido `null`, `undefined`, un número o un valor nuevo del backend— es
 * `UNVERIFIED`. Nunca se adivina un VERIFIED.
 */
export function toVerificationStatus(value: unknown): VerificationStatus {
  if (typeof value !== 'string') {
    return 'UNVERIFIED';
  }
  const normalized = value.trim().toUpperCase();
  return (VERIFICATION_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as VerificationStatus)
    : 'UNVERIFIED';
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Una fecha de la API → `Date`, o `null` si falta o no es una fecha.
 *
 * Una fecha sin hora (`2026-03-12`) se ancla al mediodía LOCAL: `new Date('2026-03-12')`
 * es medianoche UTC y en cualquier huso al oeste de Greenwich se mostraría un día antes.
 */
export function parseVerificationDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const text = value.trim();
  const dateOnly = DATE_ONLY.exec(text);
  if (dateOnly !== null) {
    const [, year, month, day] = dateOnly;
    const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
    // `new Date(2026, 1, 31)` rueda a marzo: una fecha imposible no se inventa.
    const exact =
      date.getFullYear() === Number(year) &&
      date.getMonth() === Number(month) - 1 &&
      date.getDate() === Number(day);
    return exact ? date : null;
  }
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * La verificación de un DTO de profesional.
 *
 * - `verification.status` presente → manda, sea cual sea (uno desconocido es
 *   `UNVERIFIED`, aunque `verified` diga `true`: la forma nueva es la más
 *   precisa y no se contradice con la vieja).
 * - Sin `verification.status` → `verified === true` es VERIFIED; cualquier otra
 *   cosa es UNVERIFIED.
 */
export function verificationOf(source: WithVerification | null | undefined): VerificationInfo {
  if (source === null || source === undefined) {
    return NO_VERIFICATION;
  }
  const detail = source.verification;
  if (detail !== null && detail !== undefined && detail.status != null) {
    return {
      status: toVerificationStatus(detail.status),
      verifiedAt: parseVerificationDate(detail.verifiedAt),
      validUntil: parseVerificationDate(detail.validUntil),
    };
  }
  return {
    status: source.verified === true ? 'VERIFIED' : 'UNVERIFIED',
    verifiedAt: parseVerificationDate(detail?.verifiedAt),
    validUntil: parseVerificationDate(detail?.validUntil),
  };
}

/**
 * Sólo `VERIFIED` pinta el check. Es la única pregunta que la interfaz debería
 * hacerle a un estado para decidir si estampa el sello de identidad comprobada.
 */
export function showsVerifiedCheck(status: VerificationStatus): boolean {
  return status === 'VERIFIED';
}

/**
 * El sello de un concepto de estado de la ficha (`approved`, `pending`…) →
 * estado de verificación. Es el puente para las pantallas que hoy sólo tienen
 * `verificationStatusConceptId` (resuelto por el catálogo a un sello) y no el
 * objeto `verification`.
 *
 * `rejected` y `unknown` no afirman nada: no hay insignia. La revocación
 * explícita llega como `SUSPENDED` desde la API, no se deduce de un rechazo.
 */
export function verificationFromSeal(seal: string | null | undefined): VerificationStatus {
  switch (seal) {
    case 'approved':
      return 'VERIFIED';
    case 'pending':
    case 'in-review':
      return 'IN_REVIEW';
    case 'expired':
      return 'EXPIRED';
    default:
      return 'UNVERIFIED';
  }
}

/**
 * La verificación de una ficha que, hasta hoy, sólo conocía su concepto de
 * estado (`verificationStatusConceptId`, ya resuelto por el catálogo a un sello).
 *
 * Si la API envía `verification.status`, manda; si no, se usa el sello del
 * concepto. Las fechas, cuando vienen, se conservan en ambos casos.
 */
export function verificationWithSealFallback(
  source: WithVerification | null | undefined,
  seal: string | null | undefined,
): VerificationInfo {
  const detail = source?.verification;
  if (detail !== null && detail !== undefined && detail.status != null) {
    return verificationOf(source);
  }
  return {
    status: verificationFromSeal(seal),
    verifiedAt: parseVerificationDate(detail?.verifiedAt),
    validUntil: parseVerificationDate(detail?.validUntil),
  };
}
