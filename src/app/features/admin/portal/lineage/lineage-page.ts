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

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type { Linaje, TablaResumen } from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Link } from '../../../../shared/components/atoms/link/link';
import { MetricCard } from '../../../../shared/components/molecules/metric-card/metric-card';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { FilterBar } from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { estadoDeGobierno } from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { pagedList } from '../support/paged-list';
import { paramValue, patchQuery, queryParamsSignal } from '../support/route-query';
import { TableLineageDrawer } from './table-lineage-drawer';

const PAGE_SIZE = 10;
const PAGE_ROUTE = portalUrl('lineage');

/** Qué cuenta cada métrica del linaje. Una clave nueva se muestra tal cual. */
const METRIC_LABELS: Readonly<Record<string, string>> = {
  rutas: 'Operaciones',
  tablas: 'Tablas',
  dominios: 'Dominios',
  aristas: 'Relaciones en el grafo',
  operacionATabla: 'Operación → tabla',
  tablaATabla: 'Tabla → tabla',
  tablasConPii: 'Tablas con datos personales',
};

export interface LineageMetric {
  readonly key: string;
  readonly label: string;
  readonly value: string | number;
}

/** Un número se muestra como número; un estado (`SIN_FUENTE`) como lo que significa. */
export function lineageMetrics(lineage: Linaje): readonly LineageMetric[] {
  return Object.entries(lineage.metricas).map(([key, value]) => ({
    key,
    label: METRIC_LABELS[key] ?? key,
    value: typeof value === 'number' ? value : estadoDeGobierno(value).label,
  }));
}

/**
 * Linaje: qué operación lee o escribe qué tabla y qué tabla depende de cuál.
 * Arriba, el tamaño del grafo; abajo, se busca una tabla y su linaje se abre en
 * un cajón (`?tabla=schema.tabla`), así que también se llega por enlace.
 */
@Component({
  selector: 'app-portal-lineage-page',
  imports: [
    RouterLink,
    Link,
    MetricCard,
    DataTable,
    FilterBar,
    PageHeader,
    ViewStateHost,
    TableLineageDrawer,
  ],
  templateUrl: './lineage-page.html',
  styleUrl: './lineage-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LineagePage {
  private readonly client = inject(PortalClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly params = queryParamsSignal(this.route);
  private readonly search = paramValue(this.params, 'q');
  protected readonly selected = paramValue(this.params, 'tabla');

  protected readonly metrics = signal<ViewState<readonly LineageMetric[]>>(loading());
  protected readonly tables = pagedList<TablaResumen>(
    (cursor) =>
      this.client.listTables({
        ...(this.search() ? { q: this.search() } : {}),
        ...(cursor ? { cursor } : {}),
        limit: PAGE_SIZE,
      }),
    () =>
      empty(
        { label: 'Ver todas las tablas', route: PAGE_ROUTE },
        this.search()
          ? `Ninguna tabla coincide con «${this.search()}».`
          : 'El inventario no trae tablas para esta versión del modelo.',
      ),
  );

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: TablaResumen }>>('nameCell');
  protected readonly columns = computed<readonly ColumnDef<TablaResumen>[]>(() => [
    { key: 'id', header: 'Tabla', priority: 1, cell: this.nameCell() },
    { key: 'dominio', header: 'Dominio', priority: 2 },
    { key: 'operaciones', header: 'Operaciones', priority: 2, align: 'end' },
  ]);
  protected readonly byId = (row: TablaResumen): string => row.id;
  protected readonly rowName = (row: TablaResumen): string => row.id;

  constructor() {
    this.loadMetrics();
    effect(() => {
      this.search();
      untracked(() => this.tables.restart());
    });
  }

  protected loadMetrics(): void {
    this.metrics.set(loading());
    this.client.lineage().subscribe({
      next: (l) => this.metrics.set(ready(lineageMetrics(l))),
      error: (e: unknown) => this.metrics.set(errorToViewState<readonly LineageMetric[]>(e)),
    });
  }

  protected open(row: TablaResumen): void {
    void patchQuery(this.router, this.route, { tabla: row.id });
  }

  protected close(): void {
    void patchQuery(this.router, this.route, { tabla: null });
  }
}
