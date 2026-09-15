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
import { uuid } from '../../../../core/mock/mock-store';
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

  async function mount(
    response?: PharmacyOrderDto,
    orderId: string = PHARMACY_ORDER_TEST_IDS.order,
  ): Promise<void> {
    harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl(`/my-account/pharmacy-orders/${orderId}`, OrderDetail);
    await navigation;
    http.expectOne(`/pharmacy/orders/${orderId}`).flush(response ?? pharmacyOrderDtoFixture());
    harness.detectChanges();
  }

  function text(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  function byTestId(testId: string): HTMLElement | null {
    return harness.routeNativeElement?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;
  }

  function click(testId: string): void {
    byTestId(testId)?.click();
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
    // Un pedido cancelado no tiene ni tendrá factura: no hay bloque que prometerla.
    expect(byTestId('tu-factura')).toBeNull();
  });

  describe('tracking and invoice (T-E4)', () => {
    it('keeps a real order without payment honest: no «Pagado», no payment badge, no invoice', async () => {
      await mount();

      expect(byTestId('pedido-medio-de-pago')).toBeNull();
      expect(text()).not.toContain('Pagado');
      expect(text()).not.toContain('Datos de ejemplo');
      expect(byTestId('tu-factura-vacia')?.textContent).toContain(
        'La farmacia emite tu factura cuando te entrega el pedido.',
      );
      expect(byTestId('tu-factura-ver')).toBeNull();
      expect(byTestId('tu-factura-comprobante')?.getAttribute('href')).toBe(
        `/my-account/pharmacy-orders/${PHARMACY_ORDER_TEST_IDS.order}/receipt`,
      );
      // El pedido real sigue cancelable, como antes.
      expect(byTestId('pedido-cancelar')).not.toBeNull();
    });

    it('says «En preparación» for a confirmed order', async () => {
      await mount(
        pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_CONFIRMADO', display: 'Confirmado' } }),
      );
      expect(byTestId('pedido-estado-badge')?.textContent).toContain('En preparación');
    });

    it('a delivered real order without invoice data says so, without inventing one', async () => {
      await mount(
        pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' } }),
      );
      expect(byTestId('pedido-estado-badge')?.textContent).toContain('Retirado');
      expect(byTestId('tu-factura-vacia')?.textContent).toContain('todavía no está disponible');
      expect(byTestId('tu-factura-ver')).toBeNull();
    });

    it('demo order ready for pickup and already paid: says so and cannot be cancelled', async () => {
      const id = uuid('pharmacy-order-1');
      await mount(
        pharmacyOrderDtoFixture({
          id,
          status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
          pickupCode: 'ABC234',
        }),
        id,
      );

      expect(byTestId('pedido-medio-de-pago')?.textContent).toContain('Pagado por QR (demo)');
      expect(text()).toContain('Datos de ejemplo');
      expect(text()).toContain('Ya está pagado');
      expect(text()).not.toContain('pagás al retirar');
      expect(byTestId('pedido-cancelar')).toBeNull();
      expect(byTestId('tu-factura-ver')).toBeNull();
    });

    it('the delivery branch comes only from the contract: «Entregado» without demo data', async () => {
      await mount(
        pharmacyOrderDtoFixture({
          status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' },
          deliveryMode: { code: 'PINV_DELIVERY_DOMICILIO', display: 'Domicilio' },
        }),
      );

      expect(byTestId('pedido-estado-badge')?.textContent).toContain('Entregado');
      expect(text()).toContain('Envío a domicilio');
      expect(text()).toContain('En camino');
      expect(byTestId('pedido-medio-de-pago')).toBeNull();
    });

    it('the demo never overrides the contract delivery mode', async () => {
      const id = uuid('pharmacy-order-3');
      await mount(
        pharmacyOrderDtoFixture({
          id,
          status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' },
          deliveryMode: { code: 'PINV_DELIVERY_DOMICILIO', display: 'Domicilio' },
        }),
        id,
      );
      expect(byTestId('pedido-estado-badge')?.textContent).toContain('Entregado');
      expect(text()).toContain('Envío a domicilio');
      // El pago sí es de ejemplo: el contrato no lo publica.
      expect(byTestId('pedido-medio-de-pago')?.textContent).toContain('Pagado por QR (demo)');
    });

    it('demo order paid and picked up: «Retirado», its invoice and the internal receipt apart', async () => {
      const id = uuid('pharmacy-order-3');
      await mount(
        pharmacyOrderDtoFixture({ id, status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' } }),
        id,
      );

      expect(byTestId('pedido-estado-badge')?.textContent).toContain('Retirado');
      expect(byTestId('pedido-medio-de-pago')?.textContent).toContain('Pagado por QR (demo)');
      const factura = byTestId('tu-factura')?.textContent ?? '';
      for (const rotulo of ['Número', 'Emitida el', 'Total facturado', 'Estado']) {
        expect(factura).toContain(rotulo);
      }
      expect(byTestId('tu-factura-total')?.textContent).toContain('61.20 BOB');
      expect(byTestId('tu-factura-ver')?.getAttribute('href')).toBe(
        `/my-account/pharmacy-orders/${id}/invoice`,
      );
      expect(byTestId('tu-factura-descargar')).not.toBeNull();
      expect(byTestId('tu-factura-comprobante')?.getAttribute('href')).toBe(
        `/my-account/pharmacy-orders/${id}/receipt`,
      );
    });

    it('real insurance settlement still renders next to the invoice block', async () => {
      const id = uuid('pharmacy-order-3');
      await mount(
        pharmacyOrderDtoFixture({
          id,
          status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' },
          insuranceSettlementAvailability: 'PENDING_PUBLICATION',
          insuranceSettlement: null,
        }),
        id,
      );
      expect(byTestId('patient-insurance-settlement')).not.toBeNull();
      expect(byTestId('tu-factura')).not.toBeNull();
    });
  });
});
