import { vitrinas } from '../fixtures/comunidad';
import { MEDICAMENTO, displayDe } from '../fixtures/conceptos';
import { recetas } from '../fixtures/clinica';
import { PACIENTE, pacientePorId } from '../fixtures/personas';
// T-I3 · los identificadores de los pedidos de ejemplo de la bandeja viven en
// un solo lugar, porque la pantalla también los usa.
import { ID_PEDIDO_CON_DELIVERY, ID_PEDIDO_CON_SEGURO } from '../fixtures/pedidos-de-farmacia';
import { notFound, preconditionFailed, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, contiene, cuerpo, iso, masMinutos, nuevoId, texto, uuid } from '../mock-store';

/* ============================================================================
    Farmacias: el directorio, los productos publicados, la disponibilidad
    cruzada contra una receta y los pedidos con su ciclo completo (enviado →
    revisión → confirmado → listo → retirado, con sustituciones y rechazo).
    ========================================================================== */

function c(code: string, display: string) {
  return { code, display };
}

const BOB = c('BOB', 'Boliviano');

interface FarmaciaSimulada {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly siteId: string;
  readonly siteName: string;
  readonly addressText: string;
  readonly lat: number;
  readonly lng: number;
  readonly homeDelivery: boolean;
}

const FARMACIAS: readonly FarmaciaSimulada[] = vitrinas
  .filtrar((v) => v.kind === 'PHARMACY')
  .map((v, i) => ({
    id: v.tenantId,
    code: v.slug.toUpperCase().replace(/-/g, '_'),
    name: v.displayName,
    siteId: uuid(`pharmacy-site-${v.slug}`),
    siteName: i === 0 ? 'Sucursal Central' : 'Sucursal principal',
    addressText: v.address,
    lat: v.lat,
    lng: v.lng,
    homeDelivery: i === 0,
  }));

interface ProductoSimulado {
  readonly id: string;
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly productCode: string;
  readonly brandName: string;
  readonly genericName: string;
  readonly strengthText: string;
  readonly packageSizeText: string;
  readonly dosageForm: { code: string; display: string };
  readonly medication: { code: string; display: string };
  readonly medicationConceptId: string;
  readonly requiresPrescription: boolean;
  readonly price: string;
  readonly stock: number;
}

const productos = new Coleccion<ProductoSimulado>(
  FARMACIAS.flatMap((f, fi) =>
    Object.entries(MEDICAMENTO).map(([code, conceptId], i) => {
      const display = displayDe(conceptId);
      const [generico, ...resto] = display.split(' ');
      const forma = display.includes('inhalador') ? c('INHALER', 'Inhalador') : display.includes('cápsulas') ? c('CAPSULE', 'Cápsula') : display.includes('UI/ml') ? c('INJECTABLE', 'Inyectable') : c('TABLET', 'Comprimido');
      return {
        id: uuid(`product-${f.id}-${code}`),
        pharmacyId: f.id,
        pharmacyName: f.name,
        productCode: `${f.code.slice(0, 3)}-${code.replace('MED-', '')}`,
        brandName: `${generico} ${['Bagó', 'Inti', 'Genérico'][(i + fi) % 3]}`,
        genericName: generico!,
        strengthText: resto.slice(0, 2).join(' '),
        packageSizeText: forma.code === 'TABLET' || forma.code === 'CAPSULE' ? 'Caja x 30' : 'Unidad',
        dosageForm: forma,
        medication: c(code, display),
        medicationConceptId: conceptId,
        requiresPrescription: ![5, 6, 11, 12].includes(i),
        price: (8 + i * 4.5 + fi * 2).toFixed(2),
        stock: (i + fi) % 5 === 4 ? 0 : 12 + i * 3,
      };
    }),
  ),
);

function distanciaKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)) * 10) / 10;
}

/* ---- pedidos ---------------------------------------------------------------- */

type EstadoPedido = 'ENVIADO' | 'EN_REVISION' | 'CONFIRMADO' | 'ACEPTACION_PENDIENTE' | 'ACEPTADO' | 'LISTO_PARA_RETIRO' | 'RETIRADO' | 'RECHAZADO' | 'VENCIDO' | 'CANCELADO';

const ETIQUETA: Record<EstadoPedido, string> = {
  ENVIADO: 'Enviado',
  EN_REVISION: 'En revisión',
  CONFIRMADO: 'Confirmado',
  ACEPTACION_PENDIENTE: 'Esperando tu aceptación',
  ACEPTADO: 'Aceptado',
  LISTO_PARA_RETIRO: 'Listo para retirar',
  RETIRADO: 'Retirado',
  RECHAZADO: 'Rechazado',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
};

interface LineaSimulada {
  readonly productId: string;
  readonly requestedQuantity: number;
  readonly reservedQuantity: number;
  readonly fulfilledQuantity: number;
  readonly status: 'RESERVED' | 'OUT_OF_STOCK' | 'FULFILLED' | 'RELEASED';
}

interface PedidoSimulado {
  readonly id: string;
  readonly estado: EstadoPedido;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly pharmacyId: string;
  readonly medicationRequestId: string | null;
  readonly patientProfileId: string;
  readonly patientName: string;
  readonly pickupCode: string;
  readonly rejectionReasonText: string | null;
  readonly lineas: readonly LineaSimulada[];
  readonly sustituciones: readonly { id: string; originalProductId: string; proposedProductId: string; status: 'PROPOSED' | 'ACCEPTED' | 'DECLINED'; decidedAt: string | null }[];
}

function productoDe(pharmacyId: string, code: keyof typeof MEDICAMENTO): ProductoSimulado {
  return productos.get(uuid(`product-${pharmacyId}-${code}`))!;
}

const pedidos = new Coleccion<PedidoSimulado>(
  (() => {
    const f0 = FARMACIAS[0]!;
    const f1 = FARMACIAS[1] ?? f0;
    const receta = recetas.filtrar((r) => r.patientProfileId === PACIENTE.id)[0];
    return [
      { id: uuid('pharmacy-order-1'), estado: 'LISTO_PARA_RETIRO' as const, createdAt: iso(-4, 15), expiresAt: iso(1, 15), pharmacyId: f0.id, medicationRequestId: receta?.id ?? null, patientProfileId: PACIENTE.id, patientName: PACIENTE.displayName, pickupCode: 'AV-4821', rejectionReasonText: null, lineas: [{ productId: productoDe(f0.id, 'MED-ENALAPRIL').id, requestedQuantity: 1, reservedQuantity: 1, fulfilledQuantity: 0, status: 'RESERVED' as const }, { productId: productoDe(f0.id, 'MED-ATORVASTATINA').id, requestedQuantity: 1, reservedQuantity: 1, fulfilledQuantity: 0, status: 'RESERVED' as const }], sustituciones: [] },
      { id: uuid('pharmacy-order-2'), estado: 'ACEPTACION_PENDIENTE' as const, createdAt: iso(-1, 10), expiresAt: iso(2, 10), pharmacyId: f1.id, medicationRequestId: null, patientProfileId: PACIENTE.id, patientName: PACIENTE.displayName, pickupCode: 'AV-5107', rejectionReasonText: null, lineas: [{ productId: productoDe(f1.id, 'MED-PARACETAMOL').id, requestedQuantity: 2, reservedQuantity: 2, fulfilledQuantity: 0, status: 'RESERVED' as const }, { productId: productoDe(f1.id, 'MED-LORATADINA').id, requestedQuantity: 1, reservedQuantity: 0, fulfilledQuantity: 0, status: 'OUT_OF_STOCK' as const }], sustituciones: [{ id: uuid('subst-1'), originalProductId: productoDe(f1.id, 'MED-LORATADINA').id, proposedProductId: productoDe(f1.id, 'MED-IBUPROFENO').id, status: 'PROPOSED' as const, decidedAt: null }] },
      { id: uuid('pharmacy-order-3'), estado: 'RETIRADO' as const, createdAt: iso(-20, 9), expiresAt: iso(-15, 9), pharmacyId: f0.id, medicationRequestId: null, patientProfileId: PACIENTE.id, patientName: PACIENTE.displayName, pickupCode: 'AV-3390', rejectionReasonText: null, lineas: [{ productId: productoDe(f0.id, 'MED-OMEPRAZOL').id, requestedQuantity: 1, reservedQuantity: 0, fulfilledQuantity: 1, status: 'FULFILLED' as const }], sustituciones: [] },
      { id: uuid('pharmacy-order-4'), estado: 'RECHAZADO' as const, createdAt: iso(-30, 11), expiresAt: iso(-25, 11), pharmacyId: f0.id, medicationRequestId: null, patientProfileId: PACIENTE.id, patientName: PACIENTE.displayName, pickupCode: 'AV-2214', rejectionReasonText: 'La receta adjunta está vencida. Pedí una nueva a tu médico.', lineas: [{ productId: productoDe(f0.id, 'MED-SERTRALINA').id, requestedQuantity: 1, reservedQuantity: 0, fulfilledQuantity: 0, status: 'RELEASED' as const }], sustituciones: [] },
      { id: uuid('pharmacy-order-5'), estado: 'ENVIADO' as const, createdAt: iso(0, 8, 20), expiresAt: iso(3, 8), pharmacyId: f0.id, medicationRequestId: null, patientProfileId: uuid('pid-p-flores'), patientName: 'Daniela Flores Cuéllar', pickupCode: 'AV-6001', rejectionReasonText: null, lineas: [{ productId: productoDe(f0.id, 'MED-SALBUTAMOL').id, requestedQuantity: 1, reservedQuantity: 1, fulfilledQuantity: 0, status: 'RESERVED' as const }], sustituciones: [] },
      { id: uuid('pharmacy-order-6'), estado: 'EN_REVISION' as const, createdAt: iso(0, 9, 5), expiresAt: iso(3, 9), pharmacyId: f0.id, medicationRequestId: null, patientProfileId: uuid('pid-p-mamani'), patientName: 'Jorge Luis Mamani Choque', pickupCode: 'AV-6002', rejectionReasonText: null, lineas: [{ productId: productoDe(f0.id, 'MED-METFORMINA').id, requestedQuantity: 2, reservedQuantity: 2, fulfilledQuantity: 0, status: 'RESERVED' as const }, { productId: productoDe(f0.id, 'MED-LOSARTAN').id, requestedQuantity: 1, reservedQuantity: 1, fulfilledQuantity: 0, status: 'RESERVED' as const }], sustituciones: [] },
      // T-I3 · el pedido de una persona CON seguro: la bandeja del mostrador lo usa para mostrar
      // lo aprobado y lo no aprobado renglón por renglón. La cobertura no viaja en este DTO —el
      // contrato de `pharmacy-orders` no la publica—, así que vive junto a la pantalla y se
      // reconoce por el identificador; acá sólo nace el pedido.
      { id: ID_PEDIDO_CON_SEGURO, estado: 'EN_REVISION' as const, createdAt: iso(0, 10, 15), expiresAt: iso(3, 10), pharmacyId: f0.id, medicationRequestId: null, patientProfileId: uuid('pid-p-quispe'), patientName: 'Rosa Elena Quispe Vargas', pickupCode: 'AV-6003', rejectionReasonText: null, lineas: [{ productId: productoDe(f0.id, 'MED-LEVOTIROXINA').id, requestedQuantity: 2, reservedQuantity: 2, fulfilledQuantity: 0, status: 'RESERVED' as const }, { productId: productoDe(f0.id, 'MED-SERTRALINA').id, requestedQuantity: 1, reservedQuantity: 1, fulfilledQuantity: 0, status: 'RESERVED' as const }], sustituciones: [] },
      // T-I3 · el pedido que sale a domicilio. `dto()` responde `RETIRO` para todos los pedidos
      // (`:195`) y esa línea es compartida: el medio de entrega de este ejemplo también se lo
      // pone la pantalla, por identificador, y se rotula como maqueta.
      { id: ID_PEDIDO_CON_DELIVERY, estado: 'EN_REVISION' as const, createdAt: iso(0, 11, 40), expiresAt: iso(3, 11), pharmacyId: f0.id, medicationRequestId: null, patientProfileId: uuid('pid-p-gutierrez'), patientName: 'Vania Gutiérrez Peña', pickupCode: 'AV-6004', rejectionReasonText: null, lineas: [{ productId: productoDe(f0.id, 'MED-IBUPROFENO').id, requestedQuantity: 1, reservedQuantity: 1, fulfilledQuantity: 0, status: 'RESERVED' as const }, { productId: productoDe(f0.id, 'MED-OMEPRAZOL').id, requestedQuantity: 2, reservedQuantity: 2, fulfilledQuantity: 0, status: 'RESERVED' as const }], sustituciones: [] },
    ];
  })(),
);

function dto(p: PedidoSimulado) {
  const farmacia = FARMACIAS.find((f) => f.id === p.pharmacyId) ?? FARMACIAS[0]!;
  const lineas = p.lineas.map((l) => {
    const prod = productos.get(l.productId);
    return {
      productId: l.productId,
      medicationConceptId: prod?.medicationConceptId ?? null,
      productCode: prod?.productCode ?? '',
      brandName: prod?.brandName ?? null,
      genericName: prod?.genericName ?? null,
      strengthText: prod?.strengthText ?? null,
      packageSizeText: prod?.packageSizeText ?? null,
      medication: prod?.medication ?? null,
      requestedQuantity: l.requestedQuantity,
      reservedQuantity: l.reservedQuantity,
      fulfilledQuantity: l.fulfilledQuantity,
      unitPriceAmount: prod?.price ?? null,
      currency: BOB,
      status: c(`PINV_RES_LINE_${l.status}`, l.status),
    };
  });
  const total = lineas.reduce((s, l) => s + Number(l.unitPriceAmount ?? 0) * l.requestedQuantity, 0);
  return {
    id: p.id,
    status: c(`PINV_ORDER_${p.estado}`, ETIQUETA[p.estado]),
    createdAt: p.createdAt,
    expiresAt: p.expiresAt,
    siteId: farmacia.siteId,
    siteName: farmacia.siteName,
    pharmacyId: farmacia.id,
    pharmacyName: farmacia.name,
    medicationRequestId: p.medicationRequestId,
    patientName: p.patientName,
    deliveryMode: c('PINV_DELIVERY_RETIRO', 'Retiro en farmacia'),
    pickupCode: p.pickupCode,
    totalAmount: total.toFixed(2),
    currency: BOB,
    rejectionReasonText: p.rejectionReasonText,
    substitutions: p.sustituciones.map((s) => {
      const o = productos.get(s.originalProductId);
      const n = productos.get(s.proposedProductId);
      return { id: s.id, originalProductId: s.originalProductId, originalName: o?.brandName ?? '', originalUnitPriceAmount: o?.price ?? null, proposedProductId: s.proposedProductId, proposedName: n?.brandName ?? '', proposedUnitPriceAmount: n?.price ?? null, currency: BOB, status: c(s.status, s.status), decidedAt: s.decidedAt };
    }),
    lines: lineas,
  };
}

function cambiar(id: string, estado: EstadoPedido, extra: Partial<PedidoSimulado> = {}) {
  const p = pedidos.get(id);
  if (p === undefined) return notFound('Pedido no encontrado');
  return dto(pedidos.actualizar(id, { estado, ...extra })!);
}

function pedidosVisibles(request: MockRequest): PedidoSimulado[] {
  const user = request.user;
  if (user?.patientProfileId !== undefined) return pedidos.filtrar((p) => p.patientProfileId === user.patientProfileId);
  return pedidos.todos();
}

export function registrarFarmacia(router: MockRouter): void {
  router.get('/pharmacy/pharmacies', () => ({
    items: FARMACIAS.map((f) => ({ id: f.id, code: f.code, name: f.name, siteCount: 1, productCount: productos.filtrar((p) => p.pharmacyId === f.id).length })),
    count: FARMACIAS.length,
  }));

  router.get('/pharmacy/products', ({ query }) => {
    const q = texto(query, 'search');
    const conceptId = texto(query, 'conceptId');
    const limit = Number(query.get('limit') ?? 50) || 50;
    const items = productos
      .todos()
      .filter((p) => contiene(p.brandName, q) || contiene(p.genericName, q) || contiene(p.productCode, q))
      .filter((p) => conceptId === null || p.medicationConceptId === conceptId)
      .slice(0, limit)
      .map(({ medicationConceptId: _m, price: _p, stock: _s, ...p }) => p);
    return { items, limit, truncated: items.length >= limit };
  });

  router.get('/pharmacy-inventory/availability', ({ query }) => {
    const ids = (texto(query, 'productIds') ?? '').split(',').filter((x) => x !== '');
    const conceptos = ids.map((id) => productos.get(id)?.medicationConceptId ?? id);
    const lat = Number(query.get('lat') ?? query.get('originLat') ?? -17.78);
    const lng = Number(query.get('lng') ?? query.get('originLng') ?? -63.18);
    const items = FARMACIAS.map((f) => {
      const enFarmacia = conceptos.map((conceptId) => productos.filtrar((p) => p.pharmacyId === f.id && p.medicationConceptId === conceptId)[0]);
      const disponibles = enFarmacia.filter((p): p is ProductoSimulado => p !== undefined && p.stock > 0);
      const faltantes = ids.filter((_, i) => enFarmacia[i] === undefined || enFarmacia[i]!.stock === 0);
      const total = disponibles.reduce((s, p) => s + Number(p.price), 0);
      return {
        siteId: f.siteId,
        siteName: f.siteName,
        pharmacyId: f.id,
        pharmacyName: f.name,
        addressText: f.addressText,
        latitude: f.lat,
        longitude: f.lng,
        distanceKm: distanciaKm(lat, lng, f.lat, f.lng),
        homeDeliveryAvailable: f.homeDelivery,
        pickupAvailable: true,
        complete: faltantes.length === 0,
        availableCount: disponibles.length,
        missingProductIds: faltantes,
        totalAmount: total.toFixed(2),
        currency: BOB,
        products: disponibles.map((p) => ({ productId: p.id, productCode: p.productCode, brandName: p.brandName, genericName: p.genericName, strengthText: p.strengthText, packageSizeText: p.packageSizeText, medication: p.medication, availableQuantity: p.stock, price: { unitAmount: p.price, patientAmount: p.price, currency: BOB, priceListCode: 'PUBLICO' } })),
      };
    }).sort((a, b) => Number(b.complete) - Number(a.complete) || a.distanceKm - b.distanceKm);
    return { requestedProductIds: ids, items, count: items.length };
  });

  router.get('/pharmacy/orders/me', (request) => {
    const items = pedidosVisibles(request).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(dto);
    return { items, count: items.length };
  });

  router.get('/pharmacy/orders', ({ query }) => {
    const status = texto(query, 'status');
    const items = pedidos
      .todos()
      .filter((p) => status === null || p.estado === status || `PINV_ORDER_${p.estado}` === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(dto);
    return { items, count: items.length };
  });

  router.post('/pharmacy/orders', (request) => {
    const datos = cuerpo<{ siteId: string; medicationRequestId?: string; lines?: { productId: string; quantity: number }[] }>(request);
    const farmacia = FARMACIAS.find((f) => f.siteId === datos.siteId) ?? FARMACIAS[0]!;
    const paciente = pacientePorId(request.user?.patientProfileId ?? '') ?? PACIENTE;
    const nuevo = pedidos.agregar({
      id: nuevoId('pharmacy-order'),
      estado: 'ENVIADO',
      createdAt: ahora(),
      expiresAt: masMinutos(ahora(), 60 * 72),
      pharmacyId: farmacia.id,
      medicationRequestId: datos.medicationRequestId ?? null,
      patientProfileId: paciente.id,
      patientName: paciente.displayName,
      pickupCode: `AV-${Math.floor(1000 + Math.random() * 9000)}`,
      rejectionReasonText: null,
      lineas: (datos.lines ?? []).map((l) => {
        const prod = productos.get(l.productId);
        const hay = prod !== undefined && prod.stock >= l.quantity;
        return { productId: l.productId, requestedQuantity: l.quantity, reservedQuantity: hay ? l.quantity : 0, fulfilledQuantity: 0, status: hay ? ('RESERVED' as const) : ('OUT_OF_STOCK' as const) };
      }),
      sustituciones: [],
    });
    return { status: 201, body: dto(nuevo) };
  });

  router.get('/pharmacy/orders/:id', ({ params }) => {
    const p = pedidos.get(params['id']!);
    return p === undefined ? notFound('Pedido no encontrado') : dto(p);
  });

  router.post('/pharmacy/orders/:id/review', ({ params }) => cambiar(params['id']!, 'EN_REVISION'));

  router.post('/pharmacy/orders/:id/confirm', (request) => {
    const p = pedidos.get(request.params['id']!);
    if (p === undefined) return notFound('Pedido no encontrado');
    const datos = cuerpo<{ adjustments?: { productId: string; decision: 'NO_DISPONIBLE' | 'PROPONER_GENERICO'; proposedProductId?: string }[] }>(request);
    const ajustes = datos.adjustments ?? [];
    const lineas = p.lineas.map((l) => {
      const ajuste = ajustes.find((a) => a.productId === l.productId);
      return ajuste?.decision === 'NO_DISPONIBLE' ? { ...l, reservedQuantity: 0, status: 'OUT_OF_STOCK' as const } : l;
    });
    const sustituciones = ajustes
      .filter((a) => a.decision === 'PROPONER_GENERICO' && a.proposedProductId !== undefined)
      .map((a) => ({ id: nuevoId('subst'), originalProductId: a.productId, proposedProductId: a.proposedProductId!, status: 'PROPOSED' as const, decidedAt: null }));
    return cambiar(p.id, sustituciones.length > 0 ? 'ACEPTACION_PENDIENTE' : 'CONFIRMADO', { lineas, sustituciones: [...p.sustituciones, ...sustituciones] });
  });

  router.post('/pharmacy/orders/:id/reject', (request) => {
    const datos = cuerpo<{ reason: string }>(request);
    return cambiar(request.params['id']!, 'RECHAZADO', { rejectionReasonText: datos.reason ?? 'Sin motivo' });
  });

  router.post('/pharmacy/orders/:id/ready', ({ params }) => cambiar(params['id']!, 'LISTO_PARA_RETIRO'));
  router.post('/pharmacy/orders/:id/mark-ready', ({ params }) => cambiar(params['id']!, 'LISTO_PARA_RETIRO'));

  router.post('/pharmacy/orders/:id/accept-substitutions', ({ params }) => {
    const p = pedidos.get(params['id']!);
    if (p === undefined) return notFound();
    const lineas = p.lineas.map((l) => {
      const s = p.sustituciones.find((x) => x.originalProductId === l.productId);
      return s === undefined ? l : { ...l, productId: s.proposedProductId, reservedQuantity: l.requestedQuantity, status: 'RESERVED' as const };
    });
    return cambiar(p.id, 'ACEPTADO', { lineas, sustituciones: p.sustituciones.map((s) => ({ ...s, status: 'ACCEPTED' as const, decidedAt: ahora() })) });
  });

  router.post('/pharmacy/orders/:id/keep-original', ({ params }) => {
    const p = pedidos.get(params['id']!);
    if (p === undefined) return notFound();
    return cambiar(p.id, 'ACEPTADO', { sustituciones: p.sustituciones.map((s) => ({ ...s, status: 'DECLINED' as const, decidedAt: ahora() })) });
  });
  router.post('/pharmacy/orders/:id/prefer-original', ({ params }) => {
    const p = pedidos.get(params['id']!);
    if (p === undefined) return notFound();
    return cambiar(p.id, 'ACEPTADO', { sustituciones: p.sustituciones.map((s) => ({ ...s, status: 'DECLINED' as const, decidedAt: ahora() })) });
  });

  router.post('/pharmacy/orders/:id/cancel', ({ params }) => cambiar(params['id']!, 'CANCELADO'));

  router.post('/pharmacy/orders/:id/dispense', (request) => {
    const p = pedidos.get(request.params['id']!);
    if (p === undefined) return notFound('Pedido no encontrado');
    const datos = cuerpo<{ pickupCode: string; productIds?: string[] }>(request);
    if ((datos.pickupCode ?? '').toUpperCase() !== p.pickupCode) {
      return preconditionFailed('El código de retiro no coincide', { pickupCode: datos.pickupCode });
    }
    const ids = datos.productIds;
    const lineas = p.lineas.map((l) => (ids === undefined || ids.includes(l.productId) ? { ...l, fulfilledQuantity: l.requestedQuantity, reservedQuantity: 0, status: 'FULFILLED' as const } : l));
    const completo = lineas.every((l) => l.status === 'FULFILLED' || l.status === 'OUT_OF_STOCK');
    return cambiar(p.id, completo ? 'RETIRADO' : 'LISTO_PARA_RETIRO', { lineas });
  });
}
