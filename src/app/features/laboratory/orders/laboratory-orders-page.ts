import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { AppButton } from '../../../shared/components/atoms/button/button';
import { OrganizationIdentity } from '../../../shared/components/molecules/organization-identity/organization-identity';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { LaboratoryOrders } from './laboratory-orders';
import type { NewOrderResult } from './new-order/new-order.types';
import { QrOrderDialog } from './new-order/qr-order-dialog';

/**
 * The «Órdenes» route: the center's identity (logo + name) over the queue, plus the entry for way 1
 * of three to create an order (the patient's QR). The manual entry lives in the list's own «Nueva
 * orden» dialog; a doctor's referral arrives by itself once the patient accepts it.
 */
@Component({
  selector: 'app-laboratory-orders-page',
  imports: [AppButton, LaboratoryOrders, OrganizationIdentity, QrOrderDialog],
  templateUrl: './laboratory-orders-page.html',
  styleUrl: './laboratory-orders-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaboratoryOrdersPage {
  private readonly session = inject(SessionStore);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);
  private readonly list = viewChild(LaboratoryOrders);

  protected readonly qrOpen = signal(false);
  protected readonly tenantId = this.session.activeTenantId;
  protected readonly name = computed(() => {
    const id = this.tenantId();
    return id === null ? 'Su centro' : this.session.tenantName(id);
  });

  /** A created order: say so, close the dialog, go to the tab where it is and reread the queue. */
  protected onCreated({ order, created }: NewOrderResult): void {
    this.toasts.success(created ? `Orden creada para ${order.patientName}.` : `Esa orden ya estaba cargada (${order.patientName}).`);
    this.qrOpen.set(false);
    void this.router.navigate([], { queryParams: { estado: order.status === 'DRAFT' ? 'draft' : 'all' } });
    this.list()?.reload();
  }
}
