import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  untracked,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataCatalogClient } from '../../../../core/data-access/admin-portal/data-catalog.client';
import type {
  CatalogObjectSummary,
  SchemaSummary,
} from '../../../../core/data-access/admin-portal/data-catalog.types';
import { empty } from '../../../../core/view-state/view-state';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { DrawerPanel } from '../../../../shared/components/organisms/drawer-panel/drawer-panel';
import { observationStatus, reviewStatus } from '../../platform/platform-labels';
import { portalUrl } from '../portal-nav';
import { pagedList } from '../support/paged-list';

const PAGE_SIZE = 25;
const LIVE_CATALOG = '/superadmin/data-catalog';

/**
 * Un schema en un cajón: lo que la bóveda dice del módulo que lo declara y sus
 * objetos tal como los vio el último escaneo, cada uno con su ficha en el
 * catálogo vivo.
 */
@Component({
  selector: 'app-portal-schema-drawer',
  imports: [RouterLink, Badge, Link, DataTable, DrawerPanel],
  templateUrl: './schema-drawer.html',
  styleUrl: './schema-drawer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SchemaDrawer {
  private readonly catalog = inject(DataCatalogClient);

  /** El schema abierto; `''` es «cerrado». */
  readonly schemaName = input.required<string>();
  /** Lo que la lista ya sabe del schema; `null` si todavía no llegó. */
  readonly summary = input<SchemaSummary | null>(null);
  readonly closed = output<void>();

  protected readonly observation = observationStatus;
  protected readonly review = reviewStatus;
  protected readonly modelTablesUrl = portalUrl('catalog/tables');
  protected readonly objectUrl = (id: string): string => `${LIVE_CATALOG}/${encodeURIComponent(id)}`;

  protected readonly objects = pagedList<CatalogObjectSummary>(
    (cursor) =>
      this.catalog.listObjects({
        schema: this.schemaName(),
        ...(cursor ? { cursor } : {}),
        limit: PAGE_SIZE,
      }),
    () =>
      empty(
        { label: 'Ir al catálogo vivo', route: LIVE_CATALOG },
        'El último escaneo no vio objetos en este schema.',
      ),
  );

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: CatalogObjectSummary }>>('nameCell');
  private readonly stateCell =
    viewChild.required<TemplateRef<{ $implicit: CatalogObjectSummary }>>('stateCell');
  protected readonly columns = computed<readonly ColumnDef<CatalogObjectSummary>[]>(() => [
    { key: 'objectName', header: 'Objeto', priority: 1, cell: this.nameCell() },
    { key: 'observationStatus', header: 'Estado', priority: 1, cell: this.stateCell() },
    { key: 'columnCount', header: 'Columnas', priority: 3, align: 'end' },
  ]);
  protected readonly byId = (row: CatalogObjectSummary): string => row.id;
  protected readonly rowName = (row: CatalogObjectSummary): string => row.objectName;

  constructor() {
    effect(() => {
      const name = this.schemaName();
      if (name !== '') untracked(() => this.objects.restart());
    });
  }
}
