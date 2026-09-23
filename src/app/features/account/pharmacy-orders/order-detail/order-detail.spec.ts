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

  /** La lectura de avisos que el detalle hace una sola vez por pedido. */
  const AVISOS_URL = '/notifications/me?limit=50';

  /** Un aviso tal como viaja: el destino es lo que decide de qué pedido es. */
  function avisoWire(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      id: 'aviso-1',
      category: 'CLINICAL',
      subject: 'Tu pedido está en revisión',
      bodyText: 'La farmacia está revisando tu pedido.',
      destination: { type: 'PHARMACY_ORDER', id: PHARMACY_ORDER_TEST_IDS.order },
      payloadJson: null,
      unread: true,
      availableAt: '2026-09-03T15:00:00.000Z',
      readAt: null,
      ...extra,
    };
  }

  function paginaDeAvisos(items: readonly Record<string, unknown>[]): Record<string, unknown> {
    return { items, count: items.length, limit: 50, nextCursor: null, unreadCount: items.length };
  }

  async function mount(
    response?: PharmacyOrderDto,
    orderId: string = PHARMACY_ORDER_TEST_IDS.order,
    avisos: readonly Record<string, unknown>[] = [],
  ): Promise<void> {
    harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl(`/my-account/pharmacy-orders/${orderId}`, OrderDetail);
    await navigation;
    http.expectOne(`/pharmacy/orders/${orderId}`).flush(response ?? pharmacyOrderDtoFixture());
    http.expectOne(AVISOS_URL).flush(paginaDeAvisos(avisos));
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
    http.expectOne(AVISOS_URL).flush(paginaDeAvisos([]));
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

    it('un pedido sembrado por la maqueta ya no recibe el pago de ejemplo (R-T-E4)', async () => {
      const id = uuid('pharmacy-order-1');
      await mount(
        pharmacyOrderDtoFixture({
          id,
          status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
          pickupCode: 'ABC234',
        }),
        id,
      );

      // El detalle dejó de consultar `conSeguimientoDeEjemplo`: ni con el
      // backend simulado se pinta un pago que el contrato no publica.
      expect(byTestId('pedido-medio-de-pago')).toBeNull();
      expect(text()).not.toContain('Datos de ejemplo');
      expect(text()).not.toContain('Ya está pagado');
      expect(text()).toContain('pagás al retirar');
      expect(text()).toContain('ABC234');
      // Sin pago, el pedido vuelve a ser cancelable: es lo que el contrato dice.
      expect(byTestId('pedido-cancelar')).not.toBeNull();
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
      // «En camino» no se afirma: el contrato no publica el hito del envío.
      expect(text()).not.toContain('En camino');
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
      // Tampoco acá: el pago de ejemplo dejó de llegar a la pantalla.
      expect(byTestId('pedido-medio-de-pago')).toBeNull();
    });

    it('sin modalidad en el contrato, el detalle no inventa un envío', async () => {
      await mount(
        pharmacyOrderDtoFixture({
          status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' },
          deliveryMode: null,
        }),
      );

      expect(byTestId('pedido-estado-badge')?.textContent).toContain('Retirado');
      expect(text()).toContain('Modalidad no registrada');
      expect(text()).not.toContain('En camino');
      expect(text()).not.toContain('Entregado');
    });

    it('CONFIRMADO no afirma que hubo revisión: el backend admite el salto', async () => {
      await mount(
        pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_CONFIRMADO', display: 'Confirmado' } }),
      );

      expect(byTestId('pedido-estado-badge')?.textContent).toContain('En preparación');
      expect(text()).not.toContain('En revisión');
    });

    it('demo order picked up: «Retirado», its invoice and the internal receipt apart', async () => {
      const id = uuid('pharmacy-order-3');
      await mount(
        pharmacyOrderDtoFixture({ id, status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' } }),
        id,
      );

      expect(byTestId('pedido-estado-badge')?.textContent).toContain('Retirado');
      // La factura de la maqueta sigue igual que antes: fuera de este carril.
      expect(byTestId('pedido-medio-de-pago')).toBeNull();
      const factura = byTestId('tu-factura')?.textContent ?? '';
      for (const rotulo of ['Número', 'Emitida el', 'Total facturado', 'Estado']) {
        expect(factura).toContain(rotulo);
      }
      expect(byTestId('tu-factura-total')?.textContent).toContain('61.20 Bs');
      expect(byTestId('tu-factura-ver')?.getAttribute('href')).toBe(
        `/my-account/pharmacy-orders/${id}/invoice`,
      );
      expect(byTestId('tu-factura-descargar')).not.toBeNull();
      expect(byTestId('tu-factura-comprobante')?.getAttribute('href')).toBe(
        `/my-account/pharmacy-orders/${id}/receipt`,
      );
    });

    it('los avisos reales del pedido se muestran como avisos, no como historial', async () => {
      await mount(undefined, PHARMACY_ORDER_TEST_IDS.order, [
        avisoWire(),
        avisoWire({
          id: 'aviso-2',
          subject: 'Tu pedido fue confirmado',
          bodyText: 'La farmacia confirmó tu pedido y lo está preparando.',
          availableAt: '2026-09-03T16:30:00.000Z',
        }),
      ]);

      const bloque = byTestId('pedido-avisos');
      expect(bloque).not.toBeNull();
      expect(bloque?.textContent).toContain('Avisos de este pedido');
      expect(bloque?.textContent).toContain('Tu pedido está en revisión');
      expect(bloque?.textContent).toContain('Tu pedido fue confirmado');
      // Nunca se presenta como historial ni como línea de eventos completa.
      expect(bloque?.textContent).toContain('Pueden no estar todos');
      expect(text()).not.toContain('Historial');
    });

    it('sólo entran los avisos de ESTE pedido: ni de otro, ni de otra cosa', async () => {
      await mount(undefined, PHARMACY_ORDER_TEST_IDS.order, [
        avisoWire(),
        avisoWire({
          id: 'aviso-de-otro-pedido',
          subject: 'Pedido ajeno listo para retirar',
          destination: { type: 'PHARMACY_ORDER', id: '00000000-0000-4000-8000-0000000000ff' },
        }),
        avisoWire({
          id: 'aviso-de-receta',
          subject: 'Una receta tuya fue dispensada',
          destination: { type: 'PRESCRIPTION', id: PHARMACY_ORDER_TEST_IDS.order },
        }),
        avisoWire({ id: 'aviso-sin-destino', subject: 'Tenés un mensaje', destination: null }),
      ]);

      const bloque = byTestId('pedido-avisos');
      expect(bloque?.textContent).toContain('Tu pedido está en revisión');
      expect(bloque?.textContent).not.toContain('Pedido ajeno');
      expect(bloque?.textContent).not.toContain('Una receta tuya fue dispensada');
      expect(bloque?.textContent).not.toContain('Tenés un mensaje');
    });

    it('sin avisos no hay bloque: el vacío no se rellena', async () => {
      await mount();

      expect(byTestId('pedido-avisos')).toBeNull();
    });

    it('si la bandeja falla, el detalle sigue y no inventa avisos', async () => {
      harness = await RouterTestingHarness.create();
      const navigation = harness.navigateByUrl(
        `/my-account/pharmacy-orders/${PHARMACY_ORDER_TEST_IDS.order}`,
        OrderDetail,
      );
      await navigation;
      http
        .expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`)
        .flush(pharmacyOrderDtoFixture());
      http
        .expectOne(AVISOS_URL)
        .flush({ code: 'INTERNAL', message: 'boom' }, { status: 500, statusText: 'Server Error' });
      harness.detectChanges();

      expect(byTestId('pedido-detalle')).not.toBeNull();
      expect(byTestId('pedido-avisos')).toBeNull();
    });

    it('la bandeja se lee una sola vez por pedido: el sondeo es de la campana', async () => {
      await mount(undefined, PHARMACY_ORDER_TEST_IDS.order, [avisoWire()]);

      // Ninguna petición extra queda pendiente: `http.verify()` del afterEach
      // fallaría si el detalle sondeara la bandeja.
      expect(byTestId('pedido-avisos')).not.toBeNull();
    });

    describe('cambio de pedido y respuestas fuera de orden', () => {
      const PEDIDO_B = '00000000-0000-4000-8000-0000000000b0';

      const avisoDeB = (): Record<string, unknown> =>
        avisoWire({
          id: 'aviso-de-b',
          subject: 'Tu pedido B está listo para retirar',
          destination: { type: 'PHARMACY_ORDER', id: PEDIDO_B },
        });

      /** Cada pedido se reconoce por su farmacia: A y B no se confunden. */
      const FARMACIA = { A: 'Farmacia Andina', B: 'Farmacia Boliviana' } as const;

      function dtoDe(orderId: string, pharmacyName: string): PharmacyOrderDto {
        return pharmacyOrderDtoFixture({ id: orderId, pharmacyName });
      }

      /** Navega a un pedido y responde sus dos peticiones. */
      async function navegar(
        orderId: string,
        avisos: readonly Record<string, unknown>[],
        opciones: { readonly avisosFalla?: boolean; readonly pedidoFalla?: boolean } = {},
      ): Promise<OrderDetail> {
        const componente = await harness.navigateByUrl(
          `/my-account/pharmacy-orders/${orderId}`,
          OrderDetail,
        );
        const pedido = http.expectOne(`/pharmacy/orders/${orderId}`);
        if (opciones.pedidoFalla === true) {
          pedido.flush(
            { code: 'INTERNAL', message: 'boom' },
            { status: 500, statusText: 'Server Error' },
          );
        } else {
          pedido.flush(
            dtoDe(orderId, orderId === PEDIDO_B ? FARMACIA.B : FARMACIA.A),
          );
        }
        const peticion = http.expectOne(AVISOS_URL);
        if (opciones.avisosFalla === true) {
          peticion.flush(
            { code: 'INTERNAL', message: 'boom' },
            { status: 500, statusText: 'Server Error' },
          );
        } else {
          peticion.flush(paginaDeAvisos(avisos));
        }
        harness.detectChanges();
        return componente;
      }

      beforeEach(async () => {
        harness = await RouterTestingHarness.create();
      });

      it('A → B sin avisos: los de A no sobreviven al cambio de pedido', async () => {
        const componenteA = await navegar(PHARMACY_ORDER_TEST_IDS.order, [avisoWire()]);
        expect(byTestId('pedido-avisos')?.textContent).toContain('Tu pedido está en revisión');

        const componenteB = await navegar(PEDIDO_B, []);

        // El router reutiliza la instancia: es justo el caso que exige limpiar.
        expect(componenteB).toBe(componenteA);
        expect(byTestId('pedido-avisos')).toBeNull();
      });

      it('A → B con la bandeja en error: los de A tampoco sobreviven', async () => {
        await navegar(PHARMACY_ORDER_TEST_IDS.order, [avisoWire()]);
        expect(byTestId('pedido-avisos')).not.toBeNull();

        await navegar(PEDIDO_B, [], { avisosFalla: true });

        expect(byTestId('pedido-avisos')).toBeNull();
      });

      it('el bloque se vacía al empezar a cargar B, sin esperar su respuesta', async () => {
        await navegar(PHARMACY_ORDER_TEST_IDS.order, [avisoWire()]);
        expect(byTestId('pedido-avisos')).not.toBeNull();

        await harness.navigateByUrl(`/my-account/pharmacy-orders/${PEDIDO_B}`, OrderDetail);
        harness.detectChanges();

        // Todavía no respondió nada de B y los avisos de A ya no están.
        expect(byTestId('pedido-avisos')).toBeNull();

        http.expectOne(`/pharmacy/orders/${PEDIDO_B}`).flush(pharmacyOrderDtoFixture({ id: PEDIDO_B }));
        http.expectOne(AVISOS_URL).flush(paginaDeAvisos([avisoDeB()]));
        harness.detectChanges();
        expect(byTestId('pedido-avisos')?.textContent).toContain('Tu pedido B está listo');
      });

      it('al empezar a cargar B, el pedido A deja de presentarse bajo la URL de B', async () => {
        await navegar(PHARMACY_ORDER_TEST_IDS.order, [avisoWire()]);
        expect(text()).toContain(FARMACIA.A);

        await harness.navigateByUrl(`/my-account/pharmacy-orders/${PEDIDO_B}`, OrderDetail);
        harness.detectChanges();

        // Nada de B respondió todavía: la pantalla no puede seguir mostrando A.
        expect(text()).not.toContain(FARMACIA.A);
        expect(byTestId('pedido-detalle')).toBeNull();
        expect(byTestId('pedido-avisos')).toBeNull();

        http.expectOne(`/pharmacy/orders/${PEDIDO_B}`).flush(dtoDe(PEDIDO_B, FARMACIA.B));
        http.expectOne(AVISOS_URL).flush(paginaDeAvisos([avisoDeB()]));
        harness.detectChanges();
        expect(text()).toContain(FARMACIA.B);
      });

      it('A → B correcto: sólo B queda visible, pedido y avisos del mismo pedido', async () => {
        await navegar(PHARMACY_ORDER_TEST_IDS.order, [avisoWire()]);

        await navegar(PEDIDO_B, [avisoDeB()]);

        expect(text()).toContain(FARMACIA.B);
        expect(text()).not.toContain(FARMACIA.A);
        const bloque = byTestId('pedido-avisos');
        expect(bloque?.textContent).toContain('Tu pedido B está listo');
        expect(bloque?.textContent).not.toContain('Tu pedido está en revisión');
      });

      it('A → B con el pedido en error: A no sobrevive y el error es el de siempre', async () => {
        await navegar(PHARMACY_ORDER_TEST_IDS.order, [avisoWire()]);
        expect(text()).toContain(FARMACIA.A);

        await navegar(PEDIDO_B, [avisoDeB()], { pedidoFalla: true });

        expect(text()).not.toContain(FARMACIA.A);
        expect(byTestId('pedido-detalle')).toBeNull();
        // El comportamiento de error de la pantalla no cambia.
        expect(text()).toContain('Algo salió mal');
        expect(text()).toContain('Reintentar');
      });

      it('una respuesta tardía de A no puede pisar el pedido de B', async () => {
        await harness.navigateByUrl(
          `/my-account/pharmacy-orders/${PHARMACY_ORDER_TEST_IDS.order}`,
          OrderDetail,
        );
        // Las dos lecturas de A quedan EN VUELO a propósito.
        const pedidoDeA = http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`);
        const avisosDeA = http.expectOne(AVISOS_URL);
        harness.detectChanges();

        await navegar(PEDIDO_B, [avisoDeB()]);
        expect(text()).toContain(FARMACIA.B);

        // Cambiar de pedido cancela las dos lecturas anteriores.
        expect(pedidoDeA.cancelled).toBe(true);
        expect(avisosDeA.cancelled).toBe(true);
        expect(() => pedidoDeA.flush(dtoDe(PHARMACY_ORDER_TEST_IDS.order, FARMACIA.A))).toThrowError(
          /cancel/i,
        );

        // B sigue siendo el pedido presentado, con sus propios avisos.
        expect(text()).toContain(FARMACIA.B);
        expect(text()).not.toContain(FARMACIA.A);
        expect(byTestId('pedido-avisos')?.textContent).toContain('Tu pedido B está listo');
      });

      it('nunca queda pedido de uno con avisos del otro, responda quien responda primero', async () => {
        await navegar(PHARMACY_ORDER_TEST_IDS.order, [avisoWire()]);

        // Se navega a B y se responde en el orden inverso: primero los avisos.
        await harness.navigateByUrl(`/my-account/pharmacy-orders/${PEDIDO_B}`, OrderDetail);
        harness.detectChanges();
        const pedidoDeB = http.expectOne(`/pharmacy/orders/${PEDIDO_B}`);
        http.expectOne(AVISOS_URL).flush(paginaDeAvisos([avisoDeB()]));
        harness.detectChanges();

        // Con los avisos de B ya recibidos, el pedido A no puede estar visible.
        expect(text()).not.toContain(FARMACIA.A);
        expect(byTestId('pedido-detalle')).toBeNull();

        pedidoDeB.flush(dtoDe(PEDIDO_B, FARMACIA.B));
        harness.detectChanges();
        expect(text()).toContain(FARMACIA.B);
        expect(byTestId('pedido-avisos')?.textContent).toContain('Tu pedido B está listo');
        expect(byTestId('pedido-avisos')?.textContent).not.toContain('Tu pedido está en revisión');
      });

      it('una acción de A que responde tarde tampoco pisa el pedido de B', async () => {
        const conPropuesta = pharmacyOrderDtoFixture({
          pharmacyName: FARMACIA.A,
          status: { code: 'PINV_ORDER_ACEPTACION_PENDIENTE', display: 'Pendiente' },
          substitutions: [
            {
              id: 'sub-1',
              originalProductId: PHARMACY_ORDER_TEST_IDS.product,
              originalName: 'Amoxicilina',
              originalUnitPriceAmount: '68.00',
              proposedProductId: '00000000-0000-4000-8000-000000000005',
              proposedName: 'Amoxicilina genérica',
              proposedUnitPriceAmount: '24.00',
              currency: { code: 'BOB', display: 'Boliviano' },
              status: { code: 'PINV_SUB_PENDING', display: 'Pendiente' },
              decidedAt: null,
            },
          ],
        });
        await harness.navigateByUrl(
          `/my-account/pharmacy-orders/${PHARMACY_ORDER_TEST_IDS.order}`,
          OrderDetail,
        );
        http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`).flush(conPropuesta);
        http.expectOne(AVISOS_URL).flush(paginaDeAvisos([]));
        harness.detectChanges();

        // Se acepta la propuesta de A y, sin esperar la respuesta, se navega a B.
        click('pedido-aceptar');
        const accionDeA = http.expectOne({
          method: 'POST',
          url: `/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}/accept-substitutions`,
        });

        await navegar(PEDIDO_B, [avisoDeB()]);
        expect(text()).toContain(FARMACIA.B);

        accionDeA.flush(dtoDe(PHARMACY_ORDER_TEST_IDS.order, FARMACIA.A));
        harness.detectChanges();

        // La respuesta de la acción pertenece a A: no puede aterrizar sobre B.
        expect(text()).toContain(FARMACIA.B);
        expect(text()).not.toContain(FARMACIA.A);
      });

      it('una respuesta tardía de A no puede pisar los avisos de B', async () => {
        await harness.navigateByUrl(
          `/my-account/pharmacy-orders/${PHARMACY_ORDER_TEST_IDS.order}`,
          OrderDetail,
        );
        http
          .expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`)
          .flush(pharmacyOrderDtoFixture());
        // La lectura de avisos de A queda EN VUELO a propósito.
        const avisosDeA = http.expectOne(AVISOS_URL);
        harness.detectChanges();

        await navegar(PEDIDO_B, [avisoDeB()]);
        expect(byTestId('pedido-avisos')?.textContent).toContain('Tu pedido B está listo');

        // Cambiar de pedido cancela la lectura anterior: A ya no puede
        // responder ni aunque el servidor conteste tarde.
        expect(avisosDeA.cancelled).toBe(true);
        expect(() => avisosDeA.flush(paginaDeAvisos([avisoWire()]))).toThrowError(/cancel/i);

        // La UI conserva exclusivamente lo de B.
        const bloque = byTestId('pedido-avisos');
        expect(bloque?.textContent).toContain('Tu pedido B está listo');
        expect(bloque?.textContent).not.toContain('Tu pedido está en revisión');
      });
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
