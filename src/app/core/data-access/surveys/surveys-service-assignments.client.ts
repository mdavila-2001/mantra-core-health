import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate } from '../wire';
import type {
  ServiceSurveyAssignments,
  ServiceSurveyRow,
  StandardSurvey,
} from './surveys-service-assignments.types';

/**
 * Standard surveys per service (06/11/2026). Replaces free creation
 * (`POST /surveys/templates`, which the API keeps but the front no longer calls).
 *
 * The standard catalog is NOT `GET /surveys/catalog`: that route lists the base
 * surveys plus the practitioner's own (`SurveysCatalogClient`, the «Buzón»).
 */
@Injectable({ providedIn: 'root' })
export class SurveysServiceAssignmentsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /surveys/standard-catalog`. A body without `items` is an empty catalog. */
  listStandardCatalog(): Observable<readonly StandardSurvey[]> {
    return this.http
      .get<{ items?: StandardSurvey[] | null }>(this.url('/surveys/standard-catalog'))
      .pipe(map((body) => body.items ?? []));
  }

  /** `GET /surveys/service-assignments`: the fixed appointment row and one row per service. */
  list(): Observable<ServiceSurveyAssignments> {
    return this.http.get<WireAssignments>(this.url('/surveys/service-assignments')).pipe(
      map((body) => ({
        consultation: body.consultation,
        services: (body.services ?? []).map(toRow),
      })),
    );
  }

  /** `PUT /surveys/service-assignments/:serviceId`: import or change; the server keeps one active. */
  assign(serviceId: string, catalogCode: string): Observable<ServiceSurveyRow> {
    return this.http
      .put<WireRow>(this.url(`/surveys/service-assignments/${encodeURIComponent(serviceId)}`), {
        catalogCode,
      })
      .pipe(map(toRow));
  }

  /** `DELETE /surveys/service-assignments/:serviceId`: back to the service base survey. */
  remove(serviceId: string): Observable<void> {
    return this.http.delete<void>(
      this.url(`/surveys/service-assignments/${encodeURIComponent(serviceId)}`),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** A row on the wire: the date as ISO text, `assignment` possibly absent. */
type WireRow = Omit<ServiceSurveyRow, 'assignment'> & {
  readonly assignment?:
    | (Omit<NonNullable<ServiceSurveyRow['assignment']>, 'assignedAt' | 'catalogCode'> & {
        /** `null` on the wire for a legacy (non-catalog) attachment. */
        readonly catalogCode?: string | null;
        readonly assignedAt?: string | null;
      })
    | null;
};

interface WireAssignments {
  readonly consultation: ServiceSurveyAssignments['consultation'];
  readonly services?: readonly WireRow[] | null;
}

/**
 * A row as the screens use it. An attachment WITHOUT `catalogCode` is a legacy
 * hand-made survey: the API no longer sends it (only the imported catalog
 * survey or the service base is issued), so it is NOT the service's survey and
 * the row reads as «uses the service base». Guarded here so every screen agrees.
 */
function toRow(row: WireRow): ServiceSurveyRow {
  const wired = row.assignment ?? null;
  const assignment = wired !== null && wired.catalogCode ? { ...wired, catalogCode: wired.catalogCode } : null;
  return {
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    ...(row.serviceKind ? { serviceKind: row.serviceKind } : {}),
    assignment:
      assignment === null
        ? null
        : { ...assignment, assignedAt: maybeDate(assignment.assignedAt) ?? null },
  };
}
