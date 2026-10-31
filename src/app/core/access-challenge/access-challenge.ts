import { HttpContext, HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';

import { readApiError } from '../http/api-error';

/* ============================================================================
    Desafíos de acceso: lo que el front hace cuando la API dice «falta algo» en vez de «no».

    CONTRATO-GOBIERNO §8.4 («Mapa DENY/CHALLENGE → HTTP en los PEP») y §9.5:

      · 422 `REASON_REQUIRED` / `REASON_PLACEHOLDER`  → pedir el motivo;
      · 403 `STEP_UP_REQUIRED`                        → pedir el código de la app autenticadora;
      · 403 `APPROVAL_REQUIRED` (con `X-Approval-Id` en el reintento) → pedir aprobación;
      · 409 `FOUR_EYES_PAYLOAD_CHANGED`               → la aprobación era de otra acción: pedir otra;
      · 503 `STEP_UP_UNAVAILABLE`, 429 `STEP_UP_ATTEMPTS_EXCEEDED`, `DECISION_LOG_UNAVAILABLE` → no se
        reintentan: se explican.

    Este archivo es **puro** (sin diálogo, sin red): clasifica el error y define el contrato que comparten
    el interceptor (`core/http/access-challenge.interceptor.ts`) y el servicio que abre el diálogo
    (`features/access-governance/access-challenge/`). La autoridad sigue siendo la API: el front nunca decide
    que algo se puede; solo ayuda a cumplir lo que la API pidió y reintenta **la misma petición**.
   ========================================================================== */

/** Encabezado con el que se presenta una aprobación ya dada al reintentar la acción. */
export const APPROVAL_HEADER = 'X-Approval-Id';

/** El mínimo de caracteres del motivo cuando la API no dice otro (el de `require-reason.ts`). */
export const DEFAULT_REASON_MIN_LENGTH = 5;

export type AccessChallenge =
  /** Falta el motivo escrito. */
  | { readonly kind: 'REASON'; readonly minLength: number; /** `true` si el anterior era un texto de relleno. */ readonly placeholder: boolean }
  /** Falta el segundo paso (código de 6 dígitos). `enrolled: false` = aún no activó el factor. */
  | { readonly kind: 'STEP_UP'; readonly maxAgeMinutes: number | null; readonly enrolled: boolean }
  /** Falta la aprobación de otra persona. `stale`: la presentada era de otra acción o ya se usó: hay que pedir otra. */
  | { readonly kind: 'APPROVAL'; readonly approverKind: string | null; readonly atom: string | null; readonly ttlMinutes: number | null; readonly stale: boolean }
  /** No se puede continuar ni reintentando: se explica. */
  | { readonly kind: 'BLOCKED'; readonly reason: BlockedReason };

export type BlockedReason = 'STEP_UP_UNAVAILABLE' | 'STEP_UP_ATTEMPTS_EXCEEDED' | 'DECISION_LOG_UNAVAILABLE';

const BLOCKED_REASONS: ReadonlySet<string> = new Set<BlockedReason>(['STEP_UP_UNAVAILABLE', 'STEP_UP_ATTEMPTS_EXCEEDED', 'DECISION_LOG_UNAVAILABLE']);
/** Los estados HTTP con los que la API pide algo que la persona puede aportar (§8.4). */
const RESOLVABLE_STATUSES: ReadonlySet<number> = new Set([403, 409, 422]);
const STALE_APPROVAL_PROBLEMS: ReadonlySet<string> = new Set(['FOUR_EYES_PAYLOAD_CHANGED', 'FOUR_EYES_ALREADY_CONSUMED', 'FOUR_EYES_EXPIRED', 'FOUR_EYES_NOT_PENDING']);

const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const asText = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/**
 * Clasifica un fallo de la API como desafío, o `null` si no lo es (un 403 genérico, un 404, un error de red…).
 * Ramifica por `reason`, nunca por `message`.
 */
export function classifyAccessChallenge(error: unknown): AccessChallenge | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = readApiError(error);
  const reason = body?.reason;
  if (body === null || reason === undefined) return null;
  const details = body.details ?? {};
  // Un desafío que se resuelve (y se reintenta) llega como 403, 409 o 422 (§8.4). Un 404 o un 5xx con ese `reason` no
  // lo es: reintentar repetiría una acción que pudo haberse ejecutado (F5). Los que se explican sin reintentar
  // (`BLOCKED`: 503, 429…) se clasifican por su `reason`, con su propio estado.
  if (!BLOCKED_REASONS.has(reason) && !RESOLVABLE_STATUSES.has(error.status)) return null;

  if (reason === 'REASON_REQUIRED') return { kind: 'REASON', minLength: asNumber(details['minLength']) ?? DEFAULT_REASON_MIN_LENGTH, placeholder: false };
  if (reason === 'REASON_PLACEHOLDER') return { kind: 'REASON', minLength: asNumber(details['minLength']) ?? DEFAULT_REASON_MIN_LENGTH, placeholder: true };
  if (reason === 'STEP_UP_REQUIRED') return { kind: 'STEP_UP', maxAgeMinutes: asNumber(details['maxAgeMinutes']), enrolled: details['enrolled'] !== false };
  if (reason === 'APPROVAL_REQUIRED') {
    const problem = asText(details['approvalProblem']);
    return {
      kind: 'APPROVAL',
      approverKind: asText(details['approverKind']),
      atom: asText(details['atom']),
      ttlMinutes: asNumber(details['ttlMinutes']),
      stale: problem !== null && STALE_APPROVAL_PROBLEMS.has(problem),
    };
  }
  if (reason === 'FOUR_EYES_PAYLOAD_CHANGED' || reason === 'FOUR_EYES_ALREADY_CONSUMED') {
    return { kind: 'APPROVAL', approverKind: asText(details['approverKind']), atom: asText(details['atom']), ttlMinutes: asNumber(details['ttlMinutes']), stale: true };
  }
  if (BLOCKED_REASONS.has(reason)) return { kind: 'BLOCKED', reason: reason as BlockedReason };
  return null;
}

/* ---- lo que el diálogo le devuelve a quien reintenta ----------------------------------------------------------- */

/** Lo que se reúne al resolver un desafío y se aplica al reintento. */
export interface ChallengeAnswer {
  /** El motivo escrito (va en el cuerpo, en `reasonField`). */
  readonly reasonText?: string;
  /** La aprobación ya dada (va en `X-Approval-Id`). */
  readonly approvalId?: string;
  /** El segundo paso se verificó: la API lo recuerda por sesión, el reintento no lleva nada nuevo. */
  readonly stepUpVerified?: boolean;
}

/** La acción que se quiere hacer, para poder **pedir aprobación** de esa acción (y no de otra). */
export interface ApprovalTarget {
  /** Organización; si falta se usa la activa de la sesión. */
  readonly tenantId?: string;
  readonly atom?: string;
  readonly practitionerRoleAssignmentId?: string;
  readonly healthcareServiceId?: string;
  readonly careSpaceId?: string;
  readonly patientProfileId?: string;
  readonly appointmentStartAt?: string;
}

/** Cómo se resuelven los desafíos de una petición. */
export interface AccessChallengeOptions {
  /** Campo del cuerpo donde va el motivo. Por omisión `reasonText`. */
  readonly reasonField?: string;
  /** Para pedir aprobación de **esta** acción. */
  readonly approval?: ApprovalTarget;
  /** Texto corto de qué se está haciendo («Cancelar la cita de Carmen Ortuño»), para el diálogo. */
  readonly actionLabel?: string;
}

/** Quien abre el diálogo y resuelve el desafío. Lo implementa `AccessChallengeService` (features). */
export interface AccessChallengeResolver {
  resolve(challenge: AccessChallenge, options: AccessChallengeOptions): Observable<ChallengeAnswer>;
}

/** La persona cerró el diálogo sin resolver el desafío: no es un error de la API, es una decisión. */
export class AccessChallengeCancelledError extends Error {
  constructor() {
    super('La persona canceló el desafío de acceso.');
    this.name = 'AccessChallengeCancelledError';
  }
}

/**
 * Lo que un cliente acepta, como último parámetro, para que su petición **pueda resolver desafíos**: la pantalla pasa
 * `{ context: withAccessChallenge({ … }) }` y el cliente lo entrega tal cual a `HttpClient`. Sin él, la petición sale como siempre.
 */
export interface ChallengeRequestOptions {
  readonly context?: HttpContext;
}

/** Marca una petición para que el interceptor resuelva sus desafíos y la reintente. */
export const ACCESS_CHALLENGE = new HttpContextToken<(AccessChallengeOptions & { readonly reasonField: string }) | null>(() => null);

/**
 * `http.post(url, body, { context: withAccessChallenge({ approval: {...} }) })`: si la API responde con un desafío,
 * el interceptor lo resuelve con la persona y reintenta **la misma petición** (hasta tres veces: motivo, segundo paso,
 * aprobación). Sin esta marca, el desafío llega a quien llama como un error más.
 */
export function withAccessChallenge(options: AccessChallengeOptions = {}): HttpContext {
  return new HttpContext().set(ACCESS_CHALLENGE, { ...options, reasonField: options.reasonField ?? 'reasonText' });
}

/** Quién resuelve los desafíos. Lo provee la aplicación (`app.config.ts`); por omisión nadie. */
export const ACCESS_CHALLENGE_RESOLVER = new InjectionToken<AccessChallengeResolver | null>('ACCESS_CHALLENGE_RESOLVER', {
  providedIn: 'root',
  factory: () => null,
});

/* ---- bloques «Reservado» ------------------------------------------------------------------------------------- */

/** El rótulo de un bloque de agenda cuyo detalle no se puede mostrar (cita de un paciente reservado, fuera de ventana…). */
export const RESERVED_BLOCK_LABEL = 'Reservado';

/** El `denialReason` que la API usa cuando el motivo no debe decirse. */
export const RESERVED_DENIAL_REASON = 'RESERVED';

/**
 * ¿Es un bloque «Reservado»? La API manda `denialReason: 'RESERVED'` para no filtrar por qué (un paciente VIP, un menor, una
 * cita fuera de ventana): la pantalla muestra el bloque ocupado sin campos del paciente y ofrece «¿Por qué no puedo?».
 */
export function isReservedBlock(item: { readonly denialReason?: string | null }): boolean {
  return item.denialReason === RESERVED_DENIAL_REASON;
}
