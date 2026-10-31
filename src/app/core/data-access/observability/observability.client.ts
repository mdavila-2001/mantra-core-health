import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from '../admin-portal/admin-portal.wire';
import type {
  ChangeErrorGroupState,
  EndpointsQuery,
  ErrorEventsPage,
  ErrorEventsQuery,
  ErrorGroup,
  ErrorGroupDetail,
  ErrorGroupsPage,
  ErrorGroupsQuery,
  ObsCoverage,
  ObsEndpointsPage,
  ObsModules,
  ObsPageQuery,
  ObsSummary,
  ObsTimeseries,
  ObsWindowQuery,
  RequestTrace,
  SlowRequestsPage,
  SqlStatementDetail,
  SqlStatementsPage,
  SqlStatementsQuery,
  TimeseriesQuery,
} from './observability.types';

/**
 * Lectura de la observabilidad del sistema (`/admin/observability/*`). Sin lógica de presentación: cada
 * método es una petición y devuelve el cuerpo tal cual lo publica la API. Sin `X-Tenant-Id`: es alcance de
 * plataforma (la API decide por el rol; ocultar una pantalla aquí no autoriza nada).
 */
@Injectable({ providedIn: 'root' })
export class ObservabilityClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  summary(query: ObsWindowQuery): Observable<ObsSummary> {
    return this.get('/summary', query);
  }

  timeseries(query: TimeseriesQuery): Observable<ObsTimeseries> {
    return this.get('/timeseries', query);
  }

  endpoints(query: EndpointsQuery): Observable<ObsEndpointsPage> {
    return this.get('/endpoints', query);
  }

  modules(query: ObsWindowQuery): Observable<ObsModules> {
    return this.get('/modules', query);
  }

  coverage(query: ObsWindowQuery): Observable<ObsCoverage> {
    return this.get('/coverage', query);
  }

  errorGroups(query: ErrorGroupsQuery): Observable<ErrorGroupsPage> {
    return this.get('/errors/groups', query);
  }

  errorGroup(id: string, query: ObsWindowQuery = {}): Observable<ErrorGroupDetail> {
    return this.get(`/errors/groups/${encodeURIComponent(id)}`, query);
  }

  /** Cambia el estado de un grupo. Resolver o ignorar exige `note`; un 409 dice que la fila cambió. */
  changeErrorGroupState(id: string, cambio: ChangeErrorGroupState): Observable<ErrorGroup> {
    return this.http.patch<ErrorGroup>(this.url(`/errors/groups/${encodeURIComponent(id)}`), cambio);
  }

  errorEvents(query: ErrorEventsQuery): Observable<ErrorEventsPage> {
    return this.get('/errors/events', query);
  }

  /** Qué se guardó de una petición por su `requestId`. `found: false` NO es un error HTTP. */
  request(requestId: string): Observable<RequestTrace> {
    return this.get(`/requests/${encodeURIComponent(requestId)}`, {});
  }

  sqlStatements(query: SqlStatementsQuery): Observable<SqlStatementsPage> {
    return this.get('/sql/statements', query);
  }

  sqlStatement(hash: string, query: ObsWindowQuery = {}): Observable<SqlStatementDetail> {
    return this.get(`/sql/statements/${encodeURIComponent(hash)}`, query);
  }

  sqlSlow(query: ObsPageQuery): Observable<SlowRequestsPage> {
    return this.get('/sql/slow', query);
  }

  private get<T>(path: string, query: object): Observable<T> {
    return this.http.get<T>(this.url(path), {
      params: queryParams(query as Readonly<Record<string, string | number | boolean | undefined | null>>),
    });
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, `/admin/observability${path}`);
  }
}
