import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { vi } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import type { LabOrder } from '../../../core/data-access/lab-portal/lab-portal.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { LaboratoryOrders } from './laboratory-orders';
import { LaboratoryOrdersPage } from './laboratory-orders-page';
import { NewLaboratoryOrder } from './new-order/new-laboratory-order';

@Component({ selector: 'app-laboratory-orders', template: '<p data-testid="list">lista</p>' })
class ListStub {}
@Component({ selector: 'app-new-laboratory-order', template: '<p data-testid="creation">alta</p>' })
class CreationStub {}

describe('LaboratoryOrdersPage', () => {
  const success = vi.fn();

  async function open(url: string): Promise<{ harness: RouterTestingHarness; page: LaboratoryOrdersPage }> {
    success.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'administration/laboratory-orders', component: LaboratoryOrdersPage }]),
        { provide: ToastService, useValue: { success } },
        { provide: SessionStore, useValue: { activeTenantId: () => 't-1', tenantName: () => 'Laboratorio Central' } },
      ],
    });
    TestBed.overrideComponent(LaboratoryOrdersPage, { remove: { imports: [LaboratoryOrders, NewLaboratoryOrder] }, add: { imports: [ListStub, CreationStub] } });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(url, LaboratoryOrdersPage);
    harness.detectChanges();
    return { harness, page };
  }

  it('shows the list with the center identity and the «Nueva orden» link', async () => {
    const { harness } = await open('/administration/laboratory-orders');
    const el = harness.routeNativeElement!;
    expect(el.querySelector('[data-testid="list"]')).not.toBeNull();
    expect(el.textContent).toContain('Laboratorio Central');
    const link = el.querySelector('[data-testid="lab-orders-new"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('nueva=1');
  });

  it('with ?nueva=1 it shows the creation instead of the list', async () => {
    const { harness } = await open('/administration/laboratory-orders?nueva=1');
    const el = harness.routeNativeElement!;
    expect(el.querySelector('[data-testid="creation"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="list"]')).toBeNull();
  });

  it('a created order is announced and the list opens on «Borrador»', async () => {
    const { page } = await open('/administration/laboratory-orders?nueva=1');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const order = { patientName: 'Ana', status: 'DRAFT' } as LabOrder;

    (page as unknown as { onCreated: (r: { order: LabOrder; created: boolean }) => void }).onCreated({ order, created: true });
    expect(success).toHaveBeenCalledWith('Orden creada para Ana.');
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: { nueva: null, estado: 'draft' } }));

    (page as unknown as { onCreated: (r: { order: LabOrder; created: boolean }) => void }).onCreated({ order, created: false });
    expect(success).toHaveBeenLastCalledWith('Esa orden ya estaba cargada (Ana).');
  });
});
