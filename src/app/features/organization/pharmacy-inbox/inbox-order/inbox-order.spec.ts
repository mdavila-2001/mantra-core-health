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
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { InboxOrder } from './inbox-order';

describe('InboxOrder with the real pharmacy-orders contract', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmWithReason: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    confirmWithReason = vi.fn().mockResolvedValue('No trabajamos con esa presentación.');
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
});
