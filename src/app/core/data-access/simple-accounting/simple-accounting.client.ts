import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  PractitionerSummary,
  RecordKind,
  SimpleAccount,
  SimpleAccountInput,
  SimpleRecord,
  SimpleRecordInput,
  SimpleTransaction,
  SimpleTransactionInput,
  SummaryPeriod,
} from './simple-accounting.types';

/**
 * La contabilidad simple del doctor (P47): los tres números, las cuentas, los
 * gastos, activos y deudas con su tipo, y las transacciones debe/haber.
 *
 * Todo cuelga de `/accounting/practitioner/simple/...` y de la práctica
 * elegida (`practiceId`), igual que el resto de la contabilidad del médico.
 * El servidor revalida la vinculación: este cliente no es la autoridad.
 *
 * **Contrato pendiente en la API**: hoy lo sirve sólo el simulador.
 */
@Injectable({ providedIn: 'root' })
export class SimpleAccountingClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /accounting/practitioner/simple/summary` */
  summary(practiceId: string, period: SummaryPeriod): Observable<PractitionerSummary> {
    const params = new HttpParams().set('practiceId', practiceId).set('period', period);
    return this.http.get<PractitionerSummary>(this.url('/accounting/practitioner/simple/summary'), {
      params,
    });
  }

  /* ---- cuentas ---------------------------------------------------------- */

  /** `GET /accounting/practitioner/simple/accounts` */
  listAccounts(practiceId: string): Observable<readonly SimpleAccount[]> {
    const params = new HttpParams().set('practiceId', practiceId);
    return this.http
      .get<{ readonly items: readonly SimpleAccount[] }>(
        this.url('/accounting/practitioner/simple/accounts'),
        { params },
      )
      .pipe(map((body) => body.items));
  }

  /** `POST /accounting/practitioner/simple/accounts` */
  createAccount(practiceId: string, input: SimpleAccountInput): Observable<SimpleAccount> {
    return this.http.post<SimpleAccount>(this.url('/accounting/practitioner/simple/accounts'), {
      practiceId,
      ...input,
    });
  }

  /** `PUT /accounting/practitioner/simple/accounts/:id` */
  updateAccount(id: string, input: SimpleAccountInput): Observable<SimpleAccount> {
    return this.http.put<SimpleAccount>(
      this.url(`/accounting/practitioner/simple/accounts/${encodeURIComponent(id)}`),
      input,
    );
  }

  /** `DELETE /accounting/practitioner/simple/accounts/:id` — 409 si está en uso o es sembrada. */
  deleteAccount(id: string): Observable<void> {
    return this.http.delete<void>(
      this.url(`/accounting/practitioner/simple/accounts/${encodeURIComponent(id)}`),
    );
  }

  /* ---- gastos, activos y deudas ----------------------------------------- */

  /** `GET /accounting/practitioner/simple/records?kind=` */
  listRecords(practiceId: string, kind: RecordKind): Observable<readonly SimpleRecord[]> {
    const params = new HttpParams().set('practiceId', practiceId).set('kind', kind);
    return this.http
      .get<{ readonly items: readonly SimpleRecord[] }>(
        this.url('/accounting/practitioner/simple/records'),
        { params },
      )
      .pipe(map((body) => body.items));
  }

  /** `POST /accounting/practitioner/simple/records` */
  createRecord(practiceId: string, input: SimpleRecordInput): Observable<SimpleRecord> {
    return this.http.post<SimpleRecord>(this.url('/accounting/practitioner/simple/records'), {
      practiceId,
      ...input,
    });
  }

  /** `PUT /accounting/practitioner/simple/records/:id` */
  updateRecord(id: string, input: SimpleRecordInput): Observable<SimpleRecord> {
    return this.http.put<SimpleRecord>(
      this.url(`/accounting/practitioner/simple/records/${encodeURIComponent(id)}`),
      input,
    );
  }

  /** `DELETE /accounting/practitioner/simple/records/:id` */
  deleteRecord(id: string): Observable<void> {
    return this.http.delete<void>(
      this.url(`/accounting/practitioner/simple/records/${encodeURIComponent(id)}`),
    );
  }

  /* ---- transacciones debe/haber ----------------------------------------- */

  /** `GET /accounting/practitioner/simple/transactions` */
  listTransactions(practiceId: string): Observable<readonly SimpleTransaction[]> {
    const params = new HttpParams().set('practiceId', practiceId);
    return this.http
      .get<{ readonly items: readonly SimpleTransaction[] }>(
        this.url('/accounting/practitioner/simple/transactions'),
        { params },
      )
      .pipe(map((body) => body.items));
  }

  /** `POST /accounting/practitioner/simple/transactions` */
  createTransaction(
    practiceId: string,
    input: SimpleTransactionInput,
  ): Observable<SimpleTransaction> {
    return this.http.post<SimpleTransaction>(
      this.url('/accounting/practitioner/simple/transactions'),
      { practiceId, ...input },
    );
  }

  /** `PUT /accounting/practitioner/simple/transactions/:id` */
  updateTransaction(id: string, input: SimpleTransactionInput): Observable<SimpleTransaction> {
    return this.http.put<SimpleTransaction>(
      this.url(`/accounting/practitioner/simple/transactions/${encodeURIComponent(id)}`),
      input,
    );
  }

  /** `DELETE /accounting/practitioner/simple/transactions/:id` */
  deleteTransaction(id: string): Observable<void> {
    return this.http.delete<void>(
      this.url(`/accounting/practitioner/simple/transactions/${encodeURIComponent(id)}`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
