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
import type {
  ProcesoResumen,
  ProcesosQuery,
} from '../../../../core/data-access/admin-portal/portal.types';
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
import { agrupacion, optionsOf, processKind, revisionInventario } from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { pagedList } from '../support/paged-list';
import { processOptions } from '../support/process-options';
import { hasAny, queryFilters, queryParamsSignal } from '../support/route-query';

const PAGE_SIZE = 25;
const FILTER_KEYS = ['q', 'tipo', 'modulo', 'agrupacion'] as const;
const LIST_ROUTE = portalUrl('processes');

function processQuery(
  f: Readonly<Record<(typeof FILTER_KEYS)[number], string>>,
  cursor: string | undefined,
): ProcesosQuery {
  const kind = f.tipo === 'MODULO' || f.tipo === 'CRITICO' ? f.tipo : null;
  return {
    ...(f.q ? { q: f.q } : {}),
    ...(kind ? { tipo: kind } : {}),
    ...(f.modulo ? { modulo: f.modulo } : {}),
    ...(agrupacion.codes.includes(f.agrupacion) ? { agrupacion: f.agrupacion } : {}),
    ...(cursor ? { cursor } : {}),
    limit: PAGE_SIZE,
  };
}

/**
 * Procesos: qué hace el sistema, módulo por módulo y en sus flujos críticos,
 * con cuántas operaciones y etapas tiene cada uno y quién actúa. La ficha de
 * cada proceso es su propia ruta.
 */
@Component({
  selector: 'app-portal-processes-page',
  imports: [RouterLink, Badge, Link, DataTable, FilterBar, PageHeader],
  templateUrl: './processes-page.html',
  styleUrl: './processes-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessesPage {
  private readonly client = inject(PortalClient);
  private readonly options = processOptions();
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly kind = processKind;
  protected readonly grouping = agrupacion;
  protected readonly review = revisionInventario;
  protected readonly detailUrl = (code: string): string =>
    `${LIST_ROUTE}/${encodeURIComponent(code)}`;

  private readonly filters = queryFilters(queryParamsSignal(inject(ActivatedRoute)), FILTER_KEYS);

  protected readonly filterDefs = computed<readonly FilterDef[]>(() => [
    { key: 'tipo', label: 'Tipo', placeholder: 'Módulos y flujos críticos', options: optionsOf(processKind) },
    {
      key: 'modulo',
      label: 'Módulo',
      placeholder: 'Todos los módulos',
      options: this.options.modules(),
      unavailableReason: 'La lista de módulos no llegó.',
    },
    {
      key: 'agrupacion',
      label: 'Cómo se agrupó',
      placeholder: 'Cualquier agrupación',
      options: optionsOf(agrupacion),
    },
  ]);

  protected readonly list = pagedList<ProcesoResumen>(
    (cursor) => this.client.listProcesses(processQuery(this.filters(), cursor)),
    () =>
      hasAny(this.filters())
        ? empty(
            { label: 'Ver todos los procesos', route: LIST_ROUTE },
            'Ningún proceso coincide con los filtros elegidos.',
          )
        : empty(
            { label: 'Volver al centro del portal', route: portalUrl('') },
            'El inventario no trae procesos para esta versión de la API.',
          ),
  );

  private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: ProcesoResumen }>>('nameCell');
  private readonly kindCell = viewChild.required<TemplateRef<{ $implicit: ProcesoResumen }>>('kindCell');
  private readonly reviewCell =
    viewChild.required<TemplateRef<{ $implicit: ProcesoResumen }>>('reviewCell');

  protected readonly columns = computed<readonly ColumnDef<ProcesoResumen>[]>(() => [
    { key: 'nombre', header: 'Proceso', priority: 1, cell: this.nameCell() },
    { key: 'tipo', header: 'Tipo', priority: 1, cell: this.kindCell() },
    { key: 'operaciones', header: 'Operaciones', priority: 2, align: 'end' },
    { key: 'etapas', header: 'Etapas', priority: 3, align: 'end' },
    { key: 'revision', header: 'Revisión', priority: 3, cell: this.reviewCell() },
  ]);
  protected readonly byCode = (row: ProcesoResumen): string => row.codigo;
  protected readonly rowName = (row: ProcesoResumen): string => row.nombre;

  constructor() {
    effect(() => {
      this.filters();
      untracked(() => this.list.restart());
    });
  }
}
