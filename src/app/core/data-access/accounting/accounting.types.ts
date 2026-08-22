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
