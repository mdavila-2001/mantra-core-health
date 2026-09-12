/* ============================================================================
    Tipos de la contabilidad tal como los usa la vista.

    ## El dinero viaja como texto, y acá se queda como texto

    La API declara los importes `decimal como texto` (`"1250.00"`), no como
    número. Convertirlos a `number` en la frontera sería el error clásico: un
    `float` de doble precisión no representa exactamente 0,1 — `0.1 + 0.2` da
    `0.30000000000000004`— y un balance descuadrado por un céntimo no se
    distingue de uno con un error contable real.

    Así que el importe **no se convierte**: se transporta como cadena y se
    formatea para mostrar. Sumar del lado del navegador está prohibido; para eso
    está `totalDebit`/`totalCredit`, que la API calcula con enteros.
    ========================================================================== */

/** Una práctica de la organización: es lo que da el `practiceId` de los libros. */
export interface Practice {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly typeConceptId: string;
  readonly statusConceptId: string;
  readonly currencyConceptId?: string;
  readonly timeZone?: string;
}

/** Una cuenta del plan contable. */
export interface LedgerAccount {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly accountTypeConceptId: string;
  /** Deudora o acreedora: es lo que da signo al saldo. */
  readonly normalBalanceConceptId: string;
  readonly parentAccountId?: string;
  readonly currencyConceptId?: string;
}

/** Un asiento tal como lo lista el diario. */
export interface JournalTransaction {
  readonly id: string;
  readonly transactionNumber?: string;
  readonly transactionDate: Date;
  readonly fiscalPeriodId?: string;
  readonly statusConceptId: string;
  readonly transactionTypeConceptId?: string;
  readonly currencyConceptId?: string;
  /** Decimal como texto. No convertir a número: ver la cabecera del archivo. */
  readonly totalAmount?: string;
  readonly postedAt?: Date;
  /**
   * Dónde está el documento en el flujo de seis pasos.
   *
   * Es distinto de `statusConceptId`, que es el concepto de terminología: éste
   * es el **código** del estado, que es lo que la pantalla necesita para saber
   * qué acción ofrecer. Opcional porque la API todavía no lo publica en el
   * listado; cuando falta, un asiento con `postedAt` se lee como posteado.
   */
  readonly status?: WorkflowStatus;
}

/** Una línea del asiento: contra qué cuenta y de qué lado. */
export interface LedgerEntry {
  readonly id: string;
  readonly lineNo?: number;
  readonly accountId: string;
  /** Debe o haber. */
  readonly directionConceptId: string;
  /** Importe en moneda base, decimal como texto. */
  readonly amountBase: string;
  readonly costCenterId?: string;
  readonly currencyConceptId?: string;
}

/** El asiento con sus líneas — lo que se audita. */
export interface JournalTransactionDetail extends JournalTransaction {
  readonly practiceId: string;
  readonly lines: readonly LedgerEntry[];
}

/** Una fila del balance de sumas y saldos. */
export interface TrialBalanceRow {
  readonly accountId: string;
  readonly code?: string;
  readonly name?: string;
  readonly normalBalanceConceptId?: string;
  /** Suma del debe, decimal como texto. */
  readonly debit: string;
  /** Suma del haber, decimal como texto. */
  readonly credit: string;
  /** Saldo **con signo por naturaleza**: un pasivo correcto sale positivo. */
  readonly balance: string;
}

/**
 * El balance de sumas y saldos.
 *
 * `balanced` lo declara la API en vez de dejar que la pantalla sume dos
 * columnas: es la comprobación que se hace primero y de la que depende que el
 * resto del informe signifique algo. `truncated` importa por lo mismo — un
 * balance recortado en silencio es un balance que miente.
 */
export interface TrialBalance {
  readonly items: readonly TrialBalanceRow[];
  readonly count: number;
  readonly totalDebit: string;
  readonly totalCredit: string;
  readonly balanced: boolean;
  /** Asientos POSTEADOS incluidos en la agregación. */
  readonly transactionsIncluded: number;
  readonly truncated: boolean;
}

/** Una página del plan de cuentas. */
export interface ChartOfAccounts {
  readonly items: readonly LedgerAccount[];
  readonly count: number;
  readonly limit: number;
}

/** Una página del libro diario. */
export interface JournalPage {
  readonly items: readonly JournalTransaction[];
  readonly count: number;
  readonly limit: number;
}

/** Filtros del libro diario. */
export interface JournalQuery {
  readonly fiscalPeriodId?: string;
  readonly statusConceptId?: string;
  /** `YYYY-MM-DD`. */
  readonly from?: string;
  /** `YYYY-MM-DD`. */
  readonly to?: string;
  readonly limit?: number;
}

/* ============================================================================
    Carril 18 — auto-servicio contable del doctor.

    Una consulta pagada sin asiento todavía, y el resultado de registrar un
    movimiento (ingreso de consulta, gasto u otro ingreso). El importe de una
    consulta pagada sigue siendo texto decimal, por la misma razón que el
    resto del módulo.
    ========================================================================== */

/** Una factura pagada del profesional, sin asiento contable todavía. */
export interface PaidConsultation {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly encounterId?: string;
  readonly appointmentId?: string;
  readonly patientProfileId: string;
  readonly issueDate: Date;
  /** Decimal como texto. */
  readonly paidTotal: string;
  readonly currencyConceptId?: string;
}

/** Cuerpo de "registrar ingreso por consulta pagada". */
export interface RegisterConsultationIncomeInput {
  readonly practiceId: string;
  readonly invoiceId: string;
  readonly debitAccountId: string;
  readonly creditAccountId: string;
  /** `YYYY-MM-DD`. */
  readonly transactionDate: string;
  readonly description?: string;
  readonly fileId?: string;
}

/** Cuerpo de "registrar un gasto u otro ingreso". */
export interface RegisterSimpleEntryInput {
  readonly practiceId: string;
  readonly kind: 'EXPENSE' | 'OTHER_INCOME';
  readonly debitAccountId: string;
  readonly creditAccountId: string;
  /** Decimal como texto. */
  readonly amount: string;
  /** `YYYY-MM-DD`. */
  readonly transactionDate: string;
  readonly description: string;
  readonly fileId?: string;
}

/** Resultado común de registrar un movimiento del auto-servicio. */
export interface PractitionerEntryResult {
  readonly transactionId: string;
  readonly transactionNumber: string;
  readonly status: string;
  /** Decimal como texto. */
  readonly totalAmount: string;
  readonly invoiceId?: string;
  readonly notificationRequestId?: string;
}

/* ============================================================================
    TAREA-20 S2 — MODO CONTADOR: asiento de N filas.
    ========================================================================== */

/** Una fila del formulario de N filas, antes de enviarla. */
export interface JournalLineInput {
  readonly accountId: string;
  readonly direction: 'DEBIT' | 'CREDIT';
  /** Decimal como texto, positivo. */
  readonly amount: string;
  readonly memo?: string;
}

/** Cuerpo de `POST /accounting/journal-transactions` y `.../drafts`. */
export interface PostJournalInput {
  readonly practiceId: string;
  readonly transactionDate: string;
  readonly description?: string;
  readonly lines: readonly JournalLineInput[];
}

/** Respuesta al crear o postear un asiento. */
export interface PostedJournalResult {
  readonly id: string;
  readonly transactionNumber: string;
  readonly status: string;
  readonly totalAmount: string;
  readonly lineCount: number;
  readonly postedAt?: Date;
}

/* ============================================================================
    TAREA-20 S3 — libro mayor, estado de resultados, balance general.
    ========================================================================== */

/** Un movimiento del libro mayor de una cuenta, con saldo corrido. */
export interface GeneralLedgerEntry {
  readonly id: string;
  readonly transactionId: string;
  readonly transactionNumber?: string;
  readonly transactionDate: Date;
  readonly directionConceptId: string;
  /** Decimal como texto. */
  readonly debit: string;
  /** Decimal como texto. */
  readonly credit: string;
  /** Saldo acumulado, con signo por naturaleza, decimal como texto. */
  readonly runningBalance: string;
  readonly memo?: string;
}

/** El libro mayor de una cuenta: una página de movimientos con saldo corrido. */
export interface GeneralLedgerPage {
  readonly accountId: string;
  readonly code?: string;
  readonly name?: string;
  readonly normalBalanceConceptId?: string;
  readonly currencyConceptId?: string;
  /** Saldo antes de la primera fila de esta página, decimal como texto. */
  readonly openingBalance: string;
  readonly items: readonly GeneralLedgerEntry[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Filtros del libro mayor. */
export interface GeneralLedgerQuery {
  readonly accountId: string;
  readonly from?: string;
  readonly to?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Una cuenta agregada en un estado financiero. */
export interface FinancialStatementLine {
  readonly accountId: string;
  readonly code?: string;
  readonly name?: string;
  readonly accountTypeConceptId: string;
  /** Decimal como texto, con signo por naturaleza. */
  readonly amount: string;
}

/** Filtros compartidos por estado de resultados y balance general. */
export interface FinancialStatementQuery {
  readonly fiscalPeriodId?: string;
  readonly from?: string;
  readonly to?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/** El estado de resultados de una ventana. */
export interface IncomeStatement {
  readonly revenueItems: readonly FinancialStatementLine[];
  readonly expenseItems: readonly FinancialStatementLine[];
  readonly totalRevenue: string;
  readonly totalExpense: string;
  readonly netIncome: string;
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
  readonly truncated: boolean;
}

/** El balance general a una fecha de corte. */
export interface BalanceSheet {
  readonly assetItems: readonly FinancialStatementLine[];
  readonly liabilityItems: readonly FinancialStatementLine[];
  readonly equityItems: readonly FinancialStatementLine[];
  readonly netIncomeOfPeriod: string;
  readonly totalAssets: string;
  readonly totalLiabilities: string;
  readonly totalEquity: string;
  readonly totalLiabilitiesAndEquity: string;
  readonly balanced: boolean;
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
  readonly truncated: boolean;
}

/* ============================================================================
    El plano SAP: ejercicio y períodos, flujo del documento, partidas abiertas
    y objetos de controlling.

    Los nombres son los de las tablas del módulo 16 del modelo canónico
    —`fiscal_periods`, `open_items`, `clearing_documents`, `cost_centers`,
    `profit_centers`, `segments`— y los estados, los que la API declara en
    `accounting.concepts.ts`. No se inventó vocabulario: el día que la API
    publique estas lecturas, la pantalla no cambia de idioma.
    ========================================================================== */

/** Los seis estados por los que pasa un asiento antes de existir en el mayor. */
export type WorkflowStatus =
  | 'DRAFT'
  | 'AUTO_CLASSIFIED'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'POSTED'
  | 'REVERSED';

/** Las cinco acciones que mueven ese estado. Son las de la API, no más. */
export type WorkflowAction = 'classify' | 'submit-review' | 'approve' | 'post' | 'reverse';

/** Un período contable. Cerrado no admite asientos: eso es cerrar el mes. */
export interface FiscalPeriod {
  readonly id: string;
  readonly periodNumber: number;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly status: 'CLOSED' | 'OPEN' | 'PLANNED';
  readonly closedAt?: string;
}

export interface FiscalYear {
  readonly fiscalYearId: string;
  readonly name: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly currentPeriodId: string;
  readonly periods: readonly FiscalPeriod[];
}

/** Una factura pendiente de cobro o de pago, con su antigüedad. */
export interface OpenItem {
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
  readonly openAmount: string;
  readonly overdueDays: number;
  readonly agingBucket: string;
}

/** Un tramo de antigüedad de la cartera. */
export interface AgingBucket {
  readonly bucket: string;
  readonly label: string;
  readonly receivable: string;
  readonly payable: string;
  readonly count: number;
}

export interface OpenItemsPage {
  readonly items: readonly OpenItem[];
  readonly aging: readonly AgingBucket[];
  readonly totalReceivable: string;
  readonly totalPayable: string;
}

/** Un centro de coste, de beneficio o un segmento, con su resultado. */
export interface ControllingObject {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly kind: 'COST_CENTER' | 'PROFIT_CENTER' | 'SEGMENT';
  readonly debit: string;
  readonly credit: string;
  readonly result: string;
}

/** Un documento del flujo: el original, éste, y sus reversiones. */
export interface DocumentFlowNode {
  readonly id: string;
  readonly role: string;
  readonly transactionNumber: string;
  readonly transactionDate: string;
  readonly totalAmount: string;
  readonly status: WorkflowStatus;
}

/** Lo que devuelve compensar un grupo de partidas. */
export interface ClearingResult {
  readonly clearingDocumentId: string;
  readonly clearedItems: number;
  readonly clearedAmount: string;
}
