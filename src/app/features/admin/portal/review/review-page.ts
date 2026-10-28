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
import { map } from 'rxjs';

import { DataCatalogClient } from '../../../../core/data-access/admin-portal/data-catalog.client';
import type { CatalogObjectSummary } from '../../../../core/data-access/admin-portal/data-catalog.types';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty } from '../../../../core/view-state/view-state';
import { Link } from '../../../../shared/components/atoms/link/link';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import {
  FilterBar,
  type FilterDef,
} from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { sensitivityLabel } from '../../platform/platform-labels';
import { portalUrl } from '../portal-nav';
import { pagedList } from '../support/paged-list';
import {
  hasAny,
  nonEmpty,
  paramValue,
  patchQuery,
  queryFilters,
  queryParamsSignal,
} from '../support/route-query';
import { ReviewDrawer } from './review-drawer';

const PAGE_SIZE = 25;
const FILTER_KEYS = ['q', 'schema'] as const;
const REVIEW_ROUTE = portalUrl('systems/review');

/** Una ficha en revisión con el texto ya armado: la tabla sólo lo pinta. */
interface ReviewRow {
  readonly id: string;
  readonly qualifiedName: string;
  readonly businessName: string | null;
  readonly owner: string;
  readonly sensitivity: string;
  readonly columnCount: number;
}

function toRow(o: CatalogObjectSummary): ReviewRow {
  return {
    id: o.id,
    qualifiedName: `${o.schemaName}.${o.objectName}`,
    businessName: o.annotation?.businessName ?? null,
    owner: o.annotation?.owner ?? '—',
    sensitivity: sensitivityLabel(o.annotation?.sensitivity),
    columnCount: o.columnCount,
  };
}

/**
 * Revisión: las fichas del catálogo que alguien envió y esperan que otra
 * persona decida. Aprobar exige al menos una evidencia enlazada y rechazar
 * exige explicar qué falta; quien escribió la revisión no la decide. Esas
 * reglas las aplica la API: la pantalla las anticipa para no ofrecer una puerta
 * que va a estar cerrada, y explica el rechazo si igual llega.
 */
@Component({
  selector: 'app-portal-review-page',
  imports: [RouterLink, Link, Alert, DataTable, FilterBar, PageHeader, ReviewDrawer],
  templateUrl: './review-page.html',
  styleUrl: './review-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReviewPage {
  private readonly catalog = inject(DataCatalogClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly params = queryParamsSignal(this.route);
  private readonly filters = queryFilters(this.params, FILTER_KEYS);
  protected readonly selected = paramValue(this.params, 'ficha');
  protected readonly notice = signal<string | null>(null);
  protected readonly liveCatalogUrl = '/superadmin/data-catalog';

  private readonly schemaOptions = signal<readonly SelectOption<string>[]>([]);
  protected readonly filterDefs = computed<readonly FilterDef[]>(() => [
    {
      key: 'schema',
      label: 'Schema',
      placeholder: 'Todos los schemas',
      options: this.schemaOptions(),
      unavailableReason: 'La lista de schemas no llegó.',
    },
  ]);

  protected readonly list = pagedList<ReviewRow>(
    (cursor) =>
      this.catalog.listObjects({
        ...nonEmpty(this.filters()),
        reviewStatus: 'NEEDS_REVIEW',
        ...(cursor ? { cursor } : {}),
        limit: PAGE_SIZE,
      })
        .pipe(map((page) => ({ ...page, items: page.items.map(toRow) }))),
    () =>
      hasAny(this.filters())
        ? empty(
            { label: 'Ver todas las fichas en revisión', route: REVIEW_ROUTE },
            'Ninguna ficha en revisión coincide con los filtros elegidos.',
          )
        : empty(
            { label: 'Ir al catálogo de datos', route: this.liveCatalogUrl },
            'No hay fichas esperando una decisión.',
          ),
  );

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: ReviewRow }>>('nameCell');
  protected readonly columns = computed<readonly ColumnDef<ReviewRow>[]>(() => [
    { key: 'qualifiedName', header: 'Tabla o vista', priority: 1, cell: this.nameCell() },
    { key: 'owner', header: 'Responsable', priority: 2 },
    { key: 'sensitivity', header: 'Sensibilidad', priority: 2 },
    { key: 'columnCount', header: 'Columnas', priority: 3, align: 'end' },
  ]);
  protected readonly byId = (row: ReviewRow): string => row.id;
  protected readonly rowName = (row: ReviewRow): string => row.qualifiedName;

  constructor() {
    this.loadSchemas();
    effect(() => {
      this.filters();
      untracked(() => this.list.restart());
    });
  }

  protected open(row: ReviewRow): void {
    this.notice.set(null);
    void patchQuery(this.router, this.route, { ficha: row.id });
  }

  protected close(): void {
    void patchQuery(this.router, this.route, { ficha: null });
  }

  /** Decidida una ficha, sale de la cola: se cierra el cajón y se vuelve a pedir la lista. */
  protected decided(message: string): void {
    this.notice.set(message);
    this.close();
    this.list.restart();
  }

  private loadSchemas(): void {
    this.catalog
      .listSchemas()
      .pipe(map((list) => list.map((s) => ({ value: s.schemaName, label: s.schemaName }))))
      .subscribe({
        next: (options) => this.schemaOptions.set(options),
        // Sin la lista, el filtro queda deshabilitado con su motivo; la cola se ve igual.
        error: () => this.schemaOptions.set([]),
      });
  }
}
