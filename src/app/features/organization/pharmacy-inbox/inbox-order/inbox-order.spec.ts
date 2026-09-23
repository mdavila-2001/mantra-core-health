import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import {
  PHARMACY_ORDER_TEST_IDS,
  pharmacyOrderDtoFixture,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.spec-fixtures';
import type { PharmacyOrderDto } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.dto';
import {
  ID_PEDIDO_CON_DELIVERY,
  ID_PEDIDO_CON_SEGURO,
} from '../../../../core/mock/fixtures/pedidos-de-farmacia';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { InboxOrder } from './inbox-order';

describe('InboxOrder with the real pharmacy-orders contract', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmWithReason: ReturnType<typeof vi.fn>;
  let toastInfo: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirmWithReason = vi.fn().mockResolvedValue('No trabajamos con esa presentación.');
    toastInfo = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administration/pharmacy-orders/:orderId', component: InboxOrder }]),
        { provide: SessionStore, useValue: { displayName: () => 'Ana Pérez' } },
        {
          provide: DialogService,
          useValue: { confirm: vi.fn().mockResolvedValue(true), confirmWithReason },
        },
        { provide: ToastService, useValue: { info: toastInfo } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function mount(response: PharmacyOrderDto): Promise<void> {
    harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl(
      `/administration/pharmacy-orders/${PHARMACY_ORDER_TEST_IDS.order}`,
      InboxOrder,
    );
    await navigation;
    http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`).flush(response);
    if (response.status.code === 'PINV_ORDER_ENVIADO') {
      const review = http.expectOne({
        method: 'POST',
        url: `/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}/review`,
      });
      expect(review.request.body).toEqual({});
      review.flush(
        pharmacyOrderDtoFixture({
          status: { code: 'PINV_ORDER_EN_REVISION', display: 'En revisión' },
          pickupCode: 'MUST-NOT-RENDER',
        }),
      );
    }
    harness.detectChanges();
  }

  function text(): string {
    return harness.routeNativeElement?.textContent ?? '';
  }

  function element<T extends HTMLElement>(selector: string): T | null {
    return harness.routeNativeElement?.querySelector<T>(selector) ?? null;
  }

  function click(testId: string): void {
    element<HTMLButtonElement>(`[data-testid="${testId}"]`)?.click();
    harness.detectChanges();
  }

  function chooseLineDecision(label: string): void {
    const radio = [...(harness.routeNativeElement?.querySelectorAll('app-radio') ?? [])].find(
      (item) => item.textContent?.includes(label),
    );
    expect(radio).toBeDefined();
    radio?.querySelector<HTMLInputElement>('input')?.click();
    harness.detectChanges();
  }

  function type(selector: string, value: string): void {
    const input = element<HTMLInputElement>(selector);
    expect(input).not.toBeNull();
    if (input === null) return;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    harness.detectChanges();
  }

  function flushReload(response: PharmacyOrderDto): void {
    http.expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`).flush(response);
    harness.detectChanges();
  }

  it('renders an API 404 as not found', async () => {
    harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl(
      `/administration/pharmacy-orders/${PHARMACY_ORDER_TEST_IDS.order}`,
      InboxOrder,
    );
    await navigation;
    http
      .expectOne(`/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}`)
      .flush(
        { code: 'NOT_FOUND', message: 'Order not found' },
        { status: 404, statusText: 'Not Found' },
      );
    harness.detectChanges();
    expect(text()).toContain('No encontramos lo que buscás');
    expect(text()).toContain('Verificá la dirección o volvé al listado');
  });

  it('opens a submitted order via review and never renders pickupCode to staff', async () => {
    await mount(pharmacyOrderDtoFixture({ pickupCode: 'MUST-NOT-RENDER' }));
    expect(text()).toContain('Ana Paciente');
    expect(text()).toContain('En revisión');
    expect(text()).not.toContain('MUST-NOT-RENDER');
    expect(element('[data-testid="mostrador-decision-0"]')).not.toBeNull();
  });

  it('confirms unchanged lines and reloads the canonical API representation', async () => {
    const review = pharmacyOrderDtoFixture({
      status: { code: 'PINV_ORDER_EN_REVISION', display: 'En revisión' },
    });
    await mount(review);
    click('mostrador-confirmar');
    const request = http.expectOne({
      method: 'POST',
      url: `/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}/confirm`,
    });
    expect(request.request.body).toEqual({});
    request.flush(
      pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_CONFIRMADO', display: 'Confirmado' } }),
    );
    flushReload(
      pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_CONFIRMADO', display: 'Confirmado' } }),
    );
    expect(text()).toContain('En preparación');
    expect(element('[data-testid="mostrador-listo"]')).not.toBeNull();
  });

  it('proposes a real published product from the same medication concept', async () => {
    const conceptId = '00000000-0000-4000-8000-000000000007';
    const proposedProductId = '00000000-0000-4000-8000-000000000008';
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_EN_REVISION', display: 'En revisión' },
        lines: [
          {
            ...pharmacyOrderDtoFixture().lines[0],
            medicationConceptId: conceptId,
          },
        ],
      }),
    );

    chooseLineDecision('Proponer sustituto');
    const products = http.expectOne(
      (request) =>
        request.url === '/pharmacy/products' && request.params.get('conceptId') === conceptId,
    );
    expect(products.request.method).toBe('GET');
    products.flush({
      items: [
        {
          id: PHARMACY_ORDER_TEST_IDS.product,
          pharmacyId: PHARMACY_ORDER_TEST_IDS.pharmacy,
          pharmacyName: 'Farmacia Andina',
          productCode: 'AMOX-500',
          brandName: 'Amoxicilina original',
          genericName: null,
          strengthText: '500 mg',
          packageSizeText: 'Caja x 21',
          dosageForm: null,
          medication: { code: 'J01CA04', display: 'Amoxicilina' },
          requiresPrescription: true,
        },
        {
          id: proposedProductId,
          pharmacyId: PHARMACY_ORDER_TEST_IDS.pharmacy,
          pharmacyName: 'Farmacia Andina',
          productCode: 'AMOX-GEN',
          brandName: null,
          genericName: 'Amoxicilina genérica',
          strengthText: '500 mg',
          packageSizeText: 'Caja x 21',
          dosageForm: null,
          medication: { code: 'J01CA04', display: 'Amoxicilina' },
          requiresPrescription: true,
        },
      ],
      limit: 20,
      truncated: false,
    });
    harness.detectChanges();

    const select = element<HTMLSelectElement>('[data-testid="mostrador-sustituto-0"] select');
    expect(select).not.toBeNull();
    expect(select?.options).toHaveLength(2);
    expect(text()).not.toContain('Amoxicilina original');
    if (select !== null) {
      select.value = '0';
      select.dispatchEvent(new Event('change'));
    }
    harness.detectChanges();
    click('mostrador-confirmar');

    const confirm = http.expectOne({
      method: 'POST',
      url: `/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}/confirm`,
    });
    expect(confirm.request.body).toEqual({
      adjustments: [
        {
          productId: PHARMACY_ORDER_TEST_IDS.product,
          decision: 'PROPONER_GENERICO',
          proposedProductId,
        },
      ],
    });
  });

  it('isolates substitution when the order line has no medication concept', async () => {
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_EN_REVISION', display: 'En revisión' },
        lines: [
          {
            ...pharmacyOrderDtoFixture().lines[0],
            medicationConceptId: null,
          },
        ],
      }),
    );

    chooseLineDecision('Proponer sustituto');

    http.expectNone('/pharmacy/products');
    expect(text()).toContain('Este producto no tiene un concepto de medicamento publicado');
    expect(
      element<HTMLButtonElement>('[data-testid="mostrador-confirmar"]')?.getAttribute(
        'aria-disabled',
      ),
    ).toBe('true');
  });

  it('keeps a catalogue HTTP failure distinct and offers a retry', async () => {
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_EN_REVISION', display: 'En revisión' },
      }),
    );
    chooseLineDecision('Proponer sustituto');
    http
      .expectOne((request) => request.url === '/pharmacy/products')
      .flush({ message: 'Catalogue unavailable' }, { status: 503, statusText: 'Unavailable' });
    harness.detectChanges();

    expect(text()).toContain('No se pudo consultar el catálogo');
    click('mostrador-reintentar-sustitutos-0');
    http
      .expectOne((request) => request.url === '/pharmacy/products')
      .flush({
        items: [],
        limit: 20,
        truncated: false,
      });
    harness.detectChanges();
    expect(text()).toContain('Sin alternativas publicadas');
  });

  it('rejects with the required reason through the API', async () => {
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_EN_REVISION', display: 'En revisión' },
      }),
    );
    click('mostrador-rechazar');
    await harness.fixture.whenStable();
    const request = http.expectOne({
      method: 'POST',
      url: `/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}/reject`,
    });
    expect(request.request.body).toEqual({ reason: 'No trabajamos con esa presentación.' });
    const rejected = pharmacyOrderDtoFixture({
      status: { code: 'PINV_ORDER_RECHAZADO', display: 'Rechazado' },
      rejectionReasonText: 'No trabajamos con esa presentación.',
    });
    request.flush(rejected);
    flushReload(rejected);
    expect(confirmWithReason).toHaveBeenCalledOnce();
    expect(text()).toContain('No trabajamos con esa presentación.');
  });

  it('marks ready and dispenses selected line indices as productIds', async () => {
    await mount(
      pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_CONFIRMADO', display: 'Confirmado' } }),
    );
    click('mostrador-listo');
    const readyRequest = http.expectOne({
      method: 'POST',
      url: `/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}/ready`,
    });
    readyRequest.flush(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
        pickupCode: null,
      }),
    );
    flushReload(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
        pickupCode: null,
      }),
    );

    type('[data-testid="mostrador-codigo"]', 'ABC234');
    click('mostrador-retirar');
    const dispense = http.expectOne({
      method: 'POST',
      url: `/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}/dispense`,
    });
    expect(dispense.request.body.pickupCode).toBe('ABC234');
    expect(dispense.request.body.productIds).toEqual([PHARMACY_ORDER_TEST_IDS.product]);
    expect(dispense.request.body.idempotencyKey).toEqual(expect.any(String));
    dispense.flush(
      pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' } }),
    );
    harness.detectChanges();
    expect(text()).toContain('Entregado');
  });

  it('renders the explicit 422 PICKUP_CODE_MISMATCH without closing the order', async () => {
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
        pickupCode: null,
      }),
    );
    type('[data-testid="mostrador-codigo"]', 'WRONG1');
    click('mostrador-retirar');
    http
      .expectOne({
        method: 'POST',
        url: `/pharmacy/orders/${PHARMACY_ORDER_TEST_IDS.order}/dispense`,
      })
      .flush(
        {
          code: 'PRECONDITION_FAILED',
          message: 'Pickup code mismatch',
          details: { reason: 'PICKUP_CODE_MISMATCH' },
        },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    harness.detectChanges();
    expect(text()).toContain('El código no coincide');
    expect(text()).toContain('Registrar retiro');
  });

  /* ─── Lo que T-I3 suma: entrega, seguro y factura ──────────────────────── */

  it('dice por qué medio se entrega el pedido', async () => {
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_EN_REVISION', display: 'En revisión' },
      }),
    );
    const chip = element('[data-testid="mostrador-entrega"]');
    expect(chip?.textContent?.trim()).toBe('Recojo en mostrador');
    // El ámbar es el punto de acción único del sistema: una logística no lo usa.
    expect(chip?.classList.contains('tone--warning')).toBe(false);
    expect(text()).not.toContain('Datos de ejemplo');
  });

  it('el pedido de ejemplo se ve como delivery y muestra la dirección de entrega', async () => {
    await mount(
      pharmacyOrderDtoFixture({
        id: ID_PEDIDO_CON_DELIVERY,
        status: { code: 'PINV_ORDER_EN_REVISION', display: 'En revisión' },
      }),
    );

    expect(element('[data-testid="mostrador-entrega"]')?.textContent?.trim()).toBe('Delivery');
    const detalle = element('[data-testid="mostrador-entrega-detalle"]')?.textContent ?? '';
    expect(detalle).toContain('Sale a la dirección de domicilio');
    expect(detalle).toContain('Cristo Redentor');
    // Y se declara maqueta, porque el medio lo puso la pantalla.
    expect(text()).toContain('Datos de ejemplo');
  });

  it('lo que sale a domicilio no ofrece prepararlo para retiro en mostrador', async () => {
    // La etiqueta dice delivery, así que la acción no puede contradecirla:
    // las dos salen de la misma respuesta.
    await mount(
      pharmacyOrderDtoFixture({
        id: ID_PEDIDO_CON_DELIVERY,
        status: { code: 'PINV_ORDER_CONFIRMADO', display: 'Confirmado' },
      }),
    );

    expect(element('[data-testid="mostrador-entrega"]')?.textContent?.trim()).toBe('Delivery');
    expect(element('[data-testid="mostrador-listo"]')).toBeNull();
    expect(text()).not.toContain('Marcar listo para retirar');
    // Y el texto tampoco se lo pide: no hay botón que respalde esa frase.
    expect(text()).not.toContain('marcalo como listo');
    expect(text()).toContain('sale por reparto, no se retira en el mostrador');
  });

  it('un pedido de retiro del contrato sigue ofreciendo la acción de siempre', async () => {
    // La otra mitad: los pedidos reales no cambian de comportamiento.
    await mount(
      pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_CONFIRMADO', display: 'Confirmado' } }),
    );

    expect(element('[data-testid="mostrador-entrega"]')?.textContent?.trim()).toBe(
      'Recojo en mostrador',
    );
    expect(element('[data-testid="mostrador-listo"]')).not.toBeNull();
    expect(text()).toContain('Marcar listo para retirar');
    // Y sigue leyendo la frase de siempre, palabra por palabra.
    expect(text()).toContain('Confirmado. Cuando esté armado, marcalo como listo.');
  });

  it('un pedido sin cobertura no inventa un seguro', async () => {
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_EN_REVISION', display: 'En revisión' },
      }),
    );
    expect(element('[data-testid="mostrador-seguro"]')).toBeNull();
    expect(text()).not.toContain('Aprobado por el seguro');
  });

  it('con seguro dice, renglón por renglón, lo aprobado y lo NO aprobado', async () => {
    await mount(pedidoConSeguro());

    const renglones = [
      ...(harness.routeNativeElement?.querySelectorAll('.mostrador__cobertura app-badge') ?? []),
    ];
    expect(renglones.map((nodo) => nodo.textContent?.trim())).toEqual([
      'Aprobado por el seguro',
      'No aprobado',
    ]);
    expect(renglones[0]?.classList.contains('badge--success')).toBe(true);
    expect(renglones[1]?.classList.contains('badge--error')).toBe(true);
  });

  it('el resumen separa lo que pone el seguro de lo que paga la persona', async () => {
    await mount(pedidoConSeguro());
    const resumen = element('[data-testid="mostrador-seguro"]')?.textContent ?? '';

    expect(resumen).toContain('Cubre el seguro');
    expect(resumen).toContain('Paga la persona (coaseguro)');
    // 68,00 al 80 % son 54,40; la sertralina no aprobada la paga entera.
    expect(resumen).toContain('54.40 Bs');
    expect(resumen).toContain('109.10 Bs');
    // Y se dice que es maqueta, en la propia pantalla.
    expect(resumen).toContain('Datos de ejemplo');
  });

  it('descartar un renglón mueve el reparto del seguro, no sólo el total', async () => {
    await mount(pedidoConSeguro());
    const reparto = (): string =>
      element('[data-testid="mostrador-seguro"]')?.textContent ?? '';
    const total = (): string => element('[data-testid="mostrador-total-vivo"]')?.textContent ?? '';

    expect(total()).toContain('163.50');
    expect(reparto()).toContain('54.40 Bs');
    expect(reparto()).toContain('109.10 Bs');

    // El mostrador no tiene el primer renglón: baja el total …
    chooseLineDecision('No disponible');

    expect(total()).toContain('95.50');
    // … y el reparto lo acompaña, en vez de seguir cobrando lo que no sale.
    expect(reparto()).toContain('0.00 Bs');
    expect(reparto()).toContain('95.50 Bs');
    expect(reparto()).not.toContain('54.40 Bs');
    expect(reparto()).not.toContain('109.10 Bs');
  });

  it('lo que sale por reparto no pide el código de retiro ni dice que alguien lo espera', async () => {
    // No se alcanza con la semilla de hoy —el pedido de ejemplo no llega a
    // este estado— pero el acoplamiento entrega↔retiro tiene que estar
    // cerrado de los dos lados, no de uno.
    await mount(
      pharmacyOrderDtoFixture({
        id: ID_PEDIDO_CON_DELIVERY,
        status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
        pickupCode: null,
      }),
    );

    expect(element('[data-testid="mostrador-codigo"]')).toBeNull();
    expect(element('[data-testid="mostrador-retirar"]')).toBeNull();
    expect(text()).not.toContain('Registrar retiro');
    expect(text()).not.toContain('espera en el mostrador con su código de retiro');
    expect(text()).toContain('sale por reparto');
  });

  it('sin modalidad declarada, el código de retiro sigue estando: no saber no quita nada', async () => {
    // `deliveryMode` es anulable en el contrato y el adaptador lo deja en
    // `null`. Antes de este carril el formulario no miraba la modalidad, así
    // que estos pedidos lo tenían: sacárselo sería cambiar comportamiento.
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
        deliveryMode: null,
        pickupCode: null,
      }),
    );

    expect(element('[data-testid="mostrador-entrega"]')).toBeNull();
    expect(element('[data-testid="mostrador-codigo"]')).not.toBeNull();
    expect(element('[data-testid="mostrador-retirar"]')).not.toBeNull();
    expect(text()).toContain('Registrar retiro');
  });

  it('un pedido de retiro listo sigue pidiendo el código, como siempre', async () => {
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
        pickupCode: null,
      }),
    );

    expect(element('[data-testid="mostrador-codigo"]')).not.toBeNull();
    expect(text()).toContain('Registrar retiro');
    expect(text()).toContain('El pedido espera en el mostrador con su código de retiro.');
  });

  it('la factura aparece recién cuando el pedido salió', async () => {
    await mount(
      pharmacyOrderDtoFixture({
        status: { code: 'PINV_ORDER_LISTO_PARA_RETIRO', display: 'Listo' },
        pickupCode: null,
      }),
    );
    expect(element('[data-testid="mostrador-factura"]')).toBeNull();
  });

  it('el pedido entregado cierra con su factura y con la salida a la bandeja', async () => {
    await mount(
      pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' } }),
    );
    const factura = element('[data-testid="mostrador-factura"]');

    expect(factura?.textContent).toContain('Enviada al paciente');
    expect(factura?.textContent).toContain('68.00 Bs');
    // La emite la maqueta al mirarla, nunca el día en que se hizo el pedido:
    // una factura anterior a la entrega no existe.
    expect(factura?.textContent).toContain(comoLaPintaLaPantalla(new Date()));
    expect(factura?.textContent).not.toContain(
      comoLaPintaLaPantalla(new Date('2026-09-03T14:00:00.000Z')),
    );
    // Va justo antes de la salida: el pie de la pantalla sigue siendo la bandeja.
    expect(
      factura?.closest('app-resumen-de-factura')?.nextElementSibling?.textContent?.trim(),
    ).toBe('Volver a la bandeja');
  });

  it('la descarga del comprobante dice lo que es, en vez de bajar un archivo vacío', async () => {
    await mount(
      pharmacyOrderDtoFixture({ status: { code: 'PINV_ORDER_RETIRADO', display: 'Retirado' } }),
    );
    click('mostrador-descargar-factura');

    expect(toastInfo).toHaveBeenCalledOnce();
    expect(toastInfo.mock.calls[0]?.[0]).toContain('módulo de facturación');
  });

  /** `dd/MM/yyyy`, el formato con el que el comprobante pinta las fechas. */
  function comoLaPintaLaPantalla(fecha: Date): string {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    return `${dia}/${mes}/${fecha.getFullYear()}`;
  }

  /** El pedido de ejemplo con cobertura, con un renglón que el seguro rebota. */
  function pedidoConSeguro(): PharmacyOrderDto {
    const base = pharmacyOrderDtoFixture();
    return pharmacyOrderDtoFixture({
      // Lo que lo identifica como el pedido con seguro es su id, no el nombre.
      id: ID_PEDIDO_CON_SEGURO,
      status: { code: 'PINV_ORDER_EN_REVISION', display: 'En revisión' },
      patientName: 'Rosa Elena Quispe Vargas',
      lines: [
        base.lines[0],
        {
          ...base.lines[0],
          productId: '00000000-0000-4000-8000-00000000000a',
          brandName: 'Sertralina',
          unitPriceAmount: '95.50',
        },
      ],
    });
  }
});
