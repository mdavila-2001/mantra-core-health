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
import { RECURSO_CONSULTORIO_MEDICA, recursos, reservas, type ReservaSimulada } from '../fixtures/agenda';
import { MEDICAL, PACIENTE, patientById } from '../fixtures/people';
import { renglonesDePedidoSimulado } from '../handlers/pharmacy.handlers';
import { uuid } from '../mock-store';
import { SIMULATED_CATALOGS } from '../siat-sim/simulated-catalogs';
import type { SimulatedTaxpayer } from '../siat-sim/siat-simulated.adapter';
import {
  planLines,
  lineSubtotal,
  type InitialCharge,
  type EmisorSimulado,
  type PlanInstance,
  type ChargePlan,
} from './simulated-invoicing';

/** Unidad de medida 58, «unidad servicio»: la que la nota oficial pide para servicios. */
const SERVICE_UNIT = 58;
/** Unidad para productos: código del catálogo **simulado**. */
const PRODUCT_UNIT = 1;

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

export const PRACTICE_ISSUER = emisor(
  'emisor-consultorio-demo',
  'PRACTICE',
  '9990000011',
  'CONSULTORIO DEMO ALOVIDA (SIMULADO)',
  'SIM0001',
  99_100_001,
);

export const PHARMACY_ISSUER = emisor(
  'emisor-farmacia-demo',
  'PHARMACY',
  '9990000029',
  'FARMACIA DEMO ALOVIDA (SIMULADO)',
  'SIM0002',
  99_100_002,
);

export const SIMULATED_ISSUERS: readonly EmisorSimulado[] = [PRACTICE_ISSUER, PHARMACY_ISSUER];

/** El padrón del SIAT simulado: los mismos emisores, habilitados sólo en sector 1 (CA-1). */
export const SIMULATED_REGISTRY: readonly SimulatedTaxpayer[] = SIMULATED_ISSUERS.map((e) => ({
  nit: e.issuer.nit,
  razonSocial: e.issuer.legalName,
  codigoSistema: e.codigoSistema,
  direccion: e.issuer.address,
  sucursales: [e.issuer.branchCode],
  puntosDeVenta: [e.issuer.pointOfSaleCode],
  sectoresHabilitados: [1],
}));

function method(codigo: number): string {
  return SIMULATED_CATALOGS.metodosDePago.find((m) => m.codigo === codigo)!.descripcion;
}

function pago(semilla: string, methodCode: number, amount: string, paidAt: string): SimulatedPayment {
  return { id: uuid(`pago-${semilla}`), methodCode, methodLabel: method(methodCode), amount, currency: 'BOB', paidAt, simulated: true };
}

function compradorSugerido(patientProfileId: string, nombre: string): SuggestedBuyer {
  const paciente = patientById(patientProfileId);
  return {
    name: paciente?.displayName ?? nombre,
    // Código 1 del catálogo SIMULADO de documentos (cédula de identidad).
    documentTypeCode: 1,
    documentNumber: paciente?.nationalId ?? '',
    email: paciente?.email ?? null,
  };
}

function consultationLine(monto: string, fecha: string): ChargeLine {
  return {
    productCode: 'CONSULTA-MEDICA',
    description: `Consulta médica ambulatoria · ${fecha}`,
    quantity: '1',
    unitOfMeasure: SERVICE_UNIT,
    unitPrice: monto,
    discount: null,
    subtotal: lineSubtotal('1', monto, null),
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
export const SERVICE_WITH_RECONSULTATIONS = {
  code: 'CONS-CARDIO-RECONS',
  name: 'Consulta cardiológica con 2 reconsultas',
  reconsultas: 2,
  precioDeReconsulta: '180.00',
} as const;

/** Cuántos cobros con plan salen de las reservas «Pago parcial». */
const PARTIAL_PAYMENT_PLANS = 4;

function saleNote(semilla: string, numero: number, instanceId: string, methodCode: number, amount: string, issuedAt: string): SimulatedSalesNote {
  return {
    id: uuid(`nota-${semilla}`),
    number: `NV-${String(numero).padStart(6, '0')}`,
    instanceId,
    amount,
    methodCode,
    methodLabel: method(methodCode),
    issuedAt,
    simulated: true,
  };
}

/**
 * Quien atendió la reserva: el profesional al que apunta su agenda. El
 * consultorio de la médica es una agenda de sala, así que se resuelve a ella.
 */
function professionalOf(r: ReservaSimulada): string | null {
  const recurso = recursos.get(r.resourceId);
  if (recurso?.resourceRefType === 'health_practitioner_profiles') return recurso.resourceRefId;
  return r.resourceId === RECURSO_CONSULTORIO_MEDICA ? MEDICAL.id : null;
}

function consultationCharges(): InitialCharge[] {
  // Mismo criterio y mismos montos que `paid-consultations` (finance.handlers.ts).
  const pagadas = reservas.filtrar((r) => r.paymentState?.state === 'PAID').slice(0, 8);
  const pendientes = reservas.filtrar((r) => r.paymentState?.state === 'PENDING').slice(0, 3);
  // Atendiéndose ahora y todavía sin pago: el caso de «cobrar y facturar» de una vez.
  const enAtencion = reservas.filtrar((r) => r.checkedInAt !== null && r.paymentState === null && r.followUpOf === null).slice(0, 3);
  // La reconsulta agendada de cada reserva de origen.
  const reconsultaDe = new Map(
    reservas.filtrar((r) => r.followUpOf !== null).map((r) => [r.followUpOf!.bookingId, r]),
  );
  const cobro = (r: ReservaSimulada, monto: string, pagado: SimulatedPayment | null): InitialCharge => {
    const fecha = r.startAt.slice(0, 10);
    return {
      id: uuid(`cobro-consulta-${r.id}`),
      source: 'CONSULTATION',
      sourceRef: r.appointmentId ?? r.id,
      issuerId: PRACTICE_ISSUER.issuer.id,
      patientProfileId: r.patientProfileId,
      patientName: r.patientName,
      practitionerProfileId: professionalOf(r),
      description: `Consulta médica · ${fecha}`,
      lines: [consultationLine(monto, fecha)],
      createdAt: r.startAt,
      suggestedBuyer: compradorSugerido(r.patientProfileId, r.patientName),
      payment: pagado,
    };
  };
  // Las notas de venta sembradas numeran de corrido, como lo haría el emisor.
  let ultimaNota = 0;
  const conPlan = (r: ReservaSimulada, montoDeConsulta: string, variante: number): InitialCharge => {
    const reconsulta = reconsultaDe.get(r.id) ?? null;
    const instancias: PlanInstance[] = [
      { id: uuid(`instancia-${r.id}-1`), kind: 'CONSULTATION', label: 'Consulta inicial', expectedAmount: montoDeConsulta, bookingId: r.id, scheduledAt: r.startAt, salesNotes: [] },
      ...Array.from({ length: SERVICE_WITH_RECONSULTATIONS.reconsultas }, (_, k): PlanInstance => ({
        id: uuid(`instancia-${r.id}-${k + 2}`),
        kind: 'FOLLOW_UP',
        label: `Reconsulta ${k + 1}`,
        expectedAmount: SERVICE_WITH_RECONSULTATIONS.precioDeReconsulta,
        bookingId: k === 0 ? (reconsulta?.id ?? null) : null,
        scheduledAt: k === 0 ? (reconsulta?.startAt ?? null) : null,
        salesNotes: [],
      })),
    ];
    // La consulta se pagó entera el día que se atendió; en la mitad de los
    // planes, la primera reconsulta tiene además un pago a cuenta.
    const [consulta, primera, ...resto] = instancias;
    const pagos: PlanInstance[] = [
      { ...consulta!, salesNotes: [saleNote(`${r.id}-1`, ++ultimaNota, consulta!.id, variante % 2 === 0 ? 1 : 3, montoDeConsulta, r.endAt)] },
      variante % 2 === 1
        ? { ...primera!, salesNotes: [saleNote(`${r.id}-2`, ++ultimaNota, primera!.id, 1, '100.00', r.endAt)] }
        : primera!,
      ...resto,
    ];
    const plan: ChargePlan = { serviceCode: SERVICE_WITH_RECONSULTATIONS.code, serviceName: SERVICE_WITH_RECONSULTATIONS.name, instances: pagos };
    return {
      ...cobro(r, montoDeConsulta, null),
      description: `${SERVICE_WITH_RECONSULTATIONS.name} · ${r.startAt.slice(0, 10)}`,
      lines: planLines(plan),
      plan,
    };
  };

  const usadas = new Set(pagadas.map((r) => r.id));
  // Toda consulta atendida con su reconsulta ya agendada es un servicio con
  // plan, esté o no entre las que `paid-consultations` da por pagadas: las
  // reservas se generan relativas a hoy, y atarlo a esa lista hacía que el
  // plan desapareciera con el correr de los días.
  const origenesFuera = reservas.filtrar(
    (r) => reconsultaDe.has(r.id) && !usadas.has(r.id) && r.paymentState !== null,
  );

  // La paciente de la demo tiene además un servicio de una sola instancia sin
  // cobrar —el electrocardiograma que se le hizo en su última consulta con la
  // médica de la demo, que es quien abre la consulta—: así «Pagos» muestra los
  // dos caminos juntos, la tabla del plan y el modal que cobra y factura.
  const ultimaDeLaDemo = reservas
    .filtrar((r) => r.patientProfileId === PACIENTE.id && r.paymentState !== null && professionalOf(r) === MEDICAL.id)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))[0];
  const ecgDeLaDemo = ultimaDeLaDemo === undefined ? [] : [electrocardiograma(ultimaDeLaDemo)];

  const parciales = reservas
    .filtrar((r) => r.paymentState?.state === 'PARTIALLY_PAID' && !reconsultaDe.has(r.id))
    .slice(0, PARTIAL_PAYMENT_PLANS);

  return [
    ...pagadas.map((r, i) => {
      const monto = i % 3 === 0 ? '180.00' : '250.00';
      // Una consulta pagada que ya tiene su reconsulta agendada es un servicio
      // con plan. La consulta vale lo mismo que en `paid-consultations`: lo que
      // contabilidad da por pagado es la nota de venta de la consulta inicial.
      if (reconsultaDe.has(r.id)) return conPlan(r, monto, 0);
      return cobro(r, monto, pago(`consulta-${r.id}`, i % 2 === 0 ? 1 : 2, monto, r.startAt));
    }),
    ...origenesFuera.map((r) => conPlan(r, '250.00', r.paymentState?.state === 'PARTIALLY_PAID' ? 1 : 0)),
    ...ecgDeLaDemo,
    ...parciales.map((r, i) => conPlan(r, '250.00', i + 1)),
    ...[...pendientes, ...enAtencion].map((r) => cobro(r, '250.00', null)),
  ];

  /** El electrocardiograma (`ECG` del catálogo, Bs 120) hecho en esa consulta, todavía sin cobrar. */
  function electrocardiograma(r: ReservaSimulada): InitialCharge {
    const fecha = r.startAt.slice(0, 10);
    return {
      ...cobro(r, '120.00', null),
      id: uuid(`cobro-ecg-${r.id}`),
      description: `Electrocardiograma · ${fecha}`,
      lines: [
        {
          productCode: 'ECG',
          description: `Electrocardiograma de 12 derivaciones · ${fecha}`,
          quantity: '1',
          unitOfMeasure: SERVICE_UNIT,
          unitPrice: '120.00',
          discount: null,
          subtotal: lineSubtotal('1', '120.00', null),
        },
      ],
    };
  }
}

/** Pedidos pagados en T-E4 (minutos entre envío y pago) y pendientes de pago. */
const PAID_ORDERS: readonly (readonly [string, number])[] = [
  ['pharmacy-order-1', 4],
  ['pharmacy-copay-partial', 3],
];
const PENDING_ORDERS: readonly string[] = ['pharmacy-order-5', 'pharmacy-order-6'];

function orderCharge(semilla: string, minutosHastaElPago: number | null): InitialCharge | null {
  const id = uuid(semilla);
  const pedido = renglonesDePedidoSimulado(id);
  if (pedido === null) return null;
  const lines: ChargeLine[] = pedido.lineas.map((l) => ({
    productCode: l.productCode,
    description: l.descripcion,
    quantity: String(l.cantidad),
    unitOfMeasure: PRODUCT_UNIT,
    unitPrice: l.precioUnitario,
    discount: null,
    subtotal: lineSubtotal(String(l.cantidad), l.precioUnitario, null),
  }));
  const total = lines.reduce((s, l) => s + Number(l.subtotal), 0).toFixed(2);
  const pagadoEl =
    minutosHastaElPago === null ? null : new Date(new Date(pedido.createdAt).getTime() + minutosHastaElPago * 60_000).toISOString();
  return {
    id: uuid(`cobro-farmacia-${semilla}`),
    source: 'PHARMACY',
    sourceRef: id,
    issuerId: PHARMACY_ISSUER.issuer.id,
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

function pharmacyCharges(): InitialCharge[] {
  return [
    ...PAID_ORDERS.map(([semilla, minutos]) => orderCharge(semilla, minutos)),
    ...PENDING_ORDERS.map((semilla) => orderCharge(semilla, null)),
  ].filter((c): c is InitialCharge => c !== null);
}

export function initialCharges(): InitialCharge[] {
  return [...consultationCharges(), ...pharmacyCharges()];
}
