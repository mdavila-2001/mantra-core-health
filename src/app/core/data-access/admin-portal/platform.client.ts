import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { queryParams } from './admin-portal.wire';
import type {
  AnalyticsOverview,
  AnalyticsWindowQuery,
  BackupPolicy,
  Deployment,
  FunnelDefinition,
  FunnelReport,
  Incident,
  PipelineHealth,
  PlanDetail,
  PlanLimits,
  PlanSummary,
  Preflight,
  QaDefect,
  QaEnvironment,
  QaRunDetail,
  QaRunSummary,
  QaSuite,
  QaSuiteDetail,
  QaTarget,
  Readiness,
  SessionDetail,
  SessionsPage,
  SloStatus,
  Timeseries,
  WebVitals,
} from './platform.types';

/** Analítica de producto y RUM (`/admin/analytics`): sólo agregados calculados en el servidor. */
@Injectable({ providedIn: 'root' })
export class WebAnalyticsClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  overview(query: AnalyticsWindowQuery): Observable<AnalyticsOverview> {
    return this.http.get<AnalyticsOverview>(this.url('/admin/analytics/overview'), { params: queryParams({ ...query }) });
  }

  timeseries(query: AnalyticsWindowQuery): Observable<Timeseries> {
    return this.http.get<Timeseries>(this.url('/admin/analytics/timeseries'), { params: queryParams({ ...query }) });
  }

  webVitals(query: AnalyticsWindowQuery): Observable<WebVitals> {
    return this.http.get<WebVitals>(this.url('/admin/analytics/web-vitals'), { params: queryParams({ ...query }) });
  }

  funnels(): Observable<readonly FunnelDefinition[]> {
    return this.http.get<readonly FunnelDefinition[]>(this.url('/admin/analytics/funnels'));
  }

  funnelReport(funnelId: string, query: AnalyticsWindowQuery): Observable<FunnelReport> {
    return this.http.get<FunnelReport>(this.url(`/admin/analytics/funnels/${funnelId}/report`), {
      params: queryParams({ ...query }),
    });
  }

  pipelineHealth(query: AnalyticsWindowQuery): Observable<PipelineHealth> {
    return this.http.get<PipelineHealth>(this.url('/admin/analytics/pipeline-health'), {
      params: queryParams({ ...query }),
    });
  }

  sessions(query: AnalyticsWindowQuery & { readonly cursor?: string }): Observable<SessionsPage> {
    return this.http.get<SessionsPage>(this.url('/admin/analytics/sessions'), { params: queryParams({ ...query }) });
  }

  session(id: string): Observable<SessionDetail> {
    return this.http.get<SessionDetail>(this.url(`/admin/analytics/sessions/${id}`));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/**
 * QA Lab (`/admin/qa`): lectura del laboratorio y plano de ejecución en el
 * servidor. El navegador pide, aprueba y observa; no ejecuta nada.
 */
@Injectable({ providedIn: 'root' })
export class QaLabClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  environments(): Observable<readonly QaEnvironment[]> {
    return this.http.get<readonly QaEnvironment[]>(this.url('/admin/qa/environments'));
  }

  suites(): Observable<readonly QaSuite[]> {
    return this.http.get<readonly QaSuite[]>(this.url('/admin/qa/suites'));
  }

  suite(id: string): Observable<QaSuiteDetail> {
    return this.http.get<QaSuiteDetail>(this.url(`/admin/qa/suites/${id}`));
  }

  targets(): Observable<readonly QaTarget[]> {
    return this.http.get<readonly QaTarget[]>(this.url('/admin/qa/targets'));
  }

  runs(): Observable<readonly QaRunSummary[]> {
    return this.http.get<readonly QaRunSummary[]>(this.url('/admin/qa/runs'));
  }

  run(id: string): Observable<QaRunDetail> {
    return this.http.get<QaRunDetail>(this.url(`/admin/qa/runs/${id}`));
  }

  defects(): Observable<readonly QaDefect[]> {
    return this.http.get<readonly QaDefect[]>(this.url('/admin/qa/defects'));
  }

  plans(): Observable<readonly PlanSummary[]> {
    return this.http.get<readonly PlanSummary[]>(this.url('/admin/qa/plans'));
  }

  plan(id: string): Observable<PlanDetail> {
    return this.http.get<PlanDetail>(this.url(`/admin/qa/plans/${id}`));
  }

  /** Dry-run: explica el plan sin llamar a nada. */
  preflight(suiteId: string, environmentId: string, limits?: Partial<PlanLimits>): Observable<Preflight> {
    return this.http.post<Preflight>(this.url('/admin/qa/plans/preflight'), {
      suiteId,
      environmentId,
      ...(limits ? { limits } : {}),
    });
  }

  createPlan(
    suiteId: string,
    environmentId: string,
    idempotencyKey: string,
    limits?: Partial<PlanLimits>,
  ): Observable<PlanDetail & { readonly created: boolean }> {
    return this.http.post<PlanDetail & { readonly created: boolean }>(
      this.url('/admin/qa/plans'),
      { suiteId, environmentId, ...(limits ? { limits } : {}) },
      { headers: new HttpHeaders({ 'Idempotency-Key': idempotencyKey }) },
    );
  }

  /** La aprobación va sobre el hash revisado; si el plan cambió, el servidor la rechaza. */
  approve(
    planId: string,
    input: { readonly decision: 'APPROVED' | 'REJECTED'; readonly planHash: string; readonly reason: string; readonly expiresInMinutes?: number },
  ): Observable<PlanDetail> {
    return this.http.post<PlanDetail>(this.url(`/admin/qa/plans/${planId}/approvals`), input);
  }

  cancel(planId: string): Observable<PlanDetail> {
    return this.http.post<PlanDetail>(this.url(`/admin/qa/plans/${planId}/cancel`), null);
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** Consola de operación (`/admin/ops`): sólo lectura. */
@Injectable({ providedIn: 'root' })
export class OpsConsoleClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  readiness(): Observable<Readiness> {
    return this.http.get<Readiness>(this.url('/admin/ops/readiness'));
  }

  incidents(open = false): Observable<readonly Incident[]> {
    return this.http.get<readonly Incident[]>(this.url('/admin/ops/incidents'), {
      params: queryParams({ open: open ? true : undefined }),
    });
  }

  deployments(): Observable<readonly Deployment[]> {
    return this.http.get<readonly Deployment[]>(this.url('/admin/ops/deployments'));
  }

  slos(): Observable<readonly SloStatus[]> {
    return this.http.get<readonly SloStatus[]>(this.url('/admin/ops/slos'));
  }

  backups(): Observable<readonly BackupPolicy[]> {
    return this.http.get<readonly BackupPolicy[]>(this.url('/admin/ops/backups'));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
