import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { toMine } from './admissions.client';
import type { MyAdmission, ResubmitCommand, WireMyAdmission } from './admissions.types';

/**
 * The practitioner's own verification request
 * (`/profiles/practitioners/me/admission`): read it, send the first one,
 * correct and resend it, or withdraw it.
 *
 * Every route is `me`: the subject comes from the session, never from the
 * body or the URL. The API decides what is allowed (state, resubmission cap,
 * pending profile) and answers with the request as it stands; the client does
 * not anticipate any refusal, it hands it over as is.
 */
@Injectable({ providedIn: 'root' })
export class OwnAdmissionClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /profiles/practitioners/me/admission` — 404 if the person has no request. */
  myAdmission(): Observable<MyAdmission> {
    return this.http
      .get<WireMyAdmission>(this.url('/profiles/practitioners/me/admission'))
      .pipe(map(toMine));
  }

  /**
   * `POST /profiles/practitioners/me/admission/submit` — send the first
   * request, for a pending profile that never had one. Same body as the
   * resubmission: the person's attestation and the version of the text shown.
   * Refusals carry their `reason`: `ADMISSION_NOT_FOUND` (no professional
   * profile), `ADMISSION_ATTESTATION_REQUIRED`, `ADMISSION_ALREADY_EXISTS`
   * (resubmit instead) and `ADMISSION_NOT_PENDING`.
   */
  submitMyAdmission(command: ResubmitCommand): Observable<MyAdmission> {
    return this.http
      .post<WireMyAdmission>(this.url('/profiles/practitioners/me/admission/submit'), command)
      .pipe(map(toMine));
  }

  /**
   * `POST /profiles/practitioners/me/admission/resubmit` — correct and resend.
   * The body carries the person's attestation (`attested: true` and the
   * version of the text they saw); without it the API answers
   * `ADMISSION_ATTESTATION_REQUIRED`. The API also decides whether it applies
   * (state and resubmission cap) and answers the updated request.
   */
  resubmitMyAdmission(command: ResubmitCommand): Observable<MyAdmission> {
    return this.http
      .post<WireMyAdmission>(this.url('/profiles/practitioners/me/admission/resubmit'), command)
      .pipe(map(toMine));
  }

  /** `POST /profiles/practitioners/me/admission/withdraw` — withdraw a submitted request (or one with information requested). */
  withdrawMyAdmission(): Observable<MyAdmission> {
    return this.http
      .post<WireMyAdmission>(this.url('/profiles/practitioners/me/admission/withdraw'), {})
      .pipe(map(toMine));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
