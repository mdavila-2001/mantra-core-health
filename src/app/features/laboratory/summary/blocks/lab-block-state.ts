import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Skeleton } from '../../../../shared/components/atoms/skeleton/skeleton';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { SupportCode } from '../../../../shared/components/molecules/support-code/support-code';
import { HOME_LIST_SIZE } from '../laboratory-home.logic';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';

export type LabSkeletonShape = 'rows' | 'figures' | 'orders';

/**
 * One block's M34 state for the lab home. Loading and empty come from the
 * shared host; every failure (S5, S8, S9) uses the same compact alert, so the
 * four blocks fail alike: a short sentence, the support code when the API gave
 * one, and a single retry. The skeleton has the shape of the loaded block
 * (rows, figures, or tiles plus rows), so the card does not jump when it fills.
 */
@Component({
  selector: 'app-lab-block-state',
  imports: [Alert, AppButton, NgTemplateOutlet, Skeleton, SupportCode, ViewStateHost],
  templateUrl: './lab-block-state.html',
  styleUrl: './lab-block-state.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabBlockState {
  readonly state = input.required<ViewState<unknown>>();
  /** What failed, as a noun phrase: «las órdenes». */
  readonly subject = input.required<string>();
  /** Optional line that explains where the data comes from, for derived blocks. */
  readonly note = input('');
  /** The loaded layout the skeleton mimics. */
  readonly skeleton = input<LabSkeletonShape>('rows');
  /** How many rows (or figures) the loaded block usually shows. */
  readonly skeletonRows = input(HOME_LIST_SIZE);
  readonly retry = output<void>();

  /** The API's request ID when the state carries one; offline failures have none. */
  protected readonly code = computed(() => {
    const state = this.state();
    return (state.status === 'error' || state.status === 'forbidden') && state.requestId ? state.requestId : null;
  });

  protected readonly slots = computed(() => Array.from({ length: this.skeletonRows() }, (_, i) => i));

  protected readonly offline = computed(() => this.state().status === 'offline');
  protected readonly forbidden = computed(() => this.state().status === 'forbidden');
}
