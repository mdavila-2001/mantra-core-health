/**
 * Solicitudes de aprobación (autorización previa) vistas por la aseguradora.
 *
 * Registro de procesos · MÓDULO ASEGURADORA · «Recepción de solicitudes de
 * órdenes de Aprobación»: la aseguradora responde APROBADO / NO APROBADO por
 * ítem e indica, en lo no aprobado, la cláusula del contrato. Contrato:
 * `GET /prior-authorization-requests/inbox`, `GET /prior-authorization-requests/:id`
 * y `POST /prior-authorization-requests/:id/determinations` con `items`.
 *
 * Los importes viajan como **cadena decimal** y así se quedan: sumarlos o
 * compararlos como `number` produce descuadres de un céntimo.
 */

/** Qué pidió el prestador: receta (farmacia), laboratorio/imagen, u otro. */
export type PriorAuthorizationOrigin = 'PHARMACY' | 'DIAGNOSTIC' | 'GENERIC';

/** Estado de la solicitud. `IN_REVIEW` existe en el contrato aunque hoy nadie lo fija. */
export type PriorAuthorizationStatus = 'SUBMITTED' | 'IN_REVIEW' | 'DETERMINED';

/** Decisión global: la deriva el servidor a partir de la de cada ítem. */
export type PriorAuthorizationDecision = 'APPROVED' | 'DENIED' | 'PARTIAL';

/** Decisión de un ítem. */
export type PriorAuthorizationItemDecisionCode = 'APPROVED' | 'DENIED';

/** Filtro de la bandeja. Sin filtro: todas. */
export type PriorAuthorizationInboxFilter = 'PENDING' | 'DETERMINED';

export interface PriorAuthorizationPatient {
  readonly id: string;
  readonly displayName: string | null;
  readonly patientCode: string | null;
  readonly memberIdentifier: string | null;
}

export interface PriorAuthorizationItemDecision {
  readonly decision: PriorAuthorizationItemDecisionCode;
  readonly approvedQuantity: string | null;
  readonly approvedAmount: string | null;
  readonly policyClauseReference: string | null;
  readonly denialRationale: string | null;
  readonly decidedAt: Date | null;
}

export interface PriorAuthorizationItem {
  readonly id: string;
  readonly sequence: number;
  /** Producto, estudio o servicio, ya legible. */
  readonly description: string;
  readonly requestedQuantity: string | null;
  readonly requestedAmount: string | null;
  /** `null` mientras la solicitud está pendiente. */
  readonly decision: PriorAuthorizationItemDecision | null;
}

export interface PriorAuthorizationSummary {
  readonly id: string;
  readonly origin: PriorAuthorizationOrigin;
  readonly status: PriorAuthorizationStatus;
  readonly decision: PriorAuthorizationDecision | null;
  readonly patient: PriorAuthorizationPatient;
  readonly planName: string | null;
  readonly currencyCode: string | null;
  readonly itemCount: number;
  readonly totalRequestedAmount: string | null;
  readonly submittedAt: Date | null;
}

export interface PriorAuthorizationDetail extends PriorAuthorizationSummary {
  readonly items: readonly PriorAuthorizationItem[];
  readonly decidedAt: Date | null;
}

/** Lo que la aseguradora decide de UN ítem. La cláusula es obligatoria al no aprobar. */
export type PriorAuthorizationItemDecisionInput =
  | {
      readonly priorAuthorizationItemId: string;
      readonly decision: 'APPROVED';
    }
  | {
      readonly priorAuthorizationItemId: string;
      readonly decision: 'DENIED';
      readonly policyClauseReference: string;
      readonly denialRationale?: string;
    };
