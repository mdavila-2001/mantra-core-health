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
import { PRICES_ROUTE } from '../laboratory-home.logic';

/** «Su catálogo y precios»: published, drafts and unavailable today, with the way to Precios. */
@Component({
  selector: 'app-lab-catalog-overview',
  imports: [AppButtonLink, Card, NavIcon, RouterLink, SectionHeading, ViewStateHost],
  templateUrl: './lab-catalog-overview.html',
  styleUrls: ['./lab-home-block.css', './lab-catalog-overview.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LabCatalogOverview {
  readonly state = input.required<ViewState<LabSummary>>();
  readonly retry = output<void>();

  protected readonly data = computed(() => dataOf(this.state()));
  protected readonly pricesRoute = PRICES_ROUTE;
}
