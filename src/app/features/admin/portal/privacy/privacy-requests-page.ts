import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PrivacyRequestsClient } from '../../../../core/data-access/admin-portal/privacy-requests.client';
import type { PrivacyRequest } from '../../../../core/data-access/admin-portal/privacy-requests.types';
import { empty } from '../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { MetricCard } from '../../../../shared/components/molecules/metric-card/metric-card';
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
 * Solicitudes de privacidad (acceso, supresión, rectificación, portabilidad, oposición), de
 * `GET /privacy/dsar`: las más recientes primero, y las que pasaron su plazo se marcan
 * «vencida». Esa lectura no entrega conteos por estado, así que las pestañas no los inventan.
 */
@Component({
  selector: 'app-portal-privacy-requests-page',
  imports: [NgTemplateOutlet, RouterLink, Badge, Link, Alert, Card, MetricCard, Tab, Tabs, DataTable, PageHeader, FilterForm],
  templateUrl: './privacy-requests-page.html',
  styleUrl: './privacy-requests-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PrivacyRequestsPage {
  private readonly client = inject(PrivacyRequestsClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly values = queryFilters(queryParamsSignal(this.route), PRIVACY_URL_KEYS);
  protected readonly tabIndex = computed(() => tabIndexOf(this.values()));

  protected readonly status = privacyStatusLabel;
  protected readonly type = privacyTypeLabel;
  protected readonly jurisdiction = jurisdictionLabel;
  protected readonly when = dateTime;
  protected readonly waiting = (row: PrivacyRequest): number => daysSince(row.requestedAt);

  protected readonly fields = computed<readonly FilterField[]>(() => [
    { key: 'type', label: 'Tipo de solicitud', kind: 'select', options: TYPE_OPTIONS },
  ]);

  protected readonly list = pagedList<PrivacyRequest>(
    (cursor) => this.client.list({ ...privacyQuery(this.values()), limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) }),
    () => this.whenEmpty(),
  );

  /**
   * Cifras de arriba: sólo en «Todas», sin filtro y cuando la respuesta ya pedida trae todas las
   * solicitudes (una sola página, sin cursor siguiente). Si no, no se muestran: la lectura no
   * entrega conteos y contar una página sería inventar.
   */
  protected readonly metrics = computed(() => {
    const s = this.list.state();
    const c = this.list.cursor();
    if (this.tabIndex() !== 0 || this.values().type !== '') return null;
    if (s.status !== 'ready' || c.nextCursor !== null || c.prevCursor !== null) return null;
    const rows = s.data;
    const open = rows.filter((r) => r.status === 'RECEIVED' || r.status === 'IN_PROGRESS');
    return { total: rows.length, open: open.length, overdue: rows.filter((r) => r.overdue).length };
  });

  private readonly requestCell = viewChild.required<TemplateRef<{ $implicit: PrivacyRequest }>>('requestCell');
  private readonly stateCell = viewChild.required<TemplateRef<{ $implicit: PrivacyRequest }>>('stateCell');
  private readonly receivedCell = viewChild.required<TemplateRef<{ $implicit: PrivacyRequest }>>('receivedCell');
  private readonly whenCell = viewChild.required<TemplateRef<{ $implicit: PrivacyRequest }>>('whenCell');

  protected readonly columns = computed<readonly ColumnDef<PrivacyRequest>[]>(() => [
    { key: 'request', header: 'Solicitud', priority: 1, cell: this.requestCell() },
    { key: 'status', header: 'Estado', priority: 1, cell: this.stateCell() },
    { key: 'requestedAt', header: 'Recibida', priority: 2, cell: this.receivedCell() },
    { key: 'dueAt', header: 'Plazo', priority: 1, cell: this.whenCell() },
  ]);

  protected readonly tabLabels = {
    all: 'Todas',
    received: 'Recibidas',
    inProgress: 'En curso',
    completed: 'Completadas',
    rejected: 'Rechazadas',
  } as const;

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
    void patchQuery(this.router, this.route, { type: null });
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
