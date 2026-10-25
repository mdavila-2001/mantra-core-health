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
import type { MapaFila } from '../../../../core/data-access/admin-portal/portal.types';
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
import { metodoHttp, optionsOf, riesgo, senal } from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { pagedList } from '../support/paged-list';
import { routeSegments } from '../support/route-segments';
import { processOptions } from '../support/process-options';
import { OPERATION_FILTER_KEYS, operationQuery } from '../support/operation-query';
import { hasAny, queryFilters, queryParamsSignal } from '../support/route-query';

const PAGE_SIZE = 25;
const MAP_ROUTE = portalUrl('systems/flows');

/**
 * Mapa de rutas: cada ruta de la API con el proceso y la etapa en que
 * participa, cómo se autoriza, qué cliente del frontend la llama y las señales
 * que el generador le encontró. Sirve para responder «¿qué rutas escriben sin
 * roles?» o «¿qué parte de la agenda no tiene pruebas?» con un filtro.
 */
@Component({
  selector: 'app-portal-route-map-page',
  imports: [RouterLink, Badge, Link, DataTable, FilterBar, PageHeader],
  templateUrl: './route-map-page.html',
  styleUrl: './route-map-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RouteMapPage {
  private readonly client = inject(PortalClient);
  private readonly options = processOptions();
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly segments = routeSegments;
  protected readonly method = metodoHttp;
  protected readonly risk = riesgo;
  protected readonly signalLabel = senal;
  protected readonly diagramUrl = portalUrl('systems/flows/diagram');
  protected readonly operationUrl = (id: string): string =>
    `${portalUrl('systems/operations')}/${encodeURIComponent(id)}`;

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
    { key: 'senal', label: 'Señal', placeholder: 'Cualquier señal', options: optionsOf(senal) },
  ]);

  protected readonly list = pagedList<MapaFila>(
    (cursor) =>
      this.client.routeMap(
        operationQuery(this.filters(), { ...(cursor ? { cursor } : {}), limit: PAGE_SIZE }),
      ),
    () =>
      hasAny(this.filters())
        ? empty(
            { label: 'Ver el mapa completo', route: MAP_ROUTE },
            'Ninguna ruta coincide con los filtros elegidos.',
          )
        : empty(
            { label: 'Volver al centro del portal', route: portalUrl('') },
            'El inventario no trae el mapa de rutas para esta versión de la API.',
          ),
  );

  private readonly routeCell = viewChild.required<TemplateRef<{ $implicit: MapaFila }>>('routeCell');
  private readonly flowsCell = viewChild.required<TemplateRef<{ $implicit: MapaFila }>>('flowsCell');
  private readonly riskCell = viewChild.required<TemplateRef<{ $implicit: MapaFila }>>('riskCell');
  private readonly authCell = viewChild.required<TemplateRef<{ $implicit: MapaFila }>>('authCell');
  private readonly signalsCell =
    viewChild.required<TemplateRef<{ $implicit: MapaFila }>>('signalsCell');

  protected readonly columns = computed<readonly ColumnDef<MapaFila>[]>(() => [
    { key: 'ruta', header: 'Ruta', priority: 1, cell: this.routeCell() },
    { key: 'flujos', header: 'Proceso y etapa', priority: 1, cell: this.flowsCell() },
    { key: 'riesgo', header: 'Riesgo', priority: 1, cell: this.riskCell() },
    { key: 'autorizacion', header: 'Autorización', priority: 3, cell: this.authCell() },
    { key: 'senales', header: 'Señales', priority: 2, cell: this.signalsCell() },
  ]);

  protected readonly byId = (row: MapaFila): string => row.id;
  protected readonly rowName = (row: MapaFila): string => `${row.metodo} ${row.ruta}`;

  constructor() {
    effect(() => {
      this.filters();
      untracked(() => this.list.restart());
    });
  }
}
