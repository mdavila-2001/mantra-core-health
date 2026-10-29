import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from './admin-portal.wire';
import type { FlowDetail, FlowsPage, FlowsQuery } from './flows.types';

/** Catálogo de flujos (`/admin/qa/flows*`): sólo lectura. */
@Injectable({ providedIn: 'root' })
export class FlowsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(query: FlowsQuery = {}): Observable<FlowsPage> {
    return this.http.get<FlowsPage>(this.url('/admin/qa/flows'), { params: queryParams({ ...query }) });
  }

  detail(flowId: string): Observable<FlowDetail> {
    return this.http.get<FlowDetail>(this.url(`/admin/qa/flows/${encodeURIComponent(flowId)}`));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
