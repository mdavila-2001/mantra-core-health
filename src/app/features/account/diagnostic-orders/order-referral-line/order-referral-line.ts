import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import type { OrderReferral } from '../../../../core/data-access/diagnostics/order-referral.types';
import { OrganizationIdentity } from '../../../../shared/components/molecules/organization-identity/organization-identity';

/** The doctor's referral of an order to a center, as one line under the study: logo + what is pending. */
@Component({
  selector: 'app-order-referral-line',
  imports: [OrganizationIdentity],
  templateUrl: './order-referral-line.html',
  styleUrl: './order-referral-line.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrderReferralLine {
  readonly referral = input<OrderReferral | null>(null);
}
