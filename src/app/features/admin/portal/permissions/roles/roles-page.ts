import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
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
import { RolePermissionsEditor } from './role-permissions-editor';

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
  imports: [RouterLink, Alert, Link, Card, Tab, Tabs, PageHeader, RolePermissionsEditor, AuditTrailPanel],
  template: `
    <app-page-header
      title="Roles y permisos"
      subtitle="Qué permite y qué niega cada rol, por acción. Los cambios piden confirmación y quedan en la bitácora con su autor."
    />
    <div class="perm-page" data-testid="portal-roles">
      <app-alert class="perm-honesty" tone="info" data-testid="portal-roles-honesty">
        Un permiso fino sólo se aplica donde el sistema lo evalúa; en el resto de las rutas decide el rol que la ruta
        exige. Dónde pasa cada cosa, en la
        <a app-link [routerLink]="matrixUrl">matriz RBAC por módulo</a>.
      </app-alert>
      <app-card class="perm-card" variant="outlined" padding="md">
        <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
          <app-tab label="Por acción">
            <app-portal-role-permissions-editor [roleId]="values().role" (roleChanged)="selectRole($event)" />
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
