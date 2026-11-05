/* ============================================================================
    Solicitudes de privacidad (DSAR). Lectura en `GET /privacy/dsar` y
    `GET /privacy/dsar/:id` (módulo `audit`, `AuditOversightReadService`); las
    transiciones son `PATCH /privacy/dsar/:id`.

    La lectura no publica las transiciones que admite cada solicitud: las
    declara {@link allowedTransitions}, copia de `ComplianceService.updateDsar`
    (desde un estado abierto se puede ir a cualquier otro que no sea «recibida»;
    uno terminal no admite más). La autoridad es la API: ante un estado terminal
    responde 422 y la vista lo dice. Sólo llega el identificador del titular,
    nunca su nombre ni su documento.
    ========================================================================== */

export const PRIVACY_STATUSES = ['RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'] as const;
export type PrivacyStatus = (typeof PRIVACY_STATUSES)[number];

export const PRIVACY_TYPES = ['ACCESS', 'ERASURE', 'RECTIFICATION', 'PORTABILITY', 'OBJECTION'] as const;
export type PrivacyType = (typeof PRIVACY_TYPES)[number];

export const PRIVACY_JURISDICTIONS = ['PE', 'EU', 'US'] as const;
export type PrivacyJurisdiction = (typeof PRIVACY_JURISDICTIONS)[number];

/** Estados a los que una persona puede mover una solicitud (el alta es «recibida»). */
export type PrivacyTransition = Exclude<PrivacyStatus, 'RECEIVED'>;

/** Plazo fijo de la API para `dueAt` (RGPD art. 12.3); no hay plazo por jurisdicción. */
export const PRIVACY_DUE_DAYS = 30;

const OPEN_TRANSITIONS: readonly PrivacyTransition[] = ['IN_PROGRESS', 'COMPLETED', 'REJECTED'];

/**
 * Transiciones que `PATCH /privacy/dsar/:id` admite hoy desde un estado. Un estado cerrado
 * (o uno que la API no reconoció) no admite ninguna.
 */
export function allowedTransitions(status: PrivacyStatus | null): readonly PrivacyTransition[] {
  if (status === 'RECEIVED') return OPEN_TRANSITIONS;
  if (status === 'IN_PROGRESS') return OPEN_TRANSITIONS.filter((s) => s !== 'IN_PROGRESS');
  return [];
}

export interface PrivacyRequest {
  readonly id: string;
  readonly subjectUserId: string;
  /** `null`: la API no reconoció el concepto. */
  readonly type: PrivacyType | null;
  readonly status: PrivacyStatus | null;
  readonly jurisdiction: PrivacyJurisdiction | null;
  readonly requestedAt: Date;
  readonly completedAt?: Date;
  /** Solicitud + {@link PRIVACY_DUE_DAYS} días. */
  readonly dueAt: Date;
  /** La API la marca vencida: sin cerrar y pasado el plazo. */
  readonly overdue: boolean;
  /** Sólo dice si hay un paquete generado; el archivo no se expone. */
  readonly hasResultFile: boolean;
  readonly updatedAt: Date;
  readonly rowVersion: number;
  readonly allowedTransitions: readonly PrivacyTransition[];
}

export interface PrivacyRequestsQuery {
  readonly status?: PrivacyStatus;
  readonly type?: PrivacyType;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Lo que la lectura declara que no mide. */
export interface PrivacyNotMeasured {
  readonly field: string;
  readonly reason: string;
}

export interface PrivacyRequestsResult {
  readonly items: readonly PrivacyRequest[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly notMeasured: readonly PrivacyNotMeasured[];
}
