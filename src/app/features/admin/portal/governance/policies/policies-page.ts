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

import { GovernancePoliciesClient } from '../../../../../core/data-access/admin-portal/governance-policies.client';
import {
  POLICY_TYPES,
  type PolicySummary,
} from '../../../../../core/data-access/admin-portal/governance-policies.types';
import { empty } from '../../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { FilterForm, type FilterField } from '../filter-form';
import { dateTime } from '../governance-labels';
import {
  POLICY_TYPE_INFO,
  POLICY_URL_KEYS,
  hasPolicyFilters,
  policyQuery,
  policyRowName,
  policyState,
  policyType,
} from './policies.model';

const PAGE_SIZE = 50;
const SCREEN = portalUrl('governance/policies');

/**
 * Políticas de gobierno de datos: escritura, retención, anonimización y residencia, en una sola
 * lista paginada por cursor. Búsqueda y tipo viven en la URL; cada código abre su ficha, que es
 * donde se ve lo que la política controla. La API no cuenta totales ni por tipo, así que acá
 * tampoco se muestran: un conteo calculado sobre la página sería un número falso.
 */
@Component({
  selector: 'app-portal-policies-page',
  imports: [NgTemplateOutlet, RouterLink, Badge, Link, Alert, Card, Tab, Tabs, DataTable, PageHeader, FilterForm],
  templateUrl: './policies-page.html',
  styleUrl: './policies-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoliciesPage {
  private readonly client = inject(GovernancePoliciesClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly values = queryFilters(queryParamsSignal(this.route), POLICY_URL_KEYS);
  protected readonly type = policyType;
  protected readonly state = policyState;
  protected readonly when = dateTime;

  /** El tipo se elige con las pestañas (viven en la URL como `type`); el buscador queda en la fila. */
  protected readonly fields: readonly FilterField[] = [
    { key: 'q', label: 'Buscar', kind: 'text', placeholder: 'Código o nombre' },
  ];
  protected readonly tabs = [
    { type: '', label: 'Todas', hint: 'Las cuatro clases de política, en una sola lista.' },
    ...POLICY_TYPES.map((type) => ({
      type,
      label: POLICY_TYPE_INFO[type].label,
      hint: POLICY_TYPE_INFO[type].hint + '.',
    })),
  ];
  protected readonly tabIndex = computed(() => {
    const type: string = policyQuery(this.values()).type ?? '';
    return Math.max(0, this.tabs.findIndex((t) => t.type === type));
  });

  protected readonly list = pagedList<PolicySummary>(
    (cursor) =>
      this.client.listPolicies({
        ...policyQuery(this.values()),
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      }),
    () => this.whenEmpty(),
  );

  private readonly codeCell =
    viewChild.required<TemplateRef<{ $implicit: PolicySummary }>>('codeCell');
  private readonly stateCell =
    viewChild.required<TemplateRef<{ $implicit: PolicySummary }>>('stateCell');

  private readonly typeCell =
    viewChild.required<TemplateRef<{ $implicit: PolicySummary }>>('typeCell');
  private readonly versionCell =
    viewChild.required<TemplateRef<{ $implicit: PolicySummary }>>('versionCell');

  protected readonly columns = computed<readonly ColumnDef<PolicySummary>[]>(() => [
    { key: 'code', header: 'Política', priority: 1, cell: this.codeCell() },
    { key: 'type', header: 'Tipo', priority: 2, cell: this.typeCell() },
    { key: 'state', header: 'Estado', priority: 1, cell: this.stateCell() },
    { key: 'version', header: 'Versión y último cambio', priority: 2, cell: this.versionCell() },
  ]);

  protected readonly byId = (row: PolicySummary): string => row.id;
  protected readonly rowName = policyRowName;
  protected readonly detailUrl = (row: PolicySummary): string =>
    `${SCREEN}/${encodeURIComponent(row.id)}`;
  /** El tipo viaja en la URL: la API lo exige para encontrar la política (`/policies/:type/:id`). */
  protected readonly detailQuery = (row: PolicySummary): { tipo: string } => ({
    tipo: row.policyType,
  });
  protected readonly piiUrl = portalUrl('governance/pii');

  constructor() {
    effect(() => {
      this.values();
      untracked(() => this.list.restart());
    });
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { type: this.tabs[index]?.type || null });
  }

  protected apply(filters: Readonly<Record<string, string>>): void {
    void patchQuery(this.router, this.route, { q: filters['q'] || null });
  }

  /** Quita la búsqueda; la pestaña (el tipo) se queda. */
  protected clear(): void {
    void patchQuery(this.router, this.route, { q: null });
  }

  private whenEmpty(): EmptyViewState {
    if (hasPolicyFilters(this.values())) {
      return empty(
        { label: 'Quitar los filtros', route: SCREEN },
        'Ninguna política coincide con los filtros elegidos.',
      );
    }
    return empty(
      { label: 'Ver los campos con datos personales', route: this.piiUrl },
      'Todavía no hay políticas de gobierno registradas. Las da de alta quien administra la seguridad.',
    );
  }
}
