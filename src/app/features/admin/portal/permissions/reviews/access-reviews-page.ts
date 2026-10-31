import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { NavigationService } from '../../../../../core/navigation/navigation.service';
import { Card } from '../../../../../shared/components/molecules/card/card';
import { Tab } from '../../../../../shared/components/molecules/tabs/tab/tab';
import { Tabs } from '../../../../../shared/components/molecules/tabs/tabs';
import { PageHeader } from '../../../../../shared/components/organisms/page-header/page-header';
import { patchQuery, queryFilters, queryParamsSignal } from '../../support/route-query';
import { AuditTrailPanel } from '../common/audit-trail-panel';
import { LifecyclePanel } from './lifecycle-panel';
import { ReviewsPanel } from './reviews-panel';

const VIEWS = ['lifecycle', 'reviews', 'audit'] as const;
const URL_KEYS = ['view'] as const;
const AUDIT_ACTIONS = ['USER_SUSPENDED', 'USER_REACTIVATED', 'USER_DEACTIVATED', 'ACCESS_REVIEWED'] as const;

/**
 * Ciclo de vida de las cuentas y revisión periódica de accesos. Una tarjeta con
 * tres pestañas: suspender, reactivar y dar de baja; la cola de revisión con su
 * historial; y lo que quedó en la bitácora.
 */
@Component({
  selector: 'app-portal-access-reviews-page',
  imports: [Card, Tab, Tabs, PageHeader, LifecyclePanel, ReviewsPanel, AuditTrailPanel],
  template: `
    <app-page-header
      title="Ciclo de vida y revisión de accesos"
      subtitle="Suspender, reactivar o dar de baja una cuenta interna, y revisar de forma periódica que sus accesos siguen siendo los correctos."
      [breadcrumbs]="breadcrumbs()"
    />
    <app-card class="reviews-page" variant="outlined" padding="md" data-testid="portal-access-reviews">
      <app-tabs [selectedIndex]="tabIndex()" (selectedIndexChange)="selectTab($event)">
        <app-tab label="Ciclo de vida">
          @if (tabIndex() === 0) {
            <app-portal-lifecycle-panel />
          }
        </app-tab>
        <app-tab label="Revisión de accesos">
          @if (tabIndex() === 1) {
            <app-portal-reviews-panel />
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
    .reviews-page {
      display: block;
      inline-size: 100%;
      margin-inline: auto;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccessReviewsPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly breadcrumbs = inject(NavigationService).breadcrumbs;
  protected readonly values = queryFilters(queryParamsSignal(this.route), URL_KEYS);
  protected readonly tabIndex = computed(() =>
    Math.max(0, VIEWS.indexOf(this.values().view as (typeof VIEWS)[number])),
  );
  protected readonly auditActions = AUDIT_ACTIONS;

  protected selectTab(index: number): void {
    // Al cambiar de pestaña se sueltan los cajones: `user` y `review` son de su pestaña.
    void patchQuery(this.router, this.route, { view: index === 0 ? null : VIEWS[index]!, user: null, review: null });
  }
}
