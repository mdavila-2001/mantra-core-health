import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import {
  PHARMACY_ORDER_TEST_IDS,
  pharmacyOrderDtoFixture,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
import type { PharmacyOrderDto } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.dto';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { OrderDetail } from './order-detail';

describe('OrderDetail with the real pharmacy-orders contract', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmDialog: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirmDialog = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'my-account/pharmacy-orders/:orderId', component: OrderDetail }]),
        { provide: DialogService, useValue: { confirm: confirmDialog } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function mount(response?: PharmacyOrderDto): Promise<void> {
    harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl(
      `/my-account/pharmacy-orders/${PHARMACY_ORDER_TEST_IDS.order}`,
      OrderDetail,
    );
    await navigation;
    http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`).flush(
      response ?? pharmacyOrderDtoFixture(),
    );
    harness.detectChanges();
  }

  function text(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  function click(testId: string): void {
    harness.routeNativeElement
      ?.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`)
      ?.click();
    harness.detectChanges();
  }

  it('renders the API 404 as not found instead of null data', async () => {
    harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl(
      `/my-account/pharmacy-orders/${PHARMACY_ORDER_TEST_IDS.order}`,
      OrderDetail,
    );
    await navigation;
    http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`).flush(
      { code: 'NOT_FOUND', message: 'Order not found' },
      { status: 404, statusText: 'Not Found' },
    );
    harness.detectChanges();

    expect(text()).toContain('No encontramos lo que buscás');
    expect(text()).toContain('Verificá la dirección o volvé al listado');
  });

  it('renders a submitted pickup order without demo controls or UUIDs', async () => {
    await mount();
    expect(text()).toContain('Enviado');
    expect(text()).toContain('La farmacia todavía no abrió tu pedido');
    expect(harness.routeNativeElement?.querySelector('[data-testid="pedido-demo"]')).toBeNull();
    expect(text()).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{27}/i);
  });

  it('preserves newest-first substitutions and accepts them through the API', async () => {
    const pending = pharmacyOrderDtoFixture({
      status: { code: 'PINV_ORDER_ACEPTACION_PENDIENTE', display: 'Pendiente' },
      substitutions: [
        {
          id: 'sub-new',
          originalProductId: PHARMACY_ORDER_TEST_IDS.product,
          originalName: 'Amoxicilina',
          originalUnitPriceAmount: '68.00',
          proposedProductId: '00000000-0000-4000-8000-000000000005',
          proposedName: 'Amoxicilina genérica nueva',
          proposedUnitPriceAmount: '24.00',
          currency: { code: 'BOB', display: 'Boliviano' },
          status: { code: 'PINV_SUB_PENDING', display: 'Pendiente' },
          decidedAt: null,
        },
        {
          id: 'sub-old',
          originalProductId: PHARMACY_ORDER_TEST_IDS.product,
          originalName: 'Amoxicilina',
          originalUnitPriceAmount: '68.00',
          proposedProductId: '00000000-0000-4000-8000-000000000007',
          proposedName: 'Alternativa anterior',
          proposedUnitPriceAmount: '30.00',
          currency: { code: 'BOB', display: 'Boliviano' },
          status: { code: 'PINV_SUB_PENDING', display: 'Pendiente' },
          decidedAt: null,
        },
      ],
    });
    await mount(pending);
    expect(text()).toContain('Amoxicilina genérica nueva');
    expect(text()).not.toContain('Alternativa anterior');

    click('pedido-aceptar');
    http.expectOne({
      method: 'POST',
      url: `/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}/accept-substitutions`,
    }).flush(pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_ACEPTADO', display: 'Aceptado' } }));
    harness.detectChanges();
    expect(text()).toContain('Propuesta aceptada');
  });

  it('shows the pickup code to its owner and preserves a null medicationRequestId', async () => {
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
        pickupCode: 'ABC234',
        medicationRequestId: null,
      }),
    );
    expect(text()).toContain('ABC234');
    expect(text()).toContain('no un pago');
  });

  it('cancels only after confirmation and uses the real endpoint', async () => {
    await mount();
    click('pedido-cancelar');
    await harness.fixture.whenStable();
    const request = http.expectOne({
      method: 'POST',
      url: `/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}/cancel`,
    });
    expect(request.request.body).toEqual({});
    request.flush(
      pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_CANCELADO', display: 'Cancelado' } }),
    );
    harness.detectChanges();
    expect(confirmDialog).toHaveBeenCalledOnce();
    expect(text()).toContain('Cancelado');
  });
});
