import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { TENANT_HEADER } from '../../http/auth.interceptor';
import { API_BASE_URL, apiUrl } from '../api';

/** The legal representative's name by parts, as `PATCH /tenants/{id}/legal-representative` takes it. */
export interface LegalRepresentativeName {
  readonly name: string;
  readonly middleName?: string;
  readonly lastName: string;
  readonly motherLastName?: string;
}

/** The one door the screens use to correct the legal representative of an organization. */
@Injectable({ providedIn: 'root' })
export class LegalRepresentativeClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Only OWNER/ADMIN of that organization (or the platform); anyone else gets 403 from the API. */
  rename(tenantId: string, name: LegalRepresentativeName): Observable<{ readonly fullName: string }> {
    return this.http.patch<{ readonly fullName: string }>(
      apiUrl(this.baseUrl, `/tenants/${tenantId}/legal-representative`),
      name,
      { headers: new HttpHeaders({ [TENANT_HEADER]: tenantId }) },
    );
  }
}
