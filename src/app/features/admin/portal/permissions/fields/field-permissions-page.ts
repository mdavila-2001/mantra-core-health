import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Alert } from '../../../../../shared/components/molecules/alert/alert';
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
  imports: [Alert, Card, Tab, Tabs, PageHeader, RoleFieldsPanel, ScopeGrantsPanel, AuditTrailPanel],
  template: `
    <app-page-header
      title="Permisos por campo y alcance"
      subtitle="Qué columnas ve o escribe cada rol y cómo se le enmascaran, y los permisos que valen sobre un recurso concreto."
    />
    <div class="perm-page" data-testid="portal-field-permissions">
      <app-alert tone="info" title="Quitar una regla de campo todavía no está disponible." collapsible data-testid="portal-field-permissions-honesty">
        La API guarda reglas de campo nuevas o cambiadas; quitar una regla no está expuesto todavía. Las restricciones por dirección IP y por horario existen en el modelo de datos pero todavía no se pueden ver ni editar.
      </app-alert>
      <app-card class="perm-card" variant="outlined" padding="md">
        <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
          <app-tab label="Por campo">
            @if (tabIndex() === 0) {
              <app-portal-role-fields-panel [roleId]="values().role" (roleChanged)="selectRole($event)" />
            }
          </app-tab>
          <app-tab label="Por recurso">
            @if (tabIndex() === 1) {
              <app-portal-scope-grants-panel />
            }
          </app-tab>
          <app-tab label="Historial">
            @if (tabIndex() === 2) {
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
export class FieldPermissionsPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
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
