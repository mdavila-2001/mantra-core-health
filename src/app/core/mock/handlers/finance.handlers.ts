import { reservas } from '../fixtures/agenda';
import { ESTADO } from '../fixtures/conceptos';
import { PACIENTES, pacientePorId } from '../fixtures/personas';
import { PRACTICAS, servicios } from './practice.handlers';
import { notFound, preconditionFailed, validation, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, hoy, iso, isoDia, nuevoId, texto, uuid } from '../mock-store';

/* ============================================================================
    Contabilidad (plan de cuentas, diario, mayor, balances), cotizaciones con
    plan de pagos flexible (sin interés) y activos/pasivos del profesional.
    ========================================================================== */

const TIPO_CUENTA = { ACTIVO: uuid('concept-account-type-asset'), PASIVO: uuid('concept-account-type-liability'), PATRIMONIO: uuid('concept-account-type-equity'), INGRESO: uuid('concept-account-type-revenue'), GASTO: uuid('concept-account-type-expense') } as const;
const SALDO = { DEUDOR: uuid('concept-normal-balance-debit'), ACREEDOR: uuid('concept-normal-balance-credit') } as const;
const DIRECCION = { DEBIT: uuid('concept-direction-debit'), CREDIT: uuid('concept-direction-credit') } as const;
const MONEDA_BOB = uuid('concept-currency-bob');
const TIPO_ASIENTO = uuid('concept-transaction-type-standard');
const PERIODO_ACTUAL = uuid('fiscal-period-2026');

/** Los seis estados del asiento, tal como los declara la API (`ACCT_TXN_*`). */
export const FLUJO = {
  DRAFT: 'DRAFT',
  AUTO_CLASSIFIED: 'AUTO_CLASSIFIED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  POSTED: 'POSTED',
  REVERSED: 'REVERSED',
} as const;
export type EstadoDeFlujo = (typeof FLUJO)[keyof typeof FLUJO];

/**
 * Qué se puede hacer con un documento en cada estado.
 *
 * Es la máquina de la API, no una interpretación: DRAFT → AUTO_CLASSIFIED →
 * PENDING_REVIEW → APPROVED → POSTED → REVERSED, y un documento posteado **no
 * se edita, se revierte**. La pantalla no ofrece más acciones que éstas porque
 * el backend no acepta más.
 */
export const TRANSICIONES: Readonly<Record<EstadoDeFlujo, readonly string[]>> = {
  DRAFT: ['classify'],
  AUTO_CLASSIFIED: ['submit-review'],
  PENDING_REVIEW: ['approve'],
  APPROVED: ['post'],
  POSTED: ['reverse'],
  REVERSED: [],
};

interface CuentaSimulada {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly accountTypeConceptId: string;
  readonly normalBalanceConceptId: string;
  readonly parentAccountId: string | null;
  readonly currencyConceptId: string;
}

const CUENTAS: readonly CuentaSimulada[] = [
  ['1', 'Activo', 'ACTIVO', null],
  ['1.1', 'Caja', 'ACTIVO', '1'],
  ['1.2', 'Banco BNB cuenta corriente', 'ACTIVO', '1'],
  ['1.3', 'Cuentas por cobrar aseguradoras', 'ACTIVO', '1'],
  ['1.4', 'Equipamiento médico', 'ACTIVO', '1'],
  ['1.5', 'Depreciación acumulada de equipos', 'ACTIVO', '1'],
  ['2', 'Pasivo', 'PASIVO', null],
  ['2.1', 'Préstamo bancario', 'PASIVO', '2'],
  ['2.2', 'Impuestos por pagar', 'PASIVO', '2'],
  ['2.3', 'Proveedores', 'PASIVO', '2'],
  ['3', 'Patrimonio', 'PATRIMONIO', null],
  ['3.1', 'Capital', 'PATRIMONIO', '3'],
  ['3.2', 'Resultados acumulados', 'PATRIMONIO', '3'],
  ['4', 'Ingresos', 'INGRESO', null],
  ['4.1', 'Ingresos por consultas', 'INGRESO', '4'],
  ['4.2', 'Ingresos por procedimientos', 'INGRESO', '4'],
  ['4.3', 'Otros ingresos', 'INGRESO', '4'],
  ['5', 'Gastos', 'GASTO', null],
  ['5.1', 'Alquiler del consultorio', 'GASTO', '5'],
  ['5.2', 'Insumos médicos', 'GASTO', '5'],
  ['5.3', 'Servicios básicos', 'GASTO', '5'],
  ['5.4', 'Sueldos y honorarios', 'GASTO', '5'],
  ['5.5', 'Depreciación', 'GASTO', '5'],
  ['5.6', 'Intereses bancarios', 'GASTO', '5'],
].map(([code, name, tipo, padre]) => ({
  id: uuid(`account-${code}`),
  code: code!,
  name: name!,
  accountTypeConceptId: TIPO_CUENTA[tipo as keyof typeof TIPO_CUENTA],
  normalBalanceConceptId: tipo === 'ACTIVO' || tipo === 'GASTO' ? SALDO.DEUDOR : SALDO.ACREEDOR,
  parentAccountId: padre === null ? null : uuid(`account-${padre}`),
  currencyConceptId: MONEDA_BOB,
}));

function cuenta(code: string): string {
  return uuid(`account-${code}`);
}

interface AsientoSimulado {
  readonly id: string;
  readonly practiceId: string;
  readonly transactionNumber: string;
  readonly transactionDate: string;
  readonly fiscalPeriodId: string;
  readonly statusConceptId: string;
  readonly transactionTypeConceptId: string;
  readonly currencyConceptId: string;
  readonly totalAmount: string;
  readonly postedAt: string | null;
  readonly description: string;
  /** El estado en la máquina de seis pasos de la API (`ACCT_TXN_*`). */
  readonly flujo: EstadoDeFlujo;
  readonly reversalOfId?: string | null;
  readonly lines: readonly { id: string; lineNo: number; accountId: string; directionConceptId: string; amountBase: string; memo: string; currencyConceptId: string }[];
}

function asiento(indice: number, dias: number, descripcion: string, debito: string, credito: string, importe: string, borrador = false, flujo?: EstadoDeFlujo): AsientoSimulado {
  const id = uuid(`journal-${indice}`);
  return {
    id,
    flujo: flujo ?? (borrador ? FLUJO.DRAFT : FLUJO.POSTED),
    practiceId: PRACTICAS[0]!.id,
    transactionNumber: `AS-2026-${String(1000 + indice).padStart(5, '0')}`,
    transactionDate: isoDia(dias),
    fiscalPeriodId: PERIODO_ACTUAL,
    statusConceptId: borrador ? ESTADO['ST-DRAFT']! : ESTADO['ST-COMPLETED']!,
    transactionTypeConceptId: TIPO_ASIENTO,
    currencyConceptId: MONEDA_BOB,
    totalAmount: importe,
    postedAt: borrador ? null : iso(dias, 18),
    description: descripcion,
    lines: [
      { id: uuid(`line-${id}-1`), lineNo: 1, accountId: cuenta(debito), directionConceptId: DIRECCION.DEBIT, amountBase: importe, memo: descripcion, currencyConceptId: MONEDA_BOB },
      { id: uuid(`line-${id}-2`), lineNo: 2, accountId: cuenta(credito), directionConceptId: DIRECCION.CREDIT, amountBase: importe, memo: descripcion, currencyConceptId: MONEDA_BOB },
    ],
  };
}

const asientos = new Coleccion<AsientoSimulado>([
  asiento(1, -58, 'Aporte de capital inicial', '1.2', '3.1', '80000.00'),
  asiento(2, -55, 'Compra de electrocardiógrafo', '1.4', '1.2', '18500.00'),
  asiento(3, -50, 'Préstamo BNB para equipamiento', '1.2', '2.1', '40000.00'),
  asiento(4, -45, 'Consultas de la semana (efectivo)', '1.1', '4.1', '3250.00'),
  asiento(5, -44, 'Alquiler del consultorio · mes 1', '5.1', '1.2', '4500.00'),
  asiento(6, -40, 'Ecocardiogramas facturados a Seguros Andina', '1.3', '4.2', '2880.00'),
  asiento(7, -35, 'Insumos: electrodos y gel', '5.2', '1.1', '620.00'),
  asiento(8, -30, 'Consultas de la semana (efectivo)', '1.1', '4.1', '2900.00'),
  asiento(9, -28, 'Cobro de Seguros Andina', '1.2', '1.3', '2880.00'),
  asiento(10, -25, 'Luz, agua e internet', '5.3', '1.2', '780.00'),
  asiento(11, -20, 'Honorarios secretaria', '5.4', '1.2', '3200.00'),
  asiento(12, -15, 'Consultas de la semana (efectivo)', '1.1', '4.1', '3600.00'),
  asiento(13, -14, 'Alquiler del consultorio · mes 2', '5.1', '1.2', '4500.00'),
  asiento(14, -10, 'Cuota 1 del préstamo (capital)', '2.1', '1.2', '3333.33'),
  asiento(15, -10, 'Cuota 1 del préstamo (interés)', '5.6', '1.2', '400.00'),
  asiento(16, -7, 'Holter y pruebas de esfuerzo', '1.1', '4.2', '1740.00'),
  asiento(17, -5, 'Depreciación mensual del electrocardiógrafo', '5.5', '1.5', '308.33'),
  asiento(18, -2, 'Consultas de la semana (efectivo)', '1.1', '4.1', '3100.00'),
  asiento(19, -1, 'Compra de tensiómetro', '5.2', '1.1', '450.00', true),
  asiento(20, 0, 'Certificados de aptitud', '1.1', '4.3', '300.00', true),
  // Los cuatro siguientes existen para que la bandeja muestre los seis estados
  // del flujo. Ninguno está posteado, así que NO tocan el balance: un documento
  // que no llegó a POSTED no existe para el mayor, que es justamente la regla
  // que hace útil el flujo.
  asiento(21, -3, 'Mantenimiento del ecocardiógrafo', '5.2', '2.3', '1250.00', true, FLUJO.AUTO_CLASSIFIED),
  asiento(22, -4, 'Honorarios de anestesista externo', '5.4', '2.3', '2100.00', true, FLUJO.PENDING_REVIEW),
  asiento(23, -6, 'Compra de sillas para sala de espera', '1.4', '2.3', '3400.00', true, FLUJO.APPROVED),
  asiento(24, -12, 'Consultas de la semana (anulado por error de cuenta)', '1.1', '4.1', '1900.00', true, FLUJO.REVERSED),
]);

function saldoDe(accountId: string, hasta: string | null = null): { debit: number; credit: number } {
  let debit = 0;
  let credit = 0;
  for (const a of asientos.filtrar((x) => x.statusConceptId === ESTADO['ST-COMPLETED'] && (hasta === null || x.transactionDate <= hasta))) {
    for (const l of a.lines) {
      if (l.accountId !== accountId) continue;
      if (l.directionConceptId === DIRECCION.DEBIT) debit += Number(l.amountBase);
      else credit += Number(l.amountBase);
    }
  }
  return { debit, credit };
}

function d(n: number): string {
  return n.toFixed(2);
}

/* ---- cotizaciones ------------------------------------------------------------ */

/** El plan sin interés, en partes iguales: el que arma el formulario antes de tocar nada. */
function planFlexible(offeredPrice: number, downPayment: number, installmentCount: number, attentionDate: string) {
  const n = Math.max(0, installmentCount);
  const saldo = Math.max(0, Math.round((offeredPrice - downPayment) * 100));
  const base = Math.floor(saldo / Math.max(1, n));
  const resto = saldo - base * n;
  const inicio = new Date(attentionDate === '' ? ahora() : attentionDate);
  return Array.from({ length: n }, (_, i) => {
    const due = new Date(inicio);
    due.setMonth(due.getMonth() + i + 1);
    return { installmentNumber: i + 1, dueDate: due.toISOString().slice(0, 10), amount: (base + (i < resto ? 1 : 0)) / 100 };
  });
}

interface CotizacionSimulada {
  readonly id: string;
  readonly practiceId: string;
  readonly patientProfileId: string;
  readonly attentionDate: string;
  readonly appointmentId?: string;
  readonly serviceCatalogId: string;
  readonly serviceNameSnapshot: string;
  readonly offeredPrice: number;
  readonly currencyConceptId: string;
  readonly paymentPlanInstallmentCount: number;
  readonly downPaymentAmount: number;
  readonly paymentFrequency: 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  readonly validUntil: string;
  readonly status: string;
  readonly installments: readonly { installmentNumber: number; dueDate: string; amount: number }[];
}

const cotizaciones = new Coleccion<CotizacionSimulada>(
  [
    [0, 'PAQ-PREV', 890, 3, 190, -10, 20, 'ACCEPTED'],
    [5, 'ECO-DOPPLER', 480, 2, 0, -4, 26, 'DRAFT'],
    [8, 'ERGO', 520, 4, 0, -20, -5, 'EXPIRED'],
    [2, 'HOLTER', 350, 1, 0, -1, 29, 'SENT'],
  ].map(([pac, codigo, precio, cuotas, anticipo, dias, validez, status], i) => {
    const servicio = servicios.todos().find((s) => s.code === codigo)!;
    return {
      id: uuid(`quotation-${i}`),
      practiceId: servicio.practiceId,
      patientProfileId: PACIENTES[pac as number]!.id,
      attentionDate: isoDia(dias as number),
      serviceCatalogId: servicio.id,
      serviceNameSnapshot: servicio.name,
      offeredPrice: precio as number,
      currencyConceptId: MONEDA_BOB,
      paymentPlanInstallmentCount: cuotas as number,
      downPaymentAmount: anticipo as number,
      paymentFrequency: 'MONTHLY' as const,
      validUntil: isoDia(validez as number),
      status: status as string,
      installments: planFlexible(precio as number, anticipo as number, cuotas as number, isoDia(dias as number)),
    };
  }),
);

/* ---- activos y pasivos ---------------------------------------------------------- */

const activos = new Coleccion<{ id: string; practiceId: string; code: string; name: string; statusConceptId: string; bookValue: string; acquisitionCost: string; automated: boolean }>([
  { id: uuid('asset-ecg'), practiceId: PRACTICAS[0]!.id, code: 'EQ-001', name: 'Electrocardiógrafo Nihon Kohden', statusConceptId: ESTADO['ST-ACTIVE']!, bookValue: '17883.34', acquisitionCost: '18500.00', automated: true },
  { id: uuid('asset-eco'), practiceId: PRACTICAS[0]!.id, code: 'EQ-002', name: 'Ecógrafo portátil GE Vscan', statusConceptId: ESTADO['ST-ACTIVE']!, bookValue: '41250.00', acquisitionCost: '45000.00', automated: true },
  { id: uuid('asset-camilla'), practiceId: PRACTICAS[0]!.id, code: 'MOB-001', name: 'Camilla de examen eléctrica', statusConceptId: ESTADO['ST-ACTIVE']!, bookValue: '5200.00', acquisitionCost: '6500.00', automated: false },
  { id: uuid('asset-pc'), practiceId: PRACTICAS[2]!.id, code: 'IT-001', name: 'Computadora del consultorio', statusConceptId: ESTADO['ST-ACTIVE']!, bookValue: '2100.00', acquisitionCost: '4200.00', automated: true },
  { id: uuid('asset-viejo'), practiceId: PRACTICAS[0]!.id, code: 'EQ-000', name: 'Tensiómetro de mercurio (dado de baja)', statusConceptId: ESTADO['ST-ARCHIVED']!, bookValue: '0.00', acquisitionCost: '350.00', automated: false },
]);

const pasivos = new Coleccion<{ id: string; practiceId: string; code: string; name: string; creditorName: string; principalAmount: string; outstandingAmount: string; statusConceptId: string; automated: boolean; cuotas: number; pagadas: number; startDate: string; interestRate: string }>([
  { id: uuid('liability-bnb'), practiceId: PRACTICAS[0]!.id, code: 'PR-001', name: 'Préstamo equipamiento BNB', creditorName: 'Banco Nacional de Bolivia', principalAmount: '40000.00', outstandingAmount: '36666.67', statusConceptId: ESTADO['ST-ACTIVE']!, automated: true, cuotas: 12, pagadas: 1, startDate: isoDia(-50), interestRate: '12.00' },
  { id: uuid('liability-eco'), practiceId: PRACTICAS[0]!.id, code: 'PR-002', name: 'Financiación del ecógrafo', creditorName: 'GE Healthcare Bolivia', principalAmount: '45000.00', outstandingAmount: '30000.00', statusConceptId: ESTADO['ST-ACTIVE']!, automated: false, cuotas: 18, pagadas: 6, startDate: isoDia(-200), interestRate: '8.50' },
  { id: uuid('liability-pagado'), practiceId: PRACTICAS[2]!.id, code: 'PR-000', name: 'Anticipo de alquiler (saldado)', creditorName: 'Inmobiliaria Urubó', principalAmount: '9000.00', outstandingAmount: '0.00', statusConceptId: ESTADO['ST-CLOSED']!, automated: false, cuotas: 3, pagadas: 3, startDate: isoDia(-400), interestRate: '0.00' },
]);

function cronograma(principal: number, cuotas: number, pagadas: number, startDate: string, tasa: number) {
  const capital = principal / cuotas;
  return Array.from({ length: cuotas }, (_, i) => {
    const due = new Date(startDate);
    due.setMonth(due.getMonth() + i + 1);
    const interes = ((principal - capital * i) * tasa) / 100 / 12;
    return { id: uuid(`schedule-${startDate}-${i}`), installmentNumber: i + 1, dueDate: due.toISOString().slice(0, 10), principalDue: d(capital), interestDue: d(interes), paidAmount: i < pagadas ? d(capital + interes) : '0.00', statusConceptId: i < pagadas ? ESTADO['ST-COMPLETED']! : ESTADO['ST-PENDING']! };
  });
}


/* ============================================================================
    El plano SAP del módulo: ejercicio y períodos, el flujo de seis estados del
    documento, las partidas abiertas y los objetos de controlling.

    Nada de esto se inventó para la maqueta: son tablas que el modelo canónico
    ya declara en el módulo 16 —`fiscal_years`, `fiscal_periods`, `open_items`,
    `clearing_documents`, `cost_centers`, `profit_centers`, `segments`— y
    estados que la API ya nombra en `accounting.concepts.ts`. Lo que faltaba era
    poder VERLOS: la API tiene el lado de escritura (postear, compensar,
    bloquear un período) y ninguna lectura, así que la pantalla no tenía de
    dónde leer. Acá se sirven para que el cockpit exista mientras esas lecturas
    se construyen del otro lado.
    ========================================================================== */

const EJERCICIO = uuid('fiscal-year-2026');
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Los doce períodos del ejercicio, con el estado que tendría una contabilidad
 * llevada al día: los meses cerrados atrás, el corriente abierto, el resto sin
 * abrir todavía. Un período cerrado rechaza asientos — eso es lo que hace que
 * «cerrar el mes» signifique algo.
 */
function periodosDelEjercicio(): readonly {
  id: string;
  fiscalYearId: string;
  periodNumber: number;
  name: string;
  startsOn: string;
  endsOn: string;
  status: 'CLOSED' | 'OPEN' | 'PLANNED';
  closedAt: string | null;
}[] {
  const mesActual = hoy().getMonth();
  return MESES.map((nombre, i) => {
    const ultimoDia = new Date(2026, i + 1, 0).getDate();
    return {
      id: i === mesActual ? PERIODO_ACTUAL : uuid(`fiscal-period-2026-${i + 1}`),
      fiscalYearId: EJERCICIO,
      periodNumber: i + 1,
      name: `${nombre} 2026`,
      startsOn: `2026-${String(i + 1).padStart(2, '0')}-01`,
      endsOn: `2026-${String(i + 1).padStart(2, '0')}-${ultimoDia}`,
      status: i < mesActual ? 'CLOSED' : i === mesActual ? 'OPEN' : 'PLANNED',
      closedAt: i < mesActual ? iso(-((mesActual - i) * 30), 20) : null,
    };
  });
}

const periodos = new Coleccion(periodosDelEjercicio().map((p) => ({ ...p })));

/* ---- objetos de controlling ------------------------------------------------
   Centros de coste, centros de beneficio y segmentos. En una práctica médica no
   son abstracciones: el centro de coste es dónde se gasta (consultorio,
   imagenología, administración) y el de beneficio es qué línea de servicio deja
   margen. El segmento es el corte por el que se reporta hacia afuera. */
interface Dimension {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: 'COST_CENTER' | 'PROFIT_CENTER' | 'SEGMENT';
}

const DIMENSIONES: readonly Dimension[] = [
  ['CC-100', 'Consultorio', 'COST_CENTER'],
  ['CC-200', 'Imagenología y estudios', 'COST_CENTER'],
  ['CC-900', 'Administración', 'COST_CENTER'],
  ['PC-10', 'Consulta ambulatoria', 'PROFIT_CENTER'],
  ['PC-20', 'Estudios cardiológicos', 'PROFIT_CENTER'],
  ['SEG-CLI', 'Atención clínica', 'SEGMENT'],
].map(([code, name, kind]) => ({
  id: uuid(`dimension-${code}`),
  code: code!,
  name: name!,
  kind: kind as Dimension['kind'],
}));

/**
 * A qué objeto de controlling se imputa cada cuenta.
 *
 * Es el `account_determination_rules` del modelo, simplificado a lo que una
 * práctica necesita: el gasto de alquiler es del consultorio, el de insumos de
 * imagenología, el sueldo de administración; el ingreso por consultas es de
 * ambulatoria y el de procedimientos, de estudios.
 */
const IMPUTACION: Readonly<Record<string, { costCenter: string; profitCenter: string }>> = {
  '4.1': { costCenter: 'CC-100', profitCenter: 'PC-10' },
  '4.2': { costCenter: 'CC-200', profitCenter: 'PC-20' },
  '4.3': { costCenter: 'CC-900', profitCenter: 'PC-10' },
  '5.1': { costCenter: 'CC-100', profitCenter: 'PC-10' },
  '5.2': { costCenter: 'CC-200', profitCenter: 'PC-20' },
  '5.3': { costCenter: 'CC-100', profitCenter: 'PC-10' },
  '5.4': { costCenter: 'CC-900', profitCenter: 'PC-10' },
  '5.5': { costCenter: 'CC-200', profitCenter: 'PC-20' },
  '5.6': { costCenter: 'CC-900', profitCenter: 'PC-10' },
};

/* ---- partidas abiertas -----------------------------------------------------
   Lo que se debe y lo que deben, todavía sin compensar. La antigüedad es la
   pregunta que un contador hace primero: no «cuánto me deben» sino «desde
   cuándo». */
interface PartidaAbierta {
  readonly id: string;
  readonly documentNumber: string;
  readonly accountCode: string;
  readonly accountName: string;
  readonly partnerName: string;
  readonly side: 'RECEIVABLE' | 'PAYABLE';
  readonly documentDate: string;
  readonly dueDate: string;
  readonly amount: string;
  readonly clearedAmount: string;
  clearingDocumentId: string | null;
}

function partida(
  indice: number,
  lado: PartidaAbierta['side'],
  socio: string,
  diasEmision: number,
  diasVencimiento: number,
  importe: string,
  compensado = '0.00',
): PartidaAbierta {
  const esCobro = lado === 'RECEIVABLE';
  return {
    id: uuid(`open-item-${indice}`),
    documentNumber: `${esCobro ? 'FC' : 'FP'}-2026-${String(400 + indice).padStart(4, '0')}`,
    accountCode: esCobro ? '1.3' : '2.3',
    accountName: esCobro ? 'Cuentas por cobrar aseguradoras' : 'Proveedores',
    partnerName: socio,
    side: lado,
    documentDate: isoDia(diasEmision),
    dueDate: isoDia(diasVencimiento),
    amount: importe,
    clearedAmount: compensado,
    clearingDocumentId: null,
  };
}

const partidasAbiertas = new Coleccion<PartidaAbierta>([
  partida(1, 'RECEIVABLE', 'Seguros Andina', -75, -45, '4820.00'),
  partida(2, 'RECEIVABLE', 'Alianza Salud', -58, -28, '2650.00'),
  partida(3, 'RECEIVABLE', 'Seguros Andina', -40, -10, '1980.00'),
  partida(4, 'RECEIVABLE', 'Nacional Vida', -22, 8, '3120.00'),
  partida(5, 'RECEIVABLE', 'Alianza Salud', -9, 21, '1450.00', '450.00'),
  partida(6, 'PAYABLE', 'Insumos Médicos del Sur', -66, -36, '2210.00'),
  partida(7, 'PAYABLE', 'Droguería Boliviana', -31, -1, '1740.00'),
  partida(8, 'PAYABLE', 'Servicios Eléctricos SA', -12, 18, '780.00'),
]);

/** Los tramos de antigüedad con los que se mira una cartera. */
const TRAMOS = [
  { key: 'CORRIENTE', label: 'Por vencer', desde: -1, hasta: 0 },
  { key: 'D1_30', label: '1 a 30 días', desde: 1, hasta: 30 },
  { key: 'D31_60', label: '31 a 60 días', desde: 31, hasta: 60 },
  { key: 'D61_90', label: '61 a 90 días', desde: 61, hasta: 90 },
  { key: 'D90_MAS', label: 'Más de 90 días', desde: 91, hasta: 100000 },
] as const;

function diasDeAtraso(vencimiento: string): number {
  const ms = hoy().getTime() - new Date(`${vencimiento}T00:00:00`).getTime();
  return Math.floor(ms / 86_400_000);
}

function tramoDe(vencimiento: string): string {
  const atraso = diasDeAtraso(vencimiento);
  if (atraso <= 0) return 'CORRIENTE';
  return TRAMOS.find((t) => atraso >= t.desde && atraso <= t.hasta)?.key ?? 'D90_MAS';
}


/* ---- activos fijos y devengos, con sus corridas ----------------------------
   Las dos tablas que faltaban del plano SAP: `asset_classes` con su
   `depreciation_areas` —cuántos meses vive cada clase de activo y contra qué
   cuentas se amortiza— y `accrual_objects` con su `accrual_schedule_lines`.

   Lo que las hace valer no es el listado: es la **corrida**. Amortizar y
   devengar no son informes, son asientos. En SAP se ejecutan por período, y
   cada ejecución deja su documento en el mayor. Acá igual: `depreciation/run` y
   `accruals/run` crean un asiento POSTEADO y los saldos se mueven. Por eso las
   dos rechazan si el período está cerrado — un asiento en un mes cerrado es
   exactamente lo que cerrar un mes impide. */

interface ClaseDeActivo {
  readonly code: string;
  readonly name: string;
  /** Vida útil en meses. Es lo que fija la cuota, no una preferencia. */
  readonly usefulLifeMonths: number;
  /** Cuenta de gasto y cuenta de amortización acumulada. */
  readonly expenseAccount: string;
  readonly accumulatedAccount: string;
}

const CLASES_DE_ACTIVO: readonly ClaseDeActivo[] = [
  { code: 'EQ', name: 'Equipamiento médico', usefulLifeMonths: 60, expenseAccount: '5.5', accumulatedAccount: '1.5' },
  { code: 'MOB', name: 'Mobiliario clínico', usefulLifeMonths: 120, expenseAccount: '5.5', accumulatedAccount: '1.5' },
  { code: 'IT', name: 'Equipos informáticos', usefulLifeMonths: 36, expenseAccount: '5.5', accumulatedAccount: '1.5' },
];

function claseDe(codigo: string): ClaseDeActivo {
  const prefijo = codigo.split('-')[0] ?? 'EQ';
  return CLASES_DE_ACTIVO.find((c) => c.code === prefijo) ?? CLASES_DE_ACTIVO[0]!;
}

/** La cuota lineal del mes: coste entre vida útil. Sin valor residual. */
function cuotaMensualDe(activo: { code: string; acquisitionCost: string }): number {
  return Number(activo.acquisitionCost) / claseDe(activo.code).usefulLifeMonths;
}

interface Devengo {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: 'EXPENSE' | 'REVENUE';
  readonly totalAmount: string;
  readonly periods: number;
  postedPeriods: number;
  readonly startsOn: string;
  /** Contra qué cuentas se reparte cada período. */
  readonly debitAccount: string;
  readonly creditAccount: string;
}

const devengos = new Coleccion<Devengo>([
  {
    id: uuid('accrual-seguro'),
    code: 'DEV-001',
    name: 'Seguro de responsabilidad civil, pagado por el año',
    kind: 'EXPENSE',
    totalAmount: '7200.00',
    periods: 12,
    postedPeriods: 4,
    startsOn: isoDia(-120),
    // Se pagó entero y se reconoce mes a mes: gasto contra el anticipo.
    debitAccount: '5.3',
    creditAccount: '1.2',
  },
  {
    id: uuid('accrual-alquiler'),
    code: 'DEV-002',
    name: 'Alquiler del consultorio, semestre adelantado',
    kind: 'EXPENSE',
    totalAmount: '27000.00',
    periods: 6,
    postedPeriods: 2,
    startsOn: isoDia(-60),
    debitAccount: '5.1',
    creditAccount: '1.2',
  },
  {
    id: uuid('accrual-plan'),
    code: 'DEV-003',
    name: 'Plan anual de control cardiológico cobrado por adelantado',
    kind: 'REVENUE',
    totalAmount: '14400.00',
    periods: 12,
    postedPeriods: 3,
    startsOn: isoDia(-90),
    // Ingreso diferido: se reconoce el ingreso a medida que se presta.
    debitAccount: '2.2',
    creditAccount: '4.1',
  },
]);

/** Crea el asiento de una corrida y lo deja POSTEADO, como hace la real. */
function asientoDeCorrida(descripcion: string, debito: string, credito: string, importe: number): AsientoSimulado {
  const id = nuevoId('journal');
  const monto = d(importe);
  return {
    id,
    flujo: FLUJO.POSTED,
    practiceId: PRACTICAS[0]!.id,
    transactionNumber: `AS-2026-${String(1000 + asientos.tamano + 1).padStart(5, '0')}`,
    transactionDate: isoDia(0),
    fiscalPeriodId: PERIODO_ACTUAL,
    statusConceptId: ESTADO['ST-COMPLETED']!,
    transactionTypeConceptId: TIPO_ASIENTO,
    currencyConceptId: MONEDA_BOB,
    totalAmount: monto,
    postedAt: ahora(),
    description: descripcion,
    lines: [
      { id: nuevoId('line'), lineNo: 1, accountId: cuenta(debito), directionConceptId: DIRECCION.DEBIT, amountBase: monto, memo: descripcion, currencyConceptId: MONEDA_BOB },
      { id: nuevoId('line'), lineNo: 2, accountId: cuenta(credito), directionConceptId: DIRECCION.CREDIT, amountBase: monto, memo: descripcion, currencyConceptId: MONEDA_BOB },
    ],
  };
}

/** El período corriente, o `undefined` si el ejercicio no tiene ninguno abierto. */
function periodoAbierto(): { id: string; name: string; status: string } | undefined {
  return periodos.todos().find((p) => p.status === 'OPEN');
}

export function registrarFinanzas(router: MockRouter): void {
  /* ---- el plano SAP: lecturas que la API todavía no tiene ------------------
     `POST fiscal-periods/:id/lock`, `POST open-items`, `POST clearing-documents`
     y las cinco acciones del flujo SÍ existen en la API real
     (`accounting.controller`). Lo que no existe es cómo LEER nada de eso, así
     que el cockpit no tendría de dónde pintar. Estas lecturas se sirven acá con
     los nombres de las tablas del modelo, para que el día que la API las
     publique la pantalla no tenga que cambiar de vocabulario. */

  router.get('/accounting/fiscal-years', () => {
    const items = periodos.todos().sort((a, b) => a.periodNumber - b.periodNumber);
    const abierto = items.find((p) => p.status === 'OPEN') ?? items[items.length - 1]!;
    return {
      fiscalYearId: EJERCICIO,
      name: 'Ejercicio 2026',
      startsOn: '2026-01-01',
      endsOn: '2026-12-31',
      currentPeriodId: abierto.id,
      periods: items,
      count: items.length,
    };
  });

  router.post('/accounting/fiscal-periods/:id/lock', ({ params }) => {
    const periodo = periodos.get(params['id']!);
    if (periodo === undefined) return notFound('Período no encontrado');
    if (periodo.status === 'CLOSED') {
      return preconditionFailed('El período ya está cerrado', { periodId: periodo.id });
    }
    // Cerrar con documentos sin postear es exactamente lo que un cierre debe
    // impedir: quedarían fuera del ejercicio sin que nadie lo note.
    const pendientes = asientos.filtrar(
      (a) => a.fiscalPeriodId === periodo.id && a.flujo !== FLUJO.POSTED && a.flujo !== FLUJO.REVERSED,
    );
    if (pendientes.length > 0) {
      return preconditionFailed(
        `No se puede cerrar: quedan ${pendientes.length} documento(s) sin postear en el período`,
        { pending: pendientes.map((a) => a.transactionNumber) },
      );
    }
    const cerrado = periodos.actualizar(periodo.id, { status: 'CLOSED', closedAt: ahora() });
    return { status: 200, body: cerrado };
  });

  router.get('/accounting/open-items', ({ query }) => {
    const lado = texto(query, 'side');
    const items = partidasAbiertas
      .todos()
      .filter((p) => lado === null || p.side === lado)
      .map((p) => {
        const pendiente = Number(p.amount) - Number(p.clearedAmount);
        return {
          ...p,
          openAmount: d(pendiente),
          overdueDays: Math.max(0, diasDeAtraso(p.dueDate)),
          agingBucket: tramoDe(p.dueDate),
          cleared: pendiente < 0.01,
        };
      })
      .filter((p) => !p.cleared)
      .sort((a, b) => b.overdueDays - a.overdueDays);

    const resumen = TRAMOS.map((t) => {
      const delTramo = items.filter((p) => p.agingBucket === t.key);
      return {
        bucket: t.key,
        label: t.label,
        receivable: d(delTramo.filter((p) => p.side === 'RECEIVABLE').reduce((s, p) => s + Number(p.openAmount), 0)),
        payable: d(delTramo.filter((p) => p.side === 'PAYABLE').reduce((s, p) => s + Number(p.openAmount), 0)),
        count: delTramo.length,
      };
    });

    return {
      items,
      count: items.length,
      aging: resumen,
      totalReceivable: d(items.filter((p) => p.side === 'RECEIVABLE').reduce((s, p) => s + Number(p.openAmount), 0)),
      totalPayable: d(items.filter((p) => p.side === 'PAYABLE').reduce((s, p) => s + Number(p.openAmount), 0)),
    };
  });

  router.post('/accounting/clearing-documents', (request) => {
    const datos = cuerpo<{ openItemIds?: string[] }>(request);
    const ids = datos.openItemIds ?? [];
    const encontradas = ids.map((id) => partidasAbiertas.get(id)).filter((p) => p !== undefined);
    if (encontradas.length === 0) {
      return preconditionFailed('No se indicó ninguna partida a compensar', { openItemIds: ids });
    }
    const documento = nuevoId('clearing');
    let total = 0;
    for (const partida of encontradas) {
      total += Number(partida.amount) - Number(partida.clearedAmount);
      partidasAbiertas.actualizar(partida.id, {
        clearedAmount: partida.amount,
        clearingDocumentId: documento,
      });
    }
    return {
      status: 201,
      body: {
        clearingDocumentId: documento,
        clearedItems: encontradas.length,
        clearedAmount: d(total),
        clearedAt: ahora(),
      },
    };
  });

  router.get('/accounting/dimensions', () => {
    const codigoDeCuenta = new Map(CUENTAS.map((c) => [c.id, c.code]));
    const acumulado = new Map<string, { debit: number; credit: number }>();
    for (const a of asientos.filtrar((x) => x.flujo === FLUJO.POSTED)) {
      for (const l of a.lines) {
        const codigo = codigoDeCuenta.get(l.accountId);
        const imputacion = codigo === undefined ? undefined : IMPUTACION[codigo];
        if (imputacion === undefined) continue;
        for (const clave of [imputacion.costCenter, imputacion.profitCenter, 'SEG-CLI']) {
          const actual = acumulado.get(clave) ?? { debit: 0, credit: 0 };
          if (l.directionConceptId === DIRECCION.DEBIT) actual.debit += Number(l.amountBase);
          else actual.credit += Number(l.amountBase);
          acumulado.set(clave, actual);
        }
      }
    }
    const items = DIMENSIONES.map((dim) => {
      const { debit, credit } = acumulado.get(dim.code) ?? { debit: 0, credit: 0 };
      return {
        ...dim,
        // Para un objeto de controlling el resultado es lo que ingresó menos lo
        // que costó: el haber de las cuentas de ingreso contra el debe de las
        // de gasto, que es como quedan imputadas las líneas.
        debit: d(debit),
        credit: d(credit),
        result: d(credit - debit),
      };
    });
    return { items, count: items.length };
  });

  /* ---- activos fijos: registro y corrida de amortización ------------------- */
  router.get('/accounting/assets', ({ query }) => {
    const practiceId = texto(query, 'practiceId');
    const items = activos
      .filtrar((a) => practiceId === null || a.practiceId === practiceId)
      .map((a) => {
        const clase = claseDe(a.code);
        const acumulada = Number(a.acquisitionCost) - Number(a.bookValue);
        return {
          id: a.id,
          code: a.code,
          name: a.name,
          className: clase.name,
          classCode: clase.code,
          usefulLifeMonths: clase.usefulLifeMonths,
          acquisitionCost: a.acquisitionCost,
          accumulatedDepreciation: d(acumulada),
          netBookValue: a.bookValue,
          monthlyDepreciation: d(cuotaMensualDe(a)),
          // Amortizado del todo o dado de baja: ya no entra en la corrida.
          depreciable: a.statusConceptId === ESTADO['ST-ACTIVE'] && Number(a.bookValue) > 0.01,
          status: a.statusConceptId === ESTADO['ST-ACTIVE'] ? 'ACTIVE' : 'RETIRED',
        };
      })
      .sort((a, b) => a.code.localeCompare(b.code));

    return {
      items,
      count: items.length,
      totalAcquisition: d(items.reduce((s, a) => s + Number(a.acquisitionCost), 0)),
      totalAccumulated: d(items.reduce((s, a) => s + Number(a.accumulatedDepreciation), 0)),
      totalNetBookValue: d(items.reduce((s, a) => s + Number(a.netBookValue), 0)),
      monthlyCharge: d(items.filter((a) => a.depreciable).reduce((s, a) => s + Number(a.monthlyDepreciation), 0)),
    };
  });

  router.post('/accounting/depreciation/run', () => {
    const periodo = periodoAbierto();
    if (periodo === undefined) {
      return preconditionFailed('No hay período abierto: la amortización no tiene dónde postearse', {});
    }
    const elegibles = activos.filtrar(
      (a) => a.statusConceptId === ESTADO['ST-ACTIVE'] && Number(a.bookValue) > 0.01,
    );
    if (elegibles.length === 0) {
      return preconditionFailed('No hay activos amortizables', {});
    }
    let total = 0;
    for (const activo of elegibles) {
      // La última cuota nunca deja el valor neto en negativo: amortiza lo que
      // queda y el activo termina en cero, que es donde tiene que terminar.
      const cuota = Math.min(cuotaMensualDe(activo), Number(activo.bookValue));
      total += cuota;
      activos.actualizar(activo.id, { bookValue: d(Number(activo.bookValue) - cuota) });
    }
    // Un solo documento colectivo, como la corrida real: gasto contra
    // amortización acumulada.
    const asiento = asientoDeCorrida(
      `Amortización del período · ${periodo.name} · ${elegibles.length} activos`,
      '5.5',
      '1.5',
      total,
    );
    asientos.agregar(asiento);
    return {
      status: 201,
      body: {
        transactionId: asiento.id,
        transactionNumber: asiento.transactionNumber,
        assets: elegibles.length,
        amount: d(total),
        periodName: periodo.name,
      },
    };
  });

  /* ---- devengos: objetos y corrida ---------------------------------------- */
  router.get('/accounting/accrual-objects', () => {
    const items = devengos.todos().map((dev) => {
      const cuota = Number(dev.totalAmount) / dev.periods;
      return {
        id: dev.id,
        code: dev.code,
        name: dev.name,
        kind: dev.kind,
        totalAmount: dev.totalAmount,
        periods: dev.periods,
        postedPeriods: dev.postedPeriods,
        remainingPeriods: dev.periods - dev.postedPeriods,
        periodAmount: d(cuota),
        recognizedAmount: d(cuota * dev.postedPeriods),
        pendingAmount: d(cuota * (dev.periods - dev.postedPeriods)),
        startsOn: dev.startsOn,
        completed: dev.postedPeriods >= dev.periods,
      };
    });
    return {
      items,
      count: items.length,
      pendingTotal: d(items.reduce((s, i) => s + Number(i.pendingAmount), 0)),
      periodCharge: d(items.filter((i) => !i.completed).reduce((s, i) => s + Number(i.periodAmount), 0)),
    };
  });

  router.post('/accounting/accruals/run', () => {
    const periodo = periodoAbierto();
    if (periodo === undefined) {
      return preconditionFailed('No hay período abierto: el devengo no tiene dónde postearse', {});
    }
    const pendientes = devengos.filtrar((dev) => dev.postedPeriods < dev.periods);
    if (pendientes.length === 0) {
      return preconditionFailed('No queda ningún devengo con períodos pendientes', {});
    }
    const creados: string[] = [];
    let total = 0;
    for (const dev of pendientes) {
      const cuota = Number(dev.totalAmount) / dev.periods;
      total += cuota;
      // Un documento por objeto y no uno colectivo: cada devengo va contra sus
      // propias cuentas, y juntarlos escondería contra qué se imputó cada uno.
      const asiento = asientoDeCorrida(
        `Devengo ${dev.code} · ${dev.name} · período ${dev.postedPeriods + 1}/${dev.periods}`,
        dev.debitAccount,
        dev.creditAccount,
        cuota,
      );
      asientos.agregar(asiento);
      creados.push(asiento.transactionNumber);
      devengos.actualizar(dev.id, { postedPeriods: dev.postedPeriods + 1 });
    }
    return {
      status: 201,
      body: {
        objects: pendientes.length,
        amount: d(total),
        transactionNumbers: creados,
        periodName: periodo.name,
      },
    };
  });

  /* ---- el flujo del documento ---------------------------------------------
     Las cinco acciones existen en la API real. Acá mueven el estado y, en
     `post`, es cuando el asiento entra de verdad al mayor: hasta ese momento no
     toca ningún saldo. */
  const accion = (
    desde: EstadoDeFlujo,
    hasta: EstadoDeFlujo,
    alPostear = false,
  ) =>
    ({ params }: { params: Record<string, string> }) => {
      const a = asientos.get(params['id']!);
      if (a === undefined) return notFound('Asiento no encontrado');
      if (a.flujo !== desde) {
        return preconditionFailed(
          `El documento está en ${a.flujo} y esta acción sale de ${desde}`,
          { current: a.flujo, expected: desde },
        );
      }
      const cambios: Partial<AsientoSimulado> = alPostear
        ? { flujo: hasta, statusConceptId: ESTADO['ST-COMPLETED']!, postedAt: ahora() }
        : { flujo: hasta };
      const actualizado = asientos.actualizar(a.id, cambios);
      return { status: 200, body: { id: a.id, transactionNumber: a.transactionNumber, status: actualizado?.flujo } };
    };

  router.post('/accounting/journal-transactions/:id/classify', accion(FLUJO.DRAFT, FLUJO.AUTO_CLASSIFIED));
  router.post('/accounting/journal-transactions/:id/submit-review', accion(FLUJO.AUTO_CLASSIFIED, FLUJO.PENDING_REVIEW));
  router.post('/accounting/journal-transactions/:id/approve', accion(FLUJO.PENDING_REVIEW, FLUJO.APPROVED));
  router.post('/accounting/journal-transactions/:id/post', accion(FLUJO.APPROVED, FLUJO.POSTED, true));

  /* Revertir no edita: crea el documento espejo y deja los dos a la vista. Es
     la única forma de corregir algo posteado, y es lo que exige la matriz
     `<<IMMUTABLE>>` del modelo. */
  router.post('/accounting/journal-transactions/:id/reverse', ({ params }) => {
    const a = asientos.get(params['id']!);
    if (a === undefined) return notFound('Asiento no encontrado');
    if (a.flujo !== FLUJO.POSTED) {
      return preconditionFailed('Sólo se revierte un documento posteado', { current: a.flujo });
    }
    const id = nuevoId('journal');
    asientos.agregar({
      ...a,
      id,
      flujo: FLUJO.POSTED,
      reversalOfId: a.id,
      transactionNumber: `${a.transactionNumber}-R`,
      transactionDate: isoDia(0),
      description: `Reversión de ${a.transactionNumber} · ${a.description}`,
      postedAt: ahora(),
      lines: a.lines.map((l, i) => ({
        ...l,
        id: nuevoId('line'),
        lineNo: i + 1,
        // El espejo: lo que estaba en el debe va al haber y al revés.
        directionConceptId: l.directionConceptId === DIRECCION.DEBIT ? DIRECCION.CREDIT : DIRECCION.DEBIT,
      })),
    });
    asientos.actualizar(a.id, { flujo: FLUJO.REVERSED });
    return { status: 201, body: { id, reversalOf: a.id, transactionNumber: `${a.transactionNumber}-R` } };
  });

  /* El flujo de documentos: qué documentos cuelgan de éste. Es
     `accounting_document_links` del modelo. */
  router.get('/accounting/journal-transactions/:id/document-flow', ({ params }) => {
    const a = asientos.get(params['id']!);
    if (a === undefined) return notFound('Asiento no encontrado');
    const reversiones = asientos.filtrar((x) => x.reversalOfId === a.id);
    const origen = a.reversalOfId === null || a.reversalOfId === undefined ? null : asientos.get(a.reversalOfId);
    const nodo = (x: AsientoSimulado, rol: string) => ({
      id: x.id,
      role: rol,
      transactionNumber: x.transactionNumber,
      transactionDate: x.transactionDate,
      totalAmount: x.totalAmount,
      status: x.flujo,
    });
    return {
      items: [
        ...(origen === undefined || origen === null ? [] : [nodo(origen, 'ORIGEN')]),
        nodo(a, 'ACTUAL'),
        ...reversiones.map((r) => nodo(r, 'REVERSION')),
      ],
    };
  });

  router.get('/accounting/accounts', ({ query }) => {
    const limit = Number(query.get('limit') ?? 200) || 200;
    const items = CUENTAS.slice(0, limit).map((c) => ({ ...c, parentAccountId: c.parentAccountId ?? undefined }));
    return { items, count: CUENTAS.length, limit };
  });

  router.get('/accounting/trial-balance', ({ query }) => {
    const hasta = texto(query, 'to');
    const items = CUENTAS.filter((c) => c.parentAccountId !== null).map((c) => {
      const { debit, credit } = saldoDe(c.id, hasta);
      const balance = c.normalBalanceConceptId === SALDO.DEUDOR ? debit - credit : credit - debit;
      return { accountId: c.id, code: c.code, name: c.name, normalBalanceConceptId: c.normalBalanceConceptId, debit: d(debit), credit: d(credit), balance: d(balance) };
    });
    const totalDebit = items.reduce((s, r) => s + Number(r.debit), 0);
    const totalCredit = items.reduce((s, r) => s + Number(r.credit), 0);
    return { items, count: items.length, totalDebit: d(totalDebit), totalCredit: d(totalCredit), balanced: Math.abs(totalDebit - totalCredit) < 0.01, transactionsIncluded: asientos.filtrar((a) => a.statusConceptId === ESTADO['ST-COMPLETED']).length, truncated: false };
  });

  router.get('/accounting/journal-transactions', ({ query }) => {
    const practiceId = texto(query, 'practiceId');
    const status = texto(query, 'statusConceptId');
    const from = texto(query, 'from');
    const to = texto(query, 'to');
    const limit = Number(query.get('limit') ?? 50) || 50;
    const items = asientos
      .todos()
      .filter((a) => practiceId === null || a.practiceId === practiceId || true)
      .filter((a) => status === null || a.statusConceptId === status)
      .filter((a) => (from === null || a.transactionDate >= from) && (to === null || a.transactionDate <= to))
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, limit)
      .map(({ lines: _l, practiceId: _p, description: _d, ...a }) => a);
    return { items, count: items.length, limit };
  });

  router.get('/accounting/journal-transactions/:id', ({ params }) => {
    const a = asientos.get(params['id']!);
    if (a === undefined) return notFound('Asiento no encontrado');
    const { description: _d, ...resto } = a;
    return resto;
  });

  const publicar = (borrador: boolean) => (request: { body: unknown }) => {
    const datos = cuerpo<{ practiceId: string; transactionDate: string; description?: string; lines: { accountId: string; direction: 'DEBIT' | 'CREDIT'; amount: string; memo?: string }[] }>(request);
    const lineas = datos.lines ?? [];
    const debe = lineas.filter((l) => l.direction === 'DEBIT').reduce((s, l) => s + Number(l.amount), 0);
    const haber = lineas.filter((l) => l.direction === 'CREDIT').reduce((s, l) => s + Number(l.amount), 0);
    if (!borrador && Math.abs(debe - haber) > 0.005) {
      return preconditionFailed('El asiento no cuadra: el debe y el haber difieren', { debit: d(debe), credit: d(haber) });
    }
    const id = nuevoId('journal');
    const nuevo: AsientoSimulado = {
      id,
      flujo: borrador ? FLUJO.DRAFT : FLUJO.POSTED,
      practiceId: datos.practiceId ?? PRACTICAS[0]!.id,
      transactionNumber: `AS-2026-${String(1000 + asientos.tamano + 1).padStart(5, '0')}`,
      transactionDate: datos.transactionDate ?? isoDia(0),
      fiscalPeriodId: PERIODO_ACTUAL,
      statusConceptId: borrador ? ESTADO['ST-DRAFT']! : ESTADO['ST-COMPLETED']!,
      transactionTypeConceptId: TIPO_ASIENTO,
      currencyConceptId: MONEDA_BOB,
      totalAmount: d(debe),
      postedAt: borrador ? null : ahora(),
      description: datos.description ?? '',
      lines: lineas.map((l, i) => ({ id: nuevoId('line'), lineNo: i + 1, accountId: l.accountId, directionConceptId: DIRECCION[l.direction], amountBase: Number(l.amount).toFixed(2), memo: l.memo ?? datos.description ?? '', currencyConceptId: MONEDA_BOB })),
    };
    asientos.agregar(nuevo);
    return { status: 201, body: { id, transactionNumber: nuevo.transactionNumber, status: borrador ? 'DRAFT' : 'POSTED', totalAmount: nuevo.totalAmount, lineCount: nuevo.lines.length, postedAt: nuevo.postedAt } };
  };
  router.post('/accounting/journal-transactions', publicar(false));
  router.post('/accounting/journal-transactions/drafts', publicar(true));

  router.get('/accounting/practitioner/paid-consultations', () => {
    const pagadas = reservas.filtrar((r) => r.paymentState?.state === 'PAID').slice(0, 8);
    const items = pagadas.map((r, i) => ({ invoiceId: uuid(`invoice-${r.id}`), invoiceNumber: `FAC-${2026}-${String(300 + i).padStart(4, '0')}`, encounterId: null, appointmentId: r.appointmentId, patientProfileId: r.patientProfileId, issueDate: r.startAt.slice(0, 10), paidTotal: i % 3 === 0 ? '180.00' : '250.00', currencyConceptId: MONEDA_BOB }));
    return { items, count: items.length };
  });

  router.post('/accounting/practitioner/consultation-income', (request) => {
    const datos = cuerpo<{ practiceId: string; invoiceId: string; debitAccountId: string; creditAccountId: string; transactionDate: string; description?: string }>(request);
    const nuevo = asiento(asientos.tamano + 1, 0, datos.description ?? 'Ingreso por consulta', '1.1', '4.1', '250.00');
    asientos.agregar({ ...nuevo, id: nuevoId('journal'), lines: nuevo.lines.map((l, i) => ({ ...l, accountId: i === 0 ? (datos.debitAccountId ?? l.accountId) : (datos.creditAccountId ?? l.accountId) })) });
    return { status: 201, body: { transactionId: nuevo.id, transactionNumber: nuevo.transactionNumber, status: 'POSTED', totalAmount: '250.00', invoiceId: datos.invoiceId ?? null, notificationRequestId: null } };
  });

  router.post('/accounting/practitioner/entries', (request) => {
    const datos = cuerpo<{ practiceId: string; kind: 'EXPENSE' | 'OTHER_INCOME'; debitAccountId: string; creditAccountId: string; amount: string; transactionDate: string; description: string }>(request);
    const importe = Number(datos.amount ?? 0).toFixed(2);
    const id = nuevoId('journal');
    asientos.agregar({
      id,
      flujo: FLUJO.POSTED,
      practiceId: datos.practiceId ?? PRACTICAS[0]!.id,
      transactionNumber: `AS-2026-${String(1000 + asientos.tamano + 1).padStart(5, '0')}`,
      transactionDate: datos.transactionDate ?? isoDia(0),
      fiscalPeriodId: PERIODO_ACTUAL,
      statusConceptId: ESTADO['ST-COMPLETED']!,
      transactionTypeConceptId: TIPO_ASIENTO,
      currencyConceptId: MONEDA_BOB,
      totalAmount: importe,
      postedAt: ahora(),
      description: datos.description ?? '',
      lines: [
        { id: nuevoId('line'), lineNo: 1, accountId: datos.debitAccountId ?? cuenta('5.2'), directionConceptId: DIRECCION.DEBIT, amountBase: importe, memo: datos.description ?? '', currencyConceptId: MONEDA_BOB },
        { id: nuevoId('line'), lineNo: 2, accountId: datos.creditAccountId ?? cuenta('1.1'), directionConceptId: DIRECCION.CREDIT, amountBase: importe, memo: datos.description ?? '', currencyConceptId: MONEDA_BOB },
      ],
    });
    return { status: 201, body: { transactionId: id, transactionNumber: `AS-2026-${String(1000 + asientos.tamano).padStart(5, '0')}`, status: 'POSTED', totalAmount: importe, invoiceId: null, notificationRequestId: null } };
  });

  router.get('/accounting/general-ledger', ({ query }) => {
    const accountId = texto(query, 'accountId') ?? cuenta('1.1');
    const c = CUENTAS.find((x) => x.id === accountId);
    if (c === undefined) return notFound('Cuenta no encontrada');
    const from = texto(query, 'from');
    const to = texto(query, 'to');
    const deudora = c.normalBalanceConceptId === SALDO.DEUDOR;
    let saldo = 0;
    const previos = asientos.filtrar((a) => a.statusConceptId === ESTADO['ST-COMPLETED'] && from !== null && a.transactionDate < from);
    for (const a of previos) for (const l of a.lines) if (l.accountId === accountId) saldo += (l.directionConceptId === DIRECCION.DEBIT ? 1 : -1) * (deudora ? 1 : -1) * Number(l.amountBase);
    const apertura = saldo;
    const items = asientos
      .filtrar((a) => a.statusConceptId === ESTADO['ST-COMPLETED'] && (from === null || a.transactionDate >= from) && (to === null || a.transactionDate <= to))
      .sort((a, b) => a.transactionDate.localeCompare(b.transactionDate))
      .flatMap((a) =>
        a.lines
          .filter((l) => l.accountId === accountId)
          .map((l) => {
            const esDebe = l.directionConceptId === DIRECCION.DEBIT;
            saldo += (esDebe ? 1 : -1) * (deudora ? 1 : -1) * Number(l.amountBase);
            return { id: l.id, transactionId: a.id, transactionNumber: a.transactionNumber, transactionDate: a.transactionDate, directionConceptId: l.directionConceptId, debit: esDebe ? l.amountBase : '0.00', credit: esDebe ? '0.00' : l.amountBase, runningBalance: d(saldo), memo: l.memo };
          }),
      );
    return { accountId, code: c.code, name: c.name, normalBalanceConceptId: c.normalBalanceConceptId, currencyConceptId: c.currencyConceptId, openingBalance: d(apertura), items, count: items.length, limit: 200, nextCursor: null };
  });

  const lineas = (tipo: keyof typeof TIPO_CUENTA, hasta: string | null) =>
    CUENTAS.filter((c) => c.accountTypeConceptId === TIPO_CUENTA[tipo] && c.parentAccountId !== null).map((c) => {
      const { debit, credit } = saldoDe(c.id, hasta);
      const monto = c.normalBalanceConceptId === SALDO.DEUDOR ? debit - credit : credit - debit;
      return { accountId: c.id, code: c.code, name: c.name, accountTypeConceptId: c.accountTypeConceptId, amount: d(monto) };
    });
  const total = (l: { amount: string }[]) => l.reduce((s, x) => s + Number(x.amount), 0);

  router.get('/accounting/income-statement', ({ query }) => {
    const hasta = texto(query, 'to');
    const revenueItems = lineas('INGRESO', hasta);
    const expenseItems = lineas('GASTO', hasta);
    return { revenueItems, expenseItems, totalRevenue: d(total(revenueItems)), totalExpense: d(total(expenseItems)), netIncome: d(total(revenueItems) - total(expenseItems)), count: revenueItems.length + expenseItems.length, limit: 200, nextCursor: null, truncated: false };
  });

  router.get('/accounting/balance-sheet', ({ query }) => {
    const hasta = texto(query, 'to');
    const assetItems = lineas('ACTIVO', hasta);
    const liabilityItems = lineas('PASIVO', hasta);
    const equityItems = lineas('PATRIMONIO', hasta);
    const neto = total(lineas('INGRESO', hasta)) - total(lineas('GASTO', hasta));
    const totalAssets = total(assetItems);
    const totalLiabilities = total(liabilityItems);
    const totalEquity = total(equityItems) + neto;
    return { assetItems, liabilityItems, equityItems, netIncomeOfPeriod: d(neto), totalAssets: d(totalAssets), totalLiabilities: d(totalLiabilities), totalEquity: d(totalEquity), totalLiabilitiesAndEquity: d(totalLiabilities + totalEquity), balanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.01, count: assetItems.length + liabilityItems.length + equityItems.length, limit: 200, nextCursor: null, truncated: false };
  });

  /* ---- cotizaciones -------------------------------------------------------- */

  router.post('/quotations', (request) => {
    const datos = cuerpo<Partial<Omit<CotizacionSimulada, 'id' | 'serviceNameSnapshot' | 'status'>>>(request);
    const servicio = servicios.get(datos.serviceCatalogId ?? '');
    if (servicio === undefined) return notFound('Servicio no encontrado');
    const nueva: CotizacionSimulada = {
      id: nuevoId('quotation'),
      practiceId: datos.practiceId ?? servicio.practiceId,
      patientProfileId: datos.patientProfileId ?? '',
      attentionDate: datos.attentionDate ?? isoDia(0),
      ...(datos.appointmentId === undefined ? {} : { appointmentId: datos.appointmentId }),
      serviceCatalogId: servicio.id,
      serviceNameSnapshot: servicio.name,
      offeredPrice: datos.offeredPrice ?? Number(servicio.defaultPrice),
      currencyConceptId: datos.currencyConceptId ?? MONEDA_BOB,
      paymentPlanInstallmentCount: datos.installments?.length ?? datos.paymentPlanInstallmentCount ?? 1,
      downPaymentAmount: datos.downPaymentAmount ?? 0,
      paymentFrequency: datos.paymentFrequency ?? 'MONTHLY',
      validUntil: datos.validUntil ?? isoDia(30),
      status: 'DRAFT',
      // El cronograma lo arma el formulario, con sus cambios a mano: se guarda tal cual.
      installments: datos.installments ?? planFlexible(datos.offeredPrice ?? Number(servicio.defaultPrice), datos.downPaymentAmount ?? 0, datos.paymentPlanInstallmentCount ?? 1, datos.attentionDate ?? ''),
    };
    const centavos = (n: number) => Math.round(n * 100);
    const suma = centavos(nueva.downPaymentAmount) + nueva.installments.reduce((t, c) => t + centavos(c.amount), 0);
    if (suma !== centavos(nueva.offeredPrice)) {
      return validation('El anticipo más las cuotas tienen que sumar el precio ofrecido.');
    }
    cotizaciones.agregar(nueva);
    return { status: 201, body: nueva };
  });

  router.get('/quotations', ({ query }) => {
    const patientProfileId = texto(query, 'patientProfileId');
    return cotizaciones
      .filtrar((q) => patientProfileId === null || q.patientProfileId === patientProfileId)
      .map((q) => ({ id: q.id, patientProfileId: q.patientProfileId, serviceNameSnapshot: q.serviceNameSnapshot, offeredPrice: q.offeredPrice, status: q.status, attentionDate: q.attentionDate, validUntil: q.validUntil, patientName: pacientePorId(q.patientProfileId)?.displayName ?? null }));
  });

  router.get('/quotations/:id', ({ params }) => cotizaciones.get(params['id']!) ?? notFound('Cotización no encontrada'));

  /* ---- activos y pasivos ---------------------------------------------------
     Con el prefijo `/accounting/practitioner`, que es el que arma
     `AssetsLiabilitiesClient.url()`. Registradas como `/assets` y
     `/liabilities` a secas no las encontraba nadie: la petición caía en
     `respuestaGenerica`, que para una lectura sin `limit` devuelve `{}`, y la
     pantalla —que espera un arreglo— moría con `t[Symbol.iterator] is not a
     function`. El manejador existía y los datos también; sólo colgaban de la
     ruta equivocada. */

  router.get('/accounting/practitioner/assets', ({ query }) => {
    const practiceId = texto(query, 'practiceId');
    return activos.filtrar((a) => practiceId === null || a.practiceId === practiceId).map(({ practiceId: _p, ...a }) => a);
  });

  router.post('/accounting/practitioner/assets', (request) => {
    const datos = cuerpo<{ practiceId: string; code: string; name: string; acquisitionCost: string }>(request);
    const nuevo = activos.agregar({ id: nuevoId('asset'), practiceId: datos.practiceId ?? PRACTICAS[0]!.id, code: datos.code ?? 'EQ-NUEVO', name: datos.name ?? 'Activo nuevo', statusConceptId: ESTADO['ST-ACTIVE']!, bookValue: datos.acquisitionCost ?? '0.00', acquisitionCost: datos.acquisitionCost ?? '0.00', automated: true });
    return { status: 201, body: { id: nuevo.id } };
  });

  router.patch('/accounting/practitioner/assets/:id/automation', (request) => {
    const datos = cuerpo<{ automated: boolean }>(request);
    activos.actualizar(request.params['id']!, { automated: datos.automated ?? true });
    return { ok: true };
  });

  router.post('/accounting/practitioner/assets/:id/progress', ({ params }) => {
    const a = activos.get(params['id']!);
    if (a === undefined) return notFound('Activo no encontrado');
    const cuotaMensual = Number(a.acquisitionCost) / 60;
    activos.actualizar(a.id, { bookValue: d(Math.max(0, Number(a.bookValue) - cuotaMensual)) });
    return { status: 201, body: { transactionId: nuevoId('journal'), amount: d(cuotaMensual) } };
  });

  router.get('/accounting/practitioner/liabilities', ({ query }) => {
    const practiceId = texto(query, 'practiceId');
    return pasivos.filtrar((p) => practiceId === null || p.practiceId === practiceId).map(({ practiceId: _p, cuotas: _c, pagadas: _q, startDate: _s, interestRate: _i, ...p }) => p);
  });

  router.post('/accounting/practitioner/liabilities', (request) => {
    const datos = cuerpo<{ practiceId: string; code: string; name: string; creditorName?: string; principalAmount: string; interestRate?: string; installments: number; startDate: string; automated?: boolean }>(request);
    const nuevo = pasivos.agregar({ id: nuevoId('liability'), practiceId: datos.practiceId ?? PRACTICAS[0]!.id, code: datos.code ?? 'PR-NUEVO', name: datos.name ?? 'Pasivo nuevo', creditorName: datos.creditorName ?? 'Acreedor', principalAmount: datos.principalAmount ?? '0.00', outstandingAmount: datos.principalAmount ?? '0.00', statusConceptId: ESTADO['ST-ACTIVE']!, automated: datos.automated ?? true, cuotas: datos.installments ?? 12, pagadas: 0, startDate: datos.startDate ?? isoDia(0), interestRate: datos.interestRate ?? '0' });
    return { status: 201, body: { id: nuevo.id, code: nuevo.code, schedule: cronograma(Number(nuevo.principalAmount), nuevo.cuotas, 0, nuevo.startDate, Number(nuevo.interestRate)) } };
  });

  router.patch('/accounting/practitioner/liabilities/:id/automation', (request) => {
    const datos = cuerpo<{ automated: boolean }>(request);
    pasivos.actualizar(request.params['id']!, { automated: datos.automated ?? true });
    return { ok: true };
  });

  router.post('/accounting/practitioner/liabilities/:id/progress', ({ params }) => {
    const p = pasivos.get(params['id']!);
    if (p === undefined) return notFound('Pasivo no encontrado');
    if (p.pagadas >= p.cuotas) return preconditionFailed('El pasivo ya está saldado');
    const capital = Number(p.principalAmount) / p.cuotas;
    pasivos.actualizar(p.id, { pagadas: p.pagadas + 1, outstandingAmount: d(Math.max(0, Number(p.outstandingAmount) - capital)), statusConceptId: p.pagadas + 1 >= p.cuotas ? ESTADO['ST-CLOSED']! : p.statusConceptId });
    return { status: 201, body: { transactionId: nuevoId('journal'), installmentNumber: p.pagadas + 1, amount: d(capital) } };
  });
}

/* Sobreviven a F5 dentro de la pestaña: ver `Coleccion.persistirEn`. */
asientos.persistirEn('mock.finance.asientos');
cotizaciones.persistirEn('mock.finance.cotizaciones');
activos.persistirEn('mock.finance.activos');
pasivos.persistirEn('mock.finance.pasivos');
periodos.persistirEn('mock.finance.periodos');
partidasAbiertas.persistirEn('mock.finance.partidasAbiertas');
devengos.persistirEn('mock.finance.devengos');
