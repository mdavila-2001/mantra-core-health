import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type { SurveyAssignmentInfo, SurveySummary } from './surveys.types';

/** An assignment as the catalog reports it: the service name travels with it. */
export interface CatalogAssignment extends SurveyAssignmentInfo {
  readonly targetName?: string | null;
}

/** One catalog row: a base survey of the system or one the practitioner wrote. */
export interface SurveyCatalogEntry extends SurveySummary {
  readonly origin: 'SYSTEM' | 'PRACTITIONER';
  /** Only for `SYSTEM`: issued for bookings without a service or for every service. */
  readonly scope?: 'CONSULTATION' | 'SERVICE';
  readonly assignments: readonly CatalogAssignment[];
}

/** `GET /surveys/catalog`: base surveys first, then the practitioner's own. */
@Injectable({ providedIn: 'root' })
export class SurveysCatalogClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(): Observable<readonly SurveyCatalogEntry[]> {
    return this.http.get<SurveyCatalogEntry[]>(apiUrl(this.baseUrl, '/surveys/catalog'));
  }
}
