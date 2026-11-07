import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import type { OrderReferral } from '../../../../../core/data-access/diagnostics/order-referral.types';
import { AppButton } from '../../../../../shared/components/atoms/button/button';
import type { EstudioEnFicha } from '../analysis-order-block.helpers';
import { OrderReferralDialog } from '../order-referral-dialog/order-referral-dialog';

/**
 * «Derivar a un centro» for one study row: the referral status and the action to refer.
 * Only an open (pending or active) laboratory or imaging order can be referred, and again only
 * after the patient rejected the previous referral. Keeps the status it just created locally
 * until the chart reloads.
 */
@Component({
  selector: 'app-study-referral',
  imports: [AppButton, OrderReferralDialog],
  templateUrl: './study-referral.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StudyReferral {
  readonly study = input.required<EstudioEnFicha>();

  protected readonly dialogOpen = signal(false);
  private readonly justReferred = signal<OrderReferral | null>(null);

  protected readonly referral = computed(() => this.justReferred() ?? this.study().referral);
  protected readonly canRefer = computed(() => {
    const { category, statusCode } = this.study();
    const open = statusCode.includes('PENDING') || statusCode.includes('ACTIVE');
    return (category === 'LAB' || category === 'IMAGING') && open && this.referral()?.status !== 'PENDING' && this.referral()?.status !== 'ACCEPTED';
  });

  protected onReferred(referral: OrderReferral): void {
    this.justReferred.set(referral);
    this.dialogOpen.set(false);
  }
}
