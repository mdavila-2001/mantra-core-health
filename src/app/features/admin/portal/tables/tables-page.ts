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

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type {
  TablaResumen,
  TablasQuery,
} from '../../../../core/data-access/admin-portal/portal.types';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty } from '../../../../core/view-state/view-state';
import { AppButton } from '../../../../shared/components/atoms/button/button';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import {
  FilterBar,
  type FilterDef,
} from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { estadoOrm, optionsOf } from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { pagedList } from '../support/paged-list';
import { hasAny, patchQuery, queryFilters, queryParamsSignal } from '../support/route-query';

const PAGE_SIZE = 25;
const FILTER_KEYS = ['q', 'schema', 'orm', 'appendOnly'] as const;
const LIST_ROUTE = portalUrl('catalog/tables');

function tableQuery(
  f: Readonly<Record<(typeof FILTER_KEYS)[number], string>>,
  cursor: string | undefined,
): TablasQuery {
  return {
    ...(f.q ? { q: f.q } : {}),
    ...(f.schema ? { schema: f.schema } : {}),
    ...(estadoOrm.codes.includes(f.orm) ? { orm: f.orm } : {}),
    ...(f.appendOnly === 'true' || f.appendOnly === 'false'
      ? { appendOnly: f.appendOnly === 'true' }
      : {}),
    ...(cursor ? { cursor } : {}),
    limit: PAGE_SIZE,
  };
}

/**
 * Tablas: las tablas del modelo tal como las leyó el inventario (DDL, entidad
 * del ORM y operaciones que las tocan). Es el catálogo **estático**; lo que la
 * base desplegada tiene hoy y sus fichas revisables están en el catálogo vivo,
 * al que se enlaza desde acá.
 */
@Component({
  selector: 'app-portal-tables-page',
  imports: [RouterLink, AppButton, Badge, Link, DataTable, FilterBar, PageHeader],
  templateUrl: './tables-page.html',
  styleUrl: './tables-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablesPage {
  private readonly client = inject(PortalClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly orm = estadoOrm;
  protected readonly liveCatalogUrl = '/superadmin/data-catalog';
  protected readonly detailUrl = (row: TablaResumen): string =>
    `${LIST_ROUTE}/${encodeURIComponent(row.schema)}/${encodeURIComponent(row.tabla)}`;

  protected readonly filters = queryFilters(queryParamsSignal(this.route), FILTER_KEYS);

  /** El schema no tiene desplegable: llega por enlace (desde «Esquema») y se quita desde acá. */
  protected readonly filterDefs: readonly FilterDef[] = [
    { key: 'orm', label: 'Frente al ORM', placeholder: 'Cualquier estado', options: optionsOf(estadoOrm) },
    {
      key: 'appendOnly',
      label: 'Append-only',
      placeholder: 'Con y sin append-only',
      options: [
        { value: 'true', label: 'Sólo las que no admiten cambios' },
        { value: 'false', label: 'Las que sí admiten cambios' },
      ],
    },
  ];

  protected readonly list = pagedList<TablaResumen>(
    (cursor) => this.client.listTables(tableQuery(this.filters(), cursor)),
    () =>
      hasAny(this.filters())
        ? empty(
            { label: 'Ver todas las tablas', route: LIST_ROUTE },
            'Ninguna tabla coincide con los filtros elegidos.',
          )
        : empty(
            { label: 'Abrir el catálogo vivo', route: this.liveCatalogUrl },
            'El inventario no trae tablas para esta versión del modelo.',
          ),
  );

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: TablaResumen }>>('nameCell');
  private readonly ormCell = viewChild.required<TemplateRef<{ $implicit: TablaResumen }>>('ormCell');

  protected readonly columns = computed<readonly ColumnDef<TablaResumen>[]>(() => [
    { key: 'id', header: 'Tabla', priority: 1, cell: this.nameCell() },
    { key: 'dominio', header: 'Dominio', priority: 2 },
    { key: 'columnas', header: 'Columnas', priority: 3, align: 'end' },
    { key: 'indices', header: 'Índices', priority: 3, align: 'end' },
    { key: 'operaciones', header: 'Operaciones', priority: 2, align: 'end' },
    { key: 'orm', header: 'ORM', priority: 1, cell: this.ormCell() },
  ]);
  protected readonly byId = (row: TablaResumen): string => row.id;
  protected readonly rowName = (row: TablaResumen): string => row.id;

  constructor() {
    effect(() => {
      this.filters();
      untracked(() => this.list.restart());
    });
  }

  protected clearSchema(): void {
    void patchQuery(this.router, this.route, { schema: null });
  }
}
