import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, maybeDateOnly, sinNulos, type ConNulos } from '../wire';
import type {
  BillingPage,
  BillingPageQuery,
  InvoiceDetail,
  InvoiceLine,
  InvoiceSummary,
  PatientStatement,
} from './billing.types';

type WireInvoiceSummary = Omit<
  InvoiceSummary,
  'statusConceptId' | 'issueDate' | 'dueDate' | 'createdAt'
> & {
  readonly status: string;
  readonly issueDate: string;
  readonly dueDate: string | null;
  readonly createdAt: string;
};

type WireInvoiceDetail = Omit<InvoiceDetail, 'statusConceptId' | 'lines'> & {
  readonly status: string;
  readonly lines: readonly ConNulos<InvoiceLine>[];
};

type WireStatement = Omit<PatientStatement, 'periodStart' | 'periodEnd'> & {
  readonly periodStart: string;
  readonly periodEnd: string;
};

interface WirePage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
}

/**
 * Facturación, **sólo lectura** (`billing`, CV-12).
 *
 * Deliberadamente no hay ningún método que escriba: `invoices:issue-from-
 * encounter`, `credit-note`, `payments-received:apply` y el resto siguen sin
 * cliente ni pantalla (fuera de alcance: nada de cobrar). Todas las lecturas
 * exigen `practiceId` y la API responde 404 —sin distinguir «no existe» de «es
 * de otra organización»— ante una práctica ajena.
 */
@Injectable({ providedIn: 'root' })
export class BillingClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /billing/invoices?practiceId=` — facturas de la práctica, por cursor. */
  listInvoices(query: BillingPageQuery): Observable<BillingPage<InvoiceSummary>> {
    return this.http
      .get<WirePage<ConNulos<WireInvoiceSummary>>>(apiUrl(this.baseUrl, '/billing/invoices'), {
        params: paramsDe(query),
      })
      .pipe(map((pagina) => ({ nextCursor: pagina.nextCursor, items: pagina.items.map(aFactura) })));
  }

  /** `GET /billing/invoices/:id?practiceId=` — la factura con sus líneas. */
  getInvoice(invoiceId: string, practiceId: string): Observable<InvoiceDetail> {
    return this.http
      .get<ConNulos<WireInvoiceDetail>>(
        apiUrl(this.baseUrl, `/billing/invoices/${encodeURIComponent(invoiceId)}`),
        { params: new HttpParams().set('practiceId', practiceId) },
      )
      .pipe(map(aDetalle));
  }

  /** `GET /billing/patient-statements?practiceId=` — estados de cuenta, por cursor. */
  listPatientStatements(query: BillingPageQuery): Observable<BillingPage<PatientStatement>> {
    return this.http
      .get<WirePage<WireStatement>>(apiUrl(this.baseUrl, '/billing/patient-statements'), {
        params: paramsDe(query),
      })
      .pipe(
        map((pagina) => ({
          nextCursor: pagina.nextCursor,
          items: pagina.items.map((fila) => ({
            ...fila,
            periodStart: maybeDateOnly(fila.periodStart) ?? new Date(fila.periodStart),
            periodEnd: maybeDateOnly(fila.periodEnd) ?? new Date(fila.periodEnd),
          })),
        })),
      );
  }
}

function paramsDe(query: BillingPageQuery): HttpParams {
  let params = new HttpParams().set('practiceId', query.practiceId);
  if (query.cursor !== undefined) params = params.set('cursor', query.cursor);
  if (query.limit !== undefined) params = params.set('limit', String(query.limit));
  return params;
}

function aFactura(fila: ConNulos<WireInvoiceSummary>): InvoiceSummary {
  const { status, issueDate, dueDate, createdAt, ...resto } = fila;
  const vence = maybeDateOnly(dueDate);
  return {
    ...sinNulos(resto),
    statusConceptId: status as string,
    issueDate: maybeDateOnly(issueDate) ?? new Date(issueDate as string),
    ...(vence === undefined ? {} : { dueDate: vence }),
    createdAt: maybeDate(createdAt) ?? new Date(createdAt as string),
  } as InvoiceSummary;
}

function aDetalle(fila: ConNulos<WireInvoiceDetail>): InvoiceDetail {
  const { status, lines, ...resto } = fila;
  return {
    ...sinNulos(resto),
    statusConceptId: status as string,
    lines: (lines ?? []).map((linea) => sinNulos(linea)),
  } as InvoiceDetail;
}
