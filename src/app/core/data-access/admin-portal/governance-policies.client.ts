import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams, withDates, type Wire } from './admin-portal.wire';
import type {
  PiiPage,
  PiiQuery,
  PolicyAppliesTo,
  PolicyChange,
  PolicyDetail,
  PolicyPage,
  PolicyQuery,
  PolicySummary,
} from './governance-policies.types';

type SummaryBody = Wire<PolicySummary, 'updatedAt'>;
type ChangeBody = Omit<PolicyChange, 'recordedAt'> & { readonly recordedAt: string };
type DetailBody = SummaryBody &
  Readonly<{
    configuration: unknown;
    appliesTo: readonly PolicyAppliesTo[];
    history: readonly ChangeBody[];
  }>;

function toSummary(body: SummaryBody): PolicySummary {
  return withDates<PolicySummary, 'updatedAt'>(body, ['updatedAt']);
}

/**
 * Cliente del gobierno de datos: políticas y campos con datos personales. Sólo
 * lectura. La API es la autoridad: si la sesión no puede leer, responde 403 y la
 * pantalla lo dice; ocultar el menú no es seguridad.
 */
@Injectable({ providedIn: 'root' })
export class GovernancePoliciesClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  listPolicies(query: PolicyQuery = {}): Observable<PolicyPage> {
    return this.http
      .get<Omit<PolicyPage, 'items'> & { readonly items: readonly SummaryBody[] }>(
        apiUrl(this.baseUrl, '/admin/governance/policies'),
        { params: queryParams({ ...query }) },
      )
      .pipe(map((page) => ({ ...page, items: page.items.map(toSummary) })));
  }

  getPolicy(id: string): Observable<PolicyDetail> {
    return this.http
      .get<DetailBody>(apiUrl(this.baseUrl, `/admin/governance/policies/${encodeURIComponent(id)}`))
      .pipe(
        map((body) => ({
          ...toSummary(body),
          configuration: body.configuration,
          appliesTo: body.appliesTo,
          history: body.history.map((c) => ({ ...c, recordedAt: new Date(c.recordedAt) })),
        })),
      );
  }

  listPiiFields(query: PiiQuery = {}): Observable<PiiPage> {
    return this.http.get<PiiPage>(apiUrl(this.baseUrl, '/admin/governance/pii-fields'), {
      params: queryParams({ ...query }),
    });
  }
}
