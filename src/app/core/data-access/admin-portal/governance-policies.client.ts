import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams, withDates, type Wire } from './admin-portal.wire';
import type {
  ChangeLogEntry,
  ChangeLogPage,
  ChangeLogQuery,
  PiiColumnsPage,
  PiiColumnsQuery,
  PiiReconciliationPage,
  PiiReconciliationQuery,
  PiiSummary,
  PolicyDetail,
  PolicyPage,
  PolicyQuery,
  PolicySummary,
  PolicyType,
} from './governance-policies.types';

type SummaryBody = Wire<PolicySummary, 'updatedAt'>;
type DetailBody = Wire<PolicyDetail, 'updatedAt' | 'createdAt'>;
type ChangeBody = Omit<ChangeLogEntry, 'recordedAt'> & { readonly recordedAt: string };

function toSummary(body: SummaryBody): PolicySummary {
  return withDates<PolicySummary, 'updatedAt'>(body, ['updatedAt']);
}

/**
 * Cliente del gobierno de datos: políticas, bitácora de cambios y datos personales.
 * Sólo lectura. La API es la autoridad: si la sesión no puede leer, responde 403 y la
 * pantalla lo dice; ocultar el menú no es seguridad.
 *
 * Las políticas y la bitácora son de `system_ops` (`/admin/governance/*`); el
 * inventario de datos personales es del catálogo de datos (`/admin/catalog/pii/*`).
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

  /** El tipo viaja en la ruta: un id que existe en otro tipo es 404, no la política equivocada. */
  getPolicy(type: PolicyType, id: string): Observable<PolicyDetail> {
    return this.http
      .get<DetailBody>(
        apiUrl(
          this.baseUrl,
          `/admin/governance/policies/${encodeURIComponent(type)}/${encodeURIComponent(id)}`,
        ),
      )
      .pipe(
        map((body) =>
          withDates<PolicyDetail, 'updatedAt' | 'createdAt'>(body, ['updatedAt', 'createdAt']),
        ),
      );
  }

  listChangeLog(query: ChangeLogQuery = {}): Observable<ChangeLogPage> {
    return this.http
      .get<Omit<ChangeLogPage, 'items'> & { readonly items: readonly ChangeBody[] }>(
        apiUrl(this.baseUrl, '/admin/governance/change-log'),
        { params: queryParams({ ...query }) },
      )
      .pipe(
        map((page) => ({
          ...page,
          items: page.items.map((c) => ({ ...c, recordedAt: new Date(c.recordedAt) })),
        })),
      );
  }

  piiSummary(): Observable<PiiSummary> {
    return this.http.get<PiiSummary>(apiUrl(this.baseUrl, '/admin/catalog/pii/summary'));
  }

  listPiiColumns(query: PiiColumnsQuery = {}): Observable<PiiColumnsPage> {
    return this.http.get<PiiColumnsPage>(apiUrl(this.baseUrl, '/admin/catalog/pii/columns'), {
      params: queryParams({ ...query }),
    });
  }

  piiReconciliation(query: PiiReconciliationQuery = {}): Observable<PiiReconciliationPage> {
    return this.http.get<PiiReconciliationPage>(
      apiUrl(this.baseUrl, '/admin/catalog/pii/reconciliation'),
      { params: queryParams({ ...query }) },
    );
  }
}
