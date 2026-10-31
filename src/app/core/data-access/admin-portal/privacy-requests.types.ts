/* ============================================================================
    Solicitudes de privacidad (DSAR). Lectura en `/admin/governance/privacy-requests`;
    las transiciones siguen siendo `PATCH /privacy/dsar/:id`.

    La API publica en cada solicitud las transiciones que admite hoy
    (`allowedTransitions`): la vista no reconstruye la máquina de estados. Sólo
    llega el identificador del titular, nunca su nombre ni su documento.
    ========================================================================== */

export const PRIVACY_STATUSES = ['RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'] as const;
export type PrivacyStatus = (typeof PRIVACY_STATUSES)[number];

export const PRIVACY_TYPES = ['ACCESS', 'ERASURE', 'RECTIFICATION', 'PORTABILITY', 'OBJECTION'] as const;
export type PrivacyType = (typeof PRIVACY_TYPES)[number];

export const PRIVACY_JURISDICTIONS = ['PE', 'EU', 'US'] as const;
export type PrivacyJurisdiction = (typeof PRIVACY_JURISDICTIONS)[number];

/** Estados a los que una persona puede mover una solicitud (el alta es «recibida»). */
export type PrivacyTransition = Exclude<PrivacyStatus, 'RECEIVED'>;

export interface PrivacyRequest {
  readonly id: string;
  readonly subjectUserId: string;
  /** `null`: la API no reconoció el concepto. */
  readonly type: PrivacyType | null;
  readonly status: PrivacyStatus | null;
  readonly jurisdiction: PrivacyJurisdiction | null;
  readonly requestedAt: Date;
  readonly completedAt?: Date;
  readonly resultFileId: string | null;
  readonly updatedAt: Date;
  readonly rowVersion: number;
  readonly allowedTransitions: readonly PrivacyStatus[];
}

export interface PrivacyRequestsQuery {
  readonly status?: PrivacyStatus;
  readonly type?: PrivacyType;
  readonly jurisdiction?: PrivacyJurisdiction;
  readonly cursor?: string;
  readonly limit?: number;
}

export interface PrivacyRequestsResult {
  readonly items: readonly PrivacyRequest[];
  readonly nextCursor: string | null;
  readonly limit: number;
  readonly total: number;
  /** Cantidad por estado sobre TODAS las solicitudes. */
  readonly statusCounts: Readonly<Record<PrivacyStatus, number>> & { readonly other: number };
}
