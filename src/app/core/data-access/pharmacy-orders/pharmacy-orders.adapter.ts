import type {
  AjusteDeLinea,
  EnvioDePedido,
  EstadoDePedido,
  ModalidadDeEntrega,
  PedidoFarmacia,
  RegistroDeRetiro,
} from './pharmacy-orders.types';
import type {
  ConfirmPharmacyOrderDto,
  CreatePharmacyOrderDto,
  DispensePharmacyOrderDto,
  PharmacyOrderDto,
} from './pharmacy-orders.dto';

const ORDER_STATUS_BY_API_CODE: Readonly<Record<string, EstadoDePedido>> = {
  PINV_ORDER_ENVIADO: 'ENVIADO',
  PINV_ORDER_EN_REVISION: 'EN_REVISION',
  PINV_ORDER_CONFIRMADO: 'CONFIRMADO',
  PINV_ORDER_ACEPTACION_PENDIENTE: 'ACEPTACION_PENDIENTE',
  PINV_ORDER_ACEPTADO: 'ACEPTADO',
  PINV_ORDER_LISTO_PARA_RETIRO: 'LISTO_PARA_RETIRO',
  PINV_ORDER_RETIRADO: 'RETIRADO',
  PINV_ORDER_RECHAZADO: 'RECHAZADO',
  PINV_ORDER_VENCIDO: 'VENCIDO',
  PINV_ORDER_CANCELADO: 'CANCELADO',
};

const DELIVERY_MODE_BY_API_CODE: Readonly<Record<string, ModalidadDeEntrega>> = {
  PINV_DELIVERY_RETIRO: 'RETIRO',
  PINV_DELIVERY_DOMICILIO: 'DOMICILIO',
  PINV_DELIVERY_TRABAJO: 'TRABAJO',
};

const UNAVAILABLE_LINE_CODES = new Set(['PINV_RES_LINE_OUT_OF_STOCK', 'PINV_RES_LINE_RELEASED']);

/** The unresolved product policy is deliberately isolated here. */
export class UnsupportedPharmacyOrderLineError extends Error {
  constructor() {
    super('El pedido contiene medicamentos sin un producto publicado.');
    this.name = 'UnsupportedPharmacyOrderLineError';
  }
}

export function pharmacyOrderFromDto(
  dto: PharmacyOrderDto,
  viewer: 'owner' | 'staff' = 'owner',
): PedidoFarmacia {
  return {
    id: dto.id,
    estado: requiredOrderStatus(dto.status.code),
    creadoEl: requiredDate(dto.createdAt, 'createdAt'),
    venceEl: requiredDate(dto.expiresAt, 'expiresAt'),
    pharmacyId: dto.pharmacyId,
    farmacia: dto.pharmacyName,
    sede: dto.siteName,
    direccion: null,
    modalidad: deliveryModeFromDto(dto.deliveryMode?.code),
    direccionDeEntrega: null,
    paciente: dto.patientName,
    prescriptor: null,
    lineas: dto.lines.map((line) => ({
      productId: line.productId,
      conceptId: line.medicationConceptId,
      medicationCode: line.medication?.code,
      medicamento: line.brandName ?? line.genericName ?? line.productCode,
      presentacion: presentationOf(line.strengthText, line.packageSizeText),
      cantidad: line.requestedQuantity,
      reservedQuantity: line.reservedQuantity,
      fulfilledQuantity: line.fulfilledQuantity,
      precio: line.unitPriceAmount,
      moneda: line.currency?.code ?? null,
      disponible: !UNAVAILABLE_LINE_CODES.has(line.status.code),
    })),
    totalEstimado: dto.totalAmount,
    moneda: dto.currency?.code ?? null,
    codigoDeRetiro: viewer === 'staff' ? null : dto.pickupCode,
    motivoDeRechazo: dto.rejectionReasonText,
    // The API returns newest first; the adapter preserves that order.
    sustituciones: dto.substitutions.map((substitution) => ({
      id: substitution.id,
      original: {
        nombre: substitution.originalName,
        precio: substitution.originalUnitPriceAmount,
      },
      propuesta: {
        productId: substitution.proposedProductId,
        nombre: substitution.proposedName,
        precio: substitution.proposedUnitPriceAmount,
      },
      moneda: substitution.currency?.code ?? null,
    })),
    // FAR-E4/payment/delivery history are not represented by PharmacyOrderDto.
    envio: null,
    entregas: [],
    pago: null,
    requestId: dto.medicationRequestId,
    siteId: dto.siteId,
  };
}

export function createOrderRequest(
  order: EnvioDePedido,
  idempotencyKey: string,
): CreatePharmacyOrderDto {
  if (order.modalidad !== 'RETIRO') {
    throw new Error('La integración real solo admite retiro en farmacia.');
  }
  if (order.borrador.lineas.some((line) => line.productId === null)) {
    throw new UnsupportedPharmacyOrderLineError();
  }
  return {
    siteId: order.borrador.siteId,
    ...(order.borrador.requestId === '' ? {} : { medicationRequestId: order.borrador.requestId }),
    deliveryMode: 'RETIRO',
    idempotencyKey,
    lines: order.borrador.lineas.map((line) => {
      if (line.productId === null) throw new UnsupportedPharmacyOrderLineError();
      return { productId: line.productId, quantity: line.cantidad };
    }),
  };
}

export function confirmOrderRequest(
  order: PedidoFarmacia,
  adjustments: readonly AjusteDeLinea[],
): ConfirmPharmacyOrderDto {
  const changed: {
    productId: string;
    decision: 'NO_DISPONIBLE' | 'PROPONER_GENERICO';
    proposedProductId?: string;
  }[] = [];
  for (const adjustment of adjustments) {
    if (adjustment.decision === 'TAL_CUAL') continue;
    const line = order.lineas[adjustment.indice];
    if (!line?.productId) {
      throw new Error('El ajuste no corresponde a un producto del pedido.');
    }
    if (adjustment.decision === 'PROPONER_GENERICO') {
      const proposedProductId = adjustment.propuesta?.productId;
      if (!proposedProductId) {
        throw new Error('La sustitución requiere un producto publicado.');
      }
      changed.push({
        productId: line.productId,
        decision: adjustment.decision,
        proposedProductId,
      });
      continue;
    }
    changed.push({ productId: line.productId, decision: adjustment.decision });
  }
  return changed.length === 0 ? {} : { adjustments: changed };
}

export function dispenseOrderRequest(
  order: PedidoFarmacia,
  withdrawal: RegistroDeRetiro,
  idempotencyKey: string,
): DispensePharmacyOrderDto {
  const productIds = withdrawal.indices.map((index) => {
    const productId = order.lineas[index]?.productId;
    if (!productId) throw new Error('El retiro refiere una línea inválida.');
    return productId;
  });
  return {
    pickupCode: withdrawal.codigo,
    productIds,
    idempotencyKey,
  };
}

function requiredOrderStatus(code: string): EstadoDePedido {
  const status = ORDER_STATUS_BY_API_CODE[code];
  if (!status) throw new Error(`Estado de pedido desconocido: ${code}`);
  return status;
}

function deliveryModeFromDto(code: string | undefined): ModalidadDeEntrega | null {
  if (code === undefined) return null;
  const mode = DELIVERY_MODE_BY_API_CODE[code];
  if (!mode) throw new Error(`Modalidad de entrega desconocida: ${code}`);
  return mode;
}

function requiredDate(value: string, field: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha inválida en ${field}`);
  return date;
}

function presentationOf(strength: string | null, packageSize: string | null): string | null {
  const parts = [strength, packageSize].filter((part): part is string => Boolean(part));
  return parts.length === 0 ? null : parts.join(' · ');
}
