import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly, sinNulos, type ConNulos } from '../wire';
import type {
  ChartOfAccounts,
  JournalPage,
  JournalQuery,
  JournalTransaction,
  JournalTransactionDetail,
  LedgerAccount,
  LedgerEntry,
  Practice,
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

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
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
