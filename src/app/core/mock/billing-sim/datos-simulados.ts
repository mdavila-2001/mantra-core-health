/* ============================================================================
    Los datos de arranque de la facturación SIMULADA: emisores ficticios y los
    cobros que salen de lo que la maqueta ya siembra.

    - **Emisores (CA-4):** ficticios, con NIT sintético. **No** se usan las
      farmacias del corpus «Bolivia Salud · Eje Central»: son establecimientos
      reales y no pueden figurar como emisores de una factura, ni simulada.
    - **Consultas:** las mismas reservas pagadas y los mismos montos que
      `GET /accounting/practitioner/paid-consultations` (`finance.handlers.ts`),
      para que contabilidad y facturación no se contradigan; y algunas reservas
      con pago pendiente, para poder registrar un pago.
    - **Farmacia:** los pedidos que la maqueta da por pagados en T-E4
      (`order-invoice.fixtures.ts`) — `pharmacy-order-1` y
      `pharmacy-copay-partial`— y dos pendientes. **`pharmacy-order-3` queda
      fuera** (decisión de Ender: ya tiene «Tu factura» de ejemplo).
    ========================================================================== */

import type {
  ChargeLine,
  SimulatedIssuer,
  SimulatedPayment,
  SuggestedBuyer,
} from '../../data-access/billing-simulated/billing-simulated.types';
import { reservas } from '../fixtures/agenda';
import { pacientePorId } from '../fixtures/personas';
import { renglonesDePedidoSimulado } from '../handlers/pharmacy.handlers';
import { uuid } from '../mock-store';
import { CATALOGOS_SIMULADOS } from '../siat-sim/catalogos-simulados';
import type { ContribuyenteSimulado } from '../siat-sim/siat-simulado.adapter';
import { subtotalDeRenglon, type CobroInicial, type EmisorSimulado } from './facturacion-simulada';

/** Unidad de medida 58, «unidad servicio»: la que la nota oficial pide para servicios. */
const UNIDAD_SERVICIO = 58;
/** Unidad para productos: código del catálogo **simulado**. */
const UNIDAD_PRODUCTO = 1;

function emisor(
  id: string,
  kind: SimulatedIssuer['kind'],
  nit: string,
  legalName: string,
  actividadEconomica: string,
  codigoProductoSin: number,
): EmisorSimulado {
  return {
    issuer: {
      id,
      kind,
      nit,
      legalName,
      municipality: 'Santa Cruz',
      address: 'AV. FICTICIA 100, ZONA DEMO (SIMULADO)',
      phone: null,
      branchCode: 0,
      pointOfSaleCode: 0,
      documentSector: 1,
      simulated: true,
    },
    codigoSistema: 'SIM-ALOVIDA-FACT',
    actividadEconomica,
    codigoProductoSin,
  };
}

export const EMISOR_CONSULTORIO = emisor(
  'emisor-consultorio-demo',
  'PRACTICE',
  '9990000011',
  'CONSULTORIO DEMO ALOVIDA (SIMULADO)',
  'SIM0001',
  99_100_001,
);

export const EMISOR_FARMACIA = emisor(
  'emisor-farmacia-demo',
  'PHARMACY',
  '9990000029',
  'FARMACIA DEMO ALOVIDA (SIMULADO)',
  'SIM0002',
  99_100_002,
);

export const EMISORES_SIMULADOS: readonly EmisorSimulado[] = [EMISOR_CONSULTORIO, EMISOR_FARMACIA];

/** El padrón del SIAT simulado: los mismos emisores, habilitados sólo en sector 1 (CA-1). */
export const PADRON_SIMULADO: readonly ContribuyenteSimulado[] = EMISORES_SIMULADOS.map((e) => ({
  nit: e.issuer.nit,
  razonSocial: e.issuer.legalName,
  codigoSistema: e.codigoSistema,
  direccion: e.issuer.address,
  sucursales: [e.issuer.branchCode],
  puntosDeVenta: [e.issuer.pointOfSaleCode],
  sectoresHabilitados: [1],
}));

function metodo(codigo: number): string {
  return CATALOGOS_SIMULADOS.metodosDePago.find((m) => m.codigo === codigo)!.descripcion;
}

function pago(semilla: string, methodCode: number, amount: string, paidAt: string): SimulatedPayment {
  return { id: uuid(`pago-${semilla}`), methodCode, methodLabel: metodo(methodCode), amount, currency: 'BOB', paidAt, simulated: true };
}

function compradorSugerido(patientProfileId: string, nombre: string): SuggestedBuyer {
  const paciente = pacientePorId(patientProfileId);
  return {
    name: paciente?.displayName ?? nombre,
    // Código 1 del catálogo SIMULADO de documentos (cédula de identidad).
    documentTypeCode: 1,
    documentNumber: paciente?.nationalId ?? '',
    email: paciente?.email ?? null,
  };
}

function renglonDeConsulta(monto: string, fecha: string): ChargeLine {
  return {
    productCode: 'CONSULTA-MEDICA',
    description: `Consulta médica ambulatoria · ${fecha}`,
    quantity: '1',
    unitOfMeasure: UNIDAD_SERVICIO,
    unitPrice: monto,
    discount: null,
    subtotal: subtotalDeRenglon('1', monto, null),
  };
}

function cobrosDeConsultas(): CobroInicial[] {
  // Mismo criterio y mismos montos que `paid-consultations` (finance.handlers.ts).
  const pagadas = reservas.filtrar((r) => r.paymentState?.state === 'PAID').slice(0, 8);
  const pendientes = reservas.filtrar((r) => r.paymentState?.state === 'PENDING').slice(0, 3);
  const cobro = (r: (typeof pagadas)[number], monto: string, pagado: SimulatedPayment | null): CobroInicial => {
    const fecha = r.startAt.slice(0, 10);
    return {
      id: uuid(`cobro-consulta-${r.id}`),
      source: 'CONSULTATION',
      sourceRef: r.appointmentId ?? r.id,
      issuerId: EMISOR_CONSULTORIO.issuer.id,
      patientProfileId: r.patientProfileId,
      patientName: r.patientName,
      description: `Consulta médica · ${fecha}`,
      lines: [renglonDeConsulta(monto, fecha)],
      createdAt: r.startAt,
      suggestedBuyer: compradorSugerido(r.patientProfileId, r.patientName),
      payment: pagado,
    };
  };
  return [
    ...pagadas.map((r, i) => {
      const monto = i % 3 === 0 ? '180.00' : '250.00';
      return cobro(r, monto, pago(`consulta-${r.id}`, i % 2 === 0 ? 1 : 2, monto, r.startAt));
    }),
    ...pendientes.map((r) => cobro(r, '250.00', null)),
  ];
}

/** Pedidos pagados en T-E4 (minutos entre envío y pago) y pendientes de pago. */
const PEDIDOS_PAGADOS: readonly (readonly [string, number])[] = [
  ['pharmacy-order-1', 4],
  ['pharmacy-copay-partial', 3],
];
const PEDIDOS_PENDIENTES: readonly string[] = ['pharmacy-order-5', 'pharmacy-order-6'];

function cobroDePedido(semilla: string, minutosHastaElPago: number | null): CobroInicial | null {
  const id = uuid(semilla);
  const pedido = renglonesDePedidoSimulado(id);
  if (pedido === null) return null;
  const lines: ChargeLine[] = pedido.lineas.map((l) => ({
    productCode: l.productCode,
    description: l.descripcion,
    quantity: String(l.cantidad),
    unitOfMeasure: UNIDAD_PRODUCTO,
    unitPrice: l.precioUnitario,
    discount: null,
    subtotal: subtotalDeRenglon(String(l.cantidad), l.precioUnitario, null),
  }));
  const total = lines.reduce((s, l) => s + Number(l.subtotal), 0).toFixed(2);
  const pagadoEl =
    minutosHastaElPago === null ? null : new Date(new Date(pedido.createdAt).getTime() + minutosHastaElPago * 60_000).toISOString();
  return {
    id: uuid(`cobro-farmacia-${semilla}`),
    source: 'PHARMACY',
    sourceRef: id,
    issuerId: EMISOR_FARMACIA.issuer.id,
    patientProfileId: pedido.patientProfileId,
    patientName: pedido.patientName,
    description: `Pedido de farmacia ${pedido.pickupCode}`,
    lines,
    createdAt: pedido.createdAt,
    suggestedBuyer: compradorSugerido(pedido.patientProfileId, pedido.patientName),
    // El pago de T-E4 fue por QR: código 3 del catálogo simulado.
    payment: pagadoEl === null ? null : pago(`farmacia-${semilla}`, 3, total, pagadoEl),
  };
}

function cobrosDeFarmacia(): CobroInicial[] {
  return [
    ...PEDIDOS_PAGADOS.map(([semilla, minutos]) => cobroDePedido(semilla, minutos)),
    ...PEDIDOS_PENDIENTES.map((semilla) => cobroDePedido(semilla, null)),
  ].filter((c): c is CobroInicial => c !== null);
}

export function cobrosIniciales(): CobroInicial[] {
  return [...cobrosDeConsultas(), ...cobrosDeFarmacia()];
}
