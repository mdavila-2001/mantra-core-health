import { Coleccion } from '../mock-store';

/**
 * A doctor's referral of an order to a center, with the patient's decision (06/11/2026). Suggesting
 * a center grants no access (CONTRACT §3): only when the patient accepts does the order enter the
 * center's queue. Simulator-only. Its own file, importing no handlers, so `diagnostics.handlers`
 * can read it without a cycle.
 */
/** Extra fields of an order in a center's queue: how it arrived and who signed the paper order. */
export interface OrderIntakeFields {
  readonly origin?: 'PATIENT_QR' | 'DOCTOR_REFERRAL' | 'LAB_OWN';
  readonly externalRequesterName?: string;
}

export type ReferralStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface DerivacionSimulada {
  /** The order id: one row per order. */
  readonly id: string;
  readonly performerTenantId: string;
  readonly performerName: string;
  readonly requestedByName: string;
  readonly status: ReferralStatus;
  readonly requestedAt: string;
  readonly decidedAt: string | null;
}

export const derivaciones = new Coleccion<DerivacionSimulada>([]);
derivaciones.persistirEn('mock.diagnostico.derivaciones');

/** What the patient sees of the referral of one of their orders; nothing when there is none. */
export function referralFieldsOf(orderId: string): {
  readonly referral?: {
    readonly status: ReferralStatus;
    readonly performerName: string;
    readonly performerTenantId: string;
    readonly requestedByName: string;
  };
} {
  const d = derivaciones.get(orderId);
  return d === undefined
    ? {}
    : {
        referral: {
          status: d.status,
          performerName: d.performerName,
          performerTenantId: d.performerTenantId,
          requestedByName: d.requestedByName,
        },
      };
}
