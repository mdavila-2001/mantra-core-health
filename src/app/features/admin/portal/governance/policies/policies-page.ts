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
import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { empty } from '../../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { Card } from '../../../../../shared/components/molecules/card/card';
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
  imports: [RouterLink, Badge, Link, Card, DataTable, PageHeader, FilterForm],
  templateUrl: './policies-page.html',
  styleUrl: './policies-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PoliciesPage {
  private readonly client = inject(GovernancePoliciesClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly values = queryFilters(queryParamsSignal(this.route), POLICY_URL_KEYS);
  protected readonly type = policyType;
  protected readonly state = policyState;
  protected readonly when = dateTime;

  protected readonly fields: readonly FilterField[] = [
    { key: 'q', label: 'Buscar', kind: 'text', placeholder: 'Código o nombre' },
    {
      key: 'type',
      label: 'Tipo',
      kind: 'select',
      options: [
        { value: '', label: 'Todos los tipos' },
        ...POLICY_TYPES.map((value) => ({ value, label: POLICY_TYPE_INFO[value].label })),
      ],
    },
  ];

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

  protected readonly columns = computed<readonly ColumnDef<PolicySummary>[]>(() => [
    { key: 'code', header: 'Política', priority: 1, cell: this.codeCell() },
    { key: 'state', header: 'Estado', priority: 2, cell: this.stateCell() },
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

  protected apply(filters: Readonly<Record<string, string>>): void {
    void patchQuery(this.router, this.route, filters);
  }

  protected clear(): void {
    void patchQuery(
      this.router,
      this.route,
      Object.fromEntries(POLICY_URL_KEYS.map((k) => [k, null])),
    );
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
