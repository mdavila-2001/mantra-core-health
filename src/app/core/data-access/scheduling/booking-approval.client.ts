import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** One of the practitioner's own agendas and how it receives booking requests. */
export interface AgendaApproval {
  readonly id: string;
  readonly name: string;
  /** `false` = patient requests are born confirmed (v4.2.88). */
  readonly requiresApproval: boolean;
}

/** Response of `GET /scheduling/my-resources`. */
export interface AgendaApprovalPage {
  readonly items: readonly AgendaApproval[];
}

/**
 * Whether the practitioner accepts each booking request or lets the agenda
 * confirm it (v4.2.88). The API decides who may change it: the practitioner on
 * their own agenda, or scheduling admins.
 */
@Injectable({ providedIn: 'root' })
export class BookingApprovalClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /scheduling/my-resources` — the caller's own active agendas in a tenant. */
  listMine(tenantId: string): Observable<AgendaApprovalPage> {
    const params = new HttpParams().set('tenantId', tenantId);
    return this.http.get<AgendaApprovalPage>(apiUrl(this.baseUrl, '/scheduling/my-resources'), {
      params,
    });
  }

  /** `PATCH /scheduling/resources/:id` — returns what the server stored. */
  setRequiresApproval(resourceId: string, requiresApproval: boolean): Observable<AgendaApproval> {
    return this.http.patch<AgendaApproval>(
      apiUrl(this.baseUrl, `/scheduling/resources/${encodeURIComponent(resourceId)}`),
      { requiresApproval },
    );
  }
}
