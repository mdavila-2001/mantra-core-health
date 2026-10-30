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
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type { OperacionResumen } from '../../../../core/data-access/admin-portal/portal.types';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty } from '../../../../core/view-state/view-state';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import {
  FilterBar,
  type FilterDef,
} from '../../../../shared/components/organisms/filter-bar/filter-bar';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import {
  SENALES_DE_ATENCION,
  metodoHttp,
  operationOrigin,
  optionsOf,
  riesgo,
  senal,
} from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { pagedList } from '../support/paged-list';
import { routeSegments } from '../support/route-segments';
import { processOptions } from '../support/process-options';
import { OPERATION_FILTER_KEYS, operationQuery } from '../support/operation-query';
import { hasAny, queryFilters, queryParamsSignal } from '../support/route-query';

const PAGE_SIZE = 25;
const LIST_ROUTE = portalUrl('systems/operations');

/**
 * Operaciones: todos los endpoints de la API que el inventario detectó, con su
 * riesgo, quién puede llamarlos, cuántas tablas tocan y qué señales de atención
 * tienen. Los filtros viven en la URL; la ficha de cada una es su propia ruta.
 */
@Component({
  selector: 'app-portal-operations-page',
  imports: [RouterLink, Badge, Link, DataTable, FilterBar, PageHeader],
  templateUrl: './operations-page.html',
  styleUrl: './operations-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationsPage {
  private readonly client = inject(PortalClient);
  private readonly options = processOptions();
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly segments = routeSegments;
  protected readonly method = metodoHttp;
  protected readonly risk = riesgo;
  protected readonly signalLabel = senal;
  protected readonly detailUrl = (id: string): string => `${LIST_ROUTE}/${encodeURIComponent(id)}`;

  private readonly filters = queryFilters(
    queryParamsSignal(inject(ActivatedRoute)),
    OPERATION_FILTER_KEYS,
  );

  protected readonly filterDefs = computed<readonly FilterDef[]>(() => [
    {
      key: 'modulo',
      label: 'Módulo',
      placeholder: 'Todos los módulos',
      options: this.options.modules(),
      unavailableReason: 'La lista de módulos no llegó.',
    },
    {
      key: 'flujo',
      label: 'Proceso',
      placeholder: 'Todos los procesos',
      options: this.options.flows(),
      unavailableReason: 'La lista de procesos no llegó.',
    },
    { key: 'riesgo', label: 'Riesgo', placeholder: 'Cualquier riesgo', options: optionsOf(riesgo) },
    { key: 'metodo', label: 'Método', placeholder: 'Cualquier método', options: optionsOf(metodoHttp) },
    {
      key: 'origen',
      label: 'Contrato',
      placeholder: 'Dentro y fuera del contrato',
      options: optionsOf(operationOrigin),
    },
    { key: 'senal', label: 'Señal', placeholder: 'Cualquier señal', options: optionsOf(senal) },
  ]);

  protected readonly list = pagedList<OperacionResumen>(
    (cursor) =>
      this.client.listOperations(
        operationQuery(this.filters(), { ...(cursor ? { cursor } : {}), limit: PAGE_SIZE }),
      ),
    () =>
      hasAny(this.filters())
        ? empty(
            { label: 'Ver todas las operaciones', route: LIST_ROUTE },
            'Ninguna operación coincide con los filtros elegidos.',
          )
        : empty(
            { label: 'Volver al centro del portal', route: portalUrl('') },
            'El inventario no trae operaciones: todavía no se generó para esta versión de la API.',
          ),
  );

  private readonly operationCell =
    viewChild.required<TemplateRef<{ $implicit: OperacionResumen }>>('operationCell');
  private readonly riskCell =
    viewChild.required<TemplateRef<{ $implicit: OperacionResumen }>>('riskCell');
  private readonly accessCell =
    viewChild.required<TemplateRef<{ $implicit: OperacionResumen }>>('accessCell');
  private readonly signalsCell =
    viewChild.required<TemplateRef<{ $implicit: OperacionResumen }>>('signalsCell');

  protected readonly columns = computed<readonly ColumnDef<OperacionResumen>[]>(() => [
    { key: 'ruta', header: 'Operación', priority: 1, cell: this.operationCell() },
    { key: 'riesgo', header: 'Riesgo', priority: 1, cell: this.riskCell() },
    { key: 'modulo', header: 'Módulo', priority: 2 },
    { key: 'roles', header: 'Quién la llama', priority: 2, cell: this.accessCell() },
    { key: 'tablas', header: 'Tablas', priority: 3, align: 'end' },
    { key: 'senales', header: 'Atención', priority: 2, cell: this.signalsCell() },
  ]);

  protected readonly byId = (row: OperacionResumen): string => row.id;
  protected readonly rowName = (row: OperacionResumen): string => `${row.metodo} ${row.ruta}`;

  constructor() {
    effect(() => {
      this.filters();
      untracked(() => this.list.restart());
    });
  }

  /** Sólo las señales que el mapa cuenta como roto o sin cobertura; las demás son descriptivas. */
  protected attention(row: OperacionResumen): readonly string[] {
    return row.senales.filter((s) => SENALES_DE_ATENCION.includes(s));
  }
}
