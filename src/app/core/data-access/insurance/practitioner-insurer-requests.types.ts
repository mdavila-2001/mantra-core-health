/* ============================================================================
    La solicitud médico → aseguradora (API v4.2.64,
    `insurance.practitioner_insurer_requests`).

    El médico pide trabajar con una aseguradora —en el alta o desde «Mis
    verificaciones»— y la aseguradora la aprueba o la rechaza. La aprobación es
    el sello oficial. Los estados viajan como clave, no como uuid de concepto.
    ========================================================================== */

export type InsurerRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WITHDRAWN';

/** Una solicitud propia, vista por el médico. */
export interface InsurerRequest {
  readonly id: string;
  readonly carrierId: string;
  readonly carrierName: string;
  readonly status: InsurerRequestStatus;
  /** Por qué la rechazaron, si lo dijeron. Lo escribió la aseguradora. */
  readonly decisionReasonText: string | null;
  readonly createdAt: Date;
  /** `null` mientras está pendiente. */
  readonly decidedAt: Date | null;
}

/** Una solicitud recibida, vista por la aseguradora. */
export interface ReceivedInsurerRequest {
  readonly id: string;
  readonly practitionerProfileId: string;
  /** `null` si el profesional no cargó su nombre: es un dato faltante, no un anónimo. */
  readonly practitionerName: string | null;
  readonly professionalTitle: string | null;
  readonly status: InsurerRequestStatus;
  readonly decisionReasonText: string | null;
  readonly createdAt: Date;
  readonly decidedAt: Date | null;
}
