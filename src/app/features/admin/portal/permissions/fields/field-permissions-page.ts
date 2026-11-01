import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { AuditTrailPanel } from '../common/audit-trail-panel';
import { RoleFieldsPanel } from './role-fields-panel';
import { ScopeGrantsPanel } from './scope-grants-panel';

const VIEWS = ['fields', 'scope', 'audit'] as const;
const URL_KEYS = ['view', 'role'] as const;
const AUDIT_ACTIONS = ['ROLE_FIELD_PERMISSIONS_SET', 'RESOURCE_SCOPE_GRANTED', 'RESOURCE_SCOPE_GRANT_ENDED'] as const;

/**
 * Permisos por campo y por alcance de recurso. Una tarjeta con tres pestañas:
 * las reglas de campo de un rol, los permisos sobre recursos concretos y lo
 * que quedó registrado. Lo decide todo la API.
 */
@Component({
  selector: 'app-portal-field-permissions-page',
  imports: [Card, Tab, Tabs, PageHeader, RoleFieldsPanel, ScopeGrantsPanel, AuditTrailPanel],
  template: `
    <app-page-header
      title="Permisos por campo y alcance"
      subtitle="Qué columnas ve o escribe cada rol y cómo se le enmascaran, y los permisos que valen sobre un recurso concreto."
      [breadcrumbs]="breadcrumbs()"
    />
    <app-card class="field-page" variant="outlined" padding="md" data-testid="portal-field-permissions">
      <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
        <app-tab label="Por campo (rol)">
          @if (tabIndex() === 0) {
            <app-portal-role-fields-panel [roleId]="values().role" (roleChanged)="selectRole($event)" />
          }
        </app-tab>
        <app-tab label="Por alcance de recurso">
          @if (tabIndex() === 1) {
            <app-portal-scope-grants-panel />
          }
        </app-tab>
        <app-tab label="Cambios registrados">
          @if (tabIndex() === 2) {
            <app-portal-audit-trail-panel [actions]="auditActions" />
          }
        </app-tab>
      </app-tabs>
    </app-card>
  `,
  styles: `
    .field-page {
      display: block;
      inline-size: 100%;
      margin-inline: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FieldPermissionsPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
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
