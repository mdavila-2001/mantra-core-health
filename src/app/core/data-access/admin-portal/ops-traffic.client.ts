import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from './admin-portal.wire';
import type {
  TrafficEndpointsPage,
  TrafficEndpointsQuery,
  TrafficOverview,
  TrafficQuery,
} from './ops-traffic.types';

/** Tráfico HTTP de la API (`/admin/ops/traffic*`): sólo lectura de agregados. */
@Injectable({ providedIn: 'root' })
export class OpsTrafficClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  traffic(query: TrafficQuery): Observable<TrafficOverview> {
    return this.http.get<TrafficOverview>(this.url('/admin/ops/traffic'), { params: queryParams({ ...query }) });
  }

  endpoints(query: TrafficEndpointsQuery): Observable<TrafficEndpointsPage> {
    return this.http.get<TrafficEndpointsPage>(this.url('/admin/ops/traffic/endpoints'), {
      params: queryParams({ ...query }),
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
