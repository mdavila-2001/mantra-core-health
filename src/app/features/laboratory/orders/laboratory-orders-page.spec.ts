import { Component, input, output } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';

import { SessionStore } from '../../../core/auth/session.store';
import type { LabOrder } from '../../../core/data-access/lab-portal/lab-portal.types';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { LaboratoryOrders } from './laboratory-orders';
import { LaboratoryOrdersPage } from './laboratory-orders-page';
import type { NewOrderResult } from './new-order/new-order.types';
import { QrOrderDialog } from './new-order/qr-order-dialog';

const reload = vi.fn();

// Stands in for the real list: the page finds it through the `LaboratoryOrders` token.
@Component({
  selector: 'app-laboratory-orders',
  template: '<p data-testid="list">lista</p>',
  providers: [{ provide: LaboratoryOrders, useExisting: ListStub }],
})
class ListStub {
  readonly reload = reload;
}
@Component({ selector: 'app-qr-order-dialog', template: '<button data-testid="emit" (click)="created.emit(result())">crear</button>' })
class DialogStub {
  readonly result = input<NewOrderResult>({ order: { patientName: 'Ana Pérez', status: 'DRAFT' } as LabOrder, created: true });
  readonly created = output<NewOrderResult>();
  readonly closed = output<void>();
}

describe('LaboratoryOrdersPage', () => {
  const success = vi.fn();
  let navigate: ReturnType<typeof vi.spyOn>;

  function open(): ComponentFixture<LaboratoryOrdersPage> {
    success.mockReset();
    reload.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ToastService, useValue: { success } },
        { provide: SessionStore, useValue: { activeTenantId: () => 't-1', tenantName: () => 'Laboratorio Central' } },
      ],
    });
    TestBed.overrideComponent(LaboratoryOrdersPage, {
      remove: { imports: [LaboratoryOrders, QrOrderDialog] },
      add: { imports: [ListStub, DialogStub] },
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LaboratoryOrdersPage);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the center identity over the queue, with no dialog open', () => {
    const el = open().nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="list"]')).not.toBeNull();
    expect(el.textContent).toContain('Laboratorio Central');
    expect(el.querySelector('app-qr-order-dialog')).toBeNull();
  });

  it('opens the QR dialog, and a created order closes it, says so and rereads the queue', () => {
    const fixture = open();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-testid="lab-orders-new-qr"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('app-qr-order-dialog')).not.toBeNull();

    (el.querySelector('[data-testid="emit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(success).toHaveBeenCalledWith('Orden creada para Ana Pérez.');
    expect(reload).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith([], { queryParams: { estado: 'draft' } });
    expect(el.querySelector('app-qr-order-dialog')).toBeNull();
  });
});
