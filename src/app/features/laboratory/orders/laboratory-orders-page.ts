import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { SessionStore } from '../../../core/auth/session.store';
import { OrganizationIdentity } from '../../../shared/components/molecules/organization-identity/organization-identity';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PageHeader } from '../../../shared/components/organisms/page-header/page-header';
import { AppButtonLink } from '../../../shared/components/atoms/button/button-link';
import { LaboratoryOrders } from './laboratory-orders';
import type { NewOrderResult } from './new-order/new-order.types';
import { NewLaboratoryOrder } from './new-order/new-laboratory-order';

/**
 * The «Órdenes» route: the list, or (`?nueva=1`) the creation of an order. The query param keeps
 * the Back button honest and the screen linkable. The center's own identity (logo + name) sits on
 * top so it is clear whose queue this is.
 */
@Component({
  selector: 'app-laboratory-orders-page',
  imports: [AppButtonLink, LaboratoryOrders, NewLaboratoryOrder, OrganizationIdentity, PageHeader, RouterLink],
  templateUrl: './laboratory-orders-page.html',
  styleUrl: './laboratory-orders-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryOrdersPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionStore);
  private readonly toasts = inject(ToastService);

  protected readonly creating = toSignal(this.route.queryParamMap.pipe(map((p) => p.get('nueva') === '1')), { initialValue: false });
  protected readonly tenantId = this.session.activeTenantId;
  protected readonly name = computed(() => {
    const id = this.tenantId();
    return id === null ? 'Su centro' : this.session.tenantName(id);
  });

  protected back(estado: string | null = null): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: { nueva: null, estado } });
  }

  /** A created order: say so, and go to «Borrador», where it is. */
  protected onCreated({ order, created }: NewOrderResult): void {
    this.toasts.success(created ? `Orden creada para ${order.patientName}.` : `Esa orden ya estaba cargada (${order.patientName}).`);
    this.back(order.status === 'DRAFT' ? 'draft' : 'all');
  }
}
