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
import { ActivatedRoute, Router } from '@angular/router';
import { tap } from 'rxjs';

import { GovernancePoliciesClient } from '../../../../../core/data-access/admin-portal/governance-policies.client';
import type {
  PiiField,
  PiiSources,
  PiiSummary,
} from '../../../../../core/data-access/admin-portal/governance-policies.types';
import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { empty } from '../../../../../core/view-state/view-state';
import type { EmptyViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../../../shared/components/molecules/metric-card/metric-card';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { reviewStatus } from '../../../platform/platform-labels';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { FilterForm, type FilterField } from '../filter-form';
import {
  PII_LEVEL_OPTIONS,
  PII_SOURCE_OPTIONS,
  PII_URL_KEYS,
  emptyReason,
  hasPiiFilters,
  piiLevel,
  piiProtection,
  piiQuery,
  piiRegistryMark,
  piiSource,
} from './pii.model';

const PAGE_SIZE = 50;
const SCREEN = portalUrl('governance/pii');

/**
 * Inventario de campos con datos personales o secretos. Junta lo que el escaneo del catálogo
 * clasificó con lo que el registro de gobierno marca, y dice de dónde sale cada fila. Los
 * recuentos de arriba son de los filtros enteros, no de la página. La lista vacía explica por
 * qué lo está según las fuentes que informa la API.
 */
@Component({
  selector: 'app-portal-pii-page',
  imports: [Badge, Card, MetricCard, DataTable, PageHeader, FilterForm],
  templateUrl: './pii-page.html',
  styleUrl: './pii-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PiiPage {
  private readonly client = inject(GovernancePoliciesClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly values = queryFilters(queryParamsSignal(this.route), PII_URL_KEYS);
  protected readonly level = piiLevel;
  protected readonly review = reviewStatus;
  protected readonly source = piiSource;
  protected readonly protection = piiProtection;
  protected readonly registryMark = piiRegistryMark;

  protected readonly summary = signal<PiiSummary | null>(null);
  private readonly sources = signal<PiiSources | null>(null);
  protected readonly unprotectedTone = computed(() =>
    (this.summary()?.withoutProtection ?? 0) > 0 ? 'warning' : 'success',
  );

  protected readonly fields: readonly FilterField[] = [
    { key: 'q', label: 'Buscar', kind: 'text', placeholder: 'Esquema, tabla o columna' },
    {
      key: 'sensitivity',
      label: 'Nivel',
      kind: 'select',
      options: [{ value: '', label: 'Cualquier nivel' }, ...PII_LEVEL_OPTIONS],
    },
    {
      key: 'source',
      label: 'Fuente',
      kind: 'select',
      options: [{ value: '', label: 'Cualquier fuente' }, ...PII_SOURCE_OPTIONS],
    },
    {
      key: 'schema',
      label: 'Esquema exacto',
      kind: 'text',
      placeholder: 'Ej.: iam',
      advanced: true,
    },
  ];

  protected readonly list = pagedList<PiiField>(
    (cursor) =>
      this.client
        .listPiiFields({
          ...piiQuery(this.values()),
          limit: PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        })
        .pipe(
          tap((page) => {
            this.summary.set(page.summary);
            this.sources.set(page.sources);
          }),
        ),
    () => this.whenEmpty(),
  );

  private readonly fieldCell =
    viewChild.required<TemplateRef<{ $implicit: PiiField }>>('fieldCell');
  private readonly levelCell =
    viewChild.required<TemplateRef<{ $implicit: PiiField }>>('levelCell');
  private readonly protectionCell =
    viewChild.required<TemplateRef<{ $implicit: PiiField }>>('protectionCell');

  protected readonly columns = computed<readonly ColumnDef<PiiField>[]>(() => [
    { key: 'field', header: 'Campo', priority: 1, cell: this.fieldCell() },
    { key: 'level', header: 'Nivel y revisión', priority: 1, cell: this.levelCell() },
    { key: 'protection', header: 'Protección declarada', priority: 2, cell: this.protectionCell() },
  ]);

  protected readonly byKey = (row: PiiField): string =>
    `${row.schemaName}.${row.tableName}.${row.columnName}`;
  protected readonly rowName = (row: PiiField): string => this.byKey(row);
  protected readonly policiesUrl = portalUrl('governance/policies');

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
      Object.fromEntries(PII_URL_KEYS.map((k) => [k, null])),
    );
  }

  private whenEmpty(): EmptyViewState {
    const filtered = hasPiiFilters(this.values());
    // La respuesta de una página vacía trae las fuentes: se leen en el `tap`, antes de llegar acá.
    return filtered
      ? empty({ label: 'Quitar los filtros', route: SCREEN }, emptyReason(this.sources(), true))
      : empty(
          { label: 'Ver las políticas de gobierno', route: this.policiesUrl },
          emptyReason(this.sources(), false),
        );
  }
}
