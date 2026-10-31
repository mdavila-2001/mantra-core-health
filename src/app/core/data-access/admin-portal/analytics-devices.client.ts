import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from './admin-portal.wire';
import type { DevicesBreakdown, DevicesQuery } from './analytics-devices.types';

/** Dispositivos (`/admin/analytics/devices`): sólo lectura de agregados. */
@Injectable({ providedIn: 'root' })
export class AnalyticsDevicesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  devices(query: DevicesQuery = {}): Observable<DevicesBreakdown> {
    return this.http.get<DevicesBreakdown>(apiUrl(this.baseUrl, '/admin/analytics/devices'), {
      params: queryParams({ ...query }),
    });
  }
}
