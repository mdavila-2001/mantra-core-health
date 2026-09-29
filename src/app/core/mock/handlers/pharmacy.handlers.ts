import { FARMACIAS_DEL_CORPUS } from '../fixtures/bolivia-eje-central';
import { patientSettlementForItems } from '../fixtures/patient-settlements';
import { vitrinas } from '../fixtures/comunidad';
import { MEDICAMENTO, displayDe } from '../fixtures/conceptos';
import { recetas } from '../fixtures/clinica';
import { PACIENTE, pacientePorId, profesionalPorId } from '../fixtures/personas';
// T-I3 · los identificadores de los pedidos de ejemplo de la bandeja viven en
// un solo lugar, porque la pantalla también los usa.
import {
  DELIVERY_ORDER_ADDRESS,
  ID_PEDIDO_CON_DELIVERY,
  ID_PEDIDO_CON_SEGURO,
} from '../fixtures/pedidos-de-farmacia';
import { conflict, notFound, preconditionFailed, validation, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, Coleccion, contiene, cuerpo, iso, isoDia, masMinutos, nuevoId, texto, uuid } from '../mock-store';

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
  /**
   * Si es una de las 50 sucursales reales del corpus. A esas no se les
   * inventa ficha legal —NIT, forma societaria, licencias, representante—:
   * sería declarar datos de un negocio que existe.
   */
  readonly fromCorpus: boolean;
}

/** Las 50 sucursales del corpus, por su slug: da el nombre y el horario reales. */
const DEL_CORPUS = new Map(FARMACIAS_DEL_CORPUS.map((farmacia) => [farmacia.slug, farmacia]));

/**
 * Las farmacias del mostrador, sacadas de sus vitrinas públicas.
 *
 * Son las ocho de siempre más las **50 sucursales reales** del corpus «Bolivia
 * Salud · Eje Central», con su dirección publicada y su punto en el mapa. Para
 * las del corpus el nombre de la sucursal es el que usa la cadena; para las de
 * la maqueta sigue siendo el de siempre.
 *
 * El reparto a domicilio queda en la primera —la de la maqueta— porque el
 * corpus no declara qué sucursal reparte. Ponérselo a todas sería prometer un
 * servicio en nombre de un negocio que existe.
 */
const FARMACIAS: readonly FarmaciaSimulada[] = vitrinas
  .filtrar((v) => v.kind === 'PHARMACY')
  .map((v, i) => {
    const corpus = DEL_CORPUS.get(v.slug);
    return {
      id: v.tenantId,
      code: v.slug.toUpperCase().replace(/-/g, '_'),
      name: v.displayName,
      siteId: corpus?.siteId ?? uuid(`pharmacy-site-${v.slug}`),
      siteName: corpus?.siteName ?? (i === 0 ? 'Sucursal Central' : 'Sucursal principal'),
      addressText: v.address,
      lat: v.lat,
      lng: v.lng,
      homeDelivery: corpus === undefined && i === 0,
      fromCorpus: corpus !== undefined,
    };
  });

/* ---- la ficha legal de la farmacia (sólo las de la maqueta) --------------- */

/** Lo que la ficha legal dice cuando no hay de dónde sacarla. */
const LEGAL_PROFILE_NONE = {
  taxId: null,
  companyType: null,
  legalAddressText: null,
  headquarters: null,
} as const;

/**
 * NIT, forma societaria y casa matriz de ejemplo, **sólo** para las farmacias
 * de la maqueta. La casa matriz de la maqueta es la dirección de su sucursal:
 * en el backend real sale de `common.addresses` de la organización.
 */
function legalProfileOf(f: FarmaciaSimulada) {
  if (f.fromCorpus) return LEGAL_PROFILE_NONE;
  const index = FARMACIAS.indexOf(f);
  return {
    taxId: String(1020304020 + index * 7),
    companyType: c('SRL', 'Limited liability company (S.R.L.)'),
    legalAddressText: f.addressText,
    headquarters: { latitude: f.lat, longitude: f.lng },
  };
}

/**
 * La carpeta de licencias de ejemplo: una de la farmacia entera, vigente y
 * verificada, y una de la sucursal, por vencer y pendiente — así el aviso de
 * vencimiento se ve. Las fechas son relativas a hoy y los días hasta el
 * vencimiento los declara el backend, como en el real.
 */
function licensesOf(f: FarmaciaSimulada) {
  if (f.fromCorpus) return [];
  const operating = c('PHARM_LICENSE_TYPE_OPERATING', 'Operating license');
  return [
    {
      id: uuid(`pharmacy-license-${f.id}-general`),
      type: operating,
      number: `LF-${f.code.slice(0, 6)}-0187`,
      siteId: null,
      siteName: null,
      jurisdiction: null,
      validFrom: isoDia(-255),
      validTo: isoDia(110),
      daysToExpiry: 110,
      verificationStatus: c('PHARM_VERIFICATION_VERIFIED', 'Verification verified'),
      evidenceFileId: uuid(`pharmacy-license-file-${f.id}`),
    },
    {
      id: uuid(`pharmacy-license-${f.id}-site`),
      type: operating,
      number: `SEDES-${f.code.slice(0, 6)}-4411`,
      siteId: f.siteId,
      siteName: f.siteName,
      jurisdiction: null,
      validFrom: isoDia(-352),
      validTo: isoDia(13),
      daysToExpiry: 13,
      verificationStatus: c('PHARM_VERIFICATION_PENDING', 'Verification pending'),
      evidenceFileId: null,
    },
  ];
}

/** Quién responde por la farmacia de ejemplo; nadie, para las del corpus. */
function contactsOf(f: FarmaciaSimulada) {
  if (f.fromCorpus) return { legalRepresentative: null, executives: [] };
  return {
    legalRepresentative: {
      role: 'LEGAL_REPRESENTATIVE',
      fullName: 'María Elena Ortiz Camacho',
      email: 'legal@farmacia.mock',
      phone: null,
    },
    executives: [
      {
        role: 'GENERAL_MANAGER',
        fullName: 'Jorge Antonio Vaca Suárez',
        email: 'gerencia@farmacia.mock',
        phone: '+591 70011223',
      },
      {
        role: 'COMMERCIAL_MANAGER',
        fullName: 'Lucía Fernanda Roca Mendoza',
        email: 'comercial@farmacia.mock',
        phone: '+591 70011224',
      },
    ],
  };
}

interface ProductoSimulado {
  readonly id: string;
  readonly pharmacyId: string;
  readonly pharmacyName: string;
  readonly productCode: string;
  // Nulos como en la API: un producto que la farmacia sube a mano puede no
  // tener marca, genérico, forma ni medicamento del vademécum.
  readonly brandName: string | null;
  readonly genericName: string | null;
  readonly strengthText: string | null;
  readonly packageSizeText: string | null;
  readonly dosageForm: { code: string; display: string } | null;
  readonly medication: { code: string; display: string } | null;
  readonly medicationConceptId: string | null;
  readonly requiresPrescription: boolean | null;
  /** `null` = sin precio publicado: el alta de producto no fija precio. */
  readonly price: string | null;
  readonly stock: number;
  /** Retirado del catálogo (`DELETE`): borrado lógico, como en la API. */
  readonly retirado?: boolean;
}

/** Lo que el catálogo publica: sin los retirados, como `findActiveProducts`. */
function activos(): ProductoSimulado[] {
  return productos.filtrar((p) => p.retirado !== true);
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
  /** Sin declarar, el pedido se retira en la farmacia (`PINV_DELIVERY_RETIRO`). */
  readonly deliveryMode?: 'DOMICILIO' | 'TRABAJO';
  /** La dirección guardada del envío, en una línea; sólo con envío. */
  readonly deliveryAddressText?: string;
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
      // T-I3 · el pedido que sale a domicilio. El medio de entrega y la dirección son parte del
      // contrato (`deliveryMode`, `deliveryAddressText`), así que los declara el backend simulado
      // y la pantalla los lee de la respuesta, igual que con la API real.
      { id: ID_PEDIDO_CON_DELIVERY, deliveryMode: 'DOMICILIO' as const, deliveryAddressText: DELIVERY_ORDER_ADDRESS, estado: 'EN_REVISION' as const, createdAt: iso(0, 11, 40), expiresAt: iso(3, 11), pharmacyId: f0.id, medicationRequestId: null, patientProfileId: uuid('pid-p-gutierrez'), patientName: 'Vania Gutiérrez Peña', pickupCode: 'AV-6004', rejectionReasonText: null, lineas: [{ productId: productoDe(f0.id, 'MED-IBUPROFENO').id, requestedQuantity: 1, reservedQuantity: 1, fulfilledQuantity: 0, status: 'RESERVED' as const }, { productId: productoDe(f0.id, 'MED-OMEPRAZOL').id, requestedQuantity: 2, reservedQuantity: 2, fulfilledQuantity: 0, status: 'RESERVED' as const }], sustituciones: [] },
    ];
  })(),
);

for (const suffix of ['partial', 'denied', 'pending']) {
  const original = pedidos.get(uuid('pharmacy-order-1'))!;
  pedidos.agregar({ ...original, id: uuid(`pharmacy-copay-${suffix}`), estado: 'CONFIRMADO' });
}

function settlementForOrder(order: PedidoSimulado) {
  if (['CANCELADO', 'RECHAZADO', 'VENCIDO'].includes(order.estado)) return { insuranceSettlement: null, insuranceSettlementAvailability: 'NOT_AVAILABLE' };
  if (order.sustituciones.some((substitution) => substitution.status === 'PROPOSED')) return { insuranceSettlement: null, insuranceSettlementAvailability: 'UNDER_REVIEW' };
  if (order.id === uuid('pharmacy-copay-pending')) return { insuranceSettlement: null, insuranceSettlementAvailability: 'PENDING_PUBLICATION' };
  const result = order.id === uuid('pharmacy-order-1') ? 'APPROVED'
    : order.id === uuid('pharmacy-copay-partial') ? 'PARTIALLY_APPROVED'
      : order.id === uuid('pharmacy-copay-denied') ? 'DENIED' : undefined;
  if (result) return patientSettlementForItems(order.id, result, order.lineas.map((line) => {
    const product = productos.get(line.productId)!;
    // Los pedidos sembrados usan productos con precio; uno sin precio publicado
    // suma cero, igual que la API cuando a la lista le falta el renglón.
    return { id: line.productId, name: product.brandName ?? product.genericName ?? product.productCode, unitAmount: product.price ?? '0.00', quantity: line.requestedQuantity };
  }));
  return { insuranceSettlement: null, insuranceSettlementAvailability: order.estado === 'ENVIADO' ? 'PENDING_PUBLICATION' : 'NOT_AVAILABLE' };
}

/** Un renglón con precio, como lo necesita la facturación SIMULADA. */
export interface RenglonDePedidoSimulado {
  readonly productCode: string;
  readonly descripcion: string;
  readonly cantidad: number;
  readonly precioUnitario: string;
}

/**
 * Los renglones con precio de un pedido del simulador, para la facturación
 * SIMULADA (FACT-SIAT-MOCK). Sólo lectura: el mismo precio unitario y la misma
 * cantidad pedida con que `dto()` arma `totalAmount`, así el cobro facturado y
 * el total que ve el paciente no se contradicen. No toca rutas ni datos.
 */
export function renglonesDePedidoSimulado(id: string): {
  readonly patientProfileId: string;
  readonly patientName: string;
  readonly pickupCode: string;
  readonly createdAt: string;
  readonly lineas: readonly RenglonDePedidoSimulado[];
} | null {
  const pedido = pedidos.get(id);
  if (pedido === undefined) return null;
  return {
    patientProfileId: pedido.patientProfileId,
    patientName: pedido.patientName,
    pickupCode: pedido.pickupCode,
    createdAt: pedido.createdAt,
    lineas: pedido.lineas.map((l) => {
      const prod = productos.get(l.productId);
      const nombre = prod?.brandName ?? prod?.genericName ?? prod?.productCode ?? 'Producto';
      return {
        productCode: prod?.productCode ?? l.productId,
        descripcion: [nombre, prod?.strengthText].filter((parte) => parte !== null && parte !== undefined && parte !== '').join(' '),
        cantidad: l.requestedQuantity,
        precioUnitario: prod?.price ?? '0.00',
      };
    }),
  };
}

/**
 * Quién firmó la receta del pedido: el prescriptor de la receta sembrada, con
 * su nombre y su primera especialidad. `null` sin receta o sin prescriptor.
 */
function prescriberOf(p: PedidoSimulado) {
  if (p.medicationRequestId === null) return null;
  const receta = recetas.get(p.medicationRequestId);
  const profesional = receta === undefined ? undefined : profesionalPorId(receta.prescriberProfileId);
  if (profesional === undefined) return null;
  const especialidad = profesional.especialidades[0];
  return {
    name: profesional.displayName,
    specialty: especialidad === undefined ? null : displayDe(especialidad),
  };
}

function dto(p: PedidoSimulado, owner = false) {
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
    prescriber: prescriberOf(p),
    patientName: p.patientName,
    deliveryMode: p.deliveryMode === undefined ? c('PINV_DELIVERY_RETIRO', 'Retiro en farmacia') : c(`PINV_DELIVERY_${p.deliveryMode}`, p.deliveryMode === 'DOMICILIO' ? 'Entrega a domicilio' : 'Entrega en el trabajo'),
    deliveryAddressText: p.deliveryAddressText ?? null,
    pickupCode: p.pickupCode,
    ...(owner ? settlementForOrder(p) : {}),
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
    items: FARMACIAS.map((f) => ({ id: f.id, code: f.code, name: f.name, siteCount: 1, productCount: activos().filter((p) => p.pharmacyId === f.id).length })),
    count: FARMACIAS.length,
  }));

  // Carril A (Ola 0, 2026-09-25) · GET /pharmacy/pharmacies/:id — el perfil de
  // una farmacia. `.filter`, NO `.find`: las 50 sucursales del corpus
  // comparten `id` por cadena (35 Farmacorp con el mismo tenant), así que un
  // id de cadena trae TODAS sus sedes, no una sola.
  router.get('/pharmacy/pharmacies/:id', ({ params }) => {
    const id = params['id']!;
    const sedes = FARMACIAS.filter((f) => f.id === id);
    if (sedes.length === 0) return notFound('Farmacia no encontrada');
    const f0 = sedes[0]!;
    return {
      id: f0.id,
      code: f0.code,
      name: f0.name,
      // Límite del doble: `VitrinaSimulada` no declara razón social (sólo 7
      // farmacias de la planilla la tienen, embebida en `biography`); se usa
      // el nombre comercial también como `legalName`.
      legalName: f0.name,
      type: null,
      siteCount: sedes.length,
      productCount: productos.filtrar((p) => p.pharmacyId === id).length,
      homeDeliveryAvailable: sedes.some((f) => f.homeDelivery),
      pickupAvailable: true,
      sites: sedes.map((f) => ({
        id: f.siteId,
        code: f.code,
        name: f.siteName,
        addressText: f.addressText,
        latitude: f.lat,
        longitude: f.lng,
      })),
      ...legalProfileOf(f0),
    };
  });

  // GET /pharmacy/pharmacies/:id/licenses y /contacts — lo que de la ficha ve
  // el personal de la farmacia. El doble no modela la membresía: el backend
  // real responde 404 a quien no es de la organización dueña.
  router.get('/pharmacy/pharmacies/:id/licenses', ({ params }) => {
    const f = FARMACIAS.find((farmacia) => farmacia.id === params['id']);
    if (f === undefined) return notFound('Farmacia no encontrada');
    const items = licensesOf(f);
    return { items, count: items.length };
  });

  router.get('/pharmacy/pharmacies/:id/contacts', ({ params }) => {
    const f = FARMACIAS.find((farmacia) => farmacia.id === params['id']);
    if (f === undefined) return notFound('Farmacia no encontrada');
    return contactsOf(f);
  });

  router.get('/pharmacy/products', ({ query }) => {
    const q = texto(query, 'search');
    const conceptId = texto(query, 'conceptId');
    // `pharmacyId` acota a una farmacia, como `searchProducts` en la API (H5).
    const pharmacyId = texto(query, 'pharmacyId');
    const limit = Number(query.get('limit') ?? 50) || 50;
    const coinciden = activos()
      .filter((p) => contiene(p.brandName, q) || contiene(p.genericName, q) || contiene(p.productCode, q))
      .filter((p) => conceptId === null || p.medicationConceptId === conceptId)
      .filter((p) => pharmacyId === null || p.pharmacyId === pharmacyId);
    const items = coinciden
      .slice(0, limit)
      .map(({ medicationConceptId: _m, price: _p, stock: _s, retirado: _r, ...p }) => p);
    return { items, limit, truncated: coinciden.length > limit };
  });

  // UC-24-04 · el alta de un producto en el catálogo de la farmacia. Nace
  // activo y sin precio ni stock: esos viven en listas de precios y en el
  // inventario, que el alta no toca.
  router.post('/pharmacies/:pharmacyId/products', (request) => {
    const pharmacyId = request.params['pharmacyId']!;
    const farmacia = FARMACIAS.find((f) => f.id === pharmacyId);
    if (farmacia === undefined) return notFound('Farmacia no encontrada');
    const datos = cuerpo<{
      productCode: string;
      brandName: string;
      genericName: string;
      strengthText: string;
      packageSizeText: string;
      requiresPrescription: boolean;
      coldChainRequired: boolean;
      identifiers: { identifierType: string; identifierValue: string }[];
    }>(request);
    const codigo = typeof datos.productCode === 'string' ? datos.productCode : '';
    if (codigo.length < 1 || codigo.length > 100) {
      return validation('productCode must be longer than or equal to 1 characters', [
        { field: 'productCode', message: 'El código es obligatorio y tiene hasta 100 caracteres.' },
      ]);
    }
    // Como la API: el código es único por farmacia **incluidos los retirados**
    // (`findByPharmacyAndCode` no mira el estado).
    if (productos.filtrar((p) => p.pharmacyId === pharmacyId && p.productCode === codigo).length > 0) {
      return conflict('Ya existe un producto con ese código en la farmacia', { productCode: codigo });
    }
    // Los topes del DTO (`MaxLength`): el simulador no deja pasar lo que la
    // API rechazaría, para que la maqueta no muestre un alta imposible.
    const topes: readonly [keyof typeof datos, number][] = [
      ['brandName', 300],
      ['genericName', 300],
      ['strengthText', 200],
      ['packageSizeText', 200],
    ];
    const excedido = topes.find(([campo, tope]) => {
      const valor = datos[campo];
      return typeof valor === 'string' && valor.length > tope;
    });
    if (excedido !== undefined) {
      return validation(`${excedido[0]} must be shorter than or equal to ${excedido[1]} characters`, [
        { field: excedido[0], message: `No puede pasar de ${excedido[1]} caracteres.` },
      ]);
    }
    const nuevo = productos.agregar({
      id: nuevoId('pharmacy-product'),
      pharmacyId,
      pharmacyName: farmacia.name,
      productCode: codigo,
      brandName: datos.brandName ?? null,
      genericName: datos.genericName ?? null,
      strengthText: datos.strengthText ?? null,
      packageSizeText: datos.packageSizeText ?? null,
      dosageForm: null,
      medication: null,
      medicationConceptId: null,
      requiresPrescription: datos.requiresPrescription ?? null,
      price: null,
      stock: 0,
    });
    return {
      status: 201,
      body: {
        id: nuevo.id,
        pharmacyId,
        productCode: nuevo.productCode,
        status: uuid('concept-pharm-product-active'),
        identifierCount: datos.identifiers?.length ?? 0,
        createdAt: ahora(),
      },
    };
  });

  // UC-24-09 · retiro (borrado lógico). Un producto ya retirado es un 412,
  // como `PreconditionFailedException('El producto no está activo')`.
  router.delete('/pharmacies/:pharmacyId/products/:productId', ({ params }) => {
    const producto = productos.get(params['productId']!);
    if (producto === undefined || producto.pharmacyId !== params['pharmacyId']) {
      return notFound('Producto no encontrado');
    }
    if (producto.retirado === true) {
      return preconditionFailed('El producto no está activo', { productId: producto.id });
    }
    productos.actualizar(producto.id, { retirado: true });
    return { ok: true };
  });

  // «Farmacia» · pestaña Comprar (25/09/2026): sedes sueltas, con su
  // ubicación, sin exigir productos de antemano. Reusa `FARMACIAS` y
  // `distanciaKm` tal cual los usa `/pharmacy-inventory/availability` — es
  // el mismo dato, sólo que acá se lista sin evaluarlo contra nada.
  router.get('/pharmacy/sites', ({ query }) => {
    const q = texto(query, 'search');
    const latTexto = query.get('lat');
    const lngTexto = query.get('lng');
    const origen = latTexto === null || lngTexto === null ? null : { lat: Number(latTexto), lng: Number(lngTexto) };
    const limit = Number(query.get('limit') ?? 50) || 50;
    const items = FARMACIAS
      .filter((f) => contiene(f.name, q) || contiene(f.siteName, q))
      .map((f) => ({
        siteId: f.siteId,
        siteName: f.siteName,
        pharmacyId: f.id,
        pharmacyName: f.name,
        addressText: f.addressText,
        latitude: f.lat,
        longitude: f.lng,
        distanceKm: origen === null ? null : distanciaKm(origen.lat, origen.lng, f.lat, f.lng),
        homeDeliveryAvailable: f.homeDelivery,
        pickupAvailable: true,
        productCount: productos.filtrar((p) => p.pharmacyId === f.id).length,
      }))
      .sort(
        (a, b) =>
          (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) ||
          a.pharmacyName.localeCompare(b.pharmacyName, 'es') ||
          a.siteName.localeCompare(b.siteName, 'es'),
      )
      .slice(0, limit);
    return { items, count: items.length };
  });

  // Carril A (Ola 0, 2026-09-25) · GET /pharmacy/sites/:siteId/prices — el
  // catálogo con precio real de una sede. `?product=` acota a un producto.
  // Cero números nuevos: todo sale de `productos`, igual que `/availability`.
  router.get('/pharmacy/sites/:siteId/prices', ({ params, query }) => {
    const siteId = params['siteId']!;
    const farmacia = FARMACIAS.find((f) => f.siteId === siteId);
    if (farmacia === undefined) return notFound('Sede de farmacia no encontrada');
    const productId = texto(query, 'product');
    const items = activos()
      .filter((p) => p.pharmacyId === farmacia.id && p.stock > 0)
      .filter((p) => productId === null || p.id === productId)
      .sort((a, b) => (a.genericName ?? a.productCode).localeCompare(b.genericName ?? b.productCode, 'es'))
      .map((p) => ({
        productId: p.id,
        productCode: p.productCode,
        brandName: p.brandName,
        genericName: p.genericName,
        strengthText: p.strengthText,
        packageSizeText: p.packageSizeText,
        medication: p.medication,
        requiresPrescription: p.requiresPrescription,
        unitAmount: p.price,
        patientAmount: p.price,
        currency: BOB,
        priceListCode: 'PUBLICO',
      }));
    return {
      siteId: farmacia.siteId,
      siteName: farmacia.siteName,
      pharmacyId: farmacia.id,
      pharmacyName: farmacia.name,
      items,
      count: items.length,
    };
  });

  router.get('/pharmacy-inventory/availability', ({ query }) => {
    // `products` es el nombre del contrato (`@Query('products')` en
    // `pharmacy-inventory-read.controller.ts`) y el que envía `PharmacyClient`;
    // el doble leía `productIds`, así que en la maqueta la disponibilidad no
    // filtraba nada. `productIds` queda como alias de lo que ya lo usara.
    const ids = (texto(query, 'products') ?? texto(query, 'productIds') ?? '').split(',').filter((x) => x !== '');
    const conceptos = ids.map((id) => productos.get(id)?.medicationConceptId ?? id);
    // Sin origen no hay distancia (`distanceKm: null`), como en la API: antes el
    // doble medía desde un punto fijo del centro y mostraba kilómetros que la
    // persona nunca pidió.
    const latTexto = query.get('lat') ?? query.get('originLat');
    const lngTexto = query.get('lng') ?? query.get('originLng');
    const origen = latTexto === null || lngTexto === null ? null : { lat: Number(latTexto), lng: Number(lngTexto) };
    const items = FARMACIAS.map((f) => {
      const enFarmacia = conceptos.map((conceptId) => activos().filter((p) => p.pharmacyId === f.id && p.medicationConceptId === conceptId)[0]);
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
        distanceKm: origen === null ? null : distanciaKm(origen.lat, origen.lng, f.lat, f.lng),
        homeDeliveryAvailable: f.homeDelivery,
        pickupAvailable: true,
        complete: faltantes.length === 0,
        availableCount: disponibles.length,
        missingProductIds: faltantes,
        totalAmount: total.toFixed(2),
        currency: BOB,
        products: disponibles.map((p) => ({ productId: p.id, productCode: p.productCode, brandName: p.brandName, genericName: p.genericName, strengthText: p.strengthText, packageSizeText: p.packageSizeText, medication: p.medication, availableQuantity: p.stock, price: { unitAmount: p.price, patientAmount: p.price, currency: BOB, priceListCode: 'PUBLICO' } })),
      };
    }).sort((a, b) => Number(b.complete) - Number(a.complete) || (a.distanceKm ?? 0) - (b.distanceKm ?? 0) || a.pharmacyName.localeCompare(b.pharmacyName, 'es'));
    return { requestedProductIds: ids, items, count: items.length };
  });

  router.get('/pharmacy/orders/me', (request) => {
    const items = pedidosVisibles(request).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((order) => dto(order, true));
    return { items, count: items.length };
  });

  router.get('/pharmacy/orders', ({ query }) => {
    const status = texto(query, 'status');
    const items = pedidos
      .todos()
      .filter((p) => status === null || p.estado === status || `PINV_ORDER_${p.estado}` === status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((order) => dto(order));
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

  router.get('/pharmacy/orders/:id', (request) => {
    const p = pedidos.get(request.params['id']!);
    return p === undefined ? notFound('Pedido no encontrado') : dto(p, p.patientProfileId === request.user?.patientProfileId);
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

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
productos.persistirEn('mock.pharmacy.productos');
pedidos.persistirEn('mock.pharmacy.pedidos');
