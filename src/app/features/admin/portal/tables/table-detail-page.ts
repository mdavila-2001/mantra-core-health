import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type { Subscription } from 'rxjs';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type {
  AtributoDeGobierno,
  TablaFicha,
} from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { BackLink } from '../../../../shared/components/atoms/back-link/back-link';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { FactList } from '../../../../shared/components/molecules/fact-list/fact-list';
import type { Hecho } from '../../../../shared/components/molecules/fact-list/fact-list.types';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import {
  GOVERNANCE_ATTRIBUTES,
  confianza,
  estadoDeGobierno,
  metodoHttp,
  operacionSobreTabla,
  purposeState,
  revisionInventario,
} from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { paramValue, patchQuery, pathParamsSignal, queryParamsSignal } from '../support/route-query';
import { TableColumns } from './table-columns';
import { TableRelations } from './table-relations';

const LIST_ROUTE = portalUrl('catalog/tables');
const VIEWS = ['resumen', 'columnas', 'relaciones', 'operaciones', 'ddl'] as const;

/** Un atributo de gobierno escrito: su valor si alguien lo declaró, o por qué no lo hay. */
function governanceValue(attr: AtributoDeGobierno): string {
  if (attr.estado !== 'DECLARADO' || attr.valor === undefined || attr.valor === null) {
    return estadoDeGobierno(attr.estado).label;
  }
  if (typeof attr.valor === 'boolean') return attr.valor ? 'Sí' : 'No';
  return String(attr.valor);
}

function summaryFacts(t: TablaFicha): readonly Hecho[] {
  const governance = Object.entries(t.gobierno).map(([key, attr]) => ({
    etiqueta: GOVERNANCE_ATTRIBUTES[key] ?? key,
    valor: governanceValue(attr),
  }));
  return [
    { etiqueta: 'Dominio', valor: t.dominio ?? 'Sin dominio' },
    { etiqueta: 'Entidad del ORM', valor: t.entidadOrm ?? 'Sin entidad' },
    { etiqueta: 'Revisión', valor: revisionInventario(t.revision).label },
    ...governance,
  ];
}

/**
 * La ficha de una tabla del modelo, en una tarjeta con pestañas: para qué
 * existe, sus columnas, sus relaciones e índices, qué operaciones la tocan y su
 * DDL. Desde acá se salta a su linaje.
 */
@Component({
  selector: 'app-portal-table-detail-page',
  imports: [
    RouterLink,
    Badge,
    BackLink,
    Link,
    Card,
    FactList,
    Tab,
    Tabs,
    PageHeader,
    ViewStateHost,
    TableColumns,
    TableRelations,
  ],
  templateUrl: './table-detail-page.html',
  styleUrl: './table-detail-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TableDetailPage {
  private readonly client = inject(PortalClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  protected readonly listUrl = LIST_ROUTE;
  protected readonly lineageUrl = portalUrl('lineage');
  protected readonly method = metodoHttp;
  protected readonly effect = operacionSobreTabla;
  protected readonly confidence = confianza;
  protected readonly purpose = purposeState;
  protected readonly operationUrl = (id: string): string =>
    `${portalUrl('systems/operations')}/${encodeURIComponent(id)}`;
  protected readonly tableUrl = (schema: string, table: string): string =>
    `${LIST_ROUTE}/${encodeURIComponent(schema)}/${encodeURIComponent(table)}`;

  private readonly path = pathParamsSignal(this.route);
  private readonly schema = paramValue(this.path, 'schema');
  private readonly table = paramValue(this.path, 'table');
  protected readonly qualified = computed(() => `${this.schema()}.${this.table()}`);
  private readonly view = paramValue(queryParamsSignal(this.route), 'vista');
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view() as (typeof VIEWS)[number])),
  );

  protected readonly detail = signal<ViewState<TablaFicha>>(loading());
  protected readonly facts = computed(() => {
    const s = this.detail();
    return s.status === 'ready' ? summaryFacts(s.data) : [];
  });

  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    effect(() => {
      const [schema, table] = [this.schema(), this.table()];
      untracked(() => this.load(schema, table));
    });
  }

  protected reload(): void {
    this.load(this.schema(), this.table());
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { vista: index === 0 ? null : VIEWS[index]! });
  }

  private load(schema: string, table: string): void {
    this.pending?.unsubscribe();
    this.detail.set(loading());
    this.pending = this.client.getTable(schema, table).subscribe({
      next: (t) => this.detail.set(ready(t)),
      error: (e: unknown) => this.detail.set(errorToViewState<TablaFicha>(e)),
    });
  }
}
