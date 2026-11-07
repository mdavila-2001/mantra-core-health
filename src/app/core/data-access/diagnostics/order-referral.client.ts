import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { simulatorOnly } from '../simulator-only';
import type { OrderReferralResult } from './order-referral.types';

/**
 * A doctor's referral of a laboratory/imaging order to a center, with the patient's acceptance
 * (06/11/2026). **Simulator-only**: the real API publishes no such routes, so each call goes
 * through `simulatorOnly` and, against the real API, no request leaves: it returns an error naming
 * the missing feature. Separate from {@link DiagnosticsClient}, which is the real diagnostics contract.
 */
@Injectable({ providedIn: 'root' })
export class OrderReferralClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** The patient accepts or rejects the referral; only on accept does the order reach the center. */
  respondToReferral(
    orderId: string,
    decision: 'accept' | 'reject',
  ): Observable<OrderReferralResult> {
    return simulatorOnly(
      'Responder a la derivación de una orden',
      this.url('/diagnostic-results/me/orders'),
      () =>
        this.http.post<OrderReferralResult>(
          this.url(
            `/diagnostic-results/me/orders/${encodeURIComponent(orderId)}/referral/${decision}`,
          ),
          {},
        ),
    );
  }

  /** The doctor refers an order to a center; it stays pending until the patient accepts. */
  referOrder(orderId: string, performerTenantId: string): Observable<OrderReferralResult> {
    return simulatorOnly(
      'Derivar una orden a un centro',
      this.url('/diagnostics/orders'),
      () =>
        this.http.post<OrderReferralResult>(
          this.url(`/diagnostics/orders/${encodeURIComponent(orderId)}/referral`),
          { performerTenantId },
        ),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
