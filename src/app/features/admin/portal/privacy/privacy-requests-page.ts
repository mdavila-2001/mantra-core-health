import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { tap } from 'rxjs';

import { PrivacyRequestsClient } from '../../../../core/data-access/admin-portal/privacy-requests.client';
import type { PrivacyRequest, PrivacyRequestsResult } from '../../../../core/data-access/admin-portal/privacy-requests.types';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty } from '../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { FilterForm, type FilterField } from '../governance/filter-form';
import { dateTime } from '../governance/governance-labels';
import { portalUrl } from '../portal-nav';
import { pagedList } from '../support/paged-list';
import { patchQuery, queryFilters, queryParamsSignal } from '../support/route-query';
import {
  JURISDICTION_OPTIONS,
  TYPE_OPTIONS,
  daysSince,
  jurisdictionLabel,
  privacyStatusLabel,
  privacyTypeLabel,
} from './privacy-labels';
import {
  PRIVACY_TABS,
  PRIVACY_URL_KEYS,
  hasPrivacyFilters,
  privacyQuery,
  tabIndexOf,
} from './privacy-requests.model';

const PAGE_SIZE = 25;
const SCREEN = portalUrl('governance/privacy-requests');

/**
 * Solicitudes de privacidad (acceso, supresión, rectificación, portabilidad, oposición). Las
 * más antiguas primero: una solicitud sin atender no queda enterrada bajo las nuevas. El
 * conteo por estado lo calcula la API sobre todas las solicitudes, no sobre la página.
 */
@Component({
  selector: 'app-portal-privacy-requests-page',
  imports: [NgTemplateOutlet, RouterLink, Badge, Link, Card, Tab, Tabs, DataTable, PageHeader, FilterForm],
  templateUrl: './privacy-requests-page.html',
  styleUrl: './privacy-requests-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyRequestsPage {
  private readonly client = inject(PrivacyRequestsClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly values = queryFilters(queryParamsSignal(this.route), PRIVACY_URL_KEYS);
  protected readonly tabIndex = computed(() => tabIndexOf(this.values()));

  protected readonly status = privacyStatusLabel;
  protected readonly type = privacyTypeLabel;
  protected readonly jurisdiction = jurisdictionLabel;
  protected readonly when = dateTime;
  protected readonly waiting = (row: PrivacyRequest): number => daysSince(row.requestedAt);

  /** Conteo por estado sobre todas las solicitudes; `null` hasta que llega la primera página. */
  protected readonly counts = signal<PrivacyRequestsResult['statusCounts'] | null>(null);

  protected readonly fields = computed<readonly FilterField[]>(() => [
    { key: 'type', label: 'Tipo de solicitud', kind: 'select', options: TYPE_OPTIONS },
    { key: 'jurisdiction', label: 'Jurisdicción', kind: 'select', options: JURISDICTION_OPTIONS },
  ]);

  protected readonly list = pagedList<PrivacyRequest>(
    (cursor) =>
      this.client
        .list({ ...privacyQuery(this.values()), limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) })
        .pipe(tap((page) => this.counts.set(page.statusCounts))),
    () => this.whenEmpty(),
  );

  private readonly requestCell = viewChild.required<TemplateRef<{ $implicit: PrivacyRequest }>>('requestCell');
  private readonly stateCell = viewChild.required<TemplateRef<{ $implicit: PrivacyRequest }>>('stateCell');
  private readonly whenCell = viewChild.required<TemplateRef<{ $implicit: PrivacyRequest }>>('whenCell');

  protected readonly columns = computed<readonly ColumnDef<PrivacyRequest>[]>(() => [
    { key: 'request', header: 'Solicitud', priority: 1, cell: this.requestCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.stateCell() },
    { key: 'requestedAt', header: 'Recibida', priority: 2, cell: this.whenCell() },
  ]);

  protected readonly tabLabels = computed(() => {
    const c = this.counts();
    const suffix = (n: number | undefined): string => (n === undefined ? '' : ` (${n})`);
    return {
      all: 'Todas',
      received: `Recibidas${suffix(c?.RECEIVED)}`,
      inProgress: `En curso${suffix(c?.IN_PROGRESS)}`,
      completed: `Completadas${suffix(c?.COMPLETED)}`,
      rejected: `Rechazadas${suffix(c?.REJECTED)}`,
    };
  });

  protected readonly byId = (row: PrivacyRequest): string => row.id;
  protected readonly rowName = (row: PrivacyRequest): string =>
    `${privacyTypeLabel(row.type)} · ${dateTime(row.requestedAt)}`;
  protected readonly detailUrl = (id: string): string => `${SCREEN}/${encodeURIComponent(id)}`;

  constructor() {
    effect(() => {
      this.values();
      untracked(() => this.list.restart());
    });
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { status: index === 0 ? null : PRIVACY_TABS[index]! });
  }

  protected apply(filters: Readonly<Record<string, string>>): void {
    void patchQuery(this.router, this.route, filters);
  }

  protected clear(): void {
    void patchQuery(this.router, this.route, { type: null, jurisdiction: null });
  }

  private whenEmpty(): EmptyViewState {
    const v = this.values();
    if (hasPrivacyFilters(v)) {
      return empty(
        { label: 'Quitar los filtros', route: SCREEN, queryParams: v.status ? { status: v.status } : {} },
        'Ninguna solicitud coincide con los filtros elegidos.',
      );
    }
    if (v.status !== '') {
      return empty({ label: 'Ver todas las solicitudes', route: SCREEN }, 'No hay solicitudes en ese estado.');
    }
    return empty(
      { label: 'Ver la auditoría', route: portalUrl('governance/audit') },
      'Todavía no se recibió ninguna solicitud de privacidad.',
    );
  }
}
