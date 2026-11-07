import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { TENANT_HEADER } from '../../http/auth.interceptor';
import { API_BASE_URL, apiUrl } from '../api';

/** What `POST /tenants/{id}/branches/location-preview` answers. */
export interface MapLinkPoint {
  readonly resolved: boolean;
  readonly latitude?: number;
  readonly longitude?: number;
}

/** Where a pasted map link points to, read by the API (it also follows `maps.app.goo.gl` short links). */
@Injectable({ providedIn: 'root' })
export class BranchLocationClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Only OWNER/ADMIN of that organization (or the platform); nothing is saved. */
  preview(tenantId: string, url: string): Observable<MapLinkPoint> {
    return this.http.post<MapLinkPoint>(
      apiUrl(this.baseUrl, `/tenants/${tenantId}/branches/location-preview`),
      { url },
      { headers: new HttpHeaders({ [TENANT_HEADER]: tenantId }) },
    );
  }
}
