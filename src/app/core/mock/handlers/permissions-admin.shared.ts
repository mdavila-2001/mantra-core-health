import {
  precondition,
  reply,
  validation,
  type MockReply,
  type MockRequest,
} from '../mock-router';

/* ============================================================================
    Constantes, formas y validaciones compartidas del simulador del gobierno de
    permisos (`permissions-admin.handlers.ts`). Sin rutas: sólo lo que esos
    manejadores reutilizan. Todo es sintético.
    ========================================================================== */

export const DAY_MS = 86_400_000;
const REASON_MIN = 10;
const REASON_MAX = 500;
/** Tope del motivo de una acción de ciclo de vida de `iam` (no tiene mínimo: sólo no vacío). */
const LIFECYCLE_REASON_MAX = 500;
export const ACTIONS = new Set(['READ', 'WRITE', 'CREATE', 'DELETE', 'EXECUTE', 'APPROVE']);
export const SCOPES = new Set(['SELF', 'BRANCH', 'TENANT', 'GLOBAL']);
export const EFFECTS = new Set(['ALLOW', 'DENY']);
export const MASKS = new Set(['REDACT', 'HASH', 'PARTIAL', 'NULLIFY']);
export const SUBJECTS = new Set(['USER', 'ROLE', 'SERVICE']);
export const RESOURCES = new Set(['PATIENT', 'ENCOUNTER', 'DOCUMENT', 'RECORD']);
export const PURPOSES = new Set(['TREATMENT', 'PAYMENT', 'OPERATIONS', 'EMERGENCY']);
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Acciones de los códigos de permiso de la maqueta que no son un verbo de la API. */
export const ACTION_OF_SUFFIX: Readonly<Record<string, string>> = { EXPORT: 'EXECUTE', ASSIGN: 'EXECUTE', REVIEW: 'APPROVE' };

export interface Binding {
  readonly permissionId: string;
  readonly effect: string;
  readonly scope: string | null;
}
export interface FieldRule {
  entity: string;
  columnName: string;
  canRead: boolean;
  canWrite: boolean;
  maskStrategy: string | null;
  conditionJson: Record<string, unknown> | null;
}
export interface ScopeGrant {
  readonly id: string;
  readonly subjectId: string;
  readonly permissionId: string;
  readonly resourceId: string;
  readonly tenantId: string | null;
  readonly subjectType: string;
  readonly resourceType: string;
  readonly effect: string;
  readonly validFrom: string | null;
  validTo: string | null;
  readonly createdAt: string;
}
export interface LifecycleEvent {
  readonly id: string;
  readonly action: 'SUSPEND' | 'REACTIVATE' | 'DEACTIVATE';
  readonly reason: string;
  readonly recordedByUserId: string | null;
  readonly recordedAt: string;
}
export interface Review {
  readonly id: string;
  readonly userId: string;
  readonly userDisplayName: string | null;
  readonly reviewerUserId: string;
  readonly reviewerDisplayName: string | null;
  readonly reviewedAt: string;
}

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
  limit: number;
}

export const rejectWith = (base: MockReply, reason: string): MockReply =>
  reply(base.status, { ...(base.body as Record<string, unknown>), reason });

export const bodyOf = (req: MockRequest): Record<string, unknown> =>
  typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};

/** Motivo de terminar un permiso DENY: mínimo 10, como `EndResourceScopeGrantDto`. */
export function denyReason(req: MockRequest): string | MockReply {
  const reason = bodyOf(req)['reason'];
  if (typeof reason !== 'string' || reason.trim().length < REASON_MIN || reason.length > REASON_MAX) {
    return precondition('Terminar un permiso de efecto DENY exige un motivo', 'RESOURCE_SCOPE_GRANT_DENY_REASON_REQUIRED');
  }
  return reason.trim();
}

/** Motivo de una acción de ciclo de vida (`UserLifecycleReasonDto`): texto no vacío de hasta 500. */
export function lifecycleReason(req: MockRequest): string | MockReply {
  const reason = bodyOf(req)['reason'];
  if (typeof reason !== 'string' || reason.trim() === '' || reason.length > LIFECYCLE_REASON_MAX) {
    return validation('Error de validación', [{ field: 'reason', message: 'reason should not be empty' }]);
  }
  return reason.trim();
}

/** Una página por cursor numérico (posición), con el tope de `limit` de cada lista. */
export function pageOf<T>(req: MockRequest, rows: readonly T[], max: number, byDefault: number): MockReply | Page<T> {
  const raw = req.query.get('limit');
  const limit = raw === null || raw === '' ? byDefault : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > max) {
    return validation('Error de validación', [{ field: 'limit', message: `must not be greater than ${max}` }]);
  }
  const start = Number(req.query.get('cursor') ?? '0') || 0;
  return {
    items: rows.slice(start, start + limit),
    nextCursor: start + limit < rows.length ? String(start + limit) : null,
    limit,
  };
}
