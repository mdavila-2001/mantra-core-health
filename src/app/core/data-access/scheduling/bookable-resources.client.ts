import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';

/** A practitioner (or laboratory) a patient can book with, in any organization. */
export interface BookableResource {
  /** The organization: the `X-Tenant-Id` its agenda is read with. */
  readonly tenantId: string;
  readonly organizationName: string;
  /** One of the person's resources in that organization. */
  readonly resourceId: string;
  readonly resourceRefType: string;
  readonly resourceRefId: string;
  /** The person's display name, or the resource name when there is none. */
  readonly name: string;
}

export interface BookableResourcesQuery {
  readonly resourceType: 'PRACTITIONER' | 'ROOM';
  /** Blank lists everyone. */
  readonly q: string;
  readonly limit: number;
  readonly offset: number;
}

export interface BookableResourcesPage {
  readonly items: readonly BookableResource[];
  /** Matches across all pages. */
  readonly total: number;
}

/**
 * `GET /scheduling/bookable-resources`: who a patient can book with, from every
 * organization, paged and searched on the server. Each entry carries the
 * organization whose agenda is read next, so the patient never picks one.
 */
@Injectable({ providedIn: 'root' })
export class BookableResourcesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(query: BookableResourcesQuery): Observable<BookableResourcesPage> {
    let params = new HttpParams()
      .set('resourceType', query.resourceType)
      .set('limit', query.limit)
      .set('offset', query.offset);
    const q = query.q.trim();
    if (q !== '') params = params.set('q', q);
    return this.http
      .get<BookableResourcesPage>(apiUrl(this.baseUrl, '/scheduling/bookable-resources'), { params })
      .pipe(map((body) => ({ items: body.items, total: body.total })));
  }
}
