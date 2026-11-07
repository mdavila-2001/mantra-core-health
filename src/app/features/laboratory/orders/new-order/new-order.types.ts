import type { LabOrder } from '../../../../core/data-access/lab-portal/lab-portal.types';

/** What a creation tab hands back: the order and whether it was new. */
export interface NewOrderResult {
  readonly order: LabOrder;
  /** `false` when the patient's QR code had already been loaded. */
  readonly created: boolean;
}
