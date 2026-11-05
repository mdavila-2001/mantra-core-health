import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';

import { Card } from '../../../shared/components/molecules/card/card';
import { Tab } from '../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { OrganizationBranches } from '../../organization/organization-branches/organization-branches';
import { PharmacyOpeningHoursPage } from '../opening-hours/pharmacy-opening-hours';
import {
  BRANCHES_TABS,
  BRANCHES_TAB_LABELS,
  branchesTabIndexOf,
  branchesTabKeyOf,
} from './branches-tabs';

/**
 * Pharmacy **Sucursales** (05/11/2026, owner request): branches plus their
 * opening hours and on-call shifts in ONE tabbed card (`composition-rules.md`
 * §5), instead of two menu entries about the same sites.
 *
 * Both screens are the existing ones, mounted `embedded` (no own header/card)
 * and only while their tab is open. The tab lives in `?tab=`;
 * `/administration/pharmacy-hours` redirects to `?tab=horario`.
 */
@Component({
  selector: 'app-pharmacy-branches-hub',
  imports: [Card, OrganizationBranches, PageHeader, PharmacyOpeningHoursPage, Tab, Tabs],
  templateUrl: './pharmacy-branches-hub.html',
  styleUrl: './pharmacy-branches-hub.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PharmacyBranchesHub {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly tabs = BRANCHES_TABS;
  protected readonly labels = BRANCHES_TAB_LABELS;
  protected readonly selected = signal(
    branchesTabIndexOf(this.route.snapshot.queryParamMap.get('tab')),
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.selected.set(branchesTabIndexOf(params.get('tab')));
    });
  }

  protected select(index: number): void {
    this.selected.set(index);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: branchesTabKeyOf(index) },
      replaceUrl: true,
    });
  }
}
