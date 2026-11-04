import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { LabSummary } from '../../../../core/data-access/lab-portal/lab-portal.types';
import { dataOf } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { AppButtonLink } from '../../../../shared/components/atoms/button/button-link';
import { NavIcon } from '../../../../shared/components/atoms/nav-icon/nav-icon';
import { Card } from '../../../../shared/components/molecules/card/card';
import { SectionHeading } from '../../../../shared/components/molecules/section-heading/section-heading';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { ORDERS_ROUTE, type PendingResults } from '../laboratory-home.logic';

/** «Resultados pendientes»: processed orders without a file, each with its upload link. */
@Component({
  selector: 'app-lab-pending-results',
  imports: [AppButtonLink, Card, DatePipe, NavIcon, RouterLink, SectionHeading, ViewStateHost],
  templateUrl: './lab-pending-results.html',
  styleUrl: './lab-home-block.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabPendingResults {
  readonly state = input.required<ViewState<PendingResults>>();
  /** The summary feeds only the footer (files uploaded, last upload); it may still be loading or failed. */
  readonly summary = input.required<ViewState<LabSummary>>();
  readonly retry = output<void>();

  protected readonly data = computed(() => dataOf(this.state()));
  protected readonly uploaded = computed(() => dataOf(this.summary()));
  protected readonly lastUpload = computed(
    () => this.uploaded()?.recentActivity.find((entry) => entry.kind === 'RESULT_UPLOADED') ?? null,
  );
  protected readonly ordersRoute = ORDERS_ROUTE;
  protected readonly uploadParams = { estado: 'processed' };
}
