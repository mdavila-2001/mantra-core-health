import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
  type TemplateRef,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, type Subscription } from 'rxjs';

import { PortalClient } from '../../../../core/data-access/admin-portal/portal.client';
import type { HallazgoResumen } from '../../../../core/data-access/admin-portal/portal.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Badge } from '../../../../shared/components/atoms/badge/badge';
import { Link } from '../../../../shared/components/atoms/link/link';
import { Card } from '../../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../../shared/components/molecules/metric-card/metric-card';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { ddlSource, severidad } from '../portal-labels';
import { portalUrl } from '../portal-nav';
import { paramValue, patchQuery, queryParamsSignal } from '../support/route-query';
import { FindingDrawer } from './finding-drawer';
import { readDrift, type DriftView, type OrphanEntity } from './drift.model';

const VIEWS = ['hallazgos', 'modelo'] as const;

/**
 * Deriva: dónde el frontend, la API, el contrato y el modelo no coinciden. Dos
 * vistas: los hallazgos que salen de cruzar el mapa de rutas (con sus casos en
 * un cajón, `?hallazgo=`) y la deriva entre el DDL del modelo y el ORM.
 */
@Component({
  selector: 'app-portal-drift-page',
  imports: [
    RouterLink,
    Badge,
    Link,
    Card,
    MetricCard,
    Tab,
    Tabs,
    DataTable,
    PageHeader,
    ViewStateHost,
    FindingDrawer,
  ],
  templateUrl: './drift-page.html',
  styleUrl: './drift-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriftPage {
  private readonly client = inject(PortalClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly params = queryParamsSignal(this.route);
  private readonly view = paramValue(this.params, 'vista');
  protected readonly selected = paramValue(this.params, 'hallazgo');
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.view() as (typeof VIEWS)[number])),
  );

  protected readonly severity = severidad;
  protected readonly ddl = ddlSource;
  protected readonly findings = signal<ViewState<readonly HallazgoResumen[]>>(loading());
  protected readonly drift = signal<ViewState<DriftView>>(loading());
  protected readonly orphans = computed<ViewState<readonly OrphanEntity[]>>(() => {
    const s = this.drift();
    return s.status === 'ready' ? ready(s.data.orphanEntities) : loading();
  });
  protected readonly selectedTitle = computed(() => {
    const s = this.findings();
    const found = s.status === 'ready' ? s.data.find((f) => f.id === this.selected()) : undefined;
    return found?.titulo ?? 'Hallazgo';
  });

  private readonly severityCell =
    viewChild.required<TemplateRef<{ $implicit: HallazgoResumen }>>('severityCell');
  private readonly titleCell =
    viewChild.required<TemplateRef<{ $implicit: HallazgoResumen }>>('titleCell');
  private readonly ddlCell = viewChild.required<TemplateRef<{ $implicit: OrphanEntity }>>('ddlCell');

  protected readonly findingColumns = computed<readonly ColumnDef<HallazgoResumen>[]>(() => [
    { key: 'severidad', header: 'Severidad', priority: 1, cell: this.severityCell() },
    { key: 'titulo', header: 'Hallazgo', priority: 1, cell: this.titleCell() },
    { key: 'cuenta', header: 'Casos', priority: 2, align: 'end' },
    { key: 'queHacer', header: 'Qué hacer', priority: 3 },
  ]);
  protected readonly orphanColumns = computed<readonly ColumnDef<OrphanEntity>[]>(() => [
    { key: 'table', header: 'Tabla que declara', priority: 1 },
    { key: 'className', header: 'Entidad', priority: 2 },
    { key: 'ddlKind', header: 'Dónde la declara el modelo', priority: 1, cell: this.ddlCell() },
    { key: 'file', header: 'Archivo', priority: 3 },
  ]);
  protected readonly byFinding = (row: HallazgoResumen): string => row.id;
  protected readonly byTable = (row: OrphanEntity): string => row.table;
  protected readonly findingName = (row: HallazgoResumen): string => row.titulo;

  private pending: Subscription[] = [];

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending.forEach((s) => s.unsubscribe()));
    this.loadFindings();
    this.loadDrift();
  }

  protected loadFindings(): void {
    this.findings.set(loading());
    this.pending.push(
      this.client.listFindings().subscribe({
        next: (list) =>
          this.findings.set(
            list.length === 0
              ? empty(
                  { label: 'Ver el mapa de rutas', route: portalUrl('systems/flows') },
                  'El cruce del mapa de rutas no encontró nada que mirar.',
                )
              : ready(list),
          ),
        error: (e: unknown) => this.findings.set(errorToViewState<readonly HallazgoResumen[]>(e)),
      }),
    );
  }

  protected loadDrift(): void {
    this.drift.set(loading());
    this.pending.push(
      this.client
        .catalogDrift()
        .pipe(map(readDrift))
        .subscribe({
          next: (view) => this.drift.set(ready(view)),
          error: (e: unknown) => this.drift.set(errorToViewState<DriftView>(e)),
        }),
    );
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { vista: index === 0 ? null : VIEWS[index]! });
  }

  protected open(row: HallazgoResumen): void {
    void patchQuery(this.router, this.route, { hallazgo: row.id });
  }

  protected close(): void {
    void patchQuery(this.router, this.route, { hallazgo: null });
  }
}
