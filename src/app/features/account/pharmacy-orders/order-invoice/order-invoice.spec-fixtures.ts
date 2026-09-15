import type { PatientInsuranceSettlement } from '../../../../core/data-access/insurance/patient-insurance-settlement.types';
import type {
  LineaDePedido,
  PedidoFarmacia,
} from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.types';
import type { DocumentoDeFactura } from './order-invoice.types';

/** Datos de prueba de T-E4: un pedido como lo entrega el adaptador y una factura armada. */

export function lineaDePrueba(extra: Partial<LineaDePedido> = {}): LineaDePedido {
  return {
    productId: '00000000-0000-4000-8000-000000000004',
    conceptId: null,
    medicamento: 'Amoxicilina',
    presentacion: '500 mg',
    cantidad: 1,
    precio: '68.00',
    moneda: 'BOB',
    disponible: true,
    ...extra,
  };
}

/** Como lo entrega el adaptador: sin pago, sin envío, sin entregas. */
export function pedidoDePrueba(extra: Partial<PedidoFarmacia> = {}): PedidoFarmacia {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    estado: 'RETIRADO',
    creadoEl: new Date('2026-09-03T14:00:00.000Z'),
    venceEl: null,
    farmacia: 'Farmacia Andina',
    sede: 'Sucursal Centro',
    direccion: null,
    modalidad: 'RETIRO',
    direccionDeEntrega: null,
    paciente: 'Ana Paciente',
    prescriptor: null,
    lineas: [lineaDePrueba()],
    totalEstimado: '68.00',
    moneda: 'BOB',
    codigoDeRetiro: null,
    motivoDeRechazo: null,
    sustituciones: [],
    envio: null,
    entregas: [],
    pago: null,
    requestId: null,
    siteId: '00000000-0000-4000-8000-000000000002',
    pharmacyId: '00000000-0000-4000-8000-000000000003',
    insuranceSettlementAvailability: 'NOT_AVAILABLE',
    insuranceSettlement: null,
    ...extra,
  };
}

/** Una liquidación publicada completa, como la normaliza el adaptador. */
export function liquidacionDePrueba(
  extra: Partial<PatientInsuranceSettlement> = {},
): PatientInsuranceSettlement {
  return {
    claimId: 'claim-1',
    claimIdentifier: 'RC-2026-0001',
    adjudicationVersionId: 'adj-1',
    adjudicationVersion: 1,
    eobId: 'eob-1',
    carrierName: 'Seguros Bolívar',
    policyIdentifier: 'POL-77',
    totalBilledAmount: '68.00',
    totalApprovedAmount: '54.40',
    totalPatientAmount: '13.60',
    totalDeniedAmount: '0.00',
    currencyCode: 'BOB',
    result: 'APPROVED',
    exclusions: [],
    ...extra,
  };
}

export function facturaDePrueba(extra: Partial<DocumentoDeFactura> = {}): DocumentoDeFactura {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    numero: '04213377',
    emitidaEl: new Date('2026-09-04T16:00:00.000Z'),
    estado: 'Enviada al paciente',
    emisor: {
      nombre: 'Farmacia Andina',
      detalle: 'Sucursal Centro',
      razonSocial: 'Farmacia Andina',
      nit: '1028394027',
    },
    comprador: { nombre: 'Ana Paciente', documento: 'CI 4832915 SC' },
    lineas: [{ descripcion: 'Amoxicilina · 500 mg', cantidad: 1, importe: '68.00' }],
    subtotal: '68.00',
    descuentoDeRed: '6.80',
    coaseguro: null,
    total: '61.20',
    moneda: 'BOB',
    ...extra,
  };
}
