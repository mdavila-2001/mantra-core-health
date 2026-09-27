import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  AnnulInvoiceInput,
  IssueInvoiceInput,
  SimulatedCatalogs,
  SimulatedCharge,
  SimulatedChargesPage,
  SimulatedFiscalStatus,
  SimulatedInvoice,
  SimulatedOutboxEntry,
  SimulatedOutboxPage,
} from './billing-simulated.types';

/**
 * El cliente de la facturación **SIMULADA** (FACT-SIAT-MOCK).
 *
 * Habla con `/billing/simulated/*`, que sólo responde el backend simulado del
 * front. No hay contrato de API real detrás: cuando la API publique
 * facturación, este cliente se reemplaza —no se «conecta»—. La pantalla sólo lo
 * usa si la facturación simulada está encendida y el backend simulado activo
 * (ver `environment.billingSiatDemo`).
 *
 * Los valores de dinero viajan como texto decimal y las fechas como texto ISO
 * (o la `fechaEmision` del SIAT, sin zona): no se convierten acá, porque la
 * factura tiene que mostrar exactamente lo que dice su XML.
 */
@Injectable({ providedIn: 'root' })
export class BillingSimulatedClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  status(): Observable<SimulatedFiscalStatus> {
    return this.http.get<SimulatedFiscalStatus>(this.url('/billing/simulated/status'));
  }

  catalogs(): Observable<SimulatedCatalogs> {
    return this.http.get<SimulatedCatalogs>(this.url('/billing/simulated/catalogs'));
  }

  charges(): Observable<SimulatedChargesPage> {
    return this.http.get<SimulatedChargesPage>(this.url('/billing/simulated/charges'));
  }

  registerPayment(chargeId: string, methodCode: number): Observable<SimulatedCharge> {
    return this.http.post<SimulatedCharge>(this.url(`/billing/simulated/charges/${encodeURIComponent(chargeId)}/payment`), {
      methodCode,
    });
  }

  issueInvoice(chargeId: string, input: IssueInvoiceInput): Observable<SimulatedInvoice> {
    return this.http.post<SimulatedInvoice>(
      this.url(`/billing/simulated/charges/${encodeURIComponent(chargeId)}/invoices`),
      input,
    );
  }

  invoice(invoiceId: string): Observable<SimulatedInvoice> {
    return this.http.get<SimulatedInvoice>(this.url(`/billing/simulated/invoices/${encodeURIComponent(invoiceId)}`));
  }

  annul(invoiceId: string, input: AnnulInvoiceInput): Observable<SimulatedInvoice> {
    return this.http.post<SimulatedInvoice>(
      this.url(`/billing/simulated/invoices/${encodeURIComponent(invoiceId)}/annulment`),
      input,
    );
  }

  revertAnnulment(invoiceId: string): Observable<SimulatedInvoice> {
    return this.http.post<SimulatedInvoice>(
      this.url(`/billing/simulated/invoices/${encodeURIComponent(invoiceId)}/annulment-reversal`),
      {},
    );
  }

  emailInvoice(invoiceId: string, to: string): Observable<SimulatedOutboxEntry> {
    return this.http.post<SimulatedOutboxEntry>(this.url(`/billing/simulated/invoices/${encodeURIComponent(invoiceId)}/email`), {
      to,
    });
  }

  outbox(): Observable<SimulatedOutboxPage> {
    return this.http.get<SimulatedOutboxPage>(this.url('/billing/simulated/outbox'));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
