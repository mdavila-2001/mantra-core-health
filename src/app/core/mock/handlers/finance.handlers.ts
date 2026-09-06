import { reservas } from '../fixtures/agenda';
import { ESTADO } from '../fixtures/conceptos';
import { PACIENTES, pacientePorId } from '../fixtures/personas';
import { PRACTICAS, servicios } from './practice.handlers';
import { notFound, preconditionFailed, type MockRouter } from '../mock-router';
import { ahora, Coleccion, cuerpo, iso, isoDia, nuevoId, texto, uuid } from '../mock-store';

/* ============================================================================
    Contabilidad (plan de cuentas, diario, mayor, balances), cotizaciones con
    simulador de cuotas y activos/pasivos del profesional.
    ========================================================================== */

const TIPO_CUENTA = { ACTIVO: uuid('concept-account-type-asset'), PASIVO: uuid('concept-account-type-liability'), PATRIMONIO: uuid('concept-account-type-equity'), INGRESO: uuid('concept-account-type-revenue'), GASTO: uuid('concept-account-type-expense') } as const;
const SALDO = { DEUDOR: uuid('concept-normal-balance-debit'), ACREEDOR: uuid('concept-normal-balance-credit') } as const;
const DIRECCION = { DEBIT: uuid('concept-direction-debit'), CREDIT: uuid('concept-direction-credit') } as const;
const MONEDA_BOB = uuid('concept-currency-bob');
const TIPO_ASIENTO = uuid('concept-transaction-type-standard');
const PERIODO_ACTUAL = uuid('fiscal-period-2026');

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
  readonly lines: readonly { id: string; lineNo: number; accountId: string; directionConceptId: string; amountBase: string; memo: string; currencyConceptId: string }[];
}

function asiento(indice: number, dias: number, descripcion: string, debito: string, credito: string, importe: string, borrador = false): AsientoSimulado {
  const id = uuid(`journal-${indice}`);
  return {
    id,
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

function simular(offeredPrice: number, installmentCount: number, interestRatePercent: number, method: 'FLAT' | 'FRENCH', attentionDate: string) {
  const n = Math.max(1, installmentCount);
  const tasa = interestRatePercent / 100 / 12;
  const base = new Date(attentionDate === '' ? ahora() : attentionDate);
  const cuotas = [];
  if (method === 'FRENCH' && tasa > 0) {
    const cuota = (offeredPrice * tasa) / (1 - Math.pow(1 + tasa, -n));
    let saldo = offeredPrice;
    for (let i = 1; i <= n; i++) {
      const interes = saldo * tasa;
      const capital = cuota - interes;
      saldo -= capital;
      const due = new Date(base);
      due.setMonth(due.getMonth() + i);
      cuotas.push({ installmentNumber: i, dueDate: due.toISOString().slice(0, 10), principalAmount: Number(capital.toFixed(2)), interestAmount: Number(interes.toFixed(2)), totalAmount: Number(cuota.toFixed(2)) });
    }
  } else {
    const capital = offeredPrice / n;
    const interes = (offeredPrice * tasa * n) / n;
    for (let i = 1; i <= n; i++) {
      const due = new Date(base);
      due.setMonth(due.getMonth() + i);
      cuotas.push({ installmentNumber: i, dueDate: due.toISOString().slice(0, 10), principalAmount: Number(capital.toFixed(2)), interestAmount: Number(interes.toFixed(2)), totalAmount: Number((capital + interes).toFixed(2)) });
    }
  }
  return cuotas;
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
  readonly interestRatePercent: number;
  readonly interestCalculationMethod: 'FLAT' | 'FRENCH';
  readonly validUntil: string;
  readonly status: string;
  readonly installments: readonly { installmentNumber: number; dueDate: string; principalAmount: number; interestAmount: number; totalAmount: number }[];
}

const cotizaciones = new Coleccion<CotizacionSimulada>(
  [
    [0, 'PAQ-PREV', 890, 3, 5, 'FLAT', -10, 20, 'ACCEPTED'],
    [5, 'ECO-DOPPLER', 480, 2, 0, 'FLAT', -4, 26, 'DRAFT'],
    [8, 'ERGO', 520, 4, 8, 'FRENCH', -20, -5, 'EXPIRED'],
    [2, 'HOLTER', 350, 1, 0, 'FLAT', -1, 29, 'SENT'],
  ].map(([pac, codigo, precio, cuotas, tasa, metodo, dias, validez, status], i) => {
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
      interestRatePercent: tasa as number,
      interestCalculationMethod: metodo as 'FLAT' | 'FRENCH',
      validUntil: isoDia(validez as number),
      status: status as string,
      installments: simular(precio as number, cuotas as number, tasa as number, metodo as 'FLAT' | 'FRENCH', isoDia(dias as number)),
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

export function registrarFinanzas(router: MockRouter): void {
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

  router.post('/quotations/simulate', (request) => {
    const datos = cuerpo<{ offeredPrice: number; installmentCount: number; interestRatePercent: number; interestCalculationMethod: 'FLAT' | 'FRENCH'; attentionDate: string }>(request);
    return { installments: simular(datos.offeredPrice ?? 0, datos.installmentCount ?? 1, datos.interestRatePercent ?? 0, datos.interestCalculationMethod ?? 'FLAT', datos.attentionDate ?? '') };
  });

  router.post('/quotations', (request) => {
    const datos = cuerpo<Omit<CotizacionSimulada, 'id' | 'serviceNameSnapshot' | 'status' | 'installments'>>(request);
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
      paymentPlanInstallmentCount: datos.paymentPlanInstallmentCount ?? 1,
      interestRatePercent: datos.interestRatePercent ?? 0,
      interestCalculationMethod: datos.interestCalculationMethod ?? 'FLAT',
      validUntil: datos.validUntil ?? isoDia(30),
      status: 'DRAFT',
      installments: simular(datos.offeredPrice ?? Number(servicio.defaultPrice), datos.paymentPlanInstallmentCount ?? 1, datos.interestRatePercent ?? 0, datos.interestCalculationMethod ?? 'FLAT', datos.attentionDate ?? ''),
    };
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

  /* ---- activos y pasivos --------------------------------------------------- */

  router.get('/assets', ({ query }) => {
    const practiceId = texto(query, 'practiceId');
    return activos.filtrar((a) => practiceId === null || a.practiceId === practiceId).map(({ practiceId: _p, ...a }) => a);
  });

  router.post('/assets', (request) => {
    const datos = cuerpo<{ practiceId: string; code: string; name: string; acquisitionCost: string }>(request);
    const nuevo = activos.agregar({ id: nuevoId('asset'), practiceId: datos.practiceId ?? PRACTICAS[0]!.id, code: datos.code ?? 'EQ-NUEVO', name: datos.name ?? 'Activo nuevo', statusConceptId: ESTADO['ST-ACTIVE']!, bookValue: datos.acquisitionCost ?? '0.00', acquisitionCost: datos.acquisitionCost ?? '0.00', automated: true });
    return { status: 201, body: { id: nuevo.id } };
  });

  router.patch('/assets/:id/automation', (request) => {
    const datos = cuerpo<{ automated: boolean }>(request);
    activos.actualizar(request.params['id']!, { automated: datos.automated ?? true });
    return { ok: true };
  });

  router.post('/assets/:id/progress', ({ params }) => {
    const a = activos.get(params['id']!);
    if (a === undefined) return notFound('Activo no encontrado');
    const cuotaMensual = Number(a.acquisitionCost) / 60;
    activos.actualizar(a.id, { bookValue: d(Math.max(0, Number(a.bookValue) - cuotaMensual)) });
    return { status: 201, body: { transactionId: nuevoId('journal'), amount: d(cuotaMensual) } };
  });

  router.get('/liabilities', ({ query }) => {
    const practiceId = texto(query, 'practiceId');
    return pasivos.filtrar((p) => practiceId === null || p.practiceId === practiceId).map(({ practiceId: _p, cuotas: _c, pagadas: _q, startDate: _s, interestRate: _i, ...p }) => p);
  });

  router.post('/liabilities', (request) => {
    const datos = cuerpo<{ practiceId: string; code: string; name: string; creditorName?: string; principalAmount: string; interestRate?: string; installments: number; startDate: string; automated?: boolean }>(request);
    const nuevo = pasivos.agregar({ id: nuevoId('liability'), practiceId: datos.practiceId ?? PRACTICAS[0]!.id, code: datos.code ?? 'PR-NUEVO', name: datos.name ?? 'Pasivo nuevo', creditorName: datos.creditorName ?? 'Acreedor', principalAmount: datos.principalAmount ?? '0.00', outstandingAmount: datos.principalAmount ?? '0.00', statusConceptId: ESTADO['ST-ACTIVE']!, automated: datos.automated ?? true, cuotas: datos.installments ?? 12, pagadas: 0, startDate: datos.startDate ?? isoDia(0), interestRate: datos.interestRate ?? '0' });
    return { status: 201, body: { id: nuevo.id, code: nuevo.code, schedule: cronograma(Number(nuevo.principalAmount), nuevo.cuotas, 0, nuevo.startDate, Number(nuevo.interestRate)) } };
  });

  router.patch('/liabilities/:id/automation', (request) => {
    const datos = cuerpo<{ automated: boolean }>(request);
    pasivos.actualizar(request.params['id']!, { automated: datos.automated ?? true });
    return { ok: true };
  });

  router.post('/liabilities/:id/progress', ({ params }) => {
    const p = pasivos.get(params['id']!);
    if (p === undefined) return notFound('Pasivo no encontrado');
    if (p.pagadas >= p.cuotas) return preconditionFailed('El pasivo ya está saldado');
    const capital = Number(p.principalAmount) / p.cuotas;
    pasivos.actualizar(p.id, { pagadas: p.pagadas + 1, outstandingAmount: d(Math.max(0, Number(p.outstandingAmount) - capital)), statusConceptId: p.pagadas + 1 >= p.cuotas ? ESTADO['ST-CLOSED']! : p.statusConceptId });
    return { status: 201, body: { transactionId: nuevoId('journal'), installmentNumber: p.pagadas + 1, amount: d(capital) } };
  });
}
