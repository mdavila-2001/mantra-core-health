import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { PractitionerAccessDecisionInput, PractitionerAccessRequestInput } from './consent.types';

/**
 * Access by specialty (granular): the practitioner asks to read some
 * specialties of a patient's record and the patient decides which ones.
 *
 * Only the practitioner can open one; the patient answers and can revoke it
 * later. The organization travels in `X-Tenant-Id` (the active one), set by the
 * interceptor. The inbox (`AuthzClient.list*AccessRequests`) is what the
 * screens re-read after each call, so the bodies here are not consumed.
 */
@Injectable({ providedIn: 'root' })
export class PractitionerAccessClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `POST /consent/practitioner-access-requests` — born `PENDING`; it grants nothing yet. */
  requestAccess(input: PractitionerAccessRequestInput): Observable<void> {
    return this.http
      .post(this.url('/consent/practitioner-access-requests'), input)
      .pipe(map(() => undefined));
  }

  /** `POST /consent/practitioner-access-requests/:id/decision` — the patient accepts some specialties or declines. */
  decide(id: string, input: PractitionerAccessDecisionInput): Observable<void> {
    return this.http
      .post(this.url(`/consent/practitioner-access-requests/${encodeURIComponent(id)}/decision`), input)
      .pipe(map(() => undefined));
  }

  /** `POST /consent/practitioner-access-requests/:id/revoke` — the patient withdraws an accepted access. */
  revoke(id: string): Observable<void> {
    return this.http
      .post(this.url(`/consent/practitioner-access-requests/${encodeURIComponent(id)}/revoke`), {})
      .pipe(map(() => undefined));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
