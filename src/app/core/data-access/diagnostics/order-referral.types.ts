/** Where a doctor's referral of an order stands: the patient decides. */
export type OrderReferralStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

/** A doctor's referral of an order to a laboratory or imaging center (simulator-only). */
export interface OrderReferral {
  readonly status: OrderReferralStatus;
  /** The center's name; never its id. */
  readonly performerName: string;
  /** The center's organization, to show its logo. */
  readonly performerTenantId?: string;
  /** Who refers, so the patient knows whom they are answering. */
  readonly requestedByName: string;
}

/** What comes back from referring an order or answering its referral. */
export interface OrderReferralResult {
  readonly orderId: string;
  readonly status: OrderReferralStatus;
  readonly performerName: string;
}
