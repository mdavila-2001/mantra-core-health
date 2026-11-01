import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { tap, type Subscription } from 'rxjs';

import { GovernancePoliciesClient } from '../../../../../core/data-access/admin-portal/governance-policies.client';
import { REVIEW_STATUSES } from '../../../../../core/data-access/admin-portal/data-catalog.types';
import type {
  PiiColumn,
  PiiDiscrepancy,
  PiiReconciliationSummary,
  PiiSummary,
} from '../../../../../core/data-access/admin-portal/governance-policies.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { EmptyViewState, ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../../../shared/components/molecules/metric-card/metric-card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { reviewStatus } from '../../../platform/platform-labels';
import { portalUrl } from '../../portal-nav';
import { pagedList } from '../../support/paged-list';
import { paramValue, patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { FilterForm, type FilterField } from '../filter-form';
import {
  PII_LEVEL_OPTIONS,
  PII_URL_KEYS,
  RECONCILIATION_OPTIONS,
  columnName,
  columnsQuery,
  emptyColumnsReason,
  emptyReconciliationReason,
  hasColumnFilters,
  hasReconciliationFilters,
  piiLevel,
  reconciliationKind,
  reconciliationQuery,
  registryMark,
} from './pii.model';

const PAGE_SIZE = 50;
const SCREEN = portalUrl('governance/pii');
const VIEWS = ['resumen', 'columnas', 'conciliacion'] as const;

/**
 * Datos personales, en una tarjeta con pestañas: el resumen que mide la API, las columnas que el
 * escaneo del catálogo clasificó como personales y la conciliación con lo que el registro de
 * gobierno declara. Todo viene de `/admin/catalog/pii/*`: acá no se vuelve a clasificar ni a
 * contar nada. Sólo se ven nombres de columnas, nunca valores; y lo que la API no pudo medir
 * (`notMeasured`) se dice, no se completa.
 */
@Component({
  selector: 'app-portal-pii-page',
  imports: [
    Alert,
    Badge,
    Card,
    MetricCard,
    Tab,
    Tabs,
    DataTable,
    PageHeader,
    FilterForm,
    ViewStateHost,
  ],
  templateUrl: './pii-page.html',
  styleUrl: './pii-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PiiPage {
  private readonly client = inject(GovernancePoliciesClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly values = queryFilters(queryParamsSignal(this.route), PII_URL_KEYS);
  private readonly view = paramValue(queryParamsSignal(this.route), 'vista');
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view() as (typeof VIEWS)[number])),
  );

  protected readonly level = piiLevel;
  protected readonly review = reviewStatus;
  protected readonly kind = reconciliationKind;
  protected readonly mark = registryMark;
  protected readonly name = columnName;

  /** El resumen: lo mide el servidor. Un fallo suyo no impide ver las pestañas de abajo. */
  protected readonly summary = signal<ViewState<PiiSummary>>(loading());
  private readonly summaryData = signal<PiiSummary | null>(null);
  /** El resumen ya cargado, para la pestaña «Resumen» (su fallo se dice arriba, una sola vez). */
  protected readonly summaryReady = computed(() => {
    const s = this.summary();
    return s.status === 'ready' ? s.data : null;
  });
  protected readonly reconciliationSummary = signal<PiiReconciliationSummary | null>(null);
  protected readonly reconciliationNotMeasured = signal<
    readonly { field: string; reason: string }[]
  >([]);

  protected readonly columnFields: readonly FilterField[] = [
    { key: 'q', label: 'Buscar', kind: 'text', placeholder: 'Esquema, objeto o columna' },
    {
      key: 'minSensitivity',
      label: 'Desde el nivel',
      kind: 'select',
      options: [{ value: '', label: 'Personal o más' }, ...PII_LEVEL_OPTIONS],
    },
    {
      key: 'reviewStatus',
      label: 'Revisión de la ficha',
      kind: 'select',
      options: [
        { value: '', label: 'Cualquier estado' },
        ...REVIEW_STATUSES.map((value) => ({ value, label: reviewStatus(value).label })),
      ],
    },
    {
      key: 'schema',
      label: 'Esquema exacto',
      kind: 'text',
      placeholder: 'Ej.: iam',
      advanced: true,
    },
  ];

  protected readonly reconciliationFields: readonly FilterField[] = [
    {
      key: 'kind',
      label: 'Clase de discrepancia',
      kind: 'select',
      options: [{ value: '', label: 'Todas' }, ...RECONCILIATION_OPTIONS],
    },
    { key: 'schema', label: 'Esquema exacto', kind: 'text', placeholder: 'Ej.: iam' },
  ];

  protected readonly columns = pagedList<PiiColumn>(
    (cursor) =>
      this.client.listPiiColumns({
        ...columnsQuery(this.values()),
        limit: PAGE_SIZE,
        ...(cursor ? { cursor } : {}),
      }),
    () => this.whenNoColumns(),
  );

  protected readonly discrepancies = pagedList<PiiDiscrepancy>(
    (cursor) =>
      this.client
        .piiReconciliation({
          ...reconciliationQuery(this.values()),
          limit: PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
        })
        .pipe(
          tap((page) => {
            this.reconciliationSummary.set(page.summary);
            this.reconciliationNotMeasured.set(page.notMeasured);
          }),
        ),
    () => this.whenNoDiscrepancies(),
  );

  private readonly columnCell =
    viewChild.required<TemplateRef<{ $implicit: PiiColumn }>>('columnCell');
  private readonly levelCell =
    viewChild.required<TemplateRef<{ $implicit: PiiColumn }>>('levelCell');
  private readonly registryCell =
    viewChild.required<TemplateRef<{ $implicit: PiiColumn }>>('registryCell');
  private readonly discrepancyCell =
    viewChild.required<TemplateRef<{ $implicit: PiiDiscrepancy }>>('discrepancyCell');
  private readonly kindCell =
    viewChild.required<TemplateRef<{ $implicit: PiiDiscrepancy }>>('kindCell');
  private readonly discrepancyLevelCell =
    viewChild.required<TemplateRef<{ $implicit: PiiDiscrepancy }>>('discrepancyLevelCell');

  protected readonly columnDefs = computed<readonly ColumnDef<PiiColumn>[]>(() => [
    { key: 'column', header: 'Columna', priority: 1, cell: this.columnCell() },
    { key: 'level', header: 'Nivel y revisión', priority: 1, cell: this.levelCell() },
    { key: 'registry', header: 'Registro de gobierno', priority: 2, cell: this.registryCell() },
  ]);

  protected readonly discrepancyDefs = computed<readonly ColumnDef<PiiDiscrepancy>[]>(() => [
    { key: 'column', header: 'Columna', priority: 1, cell: this.discrepancyCell() },
    { key: 'kind', header: 'Discrepancia', priority: 1, cell: this.kindCell() },
    { key: 'level', header: 'Nivel y revisión', priority: 2, cell: this.discrepancyLevelCell() },
  ]);

  protected readonly byColumn = (row: PiiColumn): string => row.columnId;
  protected readonly byDiscrepancy = (row: PiiDiscrepancy): string =>
    `${row.kind}|${columnName(row)}`;

  private pendingSummary: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pendingSummary?.unsubscribe());
    this.loadSummary();
    // Cada pestaña pide lo suyo cuando se abre (el panel inactivo ni se dibuja), y de nuevo si
    // cambia un filtro: abrir el resumen no cuesta dos listados que nadie va a mirar.
    effect(() => {
      this.values();
      const tab = this.tabIndex();
      untracked(() => {
        if (tab === 1) this.columns.restart();
        else if (tab === 2) this.discrepancies.restart();
      });
    });
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { vista: index === 0 ? null : VIEWS[index]! });
  }

  protected reloadSummary(): void {
    this.loadSummary();
  }

  protected apply(filters: Readonly<Record<string, string>>): void {
    void patchQuery(this.router, this.route, filters);
  }

  protected clear(keys: readonly (typeof PII_URL_KEYS)[number][]): void {
    void patchQuery(this.router, this.route, Object.fromEntries(keys.map((k) => [k, null])));
  }

  protected readonly columnKeys = ['q', 'schema', 'minSensitivity', 'reviewStatus'] as const;
  protected readonly reconciliationKeys = ['kind', 'schema'] as const;

  private loadSummary(): void {
    this.pendingSummary?.unsubscribe();
    this.summary.set(loading());
    this.pendingSummary = this.client.piiSummary().subscribe({
      next: (data) => {
        this.summaryData.set(data);
        this.summary.set(ready(data));
      },
      error: (e: unknown) => {
        this.summaryData.set(null);
        this.summary.set(errorToViewState<PiiSummary>(e));
      },
    });
  }

  private whenNoColumns(): EmptyViewState {
    const filtered = hasColumnFilters(this.values());
    const reason = emptyColumnsReason(this.summaryData(), filtered);
    return filtered
      ? empty(
          { label: 'Quitar los filtros', route: SCREEN, queryParams: { vista: 'columnas' } },
          reason,
        )
      : empty({ label: 'Ver el resumen', route: SCREEN }, reason);
  }

  private whenNoDiscrepancies(): EmptyViewState {
    const filtered = hasReconciliationFilters(this.values());
    const reason = emptyReconciliationReason(this.reconciliationSummary(), filtered);
    return filtered
      ? empty(
          { label: 'Quitar los filtros', route: SCREEN, queryParams: { vista: 'conciliacion' } },
          reason,
        )
      : empty(
          { label: 'Ver las columnas', route: SCREEN, queryParams: { vista: 'columnas' } },
          reason,
        );
  }
}
