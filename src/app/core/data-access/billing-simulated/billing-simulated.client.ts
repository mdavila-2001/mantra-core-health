import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import type { ChallengeRequestOptions } from '../../access-challenge/access-challenge';
import { API_BASE_URL, apiUrl } from '../api';
import type {
  AnnulInvoiceInput,
  IssueInvoiceInput,
  RegisterInstancePaymentInput,
  SimulatedCatalogs,
  SimulatedCharge,
  SimulatedChargesPage,
  MyInvoicesPage,
  PaymentProof,
  SimulatedFiscalStatus,
  SimulatedInvoice,
  SimulatedOutboxEntry,
  SimulatedOutboxPage,
} from './billing-simulated.types';

/**
 * El cliente de la facturación **SIMULADA** (FACT-SIAT-MOCK).
 *
 * Habla con `/billing/simulated/*`, que responden **dos** fuentes con el mismo
 * contrato: el backend simulado del front (demo) y la **API real** (módulo
 * billing, parche v434), que cobra de verdad la consulta —`billing.invoices` +
 * `payments_received`— y emite una factura SIAT **simulada** (CUF/CUFD/XML
 * ficticios, `simulated: true`). La pantalla sólo lo usa si la facturación
 * simulada está disponible (ver `invoicing-availability.ts`).
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

  /** Los cobros de una persona: la lectura de «Pagos» dentro de la consulta. */
  chargesOfPatient(patientProfileId: string): Observable<SimulatedChargesPage> {
    return this.http.get<SimulatedChargesPage>(this.url('/billing/simulated/charges'), {
      params: new HttpParams().set('patientProfileId', patientProfileId),
    });
  }

  /** Cobro propio del turno abierto por el paciente en la maqueta. */
  patientChargesForBooking(bookingId: string): Observable<SimulatedChargesPage> {
    return this.http.get<SimulatedChargesPage>(this.url('/billing/simulated/patient/charges'), {
      params: new HttpParams().set('bookingId', bookingId),
    });
  }

  /** El paciente avisa que pagó; con `proof`, adjunta el comprobante. */
  reportPatientQrPayment(chargeId: string, proof?: PaymentProof): Observable<SimulatedCharge> {
    return this.http.post<SimulatedCharge>(
      this.url(`/billing/simulated/patient/charges/${encodeURIComponent(chargeId)}/report`),
      proof === undefined ? {} : { proof },
    );
  }

  /** Los cobros de una cita, con los comprobantes que el paciente envió para ella. */
  chargesOfBooking(bookingId: string): Observable<SimulatedChargesPage> {
    return this.http.get<SimulatedChargesPage>(this.url('/billing/simulated/charges'), {
      params: new HttpParams().set('bookingId', bookingId),
    });
  }

  paymentReports(patientProfileId: string): Observable<SimulatedChargesPage> {
    return this.http.get<SimulatedChargesPage>(this.url('/billing/simulated/payment-reports'), {
      params: new HttpParams().set('patientProfileId', patientProfileId),
    });
  }

  confirmPaymentReport(chargeId: string): Observable<SimulatedCharge> {
    return this.http.post<SimulatedCharge>(
      this.url(`/billing/simulated/payment-reports/${encodeURIComponent(chargeId)}/confirm`),
      {},
    );
  }

  /** Pago de una instancia del plan. Responde el cobro, con la nota de venta nueva. */
  registerInstancePayment(chargeId: string, instanceId: string, input: RegisterInstancePaymentInput, options?: ChallengeRequestOptions): Observable<SimulatedCharge> {
    return this.http.post<SimulatedCharge>(
      this.url(
        `/billing/simulated/charges/${encodeURIComponent(chargeId)}/instances/${encodeURIComponent(instanceId)}/payments`,
      ),
      input,
      options,
    );
  }

  registerPayment(chargeId: string, methodCode: number, options?: ChallengeRequestOptions): Observable<SimulatedCharge> {
    return this.http.post<SimulatedCharge>(
      this.url(`/billing/simulated/charges/${encodeURIComponent(chargeId)}/payment`),
      { methodCode },
      options,
    );
  }

  issueInvoice(chargeId: string, input: IssueInvoiceInput, options?: ChallengeRequestOptions): Observable<SimulatedInvoice> {
    return this.http.post<SimulatedInvoice>(
      this.url(`/billing/simulated/charges/${encodeURIComponent(chargeId)}/invoices`),
      input,
      options,
    );
  }

  invoice(invoiceId: string): Observable<SimulatedInvoice> {
    return this.http.get<SimulatedInvoice>(this.url(`/billing/simulated/invoices/${encodeURIComponent(invoiceId)}`));
  }

  annul(invoiceId: string, input: AnnulInvoiceInput, options?: ChallengeRequestOptions): Observable<SimulatedInvoice> {
    return this.http.post<SimulatedInvoice>(
      this.url(`/billing/simulated/invoices/${encodeURIComponent(invoiceId)}/annulment`),
      input,
      options,
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

  /**
   * «Mis facturas»: las que le emitieron (paciente) o las que emitió (quien
   * factura). Cualquier sesión puede pedirla; el lado lo decide el backend.
   */
  myInvoices(): Observable<MyInvoicesPage> {
    return this.http.get<MyInvoicesPage>(this.url('/billing/simulated/my-invoices'));
  }

  /** Una factura de «Mis facturas», con el mismo alcance que la lista. */
  myInvoice(invoiceId: string): Observable<SimulatedInvoice> {
    return this.http.get<SimulatedInvoice>(this.url(`/billing/simulated/my-invoices/${encodeURIComponent(invoiceId)}`));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
