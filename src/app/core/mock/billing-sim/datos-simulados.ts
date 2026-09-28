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
    - **Consultas con reconsultas (plan de pagos):** el tipo de servicio
      `CONS-CARDIO-RECONS` implica una consulta y dos reconsultas, y se cobra
      por instancia con nota de venta hasta saldarse. Salen de las reservas que
      ya tienen una reconsulta agendada (la instancia «Reconsulta 1» apunta a
      ella) y de las que la agenda marca «Pago parcial».
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
import type { SimulatedSalesNote } from '../../data-access/billing-simulated/billing-simulated.types';
import { reservas, type ReservaSimulada } from '../fixtures/agenda';
import { PACIENTE, pacientePorId } from '../fixtures/personas';
import { renglonesDePedidoSimulado } from '../handlers/pharmacy.handlers';
import { uuid } from '../mock-store';
import { CATALOGOS_SIMULADOS } from '../siat-sim/catalogos-simulados';
import type { ContribuyenteSimulado } from '../siat-sim/siat-simulado.adapter';
import {
  renglonesDelPlan,
  subtotalDeRenglon,
  type CobroInicial,
  type EmisorSimulado,
  type InstanciaDePlan,
  type PlanDeCobro,
} from './facturacion-simulada';

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

/**
 * El tipo de servicio que **implica más de una instancia de pago**: la
 * consulta y la serie de reconsultas que incluye. Los precios son los del
 * catálogo de la práctica (`CONS-CARDIO` y `CONS-CONTROL`,
 * `practice.handlers.ts`).
 *
 * TODO(FACT-SIAT-MOCK): el catálogo de servicios de la API no dice cuántas
 * reconsultas incluye un servicio; mientras no lo diga, el tipo se declara acá.
 */
export const SERVICIO_CON_RECONSULTAS = {
  code: 'CONS-CARDIO-RECONS',
  name: 'Consulta cardiológica con 2 reconsultas',
  reconsultas: 2,
  precioDeReconsulta: '180.00',
} as const;

/** Cuántos cobros con plan salen de las reservas «Pago parcial». */
const PLANES_DE_PAGO_PARCIAL = 4;

function notaDeVenta(semilla: string, numero: number, instanceId: string, methodCode: number, amount: string, issuedAt: string): SimulatedSalesNote {
  return {
    id: uuid(`nota-${semilla}`),
    number: `NV-${String(numero).padStart(6, '0')}`,
    instanceId,
    amount,
    methodCode,
    methodLabel: metodo(methodCode),
    issuedAt,
    simulated: true,
  };
}

function cobrosDeConsultas(): CobroInicial[] {
  // Mismo criterio y mismos montos que `paid-consultations` (finance.handlers.ts).
  const pagadas = reservas.filtrar((r) => r.paymentState?.state === 'PAID').slice(0, 8);
  const pendientes = reservas.filtrar((r) => r.paymentState?.state === 'PENDING').slice(0, 3);
  // Atendiéndose ahora y todavía sin pago: el caso de «cobrar y facturar» de una vez.
  const enAtencion = reservas.filtrar((r) => r.checkedInAt !== null && r.paymentState === null && r.followUpOf === null).slice(0, 3);
  // La reconsulta agendada de cada reserva de origen.
  const reconsultaDe = new Map(
    reservas.filtrar((r) => r.followUpOf !== null).map((r) => [r.followUpOf!.bookingId, r]),
  );
  const cobro = (r: ReservaSimulada, monto: string, pagado: SimulatedPayment | null): CobroInicial => {
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
  // Las notas de venta sembradas numeran de corrido, como lo haría el emisor.
  let ultimaNota = 0;
  const conPlan = (r: ReservaSimulada, montoDeConsulta: string, variante: number): CobroInicial => {
    const reconsulta = reconsultaDe.get(r.id) ?? null;
    const instancias: InstanciaDePlan[] = [
      { id: uuid(`instancia-${r.id}-1`), kind: 'CONSULTATION', label: 'Consulta inicial', expectedAmount: montoDeConsulta, bookingId: r.id, scheduledAt: r.startAt, salesNotes: [] },
      ...Array.from({ length: SERVICIO_CON_RECONSULTAS.reconsultas }, (_, k): InstanciaDePlan => ({
        id: uuid(`instancia-${r.id}-${k + 2}`),
        kind: 'FOLLOW_UP',
        label: `Reconsulta ${k + 1}`,
        expectedAmount: SERVICIO_CON_RECONSULTAS.precioDeReconsulta,
        bookingId: k === 0 ? (reconsulta?.id ?? null) : null,
        scheduledAt: k === 0 ? (reconsulta?.startAt ?? null) : null,
        salesNotes: [],
      })),
    ];
    // La consulta se pagó entera el día que se atendió; en la mitad de los
    // planes, la primera reconsulta tiene además un pago a cuenta.
    const [consulta, primera, ...resto] = instancias;
    const pagos: InstanciaDePlan[] = [
      { ...consulta!, salesNotes: [notaDeVenta(`${r.id}-1`, ++ultimaNota, consulta!.id, variante % 2 === 0 ? 1 : 3, montoDeConsulta, r.endAt)] },
      variante % 2 === 1
        ? { ...primera!, salesNotes: [notaDeVenta(`${r.id}-2`, ++ultimaNota, primera!.id, 1, '100.00', r.endAt)] }
        : primera!,
      ...resto,
    ];
    const plan: PlanDeCobro = { serviceCode: SERVICIO_CON_RECONSULTAS.code, serviceName: SERVICIO_CON_RECONSULTAS.name, instances: pagos };
    return {
      ...cobro(r, montoDeConsulta, null),
      description: `${SERVICIO_CON_RECONSULTAS.name} · ${r.startAt.slice(0, 10)}`,
      lines: renglonesDelPlan(plan),
      plan,
    };
  };

  // La paciente de la demo tiene además una consulta suelta pagada y sin
  // facturar: así «Pagos» muestra los dos caminos —la tabla del plan y el modal
  // de la factura— en la misma consulta.
  const usadas = new Set(pagadas.map((r) => r.id));
  const sueltaDeLaDemo = reservas
    .filtrar((r) => r.patientProfileId === PACIENTE.id && r.paymentState?.state === 'PAID' && !usadas.has(r.id) && !reconsultaDe.has(r.id))
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .slice(0, 1);

  const parciales = reservas
    .filtrar((r) => r.paymentState?.state === 'PARTIALLY_PAID' && !reconsultaDe.has(r.id))
    .slice(0, PLANES_DE_PAGO_PARCIAL);

  return [
    ...pagadas.map((r, i) => {
      const monto = i % 3 === 0 ? '180.00' : '250.00';
      // Una consulta pagada que ya tiene su reconsulta agendada es un servicio
      // con plan. La consulta vale lo mismo que en `paid-consultations`: lo que
      // contabilidad da por pagado es la nota de venta de la consulta inicial.
      if (reconsultaDe.has(r.id)) return conPlan(r, monto, 0);
      return cobro(r, monto, pago(`consulta-${r.id}`, i % 2 === 0 ? 1 : 2, monto, r.startAt));
    }),
    ...sueltaDeLaDemo.map((r) => cobro(r, '250.00', pago(`consulta-${r.id}`, 2, '250.00', r.endAt))),
    ...parciales.map((r, i) => conPlan(r, '250.00', i + 1)),
    ...[...pendientes, ...enAtencion].map((r) => cobro(r, '250.00', null)),
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
