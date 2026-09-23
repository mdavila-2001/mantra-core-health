import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import {
  PHARMACY_ORDER_TEST_IDS,
  pharmacyOrderDtoFixture,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
import { OrderReceipt } from './order-receipt';

describe('OrderReceipt with an orders API that has no payment contract', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'my-account/pharmacy-orders/:orderId/receipt', component: OrderReceipt },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function navigate(): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/my-account/pharmacy-orders/${PHARMACY_ORDER_TEST_IDS.order}/receipt`,
      OrderReceipt,
    );
  }

  function text(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  it('does not fabricate a receipt from a pharmacy order', async () => {
    await navigate();
    http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`).flush(
      pharmacyOrderDtoFixture(),
    );
    harness.detectChanges();
    expect(text()).toContain('Este pedido todavía no tiene un pago registrado.');
    expect(harness.routeNativeElement?.querySelector('[data-testid="comprobante"]')).toBeNull();
  });

  it('renders the real API 404 instead of treating it as null', async () => {
    await navigate();
    http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`).flush(
      { code: 'NOT_FOUND', message: 'Order not found' },
      { status: 404, statusText: 'Not Found' },
    );
    harness.detectChanges();
    expect(text()).toContain('No encontramos lo que buscás');
  });
});
