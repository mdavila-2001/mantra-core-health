import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { pharmacyOrderFromDto, UnsupportedPharmacyOrderLineError } from './pharmacy-orders.adapter';
import { PharmacyOrdersClient } from './pharmacy-orders.client';
import type { PharmacyOrderDto } from './pharmacy-orders.dto';
import type { BorradorDePedido, PedidoFarmacia } from './pharmacy-orders.types';

const ORDER_ID = '00000000-0000-4000-8000-000000000001';
const SITE_ID = '00000000-0000-4000-8000-000000000002';
const PHARMACY_ID = '00000000-0000-4000-8000-000000000003';
const PRODUCT_A = '00000000-0000-4000-8000-000000000004';
const PRODUCT_B = '00000000-0000-4000-8000-000000000005';
const REQUEST_ID = '00000000-0000-4000-8000-000000000006';

function orderDto(extra: Partial<PharmacyOrderDto> = {}): PharmacyOrderDto {
  return {
    id: ORDER_ID,
    status: { code: 'PINV_ORDER_ENVIADO', display: 'Enviado' },
    createdAt: '2026-09-03T14:00:00.000Z',
    expiresAt: '2026-09-05T14:00:00.000Z',
    siteId: SITE_ID,
    siteName: 'Sucursal Centro',
    pharmacyId: PHARMACY_ID,
    pharmacyName: 'Farmacia Uno',
    medicationRequestId: REQUEST_ID,
    patientName: 'Ana Paciente',
    deliveryMode: { code: 'PINV_DELIVERY_RETIRO', display: 'Retiro' },
    pickupCode: null,
    totalAmount: '42.50',
    currency: { code: 'BOB', display: 'Boliviano' },
    rejectionReasonText: null,
    substitutions: [],
    lines: [
      {
        productId: PRODUCT_A,
        medicationConceptId: '00000000-0000-4000-8000-000000000007',
        productCode: 'AMOX-500',
        brandName: 'Marca A',
        genericName: 'Amoxicilina',
        strengthText: '500 mg',
        packageSizeText: 'caja x 20',
        medication: { code: 'J01CA04', display: 'Amoxicilina' },
        requestedQuantity: 2,
        reservedQuantity: 2,
        fulfilledQuantity: 0,
        unitPriceAmount: '21.25',
        currency: { code: 'BOB', display: 'Boliviano' },
        status: { code: 'PINV_RES_LINE_CONFIRMED', display: 'Confirmada' },
      },
    ],
    ...extra,
  };
}

function draft(extra: Partial<BorradorDePedido> = {}): BorradorDePedido {
  return {
    requestId: REQUEST_ID,
    siteId: SITE_ID,
    pharmacyId: PHARMACY_ID,
    farmacia: 'Farmacia Uno',
    sede: 'Sucursal Centro',
    direccion: null,
    lineas: [
      {
        productId: PRODUCT_A,
        medicamento: 'Marca A',
        presentacion: '500 mg',
        cantidad: 2,
        precio: '21.25',
        moneda: 'BOB',
        disponible: true,
      },
    ],
    totalEstimado: '42.50',
    moneda: 'BOB',
    ...extra,
  };
}

describe('PharmacyOrdersClient real HTTP contract', () => {
  let client: PharmacyOrdersClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PharmacyOrdersClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps only the cross-route draft in memory', () => {
    expect(client.borradorPreparado()).toBeNull();
    client.prepararBorrador(draft());
    expect(client.borradorPreparado()?.siteId).toBe(SITE_ID);
    client.descartarBorrador();
    expect(client.borradorPreparado()).toBeNull();
  });

  it('POSTs a RETIRO order and adapts status, dates, names and nullable fields', () => {
    let result: PedidoFarmacia | null = null;
    const prepared = draft();
    client.prepararBorrador(prepared);
    client
      .enviar({ borrador: prepared, modalidad: 'RETIRO', direccionDeEntrega: null })
      .subscribe((order) => (result = order));

    const request = http.expectOne('/pharmacy/orders');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      siteId: SITE_ID,
      medicationRequestId: REQUEST_ID,
      deliveryMode: 'RETIRO',
      idempotencyKey: expect.any(String),
      lines: [{ productId: PRODUCT_A, quantity: 2 }],
    });
    request.flush(orderDto({ deliveryMode: null, medicationRequestId: null }));

    expect(result).toMatchObject({
      estado: 'ENVIADO',
      modalidad: null,
      requestId: null,
      farmacia: 'Farmacia Uno',
      sede: 'Sucursal Centro',
    });
    const created = result as unknown as PedidoFarmacia;
    expect(created.creadoEl).toEqual(new Date('2026-09-03T14:00:00.000Z'));
    expect(created.lineas[0]).toMatchObject({
      conceptId: '00000000-0000-4000-8000-000000000007',
      medicamento: 'Marca A',
      presentacion: '500 mg · caja x 20',
      fulfilledQuantity: 0,
    });
    expect(client.borradorPreparado()).toBeNull();
  });

  it('does not silently drop a line whose productId is null', () => {
    const blocked = draft({
      lineas: [
        {
          productId: null,
          medicamento: 'Sin publicar',
          presentacion: null,
          cantidad: 1,
          precio: null,
          moneda: null,
          disponible: false,
        },
      ],
    });
    let received: unknown;
    client
      .enviar({ borrador: blocked, modalidad: 'RETIRO', direccionDeEntrega: null })
      .subscribe({ error: (error: unknown) => (received = error) });
    expect(received).toBeInstanceOf(UnsupportedPharmacyOrderLineError);
    http.expectNone('/pharmacy/orders');
  });

  it('GETs the patient list and preserves API order', () => {
    let ids: readonly string[] = [];
    client.misPedidos().subscribe((orders) => (ids = orders.map((order) => order.id)));
    const request = http.expectOne('/pharmacy/orders/me');
    expect(request.request.method).toBe('GET');
    request.flush({ items: [orderDto()], count: 1 });
    expect(ids).toEqual([ORDER_ID]);
  });

  it('GETs one order and propagates the real 404', () => {
    let received: unknown;
    client.pedido(ORDER_ID).subscribe({ error: (error: unknown) => (received = error) });
    const request = http.expectOne(`/pharmacy/orders/${ORDER_ID}`);
    expect(request.request.method).toBe('GET');
    request.flush(
      { code: 'NOT_FOUND', message: 'No existe', timestamp: '', path: request.request.url },
      { status: 404, statusText: 'Not Found' },
    );
    expect(received).toBeInstanceOf(HttpErrorResponse);
    expect((received as HttpErrorResponse).status).toBe(404);
  });

  it('GETs one staff order with the pickup code removed', () => {
    let pickupCode: string | null | undefined;
    client.pedidoParaMostrador(ORDER_ID).subscribe((order) => (pickupCode = order.codigoDeRetiro));
    http.expectOne(`/pharmacy/orders/${ORDER_ID}`).flush(orderDto({ pickupCode: 'SECRET' }));
    expect(pickupCode).toBeNull();
  });

  it('GETs the tenant inbox and never exposes pickupCode to staff', () => {
    let pickupCode: string | null | undefined;
    client.pedidosDeFarmacia().subscribe((orders) => (pickupCode = orders[0]?.codigoDeRetiro));
    const request = http.expectOne('/pharmacy/orders');
    expect(request.request.method).toBe('GET');
    request.flush({ items: [orderDto({ pickupCode: 'SECRET' })], count: 1 });
    expect(pickupCode).toBeNull();
  });

  it('sends only declared tenant-list query parameters', () => {
    client
      .pedidosDeFarmacia({
        status: 'PINV_ORDER_ENVIADO',
        siteId: SITE_ID,
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-03T23:59:59.999Z',
        limit: 25,
      })
      .subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/pharmacy/orders');
    expect(request.request.params.keys().sort()).toEqual([
      'from',
      'limit',
      'siteId',
      'status',
      'to',
    ]);
    expect(request.request.params.get('status')).toBe('PINV_ORDER_ENVIADO');
    expect(request.request.params.get('siteId')).toBe(SITE_ID);
    expect(request.request.params.get('limit')).toBe('25');
    request.flush({ items: [], count: 0 });
  });

  it.each([
    ['cancelar', 'cancel'],
    ['abrirRevision', 'review'],
    ['aceptarSustituciones', 'accept-substitutions'],
    ['preferirOriginal', 'prefer-original'],
    ['marcarListo', 'ready'],
  ] as const)('POSTs %s to the real action endpoint', (method, action) => {
    client[method](ORDER_ID).subscribe();
    const request = http.expectOne(`/pharmacy/orders/${ORDER_ID}/${action}`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush(orderDto());
  });

  it('POSTs reject with the backend reason field', () => {
    client.rechazarPedido(ORDER_ID, 'Sin stock').subscribe();
    const request = http.expectOne(`/pharmacy/orders/${ORDER_ID}/reject`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'Sin stock' });
    request.flush(orderDto({ status: { code: 'PINV_ORDER_RECHAZADO', display: 'Rechazado' } }));
  });

  it('maps line indexes to productIds when confirming', () => {
    const order = pharmacyOrder(orderDto());
    client.confirmarPedido(order, [{ indice: 0, decision: 'NO_DISPONIBLE' }]).subscribe();
    const request = http.expectOne(`/pharmacy/orders/${ORDER_ID}/confirm`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      adjustments: [{ productId: PRODUCT_A, decision: 'NO_DISPONIBLE' }],
    });
    request.flush(orderDto());
  });

  it('maps a selected substitute to proposedProductId without sending display fields', () => {
    const order = pharmacyOrder(orderDto());
    client
      .confirmarPedido(order, [
        {
          indice: 0,
          decision: 'PROPONER_GENERICO',
          propuesta: { productId: PRODUCT_B, nombre: 'Display only', precio: '18.00' },
        },
      ])
      .subscribe();
    const request = http.expectOne(`/pharmacy/orders/${ORDER_ID}/confirm`);
    expect(request.request.body).toEqual({
      adjustments: [
        {
          productId: PRODUCT_A,
          decision: 'PROPONER_GENERICO',
          proposedProductId: PRODUCT_B,
        },
      ],
    });
    request.flush(orderDto());
  });

  it('preserves newest-first substitutions and their DTO values', () => {
    let names: readonly string[] = [];
    client.pedido(ORDER_ID).subscribe((order) => {
      names = order.sustituciones.map((substitution) => substitution.propuesta.nombre);
    });
    http.expectOne(`/pharmacy/orders/${ORDER_ID}`).flush(
      orderDto({
        substitutions: [substitutionDto('new', 'Nueva'), substitutionDto('old', 'Anterior')],
      }),
    );
    expect(names).toEqual(['Nueva', 'Anterior']);
  });

  it('keeps the proposed product id in the frontend substitution model', () => {
    const mapped = pharmacyOrder(orderDto({ substitutions: [substitutionDto('new', 'Nueva')] }));
    expect(mapped.sustituciones[0]?.propuesta.productId).toBe(PRODUCT_B);
  });

  it.each([
    ['PINV_ORDER_ENVIADO', 'ENVIADO'],
    ['PINV_ORDER_EN_REVISION', 'EN_REVISION'],
    ['PINV_ORDER_CONFIRMADO', 'CONFIRMADO'],
    ['PINV_ORDER_ACEPTACION_PENDIENTE', 'ACEPTACION_PENDIENTE'],
    ['PINV_ORDER_ACEPTADO', 'ACEPTADO'],
    ['PINV_ORDER_LISTO_PARA_RETIRO', 'LISTO_PARA_RETIRO'],
    ['PINV_ORDER_RETIRADO', 'RETIRADO'],
    ['PINV_ORDER_RECHAZADO', 'RECHAZADO'],
    ['PINV_ORDER_VENCIDO', 'VENCIDO'],
    ['PINV_ORDER_CANCELADO', 'CANCELADO'],
  ] as const)('maps backend state %s explicitly', (apiState, visualState) => {
    expect(pharmacyOrder(orderDto({ status: { code: apiState, display: apiState } })).estado).toBe(
      visualState,
    );
  });

  it('maps dispense indexes to productIds and sends an idempotency key', () => {
    const order = pharmacyOrder(
      orderDto({
        lines: [
          orderDto().lines[0]!,
          { ...orderDto().lines[0]!, productId: PRODUCT_B, productCode: 'IBU-400' },
        ],
      }),
    );
    client.dispensar(order, { codigo: 'ABC234', indices: [1] }).subscribe();
    const request = http.expectOne(`/pharmacy/orders/${ORDER_ID}/dispense`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      pickupCode: 'ABC234',
      productIds: [PRODUCT_B],
      idempotencyKey: expect.any(String),
    });
    request.flush(orderDto());
  });

  it('translates only 422 PICKUP_CODE_MISMATCH to codigoValido false', () => {
    let valid: boolean | null = null;
    client
      .dispensar(pharmacyOrder(orderDto()), { codigo: 'BAD', indices: [0] })
      .subscribe((result) => (valid = result.codigoValido));
    const request = http.expectOne(`/pharmacy/orders/${ORDER_ID}/dispense`);
    request.flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'No coincide',
        details: { reason: 'PICKUP_CODE_MISMATCH' },
        timestamp: '',
        path: request.request.url,
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(valid).toBe(false);
  });

  it('does not absorb unrelated 422 errors', () => {
    let received: unknown;
    client
      .dispensar(pharmacyOrder(orderDto()), { codigo: 'ABC234', indices: [0] })
      .subscribe({ error: (error: unknown) => (received = error) });
    const request = http.expectOne(`/pharmacy/orders/${ORDER_ID}/dispense`);
    request.flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'Estado inválido',
        details: { reason: 'INVALID_STATE' },
        timestamp: '',
        path: request.request.url,
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(received).toBeInstanceOf(HttpErrorResponse);
  });

  it('rejects an unknown backend state instead of inventing a visual state', () => {
    expect(() =>
      pharmacyOrder(orderDto({ status: { code: 'PINV_ORDER_NEW', display: 'New' } })),
    ).toThrowError('Estado de pedido desconocido: PINV_ORDER_NEW');
  });
});

function pharmacyOrder(dto: PharmacyOrderDto): PedidoFarmacia {
  return pharmacyOrderFromDto(dto);
}

function substitutionDto(id: string, proposedName: string) {
  return {
    id,
    originalProductId: PRODUCT_A,
    originalName: 'Marca A',
    originalUnitPriceAmount: '21.25',
    proposedProductId: PRODUCT_B,
    proposedName,
    proposedUnitPriceAmount: '18.00',
    currency: { code: 'BOB', display: 'Boliviano' },
    status: { code: 'PINV_SUBSTITUTION_PROPUESTA', display: 'Propuesta' },
    decidedAt: null,
  };
}
