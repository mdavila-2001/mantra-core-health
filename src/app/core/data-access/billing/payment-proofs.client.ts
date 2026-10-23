import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { switchMap, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { blobToDataUrl } from '../files/blob-to-data-url';
import type {
  ChargeProofs,
  CreatePaymentProofInput,
  PaymentContext,
  ProofReview,
  ProviderPaymentTablePage,
  ProviderPaymentTableQuery,
} from './payment-proofs.types';

/**
 * C-01 · Comprobantes de pago del paciente.
 *
 * - El paciente lee el contexto de pago de su cargo y sube un comprobante
 *   (o declara efectivo).
 * - El médico ve los comprobantes de sus consultas, los acepta o los rechaza
 *   con motivo, y lee su tabla de pagos por sesión.
 *
 * El permiso lo decide la API por objeto: fuera de alcance responde 404.
 */
@Injectable({ providedIn: 'root' })
export class PaymentProofsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  paymentContext(chargeId: string): Observable<PaymentContext> {
    return this.http.get<PaymentContext>(
      this.url(`/billing/me/charges/${encodeURIComponent(chargeId)}/payment-context`),
    );
  }

  createProof(
    chargeId: string,
    input: CreatePaymentProofInput,
  ): Observable<{ id: string; status: 'PENDING_REVIEW' }> {
    return this.http.post<{ id: string; status: 'PENDING_REVIEW' }>(
      this.url(`/billing/me/charges/${encodeURIComponent(chargeId)}/payment-proofs`),
      input,
    );
  }

  proofsOfCharge(chargeId: string): Observable<ChargeProofs> {
    return this.http.get<ChargeProofs>(
      this.url(`/billing/charges/${encodeURIComponent(chargeId)}/payment-proofs`),
    );
  }

  accept(proofId: string): Observable<ProofReview> {
    return this.http.post<ProofReview>(
      this.url(`/billing/payment-proofs/${encodeURIComponent(proofId)}/accept`),
      {},
    );
  }

  reject(proofId: string, reason: string): Observable<ProofReview> {
    return this.http.post<ProofReview>(
      this.url(`/billing/payment-proofs/${encodeURIComponent(proofId)}/reject`),
      { reason },
    );
  }

  /**
   * La imagen del comprobante como `data:` URL. Va por la ruta de billing y no
   * por `/common/files/:id/content`: el médico no subió el archivo, y la API lo
   * autoriza por el contexto del comprobante. Es PHI: no hay URL pública.
   */
  proofImage(proofId: string): Observable<string> {
    return this.http
      .get(this.url(`/billing/payment-proofs/${encodeURIComponent(proofId)}/file`), {
        responseType: 'blob',
      })
      .pipe(switchMap((bytes) => blobToDataUrl(bytes)));
  }

  /** La tabla de pagos por sesión del prestador (paginada por cursor). */
  providerPaymentTable(query: ProviderPaymentTableQuery = {}): Observable<ProviderPaymentTablePage> {
    let params = new HttpParams();
    if (query.from) params = params.set('from', query.from);
    if (query.to) params = params.set('to', query.to);
    if (query.patientProfileId) params = params.set('patientProfileId', query.patientProfileId);
    if (query.cursor) params = params.set('cursor', query.cursor);
    if (query.limit !== undefined) params = params.set('limit', String(query.limit));
    return this.http.get<ProviderPaymentTablePage>(this.url('/billing/me/provider-payment-table'), {
      params,
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
