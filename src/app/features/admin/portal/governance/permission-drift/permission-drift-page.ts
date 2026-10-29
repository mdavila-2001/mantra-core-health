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
import { ActivatedRoute, Router } from '@angular/router';
import type { Subscription } from 'rxjs';

import { DataCatalogClient } from '../../../../../core/data-access/admin-portal/data-catalog.client';
import type {
  DriftRouteRef,
  PermissionDrift,
  UsedNotSeededRole,
} from '../../../../../core/data-access/admin-portal/data-catalog.types';
import { errorToViewState } from '../../../../../core/http/error-to-view-state';
import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { empty, loading, ready } from '../../../../../core/view-state/view-state';
import type { ViewState } from '../../../../../core/view-state/view-state.types';
import { Badge } from '../../../../../shared/components/atoms/badge/badge';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../../../shared/components/molecules/metric-card/metric-card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { DataTable } from '../../../../../shared/components/organisms/data-table/data-table';
import type { ColumnDef } from '../../../../../shared/components/organisms/data-table/data-table.types';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../../shared/components/organisms/view-state-host/view-state-host';
import { portalUrl } from '../../portal-nav';
import { dateTime, httpMethod, pathSegments, roleInDatabase } from '../governance-labels';
import { patchQuery, queryParamsSignal, queryFilters } from '../../support/route-query';

const VIEWS = ['used-not-seeded', 'seeded-not-used', 'without-roles'] as const;
const USERS_SCREEN = portalUrl('governance/users');

/** Una ruta en una línea: verbo y plantilla. */
function routeLabel(route: DriftRouteRef): string {
  return `${route.method} ${route.template}`;
}

/**
 * Deriva de permisos: lo que las rutas de la API exigen (`@Roles`) contra los
 * roles que existen para asignarse. Tres categorías, cada una en su pestaña:
 * roles exigidos que nadie siembra, roles sembrados que ninguna ruta exige y
 * rutas autenticadas sin roles. La calcula la API al arrancar; acá sólo se lee.
 */
@Component({
  selector: 'app-portal-permission-drift-page',
  imports: [Badge, Card, MetricCard, Tab, Tabs, DataTable, PageHeader, ViewStateHost],
  templateUrl: './permission-drift-page.html',
  styleUrl: './permission-drift-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PermissionDriftPage {
  private readonly catalog = inject(DataCatalogClient);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;

  private readonly values = queryFilters(queryParamsSignal(this.route), ['view']);
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.values().view as (typeof VIEWS)[number])),
  );

  protected readonly drift = signal<ViewState<PermissionDrift>>(loading());
  protected readonly report = computed(() => {
    const s = this.drift();
    return s.status === 'ready' ? s.data : null;
  });

  protected readonly method = httpMethod;
  protected readonly inDatabase = roleInDatabase;
  protected readonly when = dateTime;
  protected readonly segments = pathSegments;

  protected readonly usedNotSeeded = computed<ViewState<readonly UsedNotSeededRole[]>>(() => {
    const r = this.report();
    if (!r) return loading();
    return r.usedNotSeeded.length === 0
      ? empty(
          { label: 'Ver usuarios y roles', route: USERS_SCREEN },
          'Cada rol que una ruta exige existe para asignarse.',
        )
      : ready(r.usedNotSeeded);
  });

  protected readonly withoutRoles = computed<ViewState<readonly DriftRouteRef[]>>(() => {
    const r = this.report();
    if (!r) return loading();
    return r.routesWithoutRoles.length === 0
      ? empty(
          { label: 'Ver los roles sin sembrar', route: portalUrl('governance/permission-drift') },
          'Toda ruta autenticada declara qué roles la pueden llamar.',
        )
      : ready(r.routesWithoutRoles);
  });

  private readonly roleCell = viewChild.required<TemplateRef<{ $implicit: UsedNotSeededRole }>>('roleCell');
  private readonly databaseCell = viewChild.required<TemplateRef<{ $implicit: UsedNotSeededRole }>>('databaseCell');
  private readonly sampleCell = viewChild.required<TemplateRef<{ $implicit: UsedNotSeededRole }>>('sampleCell');
  private readonly routeCell = viewChild.required<TemplateRef<{ $implicit: DriftRouteRef }>>('routeCell');
  private readonly handlerCell = viewChild.required<TemplateRef<{ $implicit: DriftRouteRef }>>('handlerCell');

  protected readonly roleColumns = computed<readonly ColumnDef<UsedNotSeededRole>[]>(() => [
    { key: 'role', header: 'Rol exigido', priority: 1, cell: this.roleCell() },
    { key: 'routeCount', header: 'Rutas que lo exigen', priority: 1, align: 'end' },
    { key: 'inDatabase', header: 'En la base', priority: 2, cell: this.databaseCell() },
    { key: 'sample', header: 'Algunas de esas rutas', priority: 3, cell: this.sampleCell() },
  ]);

  protected readonly routeColumns = computed<readonly ColumnDef<DriftRouteRef>[]>(() => [
    { key: 'template', header: 'Ruta', priority: 1, cell: this.routeCell() },
    { key: 'handler', header: 'Dónde está en el código', priority: 2, cell: this.handlerCell() },
  ]);

  protected readonly byRole = (row: UsedNotSeededRole): string => row.role;
  protected readonly byRoute = (row: DriftRouteRef): string => routeLabel(row);
  protected readonly roleName = (row: UsedNotSeededRole): string => row.role;
  protected readonly routeName = (row: DriftRouteRef): string => routeLabel(row);

  private pending: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.pending?.unsubscribe());
    this.load();
  }

  protected load(): void {
    this.pending?.unsubscribe();
    this.drift.set(loading());
    this.pending = this.catalog.permissionDrift().subscribe({
      next: (report) => this.drift.set(ready(report)),
      error: (e: unknown) => this.drift.set(errorToViewState<PermissionDrift>(e)),
    });
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { view: index === 0 ? null : VIEWS[index]! });
  }
}
