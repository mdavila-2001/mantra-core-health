import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import {
  PHARMACY_ORDER_TEST_IDS,
  pharmacyOrderDtoFixture,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
import { uuid } from '../../../../core/mock/mock-store';
import { OrderInvoice } from './order-invoice';
import { liquidacionDePrueba } from './order-invoice.spec-fixtures';

describe('OrderInvoice over the real pharmacy-orders contract', () => {
  const ENTREGADO = uuid('pharmacy-order-3');
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'my-account/pharmacy-orders/:orderId/invoice', component: OrderInvoice },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function navigate(orderId: string = PHARMACY_ORDER_TEST_IDS.order): Promise<void> {
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`/my-account/pharmacy-orders/${orderId}/invoice`, OrderInvoice);
  }

  function documento(): Element | null {
    return harness.routeNativeElement?.querySelector('[data-testid="factura-documento"]') ?? null;
  }

  function text(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  it('reads the order through the real client and shows nothing while it loads', async () => {
    await navigate();
    harness.detectChanges();
    const request = http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`);
    expect(request.request.method).toBe('GET');
    expect(documento()).toBeNull();
    request.flush(pharmacyOrderDtoFixture());
  });

  it('does not fabricate an invoice for an unknown order, even a delivered one', async () => {
    await navigate();
    http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`).flush(
      pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' } }),
    );
    harness.detectChanges();
    expect(text()).toContain('Este pedido todavía no tiene factura.');
    expect(documento()).toBeNull();
  });

  it('does not issue the demo invoice before delivery', async () => {
    await navigate(ENTREGADO);
    http.expectOne(`/pharmacy/orders/${ENTREGADO}`).flush(
      pharmacyOrderDtoFixture({ id: ENTREGADO, status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' } }),
    );
    harness.detectChanges();
    expect(documento()).toBeNull();
    expect(text()).toContain('Este pedido todavía no tiene factura.');
  });

  it('renders the demo invoice of a delivered order, labeled, with the internal receipt apart', async () => {
    await navigate(ENTREGADO);
    http.expectOne(`/pharmacy/orders/${ENTREGADO}`).flush(
      pharmacyOrderDtoFixture({
        id: ENTREGADO,
        status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' },
        insuranceSettlementAvailability: 'AVAILABLE',
        insuranceSettlement: liquidacionDePrueba(),
      }),
    );
    harness.detectChanges();

    expect(documento()).not.toBeNull();
    expect(text()).toContain('Datos de ejemplo');
    expect(text()).toContain('Farmacia Andina');
    expect(text()).toContain('Ana Paciente');
    expect(text()).toContain('Descuento red AloVida');
    expect(text()).toContain('61.20 Bs');
    // El coaseguro sale de la liquidación real publicada.
    expect(text()).toContain('Seguros Bolívar');
    expect(text()).toContain('13.60 Bs');
    expect(text()).not.toContain('No es una factura');
    expect(text()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{27}/i);
    expect(
      harness.routeNativeElement
        ?.querySelector('[data-testid="factura-comprobante"]')
        ?.getAttribute('href'),
    ).toBe(`/my-account/pharmacy-orders/${ENTREGADO}/receipt`);
  });

  it('renders the real API 404 instead of an empty invoice', async () => {
    await navigate();
    http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`).flush(
      { code: 'NOT_FOUND', message: 'Order not found' },
      { status: 404, statusText: 'Not Found' },
    );
    harness.detectChanges();
    expect(text()).toContain('No encontramos lo que buscás');
    expect(documento()).toBeNull();
  });

  it('renders a server error as an error, never as an invoice', async () => {
    await navigate(ENTREGADO);
    http.expectOne(`/pharmacy/orders/${ENTREGADO}`).flush(
      { code: 'INTERNAL', message: 'boom' },
      { status: 500, statusText: 'Server Error' },
    );
    harness.detectChanges();
    expect(documento()).toBeNull();
    expect(text()).not.toContain('Este pedido todavía no tiene factura.');
  });
});
