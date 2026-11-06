import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin, map, type Observable } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import { OrganizationLogoClient } from '../../../core/data-access/directory/organization-logo.client';
import {
  isMedicalOrganizationType,
  type MyOrganization,
} from '../../../core/data-access/directory/directory.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { dataOf, empty, loading, ready } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';
import { Badge } from '../../../shared/components/atoms/badge/badge';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { Card } from '../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../shared/components/molecules/metric-card/metric-card';
import { ViewStateHost } from '../../../shared/components/organisms/view-state-host/view-state-host';
import { OrganizationChecklist } from './organization-checklist/organization-checklist';
import {
  organizationChecklist,
  summarizeTeam,
  type ChecklistItem,
  type TeamSummary,
} from './organization-home.model';

/** People per page asked for the summary; a full page means «at least this many». */
const TEAM_PAGE = 100;

/** Today in the organization's agenda and the doctors waiting for an answer. */
interface Activity {
  readonly appointmentsToday: number;
  readonly pendingRequests: number;
}

/**
 * Home of an organization account: how the organization stands in the papers, who is on its team
 * and what is happening today. Each block loads and fails on its own, so a slow agenda never hides
 * the checklist. It shows; it does not authorize: every read is checked again by the API.
 */
@Component({
  selector: 'app-organization-home',
  imports: [AppButtonLink, Badge, Card, MetricCard, OrganizationChecklist, RouterLink, ViewStateHost],
  templateUrl: './organization-home.html',
  styleUrl: './organization-home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationHome {
  private readonly auth = inject(AuthService);
  private readonly directory = inject(DirectoryClient);
  private readonly logo = inject(OrganizationLogoClient);

  protected readonly organization = signal<ViewState<MyOrganization>>(loading());
  protected readonly hasLogo = signal<boolean | null>(null);
  protected readonly team = signal<ViewState<TeamSummary>>(loading());
  protected readonly activity = signal<ViewState<Activity>>(loading());

  protected readonly org = computed(() => dataOf(this.organization()));
  protected readonly checklist = computed<readonly ChecklistItem[]>(() => {
    const org = this.org();
    return org === null ? [] : organizationChecklist(org, this.hasLogo());
  });
  /** Agenda and requests belong to organizations that attend patients, and to who administers them. */
  protected readonly showsActivity = computed(() => {
    const org = this.org();
    return org !== null && org.canAdminister && isMedicalOrganizationType(this.auth.activeTenantType() ?? '');
  });

  constructor() {
    this.load();
  }

  protected load(): void {
    this.organization.set(loading());
    this.directory.listMyOrganizations().subscribe({
      next: (items) => {
        const org = items.find((o) => o.id === this.auth.activeTenantId()) ?? items[0];
        if (org === undefined) {
          this.organization.set(empty({ label: 'Ir a su perfil', route: '/my-account' }, 'No encontramos su organización.'));
          return;
        }
        this.organization.set(ready(org));
        this.loadDetails(org);
      },
      error: (error: unknown) => this.organization.set(errorToViewState<MyOrganization>(error)),
    });
  }

  private loadDetails(org: MyOrganization): void {
    this.logo.getUrl(org.id).subscribe((url) => this.hasLogo.set(url !== null));
    this.loadTeam(org.id);
    if (this.showsActivity()) this.loadActivity(org.id);
  }

  protected loadTeam(tenantId: string | undefined = this.org()?.id): void {
    if (tenantId === undefined) return;
    this.team.set(loading());
    this.directory.listMemberships(tenantId, { limit: TEAM_PAGE }).subscribe({
      next: (page) => this.team.set(ready(summarizeTeam(page.items, page.nextCursor !== null))),
      error: (error: unknown) => this.team.set(errorToViewState<TeamSummary>(error)),
    });
  }

  protected loadActivity(tenantId: string | undefined = this.org()?.id): void {
    if (tenantId === undefined) return;
    this.activity.set(loading());
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    const read: Observable<Activity> = forkJoin({
      agenda: this.directory.getTenantAgenda(tenantId, { from, to }),
      requests: this.directory.listPractitionerRequests(tenantId),
    }).pipe(map(({ agenda, requests }) => ({ appointmentsToday: agenda.items.length, pendingRequests: requests.length })));
    read.subscribe({
      next: (value) => this.activity.set(ready(value)),
      error: (error: unknown) => this.activity.set(errorToViewState<Activity>(error)),
    });
  }
}
