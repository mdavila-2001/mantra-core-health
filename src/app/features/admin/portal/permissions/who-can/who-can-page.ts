import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Alert } from '../../../../../shared/components/molecules/alert/alert';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { AuditTrailPanel } from '../common/audit-trail-panel';
import { DecisionSimulator } from './decision-simulator';
import { WhoCanPanel } from './who-can-panel';

const VIEWS = ['simulator', 'who-can', 'audit'] as const;
const URL_KEYS = ['view', 'permission'] as const;
const AUDIT_ACTIONS = ['ACCESS_DECISION_SIMULATED'] as const;

/**
 * Quién puede qué. Una tarjeta con tres pestañas: el simulador (la decisión
 * real del PDP), el mapa permiso → roles → personas y las simulaciones
 * registradas.
 */
@Component({
  selector: 'app-portal-who-can-page',
  imports: [Alert, Card, Tab, Tabs, PageHeader, DecisionSimulator, WhoCanPanel, AuditTrailPanel],
  template: `
    <app-page-header
      title="Quién puede qué"
      subtitle="Simule una decisión contra el motor de autorización real y vea qué roles y personas tienen cada permiso."
    />
    <div class="perm-page" data-testid="portal-who-can-page">
      <app-alert tone="info" title="El simulador responde con el motor de decisiones real." collapsible data-testid="portal-who-can-honesty">
        La respuesta del simulador es la del motor de decisiones real, no una estimación de esta pantalla, y cada consulta queda en la bitácora. El mapa de quién tiene cada permiso muestra lo asignado, no lo que cada ruta exige.
      </app-alert>
      <app-card class="perm-card" variant="outlined" padding="md">
        <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
          <app-tab label="Simulador">
            @if (tabIndex() === 0) {
              <app-portal-decision-simulator />
            }
          </app-tab>
          <app-tab label="Quién lo tiene">
            @if (tabIndex() === 1) {
              <app-portal-who-can-panel [permissionId]="values().permission" (permissionChanged)="selectPermission($event)" />
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
export class WhoCanPage {
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

  protected selectPermission(id: string): void {
    void patchQuery(this.router, this.route, { permission: id === '' ? null : id });
  }
}
