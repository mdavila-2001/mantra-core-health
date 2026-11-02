import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type { Subscription } from 'rxjs';

import { AuthzModulesCatalogClient } from '../../../../core/data-access/authz-governance/authz-modules-catalog.client';
import type { ModulesCatalog } from '../../../../core/data-access/authz-governance/authz-modules-catalog.types';
import { errorToViewState } from '../../../../core/http/error-to-view-state';
import { empty, loading, ready } from '../../../../core/view-state/view-state';
import type { ViewState } from '../../../../core/view-state/view-state.types';
import { Alert } from '../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../shared/components/molecules/card/card';
import { MetricCard } from '../../../../shared/components/molecules/metric-card/metric-card';
import { Tab } from '../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../shared/components/organisms/page-header/page-header';
import { ViewStateHost } from '../../../../shared/components/organisms/view-state-host/view-state-host';
import { portalUrl } from '../portal-nav';
import { patchQuery, queryFilters, queryParamsSignal } from '../support/route-query';
import { CoveragePanel } from './coverage-panel';
import { GapsPanel } from './gaps-panel';
import { MATRIX_MODES, MatrixPanel, type MatrixMode } from './matrix-panel';
import { pickModule } from './rbac-matrix-model';

const VIEWS = ['matrix', 'gaps', 'coverage'] as const;
const URL_KEYS = ['view', 'module', 'mode', 'role'] as const;

/**
 * Matriz RBAC por módulo. Una tarjeta ancha con tres pestañas: la matriz (recurso × acción →
 * roles, y la vista por rol con edición por borrador), los huecos (rutas sin permiso fino) y la
 * cobertura por módulo. Lee `GET /authz/catalog/modules`; la escritura es la de siempre
 * (`PUT /authz/roles/:id/permissions`). Lo decide todo la API: la pantalla no concede nada.
 */
@Component({
  selector: 'app-portal-rbac-matrix-page',
  imports: [
    Alert,
    Card,
    MetricCard,
    Tab,
    Tabs,
    PageHeader,
    ViewStateHost,
    MatrixPanel,
    GapsPanel,
    CoveragePanel,
  ],
  template: `
    <app-page-header
      title="Matriz RBAC por módulo"
      subtitle="Qué roles tienen cada permiso fino de cada módulo, qué rutas se autorizan sólo por el rol que exigen y cuánto del catálogo está definido."
    />
    <div class="rbac-page" data-testid="portal-rbac-matrix">
      @if (catalog(); as data) {
        <app-alert
          tone="info"
          title="Esta vista muestra lo definido, no lo que está en vigor."
          collapsible
          data-testid="rbac-notes"
        >
          <p class="rbac-honesty__line">
            Un permiso fino sólo se aplica donde el sistema lo evalúa; en el resto de las rutas decide el rol que la
            ruta exige. Límites de esta lectura:
          </p>
          <ul class="rbac__notes">
            @for (note of data.notes; track note) {
              <li>{{ note }}</li>
            }
          </ul>
        </app-alert>

        <section class="rbac-kpis" aria-label="Resumen del catálogo">
          <app-metric-card
            label="Módulos"
            icon="grid"
            tone="primary"
            [value]="data.summary.modules"
            [hint]="data.summary.modulesWithoutFinePermissions + ' sin finos'"
          />
          <app-metric-card
            label="Permisos"
            icon="key"
            tone="success"
            [value]="data.summary.permissions"
            [hint]="'Finos, en ' + data.roles.length + ' roles'"
          />
          <app-metric-card
            label="Sólo rol"
            icon="shield"
            tone="warning"
            [value]="data.summary.roleOnlyRoutes"
            [hint]="'De ' + data.summary.routes + ' rutas'"
          />
          <app-metric-card
            label="Huecos"
            icon="flag"
            tone="error"
            [value]="data.summary.gaps"
            [hint]="data.summary.undeclaredAuthRoutes + ' sin autorización'"
          />
        </section>
      }

      <app-card class="rbac-card" variant="outlined" padding="md">
        <app-view-state-host [state]="state()" (retry)="reload()" (refresh)="reload()">
          @if (catalog(); as data) {
            @if (refreshError(); as message) {
              <app-alert tone="warning" data-testid="rbac-refresh-error">{{ message }}</app-alert>
            }
            @if (module(); as current) {
              <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
                <app-tab label="Matriz">
                  @if (tabIndex() === 0) {
                    <app-portal-rbac-matrix-panel
                      [catalog]="data"
                      [module]="current"
                      [mode]="mode()"
                      [roleId]="values().role"
                      (moduleChanged)="selectModule($event)"
                      (modeChanged)="selectMode($event)"
                      (roleChanged)="selectRole($event)"
                      (saved)="reload()"
                    />
                  }
                </app-tab>
                <app-tab [label]="'Huecos (' + data.summary.gaps + ')'">
                  @if (tabIndex() === 1) {
                    <app-portal-rbac-gaps-panel
                      [catalog]="data"
                      [module]="values().module"
                      (moduleChanged)="selectModule($event)"
                    />
                  }
                </app-tab>
                <app-tab label="Cobertura">
                  @if (tabIndex() === 2) {
                    <app-portal-rbac-coverage-panel [catalog]="data" (openGaps)="openGaps($event)" />
                  }
                </app-tab>
              </app-tabs>
            }
          }
        </app-view-state-host>
      </app-card>
    </div>
  `,
  styleUrl: './rbac-matrix.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RbacMatrixPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly client = inject(AuthzModulesCatalogClient);
  protected readonly values = queryFilters(queryParamsSignal(this.route), URL_KEYS);

  protected readonly state = signal<ViewState<ModulesCatalog>>(loading());
  protected readonly refreshError = signal<string | null>(null);
  /** Lo último que se leyó bien: sigue a la vista mientras se vuelve a leer. */
  protected readonly catalog = signal<ModulesCatalog | null>(null);

  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.values().view as (typeof VIEWS)[number])),
  );
  protected readonly mode = computed<MatrixMode>(() =>
    (MATRIX_MODES as readonly string[]).includes(this.values().mode)
      ? (this.values().mode as MatrixMode)
      : 'action',
  );
  protected readonly module = computed(() => {
    const data = this.catalog();
    return data === null ? null : pickModule(data, this.values().module);
  });

  private reading: Subscription | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.reading?.unsubscribe());
    this.reload();
  }

  protected reload(): void {
    this.reading?.unsubscribe();
    const hadData = this.catalog() !== null;
    // Con datos a la vista no se vuelve a dibujar un esqueleto: se relee en segundo plano.
    if (!hadData) this.state.set(loading());
    this.refreshError.set(null);
    this.reading = this.client.modules().subscribe({
      next: (data) => {
        this.catalog.set(data);
        this.state.set(
          data.modules.length === 0
            ? empty(
                { label: 'Ir a Roles y permisos', route: portalUrl('governance/roles') },
                'La API no devolvió ningún módulo con rutas ni permisos.',
              )
            : ready(data),
        );
      },
      error: (e: unknown) => {
        if (hadData) {
          this.refreshError.set(
            'No se pudo actualizar el catálogo. Se sigue mostrando la última lectura buena.',
          );
        } else {
          this.state.set(errorToViewState<ModulesCatalog>(e));
        }
      },
    });
  }

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { view: index === 0 ? null : VIEWS[index]! });
  }
  protected selectModule(key: string): void {
    void patchQuery(this.router, this.route, { module: key === '' ? null : key });
  }
  protected selectMode(mode: MatrixMode): void {
    void patchQuery(this.router, this.route, { mode: mode === 'action' ? null : mode });
  }
  protected selectRole(roleId: string): void {
    void patchQuery(this.router, this.route, { role: roleId === '' ? null : roleId });
  }
  protected openGaps(module: string): void {
    void patchQuery(this.router, this.route, { view: 'gaps', module });
  }
}
