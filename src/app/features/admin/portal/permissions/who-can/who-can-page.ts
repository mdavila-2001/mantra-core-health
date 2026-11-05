import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NavigationService } from '../../../../../core/navigation/navigation.service';
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
  imports: [Card, Tab, Tabs, PageHeader, DecisionSimulator, WhoCanPanel, AuditTrailPanel],
  template: `
    <app-page-header
      title="Quién puede qué"
      subtitle="Simule una decisión contra el motor de autorización real y vea qué roles y personas tienen cada permiso."
      [breadcrumbs]="breadcrumbs()"
    />
    <app-card class="who-can-page" variant="outlined" padding="md" data-testid="portal-who-can-page">
      <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
        <app-tab label="Simulador de decisión">
          @if (tabIndex() === 0) {
            <app-portal-decision-simulator />
          }
        </app-tab>
        <app-tab label="Quién puede qué">
          @if (tabIndex() === 1) {
            <app-portal-who-can-panel [permissionId]="values().permission" (permissionChanged)="selectPermission($event)" />
          }
        </app-tab>
        <app-tab label="Simulaciones registradas">
          @if (tabIndex() === 2) {
            <app-portal-audit-trail-panel [actions]="auditActions" />
          }
        </app-tab>
      </app-tabs>
    </app-card>
  `,
  styles: `
    .who-can-page {
      display: block;
      inline-size: 100%;
      margin-inline: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WhoCanPage {
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

  protected selectPermission(id: string): void {
    void patchQuery(this.router, this.route, { permission: id === '' ? null : id });
  }
}
