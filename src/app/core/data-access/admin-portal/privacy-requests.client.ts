import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams, withDates, type Wire } from './admin-portal.wire';
import type {
  PrivacyRequest,
  PrivacyRequestsResult,
  PrivacyRequestsQuery,
  PrivacyTransition,
} from './privacy-requests.types';

type RequestBody = Wire<PrivacyRequest, 'requestedAt' | 'completedAt' | 'updatedAt'>;
type PageBody = Omit<PrivacyRequestsResult, 'items'> & { readonly items: readonly RequestBody[] };

export function toPrivacyRequest(body: RequestBody): PrivacyRequest {
  return withDates<PrivacyRequest, 'requestedAt' | 'completedAt' | 'updatedAt'>(body, [
    'requestedAt',
    'completedAt',
    'updatedAt',
  ]);
}

/** Cliente de las solicitudes de privacidad. La API decide qué transición cabe en cada estado. */
@Injectable({ providedIn: 'root' })
export class PrivacyRequestsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(query: PrivacyRequestsQuery = {}): Observable<PrivacyRequestsResult> {
    return this.http
      .get<PageBody>(this.url('/admin/governance/privacy-requests'), { params: queryParams({ ...query }) })
      .pipe(map((page) => ({ ...page, items: page.items.map(toPrivacyRequest) })));
  }

  get(id: string): Observable<PrivacyRequest> {
    return this.http
      .get<RequestBody>(this.url(`/admin/governance/privacy-requests/${encodeURIComponent(id)}`))
      .pipe(map(toPrivacyRequest));
  }

  /**
   * Mueve la solicitud (`PATCH /privacy/dsar/:id`, sólo `SECURITY_ADMIN`). La respuesta de
   * esa ruta trae conceptos, no códigos: quien llama vuelve a leer con {@link get}.
   */
  transition(id: string, status: PrivacyTransition): Observable<void> {
    return this.http
      .patch<unknown>(this.url(`/privacy/dsar/${encodeURIComponent(id)}`), { status })
      .pipe(map(() => undefined));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
