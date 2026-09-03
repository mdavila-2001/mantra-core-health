import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly, sinNulos, type ConNulos } from '../wire';
import type {
  BalanceSheet,
  ChartOfAccounts,
  FinancialStatementLine,
  FinancialStatementQuery,
  GeneralLedgerEntry,
  GeneralLedgerPage,
  GeneralLedgerQuery,
  IncomeStatement,
  JournalPage,
  JournalQuery,
  JournalTransaction,
  JournalTransactionDetail,
  LedgerAccount,
  LedgerEntry,
  PaidConsultation,
  PostedJournalResult,
  PostJournalInput,
  Practice,
  PractitionerEntryResult,
  RegisterConsultationIncomeInput,
  RegisterSimpleEntryInput,
  TrialBalance,
  TrialBalanceRow,
} from './accounting.types';

/**
 * Los libros contables: plan de cuentas, diario, el asiento con sus líneas y el
 * balance de sumas y saldos.
 *
 * ## Por qué existe este cliente
 *
 * El módulo contable de la API tenía veinte escrituras y ninguna lectura: se
 * podían postear asientos y no había forma de verlos. Con las cuatro lecturas
 * abiertas, esta es la cara de pantalla — la sección que se echaba en falta.
 *
 * ## Todo cuelga de un `practiceId`
 *
 * Ninguna de las cuatro lecturas responde sin él, y no hay «la práctica del
 * usuario»: una organización puede tener varias. Por eso `listPractices()` va
 * primero; sin esa lista la pantalla no tiene qué pedir.
 *
 * ## El dinero no se convierte
 *
 * Los importes llegan como texto decimal y se quedan como texto. Ver la
 * cabecera de `accounting.types.ts`.
 */
@Injectable({ providedIn: 'root' })
export class AccountingClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /practices` — las prácticas de la organización activa.
   *
   * Acota por el tenant de la sesión del lado del servidor; acá no viaja
   * ningún filtro.
   */
  listPractices(): Observable<readonly Practice[]> {
    return this.http
      .get<RespuestaPracticas>(this.url('/practices'))
      .pipe(map((body) => body.items.map(aPractica)));
  }

  /** `GET /accounting/accounts` — el plan de cuentas de una práctica. */
  chartOfAccounts(practiceId: string, limit?: number): Observable<ChartOfAccounts> {
    let params = new HttpParams().set('practiceId', practiceId);
    if (limit !== undefined) {
      params = params.set('limit', String(limit));
    }

    return this.http
      .get<RespuestaCuentas>(this.url('/accounting/accounts'), { params })
      .pipe(map((body) => ({ ...body, items: body.items.map(aCuenta) })));
  }

  /**
   * `GET /accounting/trial-balance` — el balance de sumas y saldos.
   *
   * Agrega **sólo lo posteado**: un borrador no es un hecho contable.
   */
  trialBalance(
    practiceId: string,
    ventana: Pick<JournalQuery, 'fiscalPeriodId' | 'from' | 'to'> = {},
  ): Observable<TrialBalance> {
    return this.http
      .get<RespuestaBalance>(this.url('/accounting/trial-balance'), {
        params: conFiltros(new HttpParams().set('practiceId', practiceId), ventana),
      })
      .pipe(map((body) => ({ ...body, items: body.items.map(aFilaDeBalance) })));
  }

  /** `GET /accounting/journal-transactions` — el libro diario. */
  listJournal(practiceId: string, query: JournalQuery = {}): Observable<JournalPage> {
    let params = conFiltros(new HttpParams().set('practiceId', practiceId), query);
    if (query.statusConceptId !== undefined) {
      params = params.set('statusConceptId', query.statusConceptId);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<RespuestaDiario>(this.url('/accounting/journal-transactions'), { params })
      .pipe(map((body) => ({ ...body, items: body.items.map(aAsiento) })));
  }

  /** `GET /accounting/journal-transactions/{id}` — el asiento con sus líneas. */
  getJournalTransaction(transactionId: string): Observable<JournalTransactionDetail> {
    return this.http
      .get<ConNulos<WireAsientoDetalle>>(
        this.url(`/accounting/journal-transactions/${transactionId}`),
      )
      .pipe(map(aAsientoDetallado));
  }

  /**
   * `GET /accounting/practitioner/paid-consultations` — Carril 18: facturas
   * pagadas del profesional autenticado, en esa práctica, sin asiento
   * contable todavía.
   */
  listPaidConsultations(practiceId: string): Observable<readonly PaidConsultation[]> {
    return this.http
      .get<RespuestaConsultasPagadas>(
        this.url('/accounting/practitioner/paid-consultations'),
        { params: new HttpParams().set('practiceId', practiceId) },
      )
      .pipe(map((body) => body.items.map(aConsultaPagada)));
  }

  /**
   * `POST /accounting/practitioner/consultation-income` — registra el
   * ingreso de una consulta ya pagada. El importe lo calcula el servidor a
   * partir de la factura; acá solo se eligen las cuentas.
   */
  registerConsultationIncome(
    input: RegisterConsultationIncomeInput,
  ): Observable<PractitionerEntryResult> {
    return this.http
      .post<WireResultado>(
        this.url('/accounting/practitioner/consultation-income'),
        input,
      )
      .pipe(map(aResultado));
  }

  /** `POST /accounting/practitioner/entries` — gasto u otro ingreso. */
  registerSimpleEntry(
    input: RegisterSimpleEntryInput,
  ): Observable<PractitionerEntryResult> {
    return this.http
      .post<WireResultado>(this.url('/accounting/practitioner/entries'), input)
      .pipe(map(aResultado));
  }

  /**
   * `GET /accounting/general-ledger` — el libro mayor de **una** cuenta, con
   * saldo corrido. Pagina por cursor (AC-20-14): pasar `query.cursor` con el
   * `nextCursor` de la página anterior, nunca un número de página.
   */
  generalLedger(practiceId: string, query: GeneralLedgerQuery): Observable<GeneralLedgerPage> {
    let params = new HttpParams()
      .set('practiceId', practiceId)
      .set('accountId', query.accountId);
    if (query.from !== undefined) params = params.set('from', query.from);
    if (query.to !== undefined) params = params.set('to', query.to);
    if (query.cursor !== undefined) params = params.set('cursor', query.cursor);
    if (query.limit !== undefined) params = params.set('limit', String(query.limit));

    return this.http
      .get<RespuestaMayor>(this.url('/accounting/general-ledger'), { params })
      .pipe(map(aLibroMayor));
  }

  /**
   * `GET /accounting/income-statement` — ingresos y gastos posteados de la
   * ventana pedida. Agrega desde la misma fuente que el libro mayor: no debe
   * dar un número distinto para la misma cuenta y período.
   */
  incomeStatement(
    practiceId: string,
    query: FinancialStatementQuery = {},
  ): Observable<IncomeStatement> {
    return this.http
      .get<RespuestaEstadoDeResultados>(this.url('/accounting/income-statement'), {
        params: conFiltrosFinancieros(new HttpParams().set('practiceId', practiceId), query),
      })
      .pipe(
        map((body) => ({
          ...body,
          revenueItems: body.revenueItems.map(aLineaFinanciera),
          expenseItems: body.expenseItems.map(aLineaFinanciera),
        })),
      );
  }

  /**
   * `GET /accounting/balance-sheet` — activo, pasivo y patrimonio a una
   * fecha de corte (`query.to`). Distinto del balance de sumas y saldos.
   */
  balanceSheet(
    practiceId: string,
    query: FinancialStatementQuery = {},
  ): Observable<BalanceSheet> {
    return this.http
      .get<RespuestaBalanceGeneral>(this.url('/accounting/balance-sheet'), {
        params: conFiltrosFinancieros(new HttpParams().set('practiceId', practiceId), query),
      })
      .pipe(
        map((body) => ({
          ...body,
          assetItems: body.assetItems.map(aLineaFinanciera),
          liabilityItems: body.liabilityItems.map(aLineaFinanciera),
          equityItems: body.equityItems.map(aLineaFinanciera),
        })),
      );
  }

  /**
   * `POST /accounting/journal-transactions/drafts` — MODO CONTADOR (TAREA-20
   * S2): crea el asiento de N filas en borrador, **sin postear**. El servidor
   * sigue exigiendo que balancee antes de guardar (P-20-2, sin resolver): el
   * front no debilita esa validación, sólo la anticipa en vivo.
   */
  createJournalDraft(input: PostJournalInput): Observable<PostedJournalResult> {
    return this.http
      .post<WirePosteo>(this.url('/accounting/journal-transactions/drafts'), input)
      .pipe(map(aPosteo));
  }

  /**
   * `POST /accounting/journal-transactions` — MODO CONTADOR: registra y
   * postea el asiento de N filas en un solo paso (atajo directo, sin pasar
   * por revisión/aprobación).
   */
  postJournal(input: PostJournalInput): Observable<PostedJournalResult> {
    return this.http
      .post<WirePosteo>(this.url('/accounting/journal-transactions'), input)
      .pipe(map(aPosteo));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** Añade los filtros de estado de resultados / balance general sólo si vienen. */
function conFiltrosFinancieros(
  params: HttpParams,
  query: FinancialStatementQuery,
): HttpParams {
  let resultado = params;
  if (query.fiscalPeriodId !== undefined) {
    resultado = resultado.set('fiscalPeriodId', query.fiscalPeriodId);
  }
  if (query.from !== undefined) resultado = resultado.set('from', query.from);
  if (query.to !== undefined) resultado = resultado.set('to', query.to);
  if (query.cursor !== undefined) resultado = resultado.set('cursor', query.cursor);
  if (query.limit !== undefined) resultado = resultado.set('limit', String(query.limit));
  return resultado;
}

/**
 * Añade los filtros comunes sólo si vienen.
 *
 * Un opcional en `undefined` viajaría como clave declarada y la API lo
 * devolvería 400 por `forbidNonWhitelisted`.
 */
function conFiltros(
  params: HttpParams,
  query: Pick<JournalQuery, 'fiscalPeriodId' | 'from' | 'to'>,
): HttpParams {
  let resultado = params;
  if (query.fiscalPeriodId !== undefined) {
    resultado = resultado.set('fiscalPeriodId', query.fiscalPeriodId);
  }
  if (query.from !== undefined) {
    resultado = resultado.set('from', query.from);
  }
  if (query.to !== undefined) {
    resultado = resultado.set('to', query.to);
  }
  return resultado;
}

/* ---- formas de transporte -------------------------------------------------
   Los opcionales vacíos llegan como `null` y las fechas como texto ISO; se
   normaliza acá, en la frontera, como manda `wire.ts`. Los importes NO se
   tocan: son texto decimal a propósito. */

type WirePractica = ConNulos<Practice>;
type WireCuenta = ConNulos<LedgerAccount>;
type WireLinea = ConNulos<LedgerEntry>;
type WireFilaDeBalance = ConNulos<TrialBalanceRow>;

interface WireAsiento {
  readonly id: string;
  readonly transactionNumber: string | null;
  readonly transactionDate: string;
  readonly fiscalPeriodId: string | null;
  readonly statusConceptId: string;
  readonly transactionTypeConceptId: string | null;
  readonly currencyConceptId: string | null;
  readonly totalAmount: string | null;
  readonly postedAt: string | null;
}

interface WireAsientoDetalle extends WireAsiento {
  readonly practiceId: string;
  readonly lines: readonly WireLinea[];
}

interface RespuestaPracticas {
  readonly items: readonly WirePractica[];
  readonly count: number;
}

interface RespuestaCuentas {
  readonly items: readonly WireCuenta[];
  readonly count: number;
  readonly limit: number;
}

interface RespuestaDiario {
  readonly items: readonly WireAsiento[];
  readonly count: number;
  readonly limit: number;
}

interface RespuestaBalance {
  readonly items: readonly WireFilaDeBalance[];
  readonly count: number;
  readonly totalDebit: string;
  readonly totalCredit: string;
  readonly balanced: boolean;
  readonly transactionsIncluded: number;
  readonly truncated: boolean;
}

function aPractica(body: WirePractica): Practice {
  return sinNulos(body);
}

function aCuenta(body: WireCuenta): LedgerAccount {
  return sinNulos(body);
}

function aLinea(body: WireLinea): LedgerEntry {
  return sinNulos(body);
}

function aFilaDeBalance(body: WireFilaDeBalance): TrialBalanceRow {
  return sinNulos(body);
}

function aAsiento(body: WireAsiento): JournalTransaction {
  const { transactionDate, postedAt, ...resto } = body;
  return {
    ...sinNulos(resto),
    // La fecha del asiento es un día, no un instante: anclada a medianoche UTC
    // y pintada en hora local retrocedería un día al oeste de Greenwich.
    transactionDate: maybeDateOnly(transactionDate) ?? new Date(transactionDate),
    ...(maybeDate(postedAt) === undefined ? {} : { postedAt: maybeDate(postedAt) }),
  };
}

function aAsientoDetallado(
  body: ConNulos<WireAsientoDetalle>,
): JournalTransactionDetail {
  const { lines, practiceId, ...cabecera } = body;
  return {
    ...aAsiento(cabecera as WireAsiento),
    practiceId: practiceId as string,
    lines: ((lines ?? []) as readonly WireLinea[]).map(aLinea),
  };
}

/* ---- Carril 18: auto-servicio contable del doctor ------------------------- */

interface WireConsultaPagada {
  readonly invoiceId: string;
  readonly invoiceNumber: string;
  readonly encounterId: string | null;
  readonly appointmentId: string | null;
  readonly patientProfileId: string;
  readonly issueDate: string;
  readonly paidTotal: string;
  readonly currencyConceptId: string | null;
}

interface WireResultado {
  readonly transactionId: string;
  readonly transactionNumber: string;
  readonly status: string;
  readonly totalAmount: string;
  readonly invoiceId: string | null;
  readonly notificationRequestId: string | null;
}

interface RespuestaConsultasPagadas {
  readonly items: readonly WireConsultaPagada[];
  readonly count: number;
}

function aConsultaPagada(body: WireConsultaPagada): PaidConsultation {
  const { issueDate, ...resto } = body;
  return {
    ...sinNulos(resto as ConNulos<Omit<PaidConsultation, 'issueDate'>>),
    issueDate: maybeDateOnly(issueDate) ?? new Date(issueDate),
  };
}

function aResultado(body: WireResultado): PractitionerEntryResult {
  return sinNulos(body as ConNulos<PractitionerEntryResult>);
}

/* ---- TAREA-20 S3: libro mayor, estado de resultados, balance general ----- */

type WireMovimiento = ConNulos<Omit<GeneralLedgerEntry, 'transactionDate'>> & {
  readonly transactionDate: string;
};
type WireLineaFinanciera = ConNulos<FinancialStatementLine>;

interface RespuestaMayor {
  readonly accountId: string;
  readonly code: string | null;
  readonly name: string | null;
  readonly normalBalanceConceptId: string | null;
  readonly currencyConceptId: string | null;
  readonly openingBalance: string;
  readonly items: readonly WireMovimiento[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

interface RespuestaEstadoDeResultados {
  readonly revenueItems: readonly WireLineaFinanciera[];
  readonly expenseItems: readonly WireLineaFinanciera[];
  readonly totalRevenue: string;
  readonly totalExpense: string;
  readonly netIncome: string;
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
  readonly truncated: boolean;
}

interface RespuestaBalanceGeneral {
  readonly assetItems: readonly WireLineaFinanciera[];
  readonly liabilityItems: readonly WireLineaFinanciera[];
  readonly equityItems: readonly WireLineaFinanciera[];
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

function aMovimiento(body: WireMovimiento): GeneralLedgerEntry {
  const { transactionDate, ...resto } = body;
  return {
    ...sinNulos(resto),
    transactionDate: maybeDateOnly(transactionDate) ?? new Date(transactionDate),
  };
}

function aLibroMayor(body: RespuestaMayor): GeneralLedgerPage {
  const { code, name, normalBalanceConceptId, currencyConceptId, items, ...resto } = body;
  return {
    ...resto,
    ...sinNulos({ code, name, normalBalanceConceptId, currencyConceptId }),
    items: items.map(aMovimiento),
  };
}

function aLineaFinanciera(body: WireLineaFinanciera): FinancialStatementLine {
  return sinNulos(body);
}

/* ---- TAREA-20 S2: MODO CONTADOR ------------------------------------------- */

interface WirePosteo {
  readonly id: string;
  readonly transactionNumber: string;
  readonly status: string;
  readonly totalAmount: string;
  readonly lineCount: number;
  readonly postedAt: string | null;
}

function aPosteo(body: WirePosteo): PostedJournalResult {
  const { postedAt, ...resto } = body;
  return {
    ...resto,
    ...(maybeDate(postedAt) === undefined ? {} : { postedAt: maybeDate(postedAt) }),
  };
}
