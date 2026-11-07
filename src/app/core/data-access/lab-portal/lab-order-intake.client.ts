import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { LabOrderIntakeFields, LabPatientMatch, NewLabOrder } from './lab-order-intake.types';
import type { LabOrder } from './lab-portal.types';

/**
 * The center's own orders: look the patient up, create and edit. Annulling one
 * is the `CANCEL` step of {@link LabPortalClient.transitionOrder}. The active
 * tenant (`X-Tenant-Id`) is the center; no route carries its id.
 */
@Injectable({ providedIn: 'root' })
export class LabOrderIntakeClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** By exact national id, in the body: it is PHI and never goes in the URL. 404 if nobody holds it. */
  lookupPatient(nationalId: string): Observable<LabPatientMatch> {
    return this.http.post<LabPatientMatch>(this.url('/diagnostics/lab/patients/lookup'), {
      nationalId,
    });
  }

  /** The study's family as the catalog defines it (`LAB`, `IMAGING`, `CARDIO`…): the API checks the same. */
  studyFamily(conceptId: string): Observable<string> {
    return this.http
      .get<{ family: string }>(this.url(`/clinical/study-catalog/${encodeURIComponent(conceptId)}`))
      .pipe(map((study) => study.family));
  }

  createOrder(order: NewLabOrder): Observable<LabOrder> {
    return this.http.post<LabOrder>(this.url('/diagnostics/lab/orders'), order);
  }

  updateOrder(orderId: string, fields: LabOrderIntakeFields): Observable<LabOrder> {
    return this.http.put<LabOrder>(
      this.url(`/diagnostics/lab/orders/${encodeURIComponent(orderId)}`),
      fields,
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
