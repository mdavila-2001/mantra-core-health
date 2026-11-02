import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Link } from '../../../../../shared/components/atoms/link/link';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { portalUrl } from '../../portal-nav';
import { AuditTrailPanel } from '../common/audit-trail-panel';
import { MetricCard } from '../../../../../shared/components/molecules/metric-card/metric-card';
import { RolePermissionsEditor, type RoleSummary } from './role-permissions-editor';

const VIEWS = ['edit', 'audit'] as const;
const URL_KEYS = ['view', 'role'] as const;
const AUDIT_ACTIONS = ['ROLE_PERMISSIONS_SET', 'ROLE_CREATED'] as const;

/**
 * Roles y permisos: qué permite y qué niega cada rol, con edición. Una sola
 * tarjeta con dos pestañas: el editor y los cambios que quedaron registrados.
 * Lo decide todo la API; la pantalla no oculta un permiso ni impide un ámbito.
 */
@Component({
  selector: 'app-portal-roles-page',
  imports: [RouterLink, Alert, Link, Card, MetricCard, Tab, Tabs, PageHeader, RolePermissionsEditor, AuditTrailPanel],
  template: `
    <app-page-header
      title="Roles y permisos"
      subtitle="Qué permite y qué niega cada rol, por acción. Los cambios piden confirmación y quedan en la bitácora con su autor."
    />
    <div class="perm-page" data-testid="portal-roles">
      <app-alert tone="info" title="Un permiso fino sólo se aplica donde el sistema lo evalúa." collapsible data-testid="portal-roles-honesty">
        Un permiso fino sólo se aplica donde el sistema lo evalúa; en el resto de las rutas decide el rol que la ruta
        exige. Dónde pasa cada cosa, en la
        <a app-link [routerLink]="matrixUrl">matriz RBAC por módulo</a>.
      </app-alert>
      @if (summary(); as k) {
        <ul class="panel__kpis" aria-label="Resumen del rol elegido" data-testid="portal-role-editor-kpis">
          <li><app-metric-card label="Permite" tone="success" icon="check-circle" [value]="k.allow" /></li>
          <li><app-metric-card label="Niega" tone="error" icon="lock" [value]="k.deny" /></li>
          <li><app-metric-card label="Sensibles" tone="warning" icon="shield" [value]="k.dangerous" /></li>
          <li><app-metric-card label="Pendientes" tone="info" icon="edit" [value]="k.pending" /></li>
        </ul>
      }
      <app-card class="perm-card" variant="outlined" padding="md">
        <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
          <app-tab label="Por acción">
            <app-portal-role-permissions-editor
              [roleId]="values().role"
              (roleChanged)="selectRole($event)"
              (summaryChanged)="summary.set($event)"
            />
          </app-tab>
          <!-- El contenido proyectado se instancia aunque la pestaña no se dibuje: el @if evita pedir la bitácora de balde
               y la hace releerse cada vez que se abre, que es lo que muestra un cambio recién guardado. -->
          <app-tab label="Historial">
            @if (tabIndex() === 1) {
              <app-portal-audit-trail-panel [actions]="auditActions" />
            }
          </app-tab>
        </app-tabs>
      </app-card>
    </div>
  `,
  styleUrl: '../permissions-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RolesPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly summary = signal<RoleSummary | null>(null);
  protected readonly matrixUrl = portalUrl('governance/rbac-matrix');
  protected readonly values = queryFilters(queryParamsSignal(this.route), URL_KEYS);
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.values().view as (typeof VIEWS)[number])),
  );
  protected readonly auditActions = AUDIT_ACTIONS;

  protected selectTab(index: number): void {
    void patchQuery(this.router, this.route, { view: index === 0 ? null : VIEWS[index]! });
  }

  protected selectRole(roleId: string): void {
    void patchQuery(this.router, this.route, { role: roleId === '' ? null : roleId });
  }
}
